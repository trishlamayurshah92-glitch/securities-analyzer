import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import WatchlistPage from '../WatchlistPage';

const mockUseWatchlist = vi.fn();

vi.mock('../../hooks/useWatchlist', () => ({
  useWatchlist: () => mockUseWatchlist(),
}));

// Mock SymbolInput to avoid api calls
vi.mock('../../components/SymbolInput', () => ({
  default: () => <div data-testid="symbol-input" />,
}));

const watchlistItems = [
  { id: 1, symbol: 'AAPL', addedAt: '2024-01-01' },
  { id: 2, symbol: 'NVDA', addedAt: '2024-01-02' },
];

describe('WatchlistPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Watchlist is empty" when data is []', () => {
    mockUseWatchlist.mockReturnValue({
      data: [],
      loading: false,
      error: null,
      addSymbol: vi.fn(),
      removeSymbol: vi.fn(),
      refresh: vi.fn(),
    });

    render(<MemoryRouter><WatchlistPage /></MemoryRouter>);
    expect(screen.getByText(/Watchlist is empty/)).toBeInTheDocument();
  });

  it('renders one list item per watchlist entry', () => {
    mockUseWatchlist.mockReturnValue({
      data: watchlistItems,
      loading: false,
      error: null,
      addSymbol: vi.fn(),
      removeSymbol: vi.fn(),
      refresh: vi.fn(),
    });

    render(<MemoryRouter><WatchlistPage /></MemoryRouter>);
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('NVDA')).toBeInTheDocument();
  });

  it('delete button calls removeSymbol with the correct symbol', () => {
    const removeSymbol = vi.fn();
    mockUseWatchlist.mockReturnValue({
      data: watchlistItems,
      loading: false,
      error: null,
      addSymbol: vi.fn(),
      removeSymbol,
      refresh: vi.fn(),
    });

    render(<MemoryRouter><WatchlistPage /></MemoryRouter>);
    const removeButtons = screen.getAllByTitle('Remove');
    fireEvent.click(removeButtons[0]);
    expect(removeSymbol).toHaveBeenCalledWith('AAPL');
  });
});
