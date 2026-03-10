import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import type { RichHistoryMatch } from '../api/client'

export interface DashboardRow {
  symbol: string
  data: RichHistoryMatch | null
  loading: boolean
}

export function useDashboard() {
  const [rows, setRows] = useState<DashboardRow[]>([])
  const [overallLoading, setOverallLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [watchlistError, setWatchlistError] = useState<string | null>(null)

  const fetchRowData = useCallback(async (symbol: string) => {
    setRows((prev) =>
      prev.map((r) => (r.symbol === symbol ? { ...r, loading: true } : r)),
    )
    try {
      const snap = await api.getLatestSnapshot(symbol)
      setRows((prev) =>
        prev.map((r) =>
          r.symbol === symbol
            ? { ...r, data: snap, loading: false }
            : r,
        ),
      )
    } catch {
      setRows((prev) =>
        prev.map((r) => (r.symbol === symbol ? { ...r, data: null, loading: false } : r)),
      )
    }
  }, [])

  const loadAll = useCallback(async () => {
    setOverallLoading(true)
    try {
      const watchlist = await api.getWatchlist()
      const initialRows: DashboardRow[] = watchlist.map((item) => ({
        symbol: item.symbol,
        data: null,
        loading: true,
      }))
      setRows(initialRows)
      setOverallLoading(false)

      // Fire independent per-symbol fetches (progressive population)
      watchlist.forEach((item) => {
        fetchRowData(item.symbol)
      })
    } catch {
      setOverallLoading(false)
    }
  }, [fetchRowData])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const refresh = useCallback(() => {
    loadAll()
  }, [loadAll])

  const addSymbol = useCallback(async (symbol: string) => {
    setWatchlistError(null)
    try {
      await api.addSymbol(symbol)
      await loadAll()
    } catch (e) {
      setWatchlistError(e instanceof Error ? e.message : 'Failed to add symbol')
    }
  }, [loadAll])

  const removeSymbol = useCallback(async (symbol: string) => {
    setWatchlistError(null)
    try {
      await api.removeSymbol(symbol)
      setRows((prev) => prev.filter((r) => r.symbol !== symbol))
    } catch (e) {
      setWatchlistError(e instanceof Error ? e.message : 'Failed to remove symbol')
    }
  }, [])

  const analyzeSymbol = useCallback(
    async (symbol: string) => {
      setAnalyzing(symbol)
      setAnalyzeError(null)
      try {
        await api.runAnalysis([symbol])
        await fetchRowData(symbol)
      } catch (err: unknown) {
        setAnalyzeError(err instanceof Error ? err.message : String(err))
      } finally {
        setAnalyzing(null)
      }
    },
    [fetchRowData],
  )

  return { rows, overallLoading, refresh, addSymbol, removeSymbol, analyzeSymbol, analyzing, analyzeError, watchlistError }
}
