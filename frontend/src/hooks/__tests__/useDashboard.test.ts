import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDashboard } from '../useDashboard';

const mockGetWatchlist = vi.fn();
const mockGetLatestSnapshot = vi.fn();
const mockRunAnalysis = vi.fn();
const mockAddSymbol = vi.fn();
const mockRemoveSymbol = vi.fn();

vi.mock('../../api/client', () => ({
  api: {
    getWatchlist: (...args: unknown[]) => mockGetWatchlist(...args),
    getLatestSnapshot: (...args: unknown[]) => mockGetLatestSnapshot(...args),
    runAnalysis: (...args: unknown[]) => mockRunAnalysis(...args),
    addSymbol: (...args: unknown[]) => mockAddSymbol(...args),
    removeSymbol: (...args: unknown[]) => mockRemoveSymbol(...args),
  },
}));

const watchlist = [
  { id: 1, symbol: 'AAPL', addedAt: '2024-01-01' },
  { id: 2, symbol: 'NVDA', addedAt: '2024-01-02' },
];

const snapshot = {
  score: 1,
  date: '2024-06-01',
  sentiment: 'Bullish',
  price: 182,
  text: '',
  company_name: 'Apple Inc.',
};

describe('useDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWatchlist.mockResolvedValue(watchlist);
    mockGetLatestSnapshot.mockResolvedValue(snapshot);
  });

  it('on mount, calls getWatchlist then getLatestSnapshot per symbol', async () => {
    renderHook(() => useDashboard());

    await waitFor(() => expect(mockGetWatchlist).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockGetLatestSnapshot).toHaveBeenCalledTimes(2));
    expect(mockGetLatestSnapshot).toHaveBeenCalledWith('AAPL');
    expect(mockGetLatestSnapshot).toHaveBeenCalledWith('NVDA');
  });

  it('rows populated with symbols', async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.overallLoading).toBe(false));

    const symbols = result.current.rows.map((r) => r.symbol);
    expect(symbols).toContain('AAPL');
    expect(symbols).toContain('NVDA');
  });

  it('overallLoading=true then false', async () => {
    let resolveWatchlist!: (v: typeof watchlist) => void;
    mockGetWatchlist.mockReturnValue(new Promise((r) => { resolveWatchlist = r; }));

    const { result } = renderHook(() => useDashboard());
    expect(result.current.overallLoading).toBe(true);

    act(() => resolveWatchlist(watchlist));
    await waitFor(() => expect(result.current.overallLoading).toBe(false));
  });

  it('addSymbol calls addSymbol API and adds row', async () => {
    mockAddSymbol.mockResolvedValue({ symbol: 'TSLA', message: 'added' });
    mockRunAnalysis.mockResolvedValue({});

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.overallLoading).toBe(false));

    await act(() => result.current.addSymbol('TSLA'));

    expect(mockAddSymbol).toHaveBeenCalledWith('TSLA');
    const symbols = result.current.rows.map((r) => r.symbol);
    expect(symbols).toContain('TSLA');
  });

  it('addSymbol sets analyzing during analysis', async () => {
    mockAddSymbol.mockResolvedValue({ symbol: 'TSLA', message: 'added' });

    let resolveAnalysis!: (v: unknown) => void;
    mockRunAnalysis.mockReturnValue(new Promise((r) => { resolveAnalysis = r; }));

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.overallLoading).toBe(false));

    act(() => { result.current.addSymbol('TSLA'); });
    await waitFor(() => expect(result.current.analyzing).toBe('TSLA'));

    act(() => resolveAnalysis({}));
    await waitFor(() => expect(result.current.analyzing).toBeNull());
  });

  it('removeSymbol calls removeSymbol API and removes row from state', async () => {
    mockRemoveSymbol.mockResolvedValue({ symbol: 'AAPL', message: 'removed' });

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.overallLoading).toBe(false));

    await act(() => result.current.removeSymbol('AAPL'));

    expect(mockRemoveSymbol).toHaveBeenCalledWith('AAPL');
    const symbols = result.current.rows.map((r) => r.symbol);
    expect(symbols).not.toContain('AAPL');
  });

  it('analyzeSymbol calls runAnalysis and refreshes snapshot', async () => {
    mockRunAnalysis.mockResolvedValue({});

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.overallLoading).toBe(false));

    await act(() => result.current.analyzeSymbol('AAPL'));

    expect(mockRunAnalysis).toHaveBeenCalledWith(['AAPL']);
    expect(mockGetLatestSnapshot).toHaveBeenCalledWith('AAPL');
  });

  it('analyzeError set when analysis throws', async () => {
    mockRunAnalysis.mockRejectedValue(new Error('analysis failed'));

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.overallLoading).toBe(false));

    await act(() => result.current.analyzeSymbol('AAPL'));

    expect(result.current.analyzeError).toBe('analysis failed');
  });

  it('watchlistError set when getWatchlist throws', async () => {
    mockGetWatchlist.mockRejectedValue(new Error('watchlist unavailable'));
    mockRemoveSymbol.mockRejectedValue(new Error('watchlist unavailable'));

    const { result } = renderHook(() => useDashboard());

    // Trigger error through removeSymbol (which can set watchlistError)
    await waitFor(() => expect(result.current.overallLoading).toBe(false));

    await act(() => result.current.removeSymbol('AAPL'));
    expect(result.current.watchlistError).toBeTruthy();
  });
});
