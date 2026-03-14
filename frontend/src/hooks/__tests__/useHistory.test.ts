import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useHistory } from '../useHistory';

const mockGetHistory = vi.fn();
const mockGetTrend = vi.fn();
const mockGetSnapshotDiff = vi.fn();

vi.mock('../../api/client', () => ({
  api: {
    getHistory: (...args: unknown[]) => mockGetHistory(...args),
    getTrend: (...args: unknown[]) => mockGetTrend(...args),
    getSnapshotDiff: (...args: unknown[]) => mockGetSnapshotDiff(...args),
  },
}));

const historyItems = [{ score: 0.9, date: '2024-01-01', sentiment: 'Bullish', price: 180, text: 'Good' }];
const trendItems = [{ date: '2024-01-01', sentiment: 'Bullish', price: 180 }];
const diffItem = { symbol: 'AAPL', driftLevel: 'minor', sentimentChanged: true, previousSnapshotId: 1, currentSnapshotId: 2, previousDate: '2024-01-01', currentDate: '2024-01-08', previousSentiment: 'Bullish', currentSentiment: 'Neutral', priceDeltaPct: -2, peRatioDelta: null, marketCapDeltaPct: null };

describe('useHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchHistory calls getHistory, getTrend, getSnapshotDiff in parallel', async () => {
    mockGetHistory.mockResolvedValue(historyItems);
    mockGetTrend.mockResolvedValue(trendItems);
    mockGetSnapshotDiff.mockResolvedValue(diffItem);

    const { result } = renderHook(() => useHistory());
    await act(() => result.current.fetchHistory('AAPL'));

    expect(mockGetHistory).toHaveBeenCalledWith('AAPL', undefined);
    expect(mockGetTrend).toHaveBeenCalledWith('AAPL');
    expect(mockGetSnapshotDiff).toHaveBeenCalledWith('AAPL');
  });

  it('sets history, trend, diff from API responses', async () => {
    mockGetHistory.mockResolvedValue(historyItems);
    mockGetTrend.mockResolvedValue(trendItems);
    mockGetSnapshotDiff.mockResolvedValue(diffItem);

    const { result } = renderHook(() => useHistory());
    await act(() => result.current.fetchHistory('AAPL'));

    expect(result.current.history).toEqual(historyItems);
    expect(result.current.trend).toEqual(trendItems);
    expect(result.current.diff).toEqual(diffItem);
  });

  it('loading=true during fetch, false after', async () => {
    let resolveAll!: () => void;
    const p = new Promise<void>((r) => { resolveAll = r; });
    mockGetHistory.mockReturnValue(p.then(() => historyItems));
    mockGetTrend.mockReturnValue(p.then(() => trendItems));
    mockGetSnapshotDiff.mockReturnValue(p.then(() => diffItem));

    const { result } = renderHook(() => useHistory());

    act(() => { result.current.fetchHistory('AAPL'); });
    expect(result.current.loading).toBe(true);

    act(() => resolveAll());
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('404 on getSnapshotDiff → diff=null, no error', async () => {
    mockGetHistory.mockResolvedValue(historyItems);
    mockGetTrend.mockResolvedValue(trendItems);
    mockGetSnapshotDiff.mockRejectedValue(new Error('Not Found'));

    const { result } = renderHook(() => useHistory());
    await act(() => result.current.fetchHistory('AAPL'));

    expect(result.current.diff).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('getHistory throwing → error set', async () => {
    mockGetHistory.mockRejectedValue(new Error('history failed'));
    mockGetTrend.mockResolvedValue(trendItems);
    mockGetSnapshotDiff.mockResolvedValue(diffItem);

    const { result } = renderHook(() => useHistory());
    await act(() => result.current.fetchHistory('AAPL'));

    expect(result.current.error).toBe('history failed');
    expect(result.current.history).toEqual([]);
  });
});
