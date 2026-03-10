import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from './db.js';
import type { TrendPoint } from '@stockwatch/shared';

const googleApiKey =
  process.env.GEMINI_API_KEY ??
  process.env.GOOGLE_API_KEY ??
  process.env.OPENAI_API_KEY ??
  '';

if (!googleApiKey) {
  console.warn('[vector-store] WARNING: No Google API key found (GEMINI_API_KEY / GOOGLE_API_KEY) — embeddings will fail');
}

const genAI = new GoogleGenerativeAI(googleApiKey);

export async function embed(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
  const result = await model.embedContent(text.slice(0, 8000));
  return result.embedding.values;
}

const SECTION_HEADERS: { key: string; header: string }[] = [
  { key: 'summary',    header: '**Summary:**' },
  { key: 'bull_case',  header: '**Bull Case:**' },
  { key: 'bear_case',  header: '**Bear Case:**' },
  { key: 'risks',      header: '**Risks:**' },
  { key: 'catalysts',  header: '**Catalysts:**' },
  { key: 'valuation',  header: '**Valuation:**' },
  { key: 'conclusion', header: '**Conclusion:**' },
];

export function chunkReport(text: string): { section: string; text: string }[] {
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headerPattern = SECTION_HEADERS.map(({ header }) => escapeRegex(header)).join('|');
  const pattern = new RegExp(`(${headerPattern})`, 'g');
  const parts = text.split(pattern);

  const chunks: { section: string; text: string }[] = [];
  // parts: [pre-text, header, body, header, body, ...]
  for (let i = 1; i < parts.length - 1; i += 2) {
    const headerStr = parts[i];
    const body = parts[i + 1]?.trim() ?? '';
    const def = SECTION_HEADERS.find(({ header }) => header === headerStr);
    if (def && body.length > 0) {
      chunks.push({ section: def.key, text: `${headerStr}\n${body}` });
    }
  }
  return chunks;
}

async function storeEmbeddingWithSection(
  userId: string,
  snapshotId: number,
  symbol: string,
  text: string,
  section: string | null,
): Promise<void> {
  let embedding: number[];
  try {
    embedding = await embed(text);
  } catch (e) {
    console.error(`[vector-store] embed failed for section=${section} symbol=${symbol}:`, e);
    throw e;
  }
  await prisma.$executeRaw`
    INSERT INTO "AnalysisEmbedding" ("userId", "snapshotId", symbol, section, text, embedding)
    VALUES (${userId}, ${snapshotId}, ${symbol.toUpperCase()}, ${section}, ${text}, ${JSON.stringify(embedding)}::vector)
  `;
}

export async function storeEmbedding(
  userId: string,
  snapshotId: number,
  symbol: string,
  text: string,
): Promise<void> {
  await storeEmbeddingWithSection(userId, snapshotId, symbol, text, null);
}

export interface StoreAnalysisOptions {
  company_name?: string | null;
  pe_ratio?: number | null;
  market_cap?: number | null;
  beta?: number | null;
  week_52_high?: number | null;
  week_52_low?: number | null;
  dividend_yield?: number | null;
}

export async function storeAnalysis(
  userId: string,
  symbol: string,
  analysisText: string,
  sentiment: string,
  price?: number | null,
  extra?: StoreAnalysisOptions,
): Promise<{ status: string; id?: string; message?: string }> {
  const sym = symbol.toUpperCase().trim();

  let snap: { id: number };
  try {
    snap = await prisma.analysisSnapshot.create({
      data: {
        userId,
        symbol: sym,
        sentiment,
        reportText: analysisText,
        modelUsed: 'mcp-tool',
        price: price ?? null,
        peRatio: extra?.pe_ratio ?? null,
        marketCap: extra?.market_cap ?? null,
        beta: extra?.beta ?? null,
        week52High: extra?.week_52_high ?? null,
        week52Low: extra?.week_52_low ?? null,
        dividendYield: extra?.dividend_yield ?? null,
        companyName: extra?.company_name ?? null,
      },
    });
  } catch (e) {
    console.error('[vector-store] Failed to create AnalysisSnapshot:', e);
    return { status: 'error', message: String(e) };
  }

  // Embeddings are best-effort — failure here must not hide the snapshot
  try {
    const chunks = chunkReport(analysisText);
    if (chunks.length > 0) {
      await Promise.all(
        chunks.map(({ section, text }) =>
          storeEmbeddingWithSection(userId, snap.id, sym, text, section)
        )
      );
      console.log(`[vector-store] Stored ${chunks.length} embedding chunks for ${sym}`);
    } else {
      // Fallback for reports without new section headers (backward compat)
      await storeEmbedding(userId, snap.id, sym, analysisText.slice(0, 1000));
      console.log(`[vector-store] Stored 1 fallback embedding for ${sym}`);
    }
  } catch (embedErr) {
    console.error(`[vector-store] Embedding failed for ${sym} (snapshot ${snap.id} was saved):`, embedErr);
    // Non-fatal — snapshot is already saved, dashboard columns will still populate
  }

  return { status: 'stored', id: String(snap.id) };
}

