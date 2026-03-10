import type { NewsArticle } from '../api/client'

export default function NewsCard({ article }: { article: NewsArticle }) {
  const date = new Date(article.datetime).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-2">
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-semibold text-gray-100 hover:text-emerald-400 transition"
      >
        {article.headline}
      </a>
      <p className="text-xs text-gray-500">
        {article.source} · {date}
      </p>
      {article.summary && (
        <p className="text-sm text-gray-400 line-clamp-3">{article.summary}</p>
      )}
    </div>
  )
}
