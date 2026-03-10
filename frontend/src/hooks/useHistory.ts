import { useState } from 'react'
import { api, type HistoryMatch, type TrendPoint, type SnapshotDiff } from '../api/client'

export function useHistory() {
  const [history, setHistory] = useState<HistoryMatch[]>([])
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [diff, setDiff] = useState<SnapshotDiff | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = async (symbol: string, query?: string) => {
    setLoading(true)
    setError(null)
    try {
      const [histResult, trendResult, diffResult] = await Promise.allSettled([
        api.getHistory(symbol, query),
        api.getTrend(symbol),
        api.getSnapshotDiff(symbol),
      ])

      setHistory(histResult.status === 'fulfilled' ? histResult.value : [])
      setTrend(trendResult.status === 'fulfilled' ? trendResult.value : [])
      // 404 when < 2 snapshots — treat as null, not an error
      setDiff(diffResult.status === 'fulfilled' ? diffResult.value : null)

      const firstError = [histResult, trendResult].find((r) => r.status === 'rejected')
      if (firstError && firstError.status === 'rejected') {
        setError(firstError.reason instanceof Error ? firstError.reason.message : 'Failed to load history')
      }
    } finally {
      setLoading(false)
    }
  }

  return { history, trend, diff, loading, error, fetchHistory }
}
