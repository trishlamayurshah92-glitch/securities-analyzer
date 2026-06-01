import type { Sentiment, StructuredStockAnalysisV1 } from '@stockwatch/shared';
import { StructuredStockAnalysisV1Schema } from '@stockwatch/shared';
import { logger } from './logger.js';

export interface ParsedSnapshot {
  symbol: string;
  sentiment: Sentiment;
  reportText: string;
  companyName: string | null;
  price: number | null;
  peRatio: number | null;
  marketCap: number | null;
  beta: number | null;
  week52High: number | null;
  week52Low: number | null;
  dividendYield: number | null;
}

function parseMarketCap(raw: string): number | null {
  const m = raw.match(/\$?([\d.]+)\s*([BMTbmt])?/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (isNaN(n)) return null;
  const suffix = (m[2] ?? '').toUpperCase();
  if (suffix === 'T') return n * 1e12;
  if (suffix === 'B') return n * 1e9;
  if (suffix === 'M') return n * 1e6;
  return n;
}

function tableValue(section: string, label: string): string | null {
  // Matches: | Label | value | (with optional whitespace)
  const re = new RegExp(`\\|\\s*${label}\\s*\\|\\s*([^|]+?)\\s*\\|`, 'i');
  const m = section.match(re);
  return m ? m[1].trim() : null;
}

function parseFloat2(s: string | null): number | null {
  if (s === null) return null;
  const n = parseFloat(s.replace(/[$,%]/g, ''));
  return isNaN(n) ? null : n;
}

export function parseSnapshotsFromReport(report: string, symbols: string[]): ParsedSnapshot[] {
  const results: ParsedSnapshot[] = [];

  for (const sym of symbols) {
    // Find the section starting with ### SYM (case-insensitive)
    const sectionRe = new RegExp(
      `###\\s+${sym}\\b([\\s\\S]*?)(?=\\n###\\s+[A-Z]|$)`,
      'i',
    );
    const sectionMatch = report.match(sectionRe);
    if (!sectionMatch) continue;

    const section = sectionMatch[0];
    const reportText = section.trim();

    // Company name from header: ### SYMBOL - Company Name
    const headerMatch = section.match(/###\s+\S+\s+-\s+(.+)/);
    const companyName = headerMatch ? headerMatch[1].trim() : null;

    // Sentiment
    const sentimentMatch = section.match(/\*\*Sentiment:\*\*\s*(Bullish|Bearish|Neutral|Mixed)/i);
    const sentiment: Sentiment = (sentimentMatch?.[1] as Sentiment) ?? 'Neutral';

    // Price
    const priceRaw = tableValue(section, 'Price');
    const price = parseFloat2(priceRaw);

    // P/E Ratio
    const peRaw = tableValue(section, 'P/E Ratio');
    const peRatio = parseFloat2(peRaw);

    // Market Cap
    const mcRaw = tableValue(section, 'Market Cap');
    const marketCap = mcRaw ? parseMarketCap(mcRaw) : null;

    // 52-Week Range: "$X - $Y"
    const rangeRaw = tableValue(section, '52-Week Range');
    let week52High: number | null = null;
    let week52Low: number | null = null;
    if (rangeRaw) {
      const parts = rangeRaw.split('-').map((p) => parseFloat(p.replace(/[$,\s]/g, '')));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        week52Low = parts[0];
        week52High = parts[1];
      }
    }

    // Dividend Yield: "X.X%" → store as decimal
    const dyRaw = tableValue(section, 'Dividend Yield');
    let dividendYield: number | null = null;
    if (dyRaw) {
      const dyNum = parseFloat(dyRaw.replace('%', ''));
      dividendYield = isNaN(dyNum) ? null : dyNum / 100;
    }

    results.push({
      symbol: sym.toUpperCase(),
      sentiment,
      reportText,
      companyName,
      price,
      peRatio,
      marketCap,
      beta: null, // not in report table
      week52High,
      week52Low,
      dividendYield,
    });
  }

  return results;
}

export interface EnrichedSnapshot {
  symbol: string;
  structuredData: StructuredStockAnalysisV1 | null;
  reportText: string;
  renderedMarkdown: string;
  sentiment: Sentiment;
  companyName: string | null;
  price: number | null;
  peRatio: number | null;
  marketCap: number | null;
  beta: number | null;
  week52High: number | null;
  week52Low: number | null;
  dividendYield: number | null;
  eps: number | null;
}

export function buildEnrichedSnapshots(
  structuredPayloads: Map<string, unknown>,
  report: string,
  symbols: string[],
): EnrichedSnapshot[] {
  const results: EnrichedSnapshot[] = [];

  for (const sym of symbols) {
    // Extract the per-stock markdown section
    const sectionRe = new RegExp(
      `###\\s+${sym}\\b([\\s\\S]*?)(?=\\n###\\s+[A-Z]|$)`,
      'i',
    );
    const sectionMatch = report.match(sectionRe);
    const markdownSection = sectionMatch ? sectionMatch[0].trim() : '';

    const rawPayload = structuredPayloads.get(sym.toUpperCase());
    const parsed = StructuredStockAnalysisV1Schema.safeParse(rawPayload);

    if (parsed.success) {
      const d = parsed.data;
      results.push({
        symbol: sym.toUpperCase(),
        structuredData: d,
        reportText: markdownSection,
        renderedMarkdown: markdownSection,
        sentiment: d.sentiment,
        companyName: d.companyName,
        price: d.price,
        peRatio: d.peRatio,
        marketCap: d.marketCap,
        beta: d.beta,
        week52High: d.week52High,
        week52Low: d.week52Low,
        dividendYield: d.dividendYield,
        eps: d.eps,
      });
    } else {
      if (rawPayload !== undefined) {
        logger.warn('enriched_snapshot_fallback', {
          symbol: sym,
          reason: 'invalid structured payload',
        });
      }
      // Fall back to regex parsing
      const legacy = parseSnapshotsFromReport(report, [sym]);
      const leg = legacy[0];
      if (leg) {
        results.push({
          symbol: leg.symbol,
          structuredData: null,
          reportText: leg.reportText,
          renderedMarkdown: leg.reportText,
          sentiment: leg.sentiment,
          companyName: leg.companyName,
          price: leg.price,
          peRatio: leg.peRatio,
          marketCap: leg.marketCap,
          beta: leg.beta,
          week52High: leg.week52High,
          week52Low: leg.week52Low,
          dividendYield: leg.dividendYield,
          eps: null,
        });
      } else {
        // Symbol not found in report at all — still emit a minimal entry
        results.push({
          symbol: sym.toUpperCase(),
          structuredData: null,
          reportText: markdownSection,
          renderedMarkdown: markdownSection,
          sentiment: 'Neutral',
          companyName: null,
          price: null,
          peRatio: null,
          marketCap: null,
          beta: null,
          week52High: null,
          week52Low: null,
          dividendYield: null,
          eps: null,
        });
      }
    }
  }

  return results;
}
