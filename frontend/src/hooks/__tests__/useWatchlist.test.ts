import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWatchlist } from '../useWatchlist';

const mockGetWatchlist = vi.fn();
const mockAddSymbol = vi.fn();
const mockRemoveSymbol = vi.fn();

vi.mock('../../api/client', () => ({
  api: {
    getWatchlist: (...args: unknown[]) => mockGetWatchlist(...args),
    addSymbol: (...args: unknown[]) => mockAddSymbol(...args),
    removeSymbol: (...args: unknown[]) => mockRemoveSymbol(...args),
  },
}));

describe('useWatchlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls getWatchlist on mount', async () => {
    mockGetWatchlist.mockResolvedValue([]);
    renderHook(() => useWatchlist());
    await waitFor(() => expect(mockGetWatchlist).toHaveBeenCalledTimes(1));
  });

  it('sets data from API response', async () => {
    const items = [{ id: 1, symbol: 'AAPL', addedAt: '2024-01-01' }];
    mockGetWatchlist.mockResolvedValue(items);

    const { result } = renderHook(() => useWatchlist());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual(items);
  });

  it('sets loading=true during fetch, false after', async () => {
    let resolve: (v: unknown[]) => void;
    mockGetWatchlist.mockReturnValue(new Promise((r) => { resolve = r; }));

    const { result } = renderHook(() => useWatchlist());
    expect(result.current.loading).toBe(true);

    act(() => resolve!([]));
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('sets error when getWatchlist throws', async () => {
    mockGetWatchlist.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useWatchlist());
    await waitFor(() => expect(result.current.error).toBe('network error'));
  });

  it('addSymbol calls addSymbol API then refreshes', async () => {
    mockGetWatchlist.mockResolvedValue([]);
    mockAddSymbol.mockResolvedValue({ symbol: 'NVDA', message: 'added' });

    const { result } = renderHook(() => useWatchlist());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.addSymbol('NVDA'));

    expect(mockAddSymbol).toHaveBeenCalledWith('NVDA');
    expect(mockGetWatchlist).toHaveBeenCalledTimes(2);
  });

  it('removeSymbol calls removeSymbol API then refreshes', async () => {
    mockGetWatchlist.mockResolvedValue([]);
    mockRemoveSymbol.mockResolvedValue({ symbol: 'AAPL', message: 'removed' });

    const { result } = renderHook(() => useWatchlist());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.removeSymbol('AAPL'));

    expect(mockRemoveSymbol).toHaveBeenCalledWith('AAPL');
    expect(mockGetWatchlist).toHaveBeenCalledTimes(2);
  });

  it('refresh re-calls getWatchlist', async () => {
    mockGetWatchlist.mockResolvedValue([]);

    const { result } = renderHook(() => useWatchlist());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.refresh());

    expect(mockGetWatchlist).toHaveBeenCalledTimes(2);
  });
});
