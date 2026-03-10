import type { Sentiment, SnapshotDiff } from '@stockwatch/shared';

export interface SnapshotRow {
  id: number;
  symbol: string;
  createdAt: Date;
  sentiment: string;
  price: number | null;
  peRatio: number | null;
  marketCap: number | null;
}

function deltaPct(prev: number | null, curr: number | null): number | null {
  if (prev == null || curr == null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export function computeDiff(previous: SnapshotRow, current: SnapshotRow): SnapshotDiff {
  const prevSentiment = previous.sentiment as Sentiment;
  const currSentiment = current.sentiment as Sentiment;
  const sentimentChanged = prevSentiment !== currSentiment;

  let driftLevel: 'none' | 'minor' | 'significant' = 'none';
  if (sentimentChanged) {
    const isFlip =
      (prevSentiment === 'Bullish' && currSentiment === 'Bearish') ||
      (prevSentiment === 'Bearish' && currSentiment === 'Bullish');
    driftLevel = isFlip ? 'significant' : 'minor';
  }

  return {
    symbol: current.symbol,
    previousSnapshotId: previous.id,
    currentSnapshotId: current.id,
    previousDate: previous.createdAt.toISOString(),
    currentDate: current.createdAt.toISOString(),
    previousSentiment: prevSentiment,
    currentSentiment: currSentiment,
    sentimentChanged,
    driftLevel,
    priceDeltaPct: deltaPct(previous.price, current.price),
    peRatioDelta:
      previous.peRatio != null && current.peRatio != null
        ? current.peRatio - previous.peRatio
        : null,
    marketCapDeltaPct: deltaPct(previous.marketCap, current.marketCap),
  };
}
