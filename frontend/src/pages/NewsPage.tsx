import { Link, useParams } from 'react-router-dom'
import { useNews } from '../hooks/useNews'
import NewsCard from '../components/NewsCard'

export default function NewsPage() {
  const { symbol = '' } = useParams<{ symbol: string }>()
  const { data: articles, loading, error } = useNews(symbol.toUpperCase())

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          to="/dashboard"
          className="text-sm text-gray-400 hover:text-gray-200 transition"
        >
          ← Back
        </Link>
        <h1 className="text-xl font-bold text-gray-100">
          {symbol.toUpperCase()} — News
        </h1>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-2">
              <div className="h-4 rounded bg-gray-800 animate-pulse w-3/4" />
              <div className="h-3 rounded bg-gray-800 animate-pulse w-1/4" />
              <div className="h-3 rounded bg-gray-800 animate-pulse w-full" />
              <div className="h-3 rounded bg-gray-800 animate-pulse w-5/6" />
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <p className="text-gray-500 text-sm">No recent news found for {symbol.toUpperCase()}.</p>
      ) : (
        <div className="space-y-3">
          {articles.map((article, i) => (
            <NewsCard key={i} article={article} />
          ))}
        </div>
      )}
    </div>
  )
}
