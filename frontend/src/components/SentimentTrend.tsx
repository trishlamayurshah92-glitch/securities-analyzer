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
    return <p className="text-sm text-[#8993A4]">No trend data available.</p>
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
          <CartesianGrid strokeDasharray="3 3" stroke="#DFE1E6" />
          <XAxis dataKey="date" tick={{ fill: '#5E6C84', fontSize: 12 }} />
          <YAxis
            yAxisId="sentiment"
            domain={[0, 3]}
            ticks={[0, 1, 2, 3]}
            tickFormatter={(v: number) => SENTIMENT_LABELS[v] || ''}
            tick={{ fill: '#5E6C84', fontSize: 12 }}
          />
          <YAxis
            yAxisId="price"
            orientation="right"
            tick={{ fill: '#5E6C84', fontSize: 12 }}
            tickFormatter={(v: number) => `$${v}`}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #DFE1E6' }}
            labelStyle={{ color: '#172B4D' }}
          />
          <Legend />
          <Line
            yAxisId="sentiment"
            type="monotone"
            dataKey="sentiment"
            stroke="#0052CC"
            strokeWidth={2}
            dot={{ fill: '#0052CC' }}
            name="Sentiment"
          />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="price"
            stroke="#403294"
            strokeWidth={2}
            dot={{ fill: '#403294' }}
            name="Price"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
