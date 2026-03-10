import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { TrendPoint } from '../api/client'

const SENTIMENT_MAP: Record<string, number> = {
  Bullish: 3,
  Neutral: 2,
  Mixed: 1,
  Bearish: 0,
}

const SENTIMENT_LABELS: Record<number, string> = {
  3: 'Bullish',
  2: 'Neutral',
  1: 'Mixed',
  0: 'Bearish',
}

interface Props {
  data: TrendPoint[]
}

export default function SentimentTrend({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-500">No trend data available.</p>
  }

  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString(),
    sentiment: SENTIMENT_MAP[d.sentiment] ?? 2,
    price: d.price,
  }))

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis
            yAxisId="sentiment"
            domain={[0, 3]}
            ticks={[0, 1, 2, 3]}
            tickFormatter={(v: number) => SENTIMENT_LABELS[v] || ''}
            tick={{ fill: '#9ca3af', fontSize: 12 }}
          />
          <YAxis
            yAxisId="price"
            orientation="right"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            tickFormatter={(v: number) => `$${v}`}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
            labelStyle={{ color: '#e5e7eb' }}
          />
          <Legend />
          <Line
            yAxisId="sentiment"
            type="monotone"
            dataKey="sentiment"
            stroke="#34d399"
            strokeWidth={2}
            dot={{ fill: '#34d399' }}
            name="Sentiment"
          />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="price"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={{ fill: '#60a5fa' }}
            name="Price"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
