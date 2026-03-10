import { useState, useEffect, useRef } from 'react'
import { api } from '../api/client'
import type { NewsArticle } from '../api/client'

export function useNews(symbol: string, daysBack?: number) {
  const [data, setData] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    setLoading(true)
    setError(null)

    api.getNews(symbol, daysBack)
      .then((articles) => {
        if (mountedRef.current) {
          setData(articles)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      })

    return () => {
      mountedRef.current = false
    }
  }, [symbol, daysBack])

  return { data, loading, error }
}
