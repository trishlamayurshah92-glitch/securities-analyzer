import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import StockDashboardPage from '../StockDashboardPage';

const mockUseDashboard = vi.fn();

vi.mock('../../hooks/useDashboard', () => ({
  useDashboard: () => mockUseDashboard(),
}));

// Mock SymbolInput to avoid api.searchSymbols calls
vi.mock('../../components/SymbolInput', () => ({
  default: ({ onSubmit }: { onSubmit: (s: string) => void }) => (
    <input data-testid="symbol-input" onBlur={(e) => onSubmit(e.target.value)} />
  ),
}));

const defaultDashboard = {
  rows: [],
  overallLoading: false,
  refresh: vi.fn(),
  addSymbol: vi.fn(),
  removeSymbol: vi.fn(),
  analyzeSymbol: vi.fn(),
  analyzing: null,
  analyzeError: null,
  watchlistError: null,
};

function renderPage(overrides = {}) {
  mockUseDashboard.mockReturnValue({ ...defaultDashboard, ...overrides });
  return render(
    <MemoryRouter>
      <StockDashboardPage />
    </MemoryRouter>,
  );
}

describe('StockDashboardPage', () => {
  it('renders StockTable component (table element)', () => {
    renderPage({ rows: [] });
    // StockTable renders "No stocks yet..." when empty
    expect(screen.getByText(/No stocks yet/)).toBeInTheDocument();
  });

  it('shows error banner when analyzeError is set', () => {
    renderPage({ analyzeError: 'Analysis failed badly' });
    expect(screen.getByText(/Analysis failed: Analysis failed badly/)).toBeInTheDocument();
  });

  it('shows error banner when watchlistError is set', () => {
    renderPage({ watchlistError: 'Could not load watchlist' });
    expect(screen.getByText('Could not load watchlist')).toBeInTheDocument();
  });

  it('"Refresh" button calls refresh', () => {
    const refresh = vi.fn();
    renderPage({ refresh });
    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));
    expect(refresh).toHaveBeenCalled();
  });

  it('shows "Loading…" on Refresh button when overallLoading', () => {
    renderPage({ overallLoading: true });
    expect(screen.getByRole('button', { name: /Loading…/i })).toBeInTheDocument();
  });
});