export interface HistoryMatch {
  score: number;
  date: string;
  sentiment: string;
  price: number | null;
  text: string;
  section: string | null;
  company_name?: string | null;
  pe_ratio?: number | null;
  market_cap?: number | null;
  beta?: number | null;
  week_52_high?: number | null;
  week_52_low?: number | null;
  dividend_yield?: number | null;
}

interface RawEmbeddingRow {
  symbol: string;
  text: string;
  section: string | null;
  distance: number;
  sentiment: string;
  price: number | null;
  createdAt: Date;
  companyName: string | null;
  peRatio: number | null;
  marketCap: number | null;
  beta: number | null;
  week52High: number | null;
  week52Low: number | null;
  dividendYield: number | null;
}

export async function searchHistory(
  userId: string,
  symbol: string,
  query: string,
  topK: number = 5,
  section?: string | null,
): Promise<HistoryMatch[]> {
  try {
    const queryEmbedding = await embed(query);
    const sym = symbol.toUpperCase().trim();

    const results = section
      ? await prisma.$queryRaw<RawEmbeddingRow[]>`
          SELECT ae.symbol, ae.text, ae.section,
            (ae.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) AS distance,
            s.sentiment, s.price, s."createdAt", s."companyName",
            s."peRatio", s."marketCap", s.beta, s."week52High", s."week52Low", s."dividendYield"
          FROM "AnalysisEmbedding" ae
          JOIN "AnalysisSnapshot" s ON ae."snapshotId" = s.id
          WHERE ae."userId" = ${userId} AND ae.symbol = ${sym} AND ae.section = ${section}
          ORDER BY distance ASC LIMIT ${topK}`
      : await prisma.$queryRaw<RawEmbeddingRow[]>`
          SELECT ae.symbol, ae.text, ae.section,
            (ae.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) AS distance,
            s.sentiment, s.price, s."createdAt", s."companyName",
            s."peRatio", s."marketCap", s.beta, s."week52High", s."week52Low", s."dividendYield"
          FROM "AnalysisEmbedding" ae
          JOIN "AnalysisSnapshot" s ON ae."snapshotId" = s.id
          WHERE ae."userId" = ${userId} AND ae.symbol = ${sym}
          ORDER BY distance ASC LIMIT ${topK}`;

    return results.map((row) => ({
      score: 1 - Number(row.distance),
      date: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      sentiment: row.sentiment,
      price: row.price != null ? Number(row.price) : null,
      text: row.text,
      section: row.section ?? null,
      company_name: row.companyName,
      pe_ratio: row.peRatio != null ? Number(row.peRatio) : null,
      market_cap: row.marketCap != null ? Number(row.marketCap) : null,
      beta: row.beta != null ? Number(row.beta) : null,
      week_52_high: row.week52High != null ? Number(row.week52High) : null,
      week_52_low: row.week52Low != null ? Number(row.week52Low) : null,
      dividend_yield: row.dividendYield != null ? Number(row.dividendYield) : null,
    }));
  } catch {
    return [];
  }
}

export async function getSentimentTrend(
  userId: string,
  symbol: string,
  days: number = 30,
): Promise<TrendPoint[]> {
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const snapshots = await prisma.analysisSnapshot.findMany({
      where: {
        userId,
        symbol: symbol.toUpperCase().trim(),
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, sentiment: true, price: true },
    });

    return snapshots.map((s) => ({
      date: s.createdAt.toISOString(),
      sentiment: s.sentiment,
      price: s.price != null ? Number(s.price) : null,
    }));
  } catch {
    return [];
  }
}
