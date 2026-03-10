import { useState, useEffect } from 'react'
import { useHistory } from '../hooks/useHistory'
import { api, type WatchlistItem, type SnapshotDiff } from '../api/client'
import SentimentTrend from '../components/SentimentTrend'

function ThesisDriftCard({ diff }: { diff: SnapshotDiff }) {
  const badgeColor =
    diff.driftLevel === 'significant'
      ? 'bg-red-500/20 text-red-400 border-red-800'
      : diff.driftLevel === 'minor'
      ? 'bg-yellow-500/20 text-yellow-400 border-yellow-800'
      : 'bg-gray-700/50 text-gray-400 border-gray-700'

  const badgeLabel =
    diff.driftLevel === 'significant'
      ? 'Significant Drift'
      : diff.driftLevel === 'minor'
      ? 'Minor Drift'
      : 'No Drift'

  const fmt = (d: string) => new Date(d).toLocaleDateString()
  const fmtPct = (n: number | null) => (n != null ? `${n >= 0 ? '+' : ''}${n.toFixed(1)}%` : 'N/A')
  const fmtDelta = (n: number | null) => (n != null ? `${n >= 0 ? '+' : ''}${n.toFixed(2)}` : 'N/A')

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-gray-300">Thesis Drift</h2>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeColor}`}>
          {badgeLabel}
        </span>
        {diff.sentimentChanged && (
          <span className="text-sm text-gray-400">
            {diff.previousSentiment} → {diff.currentSentiment}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-gray-500 text-xs">Price Change</p>
          <p className={`font-medium ${diff.priceDeltaPct != null && diff.priceDeltaPct < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {fmtPct(diff.priceDeltaPct)}
          </p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">P/E Delta</p>
          <p className="font-medium text-gray-200">{fmtDelta(diff.peRatioDelta)}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Mkt Cap Change</p>
          <p className={`font-medium ${diff.marketCapDeltaPct != null && diff.marketCapDeltaPct < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {fmtPct(diff.marketCapDeltaPct)}
          </p>
        </div>
      </div>
      <p className="text-xs text-gray-600">
        Comparing {fmt(diff.previousDate)} → {fmt(diff.currentDate)}
      </p>
    </div>
  )
}

export default function HistoryPage() {
  const { history, trend, diff, loading, error, fetchHistory } = useHistory()
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [selectedSymbol, setSelectedSymbol] = useState('')

  useEffect(() => {
    api.getWatchlist().then((wl) => {
      setWatchlist(wl)
      if (wl.length > 0) {
        setSelectedSymbol(wl[0].symbol)
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedSymbol) fetchHistory(selectedSymbol)
  }, [selectedSymbol]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">History</h1>

      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-400">Symbol:</label>
        <select
          value={selectedSymbol}
          onChange={(e) => setSelectedSymbol(e.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none focus:border-emerald-500"
        >
          {watchlist.map(({ symbol }) => (
            <option key={symbol} value={symbol}>
              {symbol}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <>
          {diff && <ThesisDriftCard diff={diff} />}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-300">Sentiment Trend</h2>
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <SentimentTrend data={trend} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-300">Past Analyses</h2>
            {history.length === 0 ? (
              <p className="text-sm text-gray-500">No past analyses found for {selectedSymbol}.</p>
            ) : (
              <div className="space-y-3">
                {history.map((match, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-2"
                  >
                    <div className="flex items-center gap-3 text-sm">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          match.sentiment === 'Bullish'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : match.sentiment === 'Bearish'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-gray-700 text-gray-300'
                        }`}
                      >
                        {match.sentiment}
                      </span>
                      <span className="text-gray-500">
                        {new Date(match.date).toLocaleDateString()}
                      </span>
                      {match.price != null && (
                        <span className="text-gray-400">${match.price.toFixed(2)}</span>
                      )}
                      <span className="ml-auto text-gray-600">
                        Score: {match.score.toFixed(3)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">{match.text}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
