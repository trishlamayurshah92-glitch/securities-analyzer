import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNews } from '../useNews';

const mockGetNews = vi.fn();

vi.mock('../../api/client', () => ({
  api: {
    getNews: (...args: unknown[]) => mockGetNews(...args),
  },
}));

const articles = [
  { headline: 'Apple soars', summary: 'Good', source: 'Reuters', datetime: '2024-01-01', url: 'https://example.com' },
];

describe('useNews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches news on mount with the provided symbol', async () => {
    mockGetNews.mockResolvedValue(articles);

    renderHook(() => useNews('AAPL'));
    await waitFor(() => expect(mockGetNews).toHaveBeenCalledWith('AAPL', undefined));
  });

  it('loading=true during fetch, false after', async () => {
    let resolve!: (v: typeof articles) => void;
    mockGetNews.mockReturnValue(new Promise((r) => { resolve = r; }));

    const { result } = renderHook(() => useNews('AAPL'));
    expect(result.current.loading).toBe(true);

    act(() => resolve(articles));
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('data populated with articles', async () => {
    mockGetNews.mockResolvedValue(articles);

    const { result } = renderHook(() => useNews('AAPL'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual(articles);
  });

  it('error set when getNews throws', async () => {
    mockGetNews.mockRejectedValue(new Error('fetch failed'));

    const { result } = renderHook(() => useNews('AAPL'));
    await waitFor(() => expect(result.current.error).toBe('fetch failed'));
  });

  it('re-fetches when symbol prop changes', async () => {
    mockGetNews.mockResolvedValue(articles);

    const { result, rerender } = renderHook(({ sym }) => useNews(sym), {
      initialProps: { sym: 'AAPL' },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ sym: 'NVDA' });
    await waitFor(() => expect(mockGetNews).toHaveBeenCalledWith('NVDA', undefined));
  });
});
