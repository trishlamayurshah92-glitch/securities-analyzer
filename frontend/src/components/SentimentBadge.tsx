interface SentimentBadgeProps {
  sentiment: string | null | undefined
}

const colorMap: Record<string, string> = {
  Bullish: 'bg-[#DEEBFF] text-[#0052CC]',
  Bearish: 'bg-red-100 text-red-700',
  Mixed: 'bg-yellow-100 text-yellow-700',
  Neutral: 'bg-gray-100 text-gray-600',
}

export default function SentimentBadge({ sentiment }: SentimentBadgeProps) {
  const label = sentiment ?? 'N/A'
  const color = (sentiment && colorMap[sentiment]) ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}
