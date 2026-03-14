import { useState, useEffect } from 'react'
import { useAnalysis } from '../hooks/useAnalysis'
import { api, type WatchlistItem } from '../api/client'
import LoadingOverlay from '../components/LoadingOverlay'
import AnalysisReport from '../components/AnalysisReport'

export default function AnalysisPage() {
  const { data, loading, error, run } = useAnalysis()
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    api.getWatchlist().then(setWatchlist).catch(() => {})
  }, [])

  const toggleSymbol = (symbol: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(symbol)) next.delete(symbol)
      else next.add(symbol)
      return next
    })
  }

  const handleRun = () => {
    const symbols = selected.size > 0 ? [...selected] : undefined
    run(symbols)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Run Analysis</h1>

      <div className="space-y-4 rounded-xl border border-[#DFE1E6] bg-white p-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-[#5E6C84]">
            Select symbols (leave empty to analyze all)
          </label>
          <div className="flex flex-wrap gap-2">
            {watchlist.map(({ symbol }) => (
              <button
                key={symbol}
                onClick={() => toggleSymbol(symbol)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  selected.has(symbol)
                    ? 'bg-[#0052CC] text-white'
                    : 'bg-[#F0F2F5] text-[#344563] hover:bg-[#DFE1E6]'
                }`}
              >
                {symbol}
              </button>
            ))}
            {watchlist.length === 0 && (
              <p className="text-sm text-[#8993A4]">No symbols in watchlist. Add some on the Watchlist page.</p>
            )}
          </div>
        </div>

        <button
          onClick={handleRun}
          disabled={loading}
          className="rounded-lg bg-[#0052CC] px-6 py-2.5 font-medium text-white hover:bg-[#0065FF] disabled:opacity-50 transition"
        >
          Run Analysis
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && (
        <AnalysisReport
          markdown={data.report}
          model={data.model}
          duration={data.duration_seconds}
          stocks={data.stocks_analyzed}
        />
      )}

      {loading && <LoadingOverlay />}
    </div>
  )
}
