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
          className="text-sm text-[#5E6C84] hover:text-[#172B4D] transition"
        >
          ← Back
        </Link>
        <h1 className="text-xl font-bold text-[#172B4D]">
          {symbol.toUpperCase()} — News
        </h1>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[#DFE1E6] bg-white p-4 space-y-2">
              <div className="h-4 rounded bg-[#DFE1E6] animate-pulse w-3/4" />
              <div className="h-3 rounded bg-[#DFE1E6] animate-pulse w-1/4" />
              <div className="h-3 rounded bg-[#DFE1E6] animate-pulse w-full" />
              <div className="h-3 rounded bg-[#DFE1E6] animate-pulse w-5/6" />
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <p className="text-[#8993A4] text-sm">No recent news found for {symbol.toUpperCase()}.</p>
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
