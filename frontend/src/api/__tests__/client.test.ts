import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../client';

// Mock supabase (path relative to test file: src/api/__tests__/ → src/lib/supabase)
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

// Import mocked supabase to control session
import { supabase } from '../../lib/supabase';

function makeResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe('API client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    // Default: no session
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null } } as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getWatchlist() calls GET /api/watchlist', async () => {
    fetchMock.mockResolvedValue(makeResponse([]));
    await api.getWatchlist();
    expect(fetchMock).toHaveBeenCalledWith('/api/watchlist', expect.objectContaining({
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
    }));
  });

  it('addSymbol("AAPL") calls POST /api/watchlist with {symbol:"AAPL"}', async () => {
    fetchMock.mockResolvedValue(makeResponse({ symbol: 'AAPL', message: 'added' }));
    await api.addSymbol('AAPL');
    expect(fetchMock).toHaveBeenCalledWith('/api/watchlist', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ symbol: 'AAPL' }),
    }));
  });

  it('removeSymbol("AAPL") calls DELETE /api/watchlist/AAPL', async () => {
    fetchMock.mockResolvedValue(makeResponse({ symbol: 'AAPL', message: 'removed' }));
    await api.removeSymbol('AAPL');
    expect(fetchMock).toHaveBeenCalledWith('/api/watchlist/AAPL', expect.objectContaining({
      method: 'DELETE',
    }));
  });

  it('runAnalysis(["AAPL"]) calls POST /api/analyze with symbols', async () => {
    fetchMock.mockResolvedValue(makeResponse({ report: '# R', stocks_analyzed: ['AAPL'], model: 'gpt-4', duration_seconds: 5 }));
    await api.runAnalysis(['AAPL']);
    expect(fetchMock).toHaveBeenCalledWith('/api/analyze', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ symbols: ['AAPL'] }),
    }));
  });

  it('runAnalysis() calls without symbols in body', async () => {
    fetchMock.mockResolvedValue(makeResponse({ report: '#R', stocks_analyzed: [], model: 'gpt-4', duration_seconds: 5 }));
    await api.runAnalysis();
    expect(fetchMock).toHaveBeenCalledWith('/api/analyze', expect.objectContaining({
      body: JSON.stringify({ symbols: undefined }),
    }));
  });

  it('getHistory("AAPL", "earnings", 5) encodes query params', async () => {
    fetchMock.mockResolvedValue(makeResponse([]));
    await api.getHistory('AAPL', 'earnings', 5);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/history/AAPL');
    expect(calledUrl).toContain('query=earnings');
    expect(calledUrl).toContain('top_k=5');
  });

  it('getTrend("AAPL", 7) encodes days param', async () => {
    fetchMock.mockResolvedValue(makeResponse([]));
    await api.getTrend('AAPL', 7);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/history/AAPL/trend');
    expect(calledUrl).toContain('days=7');
  });

  it('getLatestSnapshot("AAPL") returns null when response is null', async () => {
    fetchMock.mockResolvedValue(makeResponse(null));
    const result = await api.getLatestSnapshot('AAPL');
    expect(result).toBeNull();
  });

  it('getSnapshotDiff("AAPL") calls /api/history/AAPL/diff', async () => {
    fetchMock.mockResolvedValue(makeResponse({ symbol: 'AAPL', driftLevel: 'none' }));
    await api.getSnapshotDiff('AAPL');
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toBe('/api/history/AAPL/diff');
  });

  it('getNews("AAPL", 14) encodes days_back=14', async () => {
    fetchMock.mockResolvedValue(makeResponse([]));
    await api.getNews('AAPL', 14);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/news/AAPL');
    expect(calledUrl).toContain('days_back=14');
  });

  it('searchSymbols("APP") calls /api/search?q=APP', async () => {
    fetchMock.mockResolvedValue(makeResponse([]));
    await api.searchSymbols('APP');
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toBe('/api/search?q=APP');
  });

  it('adds Authorization header when session exists', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'my-token' } },
    } as never);
    fetchMock.mockResolvedValue(makeResponse([]));

    await api.getWatchlist();

    const callHeaders = fetchMock.mock.calls[0][1].headers;
    expect(callHeaders).toMatchObject({ Authorization: 'Bearer my-token' });
  });

  it('throws with error message when response is non-200', async () => {
    fetchMock.mockResolvedValue(makeResponse({ detail: 'Not found' }, false, 404));
    await expect(api.getWatchlist()).rejects.toThrow('Not found');
  });
});
