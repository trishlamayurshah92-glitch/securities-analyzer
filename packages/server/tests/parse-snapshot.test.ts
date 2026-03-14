import { describe, it, expect } from 'vitest';
import { parseSnapshotsFromReport } from '../src/lib/parse-snapshot.js';

const makeReport = (symbol: string, overrides?: Record<string, string>) => {
  const sentiment = overrides?.sentiment ?? 'Bullish';
  const company = overrides?.company ?? 'Apple Inc.';
  const price = overrides?.price ?? '$182.50';
  const pe = overrides?.pe ?? '28.10';
  const mc = overrides?.mc ?? '$2.80T';
  const range = overrides?.range ?? '$124.00 - $199.00';
  const dy = overrides?.dy ?? '0.55%';
  return `
### ${symbol} - ${company}

**Sentiment:** ${sentiment}

| Metric | Value |
|---|---|
| Price | ${price} |
| P/E Ratio | ${pe} |
| Market Cap | ${mc} |
| 52-Week Range | ${range} |
| Dividend Yield | ${dy} |
`;
};

describe('parseSnapshotsFromReport', () => {
  it('parses Bullish sentiment', () => {
    const report = makeReport('AAPL');
    const [snap] = parseSnapshotsFromReport(report, ['AAPL']);
    expect(snap.sentiment).toBe('Bullish');
  });

  it('parses Bearish sentiment', () => {
    const report = makeReport('AAPL', { sentiment: 'Bearish' });
    const [snap] = parseSnapshotsFromReport(report, ['AAPL']);
    expect(snap.sentiment).toBe('Bearish');
  });

  it('parses Neutral sentiment', () => {
    const report = makeReport('AAPL', { sentiment: 'Neutral' });
    const [snap] = parseSnapshotsFromReport(report, ['AAPL']);
    expect(snap.sentiment).toBe('Neutral');
  });

  it('parses Mixed sentiment', () => {
    const report = makeReport('AAPL', { sentiment: 'Mixed' });
    const [snap] = parseSnapshotsFromReport(report, ['AAPL']);
    expect(snap.sentiment).toBe('Mixed');
  });

  it('parses company name from section header', () => {
    const report = makeReport('AAPL');
    const [snap] = parseSnapshotsFromReport(report, ['AAPL']);
    expect(snap.companyName).toBe('Apple Inc.');
  });

  it('parses price from Fundamentals table', () => {
    const report = makeReport('AAPL', { price: '$182.50' });
    const [snap] = parseSnapshotsFromReport(report, ['AAPL']);
    expect(snap.price).toBe(182.5);
  });

  it('parses PE ratio from Fundamentals table', () => {
    const report = makeReport('AAPL', { pe: '28.10' });
    const [snap] = parseSnapshotsFromReport(report, ['AAPL']);
    expect(snap.peRatio).toBe(28.1);
  });

  it('parses market cap in trillions', () => {
    const report = makeReport('AAPL', { mc: '$2.80T' });
    const [snap] = parseSnapshotsFromReport(report, ['AAPL']);
    expect(snap.marketCap).toBe(2.8e12);
  });

  it('parses market cap in billions', () => {
    const report = makeReport('AAPL', { mc: '$500B' });
    const [snap] = parseSnapshotsFromReport(report, ['AAPL']);
    expect(snap.marketCap).toBe(500e9);
  });

  it('parses 52-week range → high/low', () => {
    const report = makeReport('AAPL', { range: '$124.00 - $199.00' });
    const [snap] = parseSnapshotsFromReport(report, ['AAPL']);
    expect(snap.week52High).toBe(199);
    expect(snap.week52Low).toBe(124);
  });

  it('parses dividend yield "0.55%" → 0.0055', () => {
    const report = makeReport('AAPL', { dy: '0.55%' });
    const [snap] = parseSnapshotsFromReport(report, ['AAPL']);
    expect(snap.dividendYield).toBeCloseTo(0.0055);
  });

  it('beta is always null (not in report table)', () => {
    const report = makeReport('AAPL');
    const [snap] = parseSnapshotsFromReport(report, ['AAPL']);
    expect(snap.beta).toBeNull();
  });

  it('multiple symbols returns one ParsedSnapshot per symbol', () => {
    const report = makeReport('AAPL') + '\n' + makeReport('NVDA', { company: 'Nvidia Corp' });
    const snaps = parseSnapshotsFromReport(report, ['AAPL', 'NVDA']);
    expect(snaps).toHaveLength(2);
    expect(snaps[0].symbol).toBe('AAPL');
    expect(snaps[1].symbol).toBe('NVDA');
  });

  it('symbol not found in report → returns empty array', () => {
    const report = makeReport('AAPL');
    const snaps = parseSnapshotsFromReport(report, ['TSLA']);
    expect(snaps).toHaveLength(0);
  });

  it('missing optional fields → nulls not errors', () => {
    const report = `
### AAPL - Apple Inc.

**Sentiment:** Bullish
`;
    const [snap] = parseSnapshotsFromReport(report, ['AAPL']);
    expect(snap.peRatio).toBeNull();
    expect(snap.price).toBeNull();
    expect(snap.marketCap).toBeNull();
  });

  it('uppercases symbol on result', () => {
    const report = makeReport('aapl');
    const [snap] = parseSnapshotsFromReport(report, ['aapl']);
    expect(snap.symbol).toBe('AAPL');
  });
});
