import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import StockTable from '../StockTable';
import type { DashboardRow } from '../../hooks/useDashboard';

const rows: DashboardRow[] = [
  {
    symbol: 'AAPL',
    loading: false,
    data: {
      score: 1,
      date: '2024-06-01T00:00:00Z',
      sentiment: 'Bullish',
      price: 182.52,
      text: '',
      company_name: 'Apple Inc.',
      pe_ratio: 28.1,
      market_cap: 2.8e12,
      beta: 1.29,
    },
  },
  {
    symbol: 'NVDA',
    loading: false,
    data: {
      score: 1,
      date: '2024-06-01T00:00:00Z',
      sentiment: 'Bearish',
      price: 450.0,
      text: '',
      company_name: 'NVIDIA Corp',
      pe_ratio: null,
      market_cap: null,
      beta: null,
    },
  },
];

function renderTable(props: Partial<React.ComponentProps<typeof StockTable>> = {}) {
  return render(
    <MemoryRouter>
      <StockTable
        rows={rows}
        onAnalyze={vi.fn()}
        onRemove={vi.fn()}
        analyzing={null}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('StockTable', () => {
  it('empty rows=[] → renders "No stocks yet..."', () => {
    render(
      <MemoryRouter>
        <StockTable rows={[]} onAnalyze={vi.fn()} onRemove={vi.fn()} analyzing={null} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/No stocks yet/)).toBeInTheDocument();
  });

  it('renders one row per DashboardRow', () => {
    renderTable();
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('NVDA')).toBeInTheDocument();
  });

  it('renders symbol text', () => {
    renderTable();
    expect(screen.getByText('AAPL')).toBeInTheDocument();
  });

  it('renders formatted price "$182.52"', () => {
    renderTable();
    expect(screen.getByText('$182.52')).toBeInTheDocument();
  });

  it('renders SentimentBadge for each row', () => {
    renderTable();
    expect(screen.getByText('Bullish')).toBeInTheDocument();
    expect(screen.getByText('Bearish')).toBeInTheDocument();
  });

  it('clicking "Analyze" calls onAnalyze with the correct symbol', () => {
    const onAnalyze = vi.fn();
    renderTable({ onAnalyze });
    // Click first Analyze button (for AAPL)
    const analyzeButtons = screen.getAllByRole('button', { name: /Analyze/i });
    fireEvent.click(analyzeButtons[0]);
    expect(onAnalyze).toHaveBeenCalledWith('AAPL');
  });

  it('clicking delete icon calls onRemove with the correct symbol', () => {
    const onRemove = vi.fn();
    renderTable({ onRemove });
    // Remove buttons have title="Remove"
    const removeButtons = screen.getAllByTitle('Remove');
    fireEvent.click(removeButtons[0]);
    expect(onRemove).toHaveBeenCalledWith('AAPL');
  });

  it('"Analyze" buttons are disabled when analyzing !== null', () => {
    renderTable({ analyzing: 'AAPL' });
    const analyzeButtons = screen.getAllByRole('button', { name: /Analyze|Running/i });
    analyzeButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it('active analyze symbol shows "Running" text', () => {
    renderTable({ analyzing: 'AAPL' });
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('clicking Symbol column header changes sort state', () => {
    renderTable();
    const symbolHeader = screen.getByText('Symbol');
    fireEvent.click(symbolHeader);
    // After click, sort indicator should appear (↑ or ↓)
    expect(screen.getByText(/Symbol\s*↑|Symbol\s*↓|↑|↓/)).toBeInTheDocument();
  });

  it('News link points to /news/{symbol}', () => {
    renderTable();
    const newsLinks = screen.getAllByRole('link', { name: /News/i });
    expect(newsLinks[0]).toHaveAttribute('href', '/news/AAPL');
  });
});
