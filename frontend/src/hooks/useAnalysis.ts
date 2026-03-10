import { useState } from 'react'
import { api, type AnalysisResult } from '../api/client'

export function useAnalysis() {
  const [data, setData] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (symbols?: string[]) => {
    setLoading(true)
    setError(null)
    setData(null)
    try {
      setData(await api.runAnalysis(symbols))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  return { data, loading, error, run }
}
