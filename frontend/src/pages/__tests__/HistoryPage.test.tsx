import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import HistoryPage from '../HistoryPage';

const mockUseHistory = vi.fn();
const mockGetWatchlist = vi.fn();

vi.mock('../../hooks/useHistory', () => ({
  useHistory: () => mockUseHistory(),
}));

vi.mock('../../api/client', () => ({
  api: {
    getWatchlist: (...args: unknown[]) => mockGetWatchlist(...args),
  },
}));

vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <svg data-testid="line-chart">{children}</svg>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const diff = {
  symbol: 'AAPL',
  driftLevel: 'significant',
  sentimentChanged: true,
  previousSnapshotId: 1,
  currentSnapshotId: 2,
  previousDate: '2024-01-01T00:00:00Z',
  currentDate: '2024-01-08T00:00:00Z',
  previousSentiment: 'Bullish',
  currentSentiment: 'Bearish',
  priceDeltaPct: -5,
  peRatioDelta: null,
  marketCapDeltaPct: null,
};

const trend = [{ date: '2024-01-01', sentiment: 'Bullish', price: 182 }];

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWatchlist.mockResolvedValue([
      { id: 1, symbol: 'AAPL', addedAt: '2024-01-01' },
      { id: 2, symbol: 'NVDA', addedAt: '2024-01-02' },
    ]);
    mockUseHistory.mockReturnValue({
      history: [],
      trend: [],
      diff: null,
      loading: false,
      error: null,
      fetchHistory: vi.fn(),
    });
  });

  it('symbol dropdown shows watchlist symbols', async () => {
    render(<MemoryRouter><HistoryPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'AAPL' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'NVDA' })).toBeInTheDocument();
    });
  });

  it('shows "No past analyses found" when history is empty', async () => {
    mockUseHistory.mockReturnValue({
      history: [],
      trend: [],
      diff: null,
      loading: false,
      error: null,
      fetchHistory: vi.fn(),
    });

    render(<MemoryRouter><HistoryPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/No past analyses found/)).toBeInTheDocument();
    });
  });

  it('shows ThesisDriftCard when diff is not null', async () => {
    mockUseHistory.mockReturnValue({
      history: [],
      trend: [],
      diff,
      loading: false,
      error: null,
      fetchHistory: vi.fn(),
    });

    render(<MemoryRouter><HistoryPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Thesis Drift')).toBeInTheDocument();
    });
  });

  it('shows SentimentTrend chart when trend data is provided', async () => {
    mockUseHistory.mockReturnValue({
      history: [],
      trend,
      diff: null,
      loading: false,
      error: null,
      fetchHistory: vi.fn(),
    });

    render(<MemoryRouter><HistoryPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });
});
