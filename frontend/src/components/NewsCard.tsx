import type { NewsArticle } from '../api/client'

export default function NewsCard({ article }: { article: NewsArticle }) {
  const date = new Date(article.datetime).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="rounded-xl border border-[#DFE1E6] bg-white p-4 space-y-2">
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-semibold text-[#172B4D] hover:text-[#0052CC] transition"
      >
        {article.headline}
      </a>
      <p className="text-xs text-[#8993A4]">
        {article.source} · {date}
      </p>
      {article.summary && (
        <p className="text-sm text-[#5E6C84] line-clamp-3">{article.summary}</p>
      )}
    </div>
  )
}
