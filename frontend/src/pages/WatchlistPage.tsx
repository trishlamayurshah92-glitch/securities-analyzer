import { useWatchlist } from '../hooks/useWatchlist'
import SymbolInput from '../components/SymbolInput'

export default function WatchlistPage() {
  const { data, loading, error, addSymbol, removeSymbol } = useWatchlist()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Watchlist</h1>

      <SymbolInput onSubmit={addSymbol} placeholder="Add symbol..." buttonText="Add" />

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-gray-500">Watchlist is empty. Add a symbol above.</p>
      ) : (
        <ul className="space-y-2">
          {data.map(({ symbol }) => (
            <li
              key={symbol}
              className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3"
            >
              <span className="font-medium">{symbol}</span>
              <button
                onClick={() => removeSymbol(symbol)}
                className="rounded px-3 py-1 text-sm text-red-400 hover:bg-red-950 hover:text-red-300 transition"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
