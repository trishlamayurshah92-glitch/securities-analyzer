import { useDashboard } from '../hooks/useDashboard'
import StockTable from '../components/StockTable'
import SymbolInput from '../components/SymbolInput'

export default function StockDashboardPage() {
  const {
    rows,
    overallLoading,
    refresh,
    addSymbol,
    removeSymbol,
    analyzeSymbol,
    analyzing,
    analyzeError,
    watchlistError,
  } = useDashboard()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-[#172B4D]">Dashboard</h1>
        <div className="flex items-center gap-3">
          <SymbolInput onSubmit={addSymbol} placeholder="Add ticker…" buttonText="Add ticker" />
          <button
            onClick={refresh}
            disabled={overallLoading}
            className="rounded px-3 py-1.5 text-sm bg-[#F0F2F5] text-[#172B4D] hover:bg-[#DFE1E6] disabled:opacity-50 transition"
          >
            {overallLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {(analyzeError || watchlistError) && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {analyzeError ? `Analysis failed: ${analyzeError}` : watchlistError}
        </div>
      )}

      <div className="rounded-xl border border-[#DFE1E6] bg-white p-1">
        <StockTable rows={rows} onAnalyze={analyzeSymbol} onRemove={removeSymbol} analyzing={analyzing} />
      </div>
    </div>
  )
}
