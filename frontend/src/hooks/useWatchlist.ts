import { useState, useEffect, useCallback } from 'react'
import { api, type WatchlistItem } from '../api/client'

export function useWatchlist() {
  const [data, setData] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await api.getWatchlist())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load watchlist')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const addSymbol = async (symbol: string) => {
    try {
      await api.addSymbol(symbol)
      await fetch()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add symbol')
    }
  }

  const removeSymbol = async (symbol: string) => {
    try {
      await api.removeSymbol(symbol)
      await fetch()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove symbol')
    }
  }

  return { data, loading, error, addSymbol, removeSymbol, refresh: fetch }
}
