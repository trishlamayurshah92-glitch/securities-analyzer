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
      : 'bg-gray-100 text-gray-600 border-gray-200'

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
    <div className="rounded-xl border border-[#DFE1E6] bg-white p-4 space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-[#172B4D]">Thesis Drift</h2>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeColor}`}>
          {badgeLabel}
        </span>
        {diff.sentimentChanged && (
          <span className="text-sm text-[#5E6C84]">
            {diff.previousSentiment} → {diff.currentSentiment}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-[#8993A4] text-xs">Price Change</p>
          <p className={`font-medium ${diff.priceDeltaPct != null && diff.priceDeltaPct < 0 ? 'text-red-400' : 'text-[#006644]'}`}>
            {fmtPct(diff.priceDeltaPct)}
          </p>
        </div>
        <div>
          <p className="text-[#8993A4] text-xs">P/E Delta</p>
          <p className="font-medium text-[#172B4D]">{fmtDelta(diff.peRatioDelta)}</p>
        </div>
        <div>
          <p className="text-[#8993A4] text-xs">Mkt Cap Change</p>
          <p className={`font-medium ${diff.marketCapDeltaPct != null && diff.marketCapDeltaPct < 0 ? 'text-red-400' : 'text-[#006644]'}`}>
            {fmtPct(diff.marketCapDeltaPct)}
          </p>
        </div>
      </div>
      <p className="text-xs text-[#8993A4]">
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
        <label className="text-sm font-medium text-[#5E6C84]">Symbol:</label>
        <select
          value={selectedSymbol}
          onChange={(e) => setSelectedSymbol(e.target.value)}
          className="rounded-lg border border-[#C1C7D0] bg-white px-3 py-2 text-sm text-[#172B4D] outline-none focus:border-[#0052CC]"
        >
          {watchlist.map(({ symbol }) => (
            <option key={symbol} value={symbol}>
              {symbol}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#8993A4]">Loading...</p>
      ) : (
        <>
          {diff && <ThesisDriftCard diff={diff} />}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[#172B4D]">Sentiment Trend</h2>
            <div className="rounded-xl border border-[#DFE1E6] bg-white p-4">
              <SentimentTrend data={trend} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[#172B4D]">Past Analyses</h2>
            {history.length === 0 ? (
              <p className="text-sm text-[#8993A4]">No past analyses found for {selectedSymbol}.</p>
            ) : (
              <div className="space-y-3">
                {history.map((match, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-[#DFE1E6] bg-white p-4 space-y-2"
                  >
                    <div className="flex items-center gap-3 text-sm">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          match.sentiment === 'Bullish'
                            ? 'bg-[#DEEBFF] text-[#0052CC]'
                            : match.sentiment === 'Bearish'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {match.sentiment}
                      </span>
                      <span className="text-[#8993A4]">
                        {new Date(match.date).toLocaleDateString()}
                      </span>
                      {match.price != null && (
                        <span className="text-[#5E6C84]">${match.price.toFixed(2)}</span>
                      )}
                      <span className="ml-auto text-[#8993A4]">
                        Score: {match.score.toFixed(3)}
                      </span>
                    </div>
                    <p className="text-sm text-[#344563] leading-relaxed">{match.text}</p>
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
