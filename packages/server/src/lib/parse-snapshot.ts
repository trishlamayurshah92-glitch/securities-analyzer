import type { Sentiment } from '@stockwatch/shared';

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
