import type {
  WatchlistItem,
  AnalysisResult,
  HistoryMatch,
  TrendPoint,
  NewsArticle,
  AnalysisSnapshot,
  SnapshotDiff,
} from '@stockwatch/shared';
import { supabase } from '../lib/supabase';

export type { WatchlistItem, AnalysisResult, HistoryMatch, TrendPoint, NewsArticle, AnalysisSnapshot, SnapshotDiff };

export type RichHistoryMatch = HistoryMatch & {
  company_name?: string | null;
  pe_ratio?: number | null;
  market_cap?: number | null;
  beta?: number | null;
  week_52_high?: number | null;
  week_52_low?: number | null;
  dividend_yield?: number | null;
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

export const api = {
  getWatchlist: () => request<WatchlistItem[]>('/api/watchlist'),

  addSymbol: (symbol: string) =>
    request<{ symbol: string; message: string }>('/api/watchlist', {
      method: 'POST',
      body: JSON.stringify({ symbol }),
    }),

  removeSymbol: (symbol: string) =>
    request<{ symbol: string; message: string }>(`/api/watchlist/${symbol}`, {
      method: 'DELETE',
    }),

  runAnalysis: (symbols?: string[]) =>
    request<AnalysisResult>('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ symbols }),
    }),

  getHistory: (symbol: string, query?: string, topK?: number) => {
    const params = new URLSearchParams()
    if (query) params.set('query', query)
    if (topK) params.set('top_k', String(topK))
    return request<HistoryMatch[]>(`/api/history/${symbol}?${params}`)
  },

  getTrend: (symbol: string, days?: number) => {
    const params = new URLSearchParams()
    if (days) params.set('days', String(days))
    return request<TrendPoint[]>(`/api/history/${symbol}/trend?${params}`)
  },

  getSnapshots: (symbol: string, limit?: number) =>
    request<AnalysisSnapshot[]>(`/api/history/${symbol}?top_k=${limit ?? 10}`),

  getLatestSnapshot: (symbol: string) =>
    request<RichHistoryMatch | null>(`/api/history/${symbol}/latest`),

  getSnapshotDiff: (symbol: string) =>
    request<SnapshotDiff>(`/api/history/${symbol}/diff`),

  getNews: (symbol: string, daysBack?: number) => {
    const params = new URLSearchParams()
    if (daysBack) params.set('days_back', String(daysBack))
    return request<NewsArticle[]>(`/api/news/${symbol}?${params}`)
  },

  searchSymbols: (q: string) =>
    request<{ symbol: string; description: string }[]>(`/api/search?q=${encodeURIComponent(q)}`),
}
