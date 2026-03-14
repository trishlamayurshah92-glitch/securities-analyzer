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
      <div className="flex flex-wrap gap-3 text-sm text-[#5E6C84]">
        <span>Model: <span className="text-[#172B4D]">{model}</span></span>
        <span>Duration: <span className="text-[#172B4D]">{duration}s</span></span>
        <span>Stocks: <span className="text-[#172B4D]">{stocks.join(', ')}</span></span>
      </div>
      <article className="prose max-w-none prose-headings:text-[#0052CC] prose-a:text-[#0052CC]">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </article>
    </div>
  )
}
