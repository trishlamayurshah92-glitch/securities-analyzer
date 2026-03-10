import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  markdown: string
  model: string
  duration: number
  stocks: string[]
}

export default function AnalysisReport({ markdown, model, duration, stocks }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-sm text-gray-400">
        <span>Model: <span className="text-gray-200">{model}</span></span>
        <span>Duration: <span className="text-gray-200">{duration}s</span></span>
        <span>Stocks: <span className="text-gray-200">{stocks.join(', ')}</span></span>
      </div>
      <article className="prose prose-invert max-w-none prose-headings:text-emerald-400 prose-a:text-emerald-400">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </article>
    </div>
  )
}
