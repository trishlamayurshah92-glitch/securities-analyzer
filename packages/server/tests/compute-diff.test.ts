import { describe, it, expect } from 'vitest';
import { computeDiff, type SnapshotRow } from '../src/lib/compute-diff.js';

function makeRow(overrides: Partial<SnapshotRow> & { id: number }): SnapshotRow {
  return {
    symbol: 'AAPL',
    createdAt: new Date('2024-01-01'),
    sentiment: 'Bullish',
    price: 190,
    peRatio: 28,
    marketCap: 2.9e12,
    ...overrides,
  };
}

describe('computeDiff', () => {
  it('Bullish → Bearish flip → driftLevel === "significant"', () => {
    const prev = makeRow({ id: 1, sentiment: 'Bullish' });
    const curr = makeRow({ id: 2, sentiment: 'Bearish', createdAt: new Date('2024-01-08') });
    const diff = computeDiff(prev, curr);
    expect(diff.sentimentChanged).toBe(true);
    expect(diff.driftLevel).toBe('significant');
  });

  it('Bearish → Bullish flip → driftLevel === "significant"', () => {
    const prev = makeRow({ id: 1, sentiment: 'Bearish' });
    const curr = makeRow({ id: 2, sentiment: 'Bullish', createdAt: new Date('2024-01-08') });
    const diff = computeDiff(prev, curr);
    expect(diff.sentimentChanged).toBe(true);
    expect(diff.driftLevel).toBe('significant');
  });

  it('Bullish → Neutral change → driftLevel === "minor"', () => {
    const prev = makeRow({ id: 1, sentiment: 'Bullish' });
    const curr = makeRow({ id: 2, sentiment: 'Neutral', createdAt: new Date('2024-01-08') });
    const diff = computeDiff(prev, curr);
    expect(diff.sentimentChanged).toBe(true);
    expect(diff.driftLevel).toBe('minor');
  });

  it('Same sentiment → driftLevel === "none", sentimentChanged: false', () => {
    const prev = makeRow({ id: 1, sentiment: 'Bullish' });
    const curr = makeRow({ id: 2, sentiment: 'Bullish', createdAt: new Date('2024-01-08') });
    const diff = computeDiff(prev, curr);
    expect(diff.sentimentChanged).toBe(false);
    expect(diff.driftLevel).toBe('none');
  });

  it('priceDeltaPct calculated correctly: 190→171 ≈ -10%', () => {
    const prev = makeRow({ id: 1, price: 190 });
    const curr = makeRow({ id: 2, price: 171, createdAt: new Date('2024-01-08') });
    const diff = computeDiff(prev, curr);
    expect(diff.priceDeltaPct).toBeCloseTo(-10, 0);
  });

  it('priceDeltaPct is null when either price is null', () => {
    const prev = makeRow({ id: 1, price: null });
    const curr = makeRow({ id: 2, price: 171, createdAt: new Date('2024-01-08') });
    const diff = computeDiff(prev, curr);
    expect(diff.priceDeltaPct).toBeNull();
  });

  it('priceDeltaPct is null when current price is null', () => {
    const prev = makeRow({ id: 1, price: 190 });
    const curr = makeRow({ id: 2, price: null, createdAt: new Date('2024-01-08') });
    const diff = computeDiff(prev, curr);
    expect(diff.priceDeltaPct).toBeNull();
  });

  it('peRatioDelta calculated as absolute difference: 28 - 25 = 3', () => {
    const prev = makeRow({ id: 1, peRatio: 25 });
    const curr = makeRow({ id: 2, peRatio: 28, createdAt: new Date('2024-01-08') });
    const diff = computeDiff(prev, curr);
    expect(diff.peRatioDelta).toBe(3);
  });

  it('peRatioDelta is null when either PE is null', () => {
    const prev = makeRow({ id: 1, peRatio: null });
    const curr = makeRow({ id: 2, peRatio: 28, createdAt: new Date('2024-01-08') });
    const diff = computeDiff(prev, curr);
    expect(diff.peRatioDelta).toBeNull();
  });

  it('marketCapDeltaPct calculated as percentage', () => {
    const prev = makeRow({ id: 1, marketCap: 2e12 });
    const curr = makeRow({ id: 2, marketCap: 2.2e12, createdAt: new Date('2024-01-08') });
    const diff = computeDiff(prev, curr);
    expect(diff.marketCapDeltaPct).toBeCloseTo(10, 1);
  });

  it('returns correct symbol, previousSnapshotId, currentSnapshotId', () => {
    const prev = makeRow({ id: 1, symbol: 'AAPL' });
    const curr = makeRow({ id: 2, symbol: 'AAPL', createdAt: new Date('2024-01-08') });
    const diff = computeDiff(prev, curr);
    expect(diff.symbol).toBe('AAPL');
    expect(diff.previousSnapshotId).toBe(1);
    expect(diff.currentSnapshotId).toBe(2);
  });
});
