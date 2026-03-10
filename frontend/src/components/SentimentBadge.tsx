interface SentimentBadgeProps {
  sentiment: string | null | undefined
}

const colorMap: Record<string, string> = {
  Bullish: 'bg-emerald-500/20 text-emerald-400',
  Bearish: 'bg-red-500/20 text-red-400',
  Mixed: 'bg-yellow-500/20 text-yellow-400',
  Neutral: 'bg-gray-500/20 text-gray-400',
}

export default function SentimentBadge({ sentiment }: SentimentBadgeProps) {
  const label = sentiment ?? 'N/A'
  const color = (sentiment && colorMap[sentiment]) ?? 'bg-gray-500/20 text-gray-400'
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}
