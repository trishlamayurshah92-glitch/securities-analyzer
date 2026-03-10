import { useState } from 'react'
import { Link } from 'react-router-dom'
import SentimentBadge from './SentimentBadge'
import type { DashboardRow } from '../hooks/useDashboard'

type SortKey = 'symbol' | 'price' | 'pe_ratio' | 'market_cap' | 'beta' | 'sentiment' | 'date'
type SortDir = 'asc' | 'desc'

function formatMarketCap(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
  return `$${v.toLocaleString()}`
}

function fmt(v: number | null | undefined, decimals = 2): string {
  return v == null ? '—' : v.toFixed(decimals)
}

interface StockTableProps {
  rows: DashboardRow[]
  onAnalyze: (symbol: string) => void
  onRemove: (symbol: string) => void
  analyzing: string | null
}

export default function StockTable({ rows, onAnalyze, onRemove, analyzing }: StockTableProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [sortClicks, setSortClicks] = useState(0)

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      if (sortDir === 'asc') {
        setSortDir('desc')
        setSortClicks(2)
      } else if (sortDir === 'desc') {
        setSortKey(null)
        setSortClicks(0)
      }
    } else {
      setSortKey(key)
      setSortDir('asc')
      setSortClicks(1)
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return null
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  const sorted = [...rows].sort((a, b) => {
    if (!sortKey) return 0
    const ad = a.data
    const bd = b.data
    let av: any = null
    let bv: any = null

    if (sortKey === 'symbol') { av = a.symbol; bv = b.symbol }
    else if (sortKey === 'price') { av = ad?.price ?? null; bv = bd?.price ?? null }
    else if (sortKey === 'pe_ratio') { av = ad?.pe_ratio ?? null; bv = bd?.pe_ratio ?? null }
    else if (sortKey === 'market_cap') { av = ad?.market_cap ?? null; bv = bd?.market_cap ?? null }
    else if (sortKey === 'beta') { av = ad?.beta ?? null; bv = bd?.beta ?? null }
    else if (sortKey === 'sentiment') { av = ad?.sentiment ?? null; bv = bd?.sentiment ?? null }
    else if (sortKey === 'date') { av = ad?.date ?? null; bv = bd?.date ?? null }

    // Nulls always sort to bottom
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1

    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })

  const thClass = 'px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-200'
  const tdClass = 'px-3 py-3 text-sm'

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No stocks yet. Add a ticker using the button above.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[800px] w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-800">
            <th className={thClass} onClick={() => handleSort('symbol')}>Symbol{sortIndicator('symbol')}</th>
            <th className={`${thClass} cursor-default hover:text-gray-400`}>Company</th>
            <th className={thClass} onClick={() => handleSort('price')}>Price{sortIndicator('price')}</th>
            <th className={thClass} onClick={() => handleSort('pe_ratio')}>P/E{sortIndicator('pe_ratio')}</th>
            <th className={thClass} onClick={() => handleSort('market_cap')}>Mkt Cap{sortIndicator('market_cap')}</th>
            <th className={thClass} onClick={() => handleSort('beta')}>Beta{sortIndicator('beta')}</th>
            <th className={thClass} onClick={() => handleSort('sentiment')}>Sentiment{sortIndicator('sentiment')}</th>
            <th className={thClass} onClick={() => handleSort('date')}>Last Analysis{sortIndicator('date')}</th>
            <th className={`${thClass} cursor-default hover:text-gray-400`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            row.loading ? (
              <tr key={row.symbol} className="border-b border-gray-800/50">
                {Array.from({ length: 9 }).map((_, i) => (
                  <td key={i} className={tdClass}>
                    <div className="h-4 rounded bg-gray-800 animate-pulse" style={{ width: i === 0 ? '4rem' : '6rem' }} />
                  </td>
                ))}
              </tr>
            ) : (
              <tr key={row.symbol} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                <td className={`${tdClass} font-bold text-emerald-400`}>{row.symbol}</td>
                <td className={`${tdClass} text-gray-300 max-w-[160px] truncate`} title={row.data?.company_name ?? ''}>
                  {row.data?.company_name ?? '—'}
                </td>
                <td className={`${tdClass} text-gray-200`}>
                  {row.data?.price != null ? `$${row.data.price.toFixed(2)}` : '—'}
                </td>
                <td className={tdClass}>{fmt(row.data?.pe_ratio, 1)}</td>
                <td className={tdClass}>{formatMarketCap(row.data?.market_cap)}</td>
                <td className={tdClass}>{fmt(row.data?.beta)}</td>
                <td className={tdClass}>
                  <SentimentBadge sentiment={row.data?.sentiment} />
                </td>
                <td className={`${tdClass} text-gray-400 text-xs`}>
                  {row.data?.date ? new Date(row.data.date).toLocaleDateString() : '—'}
                </td>
                <td className={`${tdClass} flex items-center gap-2`}>
                  <Link
                    to={`/news/${row.symbol}`}
                    className="rounded px-2 py-1 text-xs bg-gray-800 text-gray-300 hover:bg-gray-700 transition"
                  >
                    News
                  </Link>
                  <button
                    onClick={() => onAnalyze(row.symbol)}
                    disabled={analyzing !== null}
                    className="rounded px-2 py-1 text-xs bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 transition flex items-center gap-1"
                  >
                    {analyzing === row.symbol ? (
                      <>
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Running
                      </>
                    ) : 'Analyze'}
                  </button>
                  <button
                    onClick={() => onRemove(row.symbol)}
                    disabled={analyzing !== null}
                    className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-950 hover:text-red-300 disabled:opacity-50 transition"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            )
          ))}
        </tbody>
      </table>
    </div>
  )
}
