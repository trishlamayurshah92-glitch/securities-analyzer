import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SentimentTrend from '../SentimentTrend';
import type { TrendPoint } from '../../api/client';

vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <svg data-testid="line-chart">{children}</svg>
  ),
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

const trendData: TrendPoint[] = [
  { date: '2024-01-01', sentiment: 'Bullish', price: 182 },
  { date: '2024-01-08', sentiment: 'Neutral', price: 178 },
];

describe('SentimentTrend', () => {
  it('empty data=[] → renders "No trend data available."', () => {
    render(<SentimentTrend data={[]} />);
    expect(screen.getByText('No trend data available.')).toBeInTheDocument();
  });

  it('non-empty data → does NOT render empty-state text', () => {
    render(<SentimentTrend data={trendData} />);
    expect(screen.queryByText('No trend data available.')).not.toBeInTheDocument();
  });

  it('renders a chart element when data provided', () => {
    render(<SentimentTrend data={trendData} />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });
});
