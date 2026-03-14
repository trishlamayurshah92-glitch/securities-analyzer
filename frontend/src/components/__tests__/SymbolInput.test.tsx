import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SymbolInput from '../SymbolInput';

// Mock the api module
const mockSearchSymbols = vi.fn();
vi.mock('../../api/client', () => ({
  api: {
    searchSymbols: (...args: unknown[]) => mockSearchSymbols(...args),
  },
}));

describe('SymbolInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('input is uppercased automatically', () => {
    mockSearchSymbols.mockResolvedValue([]);
    render(<SymbolInput onSubmit={vi.fn()} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'aapl' } });

    expect(input.value).toBe('AAPL');
  });

  it('typing calls searchSymbols after debounce (300ms)', async () => {
    mockSearchSymbols.mockResolvedValue([]);
    render(<SymbolInput onSubmit={vi.fn()} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'AA' } });

    // Wait for the 300ms debounce to fire and searchSymbols to be called
    await waitFor(() => {
      expect(mockSearchSymbols).toHaveBeenCalledWith('AA');
    }, { timeout: 2000 });
  });

  it('matching suggestions appear in dropdown', async () => {
    mockSearchSymbols.mockResolvedValue([
      { symbol: 'AAPL', description: 'Apple Inc.' },
    ]);

    render(<SymbolInput onSubmit={vi.fn()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'AAPL' } });

    await waitFor(() => {
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('clicking a suggestion selects it and closes dropdown', async () => {
    mockSearchSymbols.mockResolvedValue([
      { symbol: 'AAPL', description: 'Apple Inc.' },
    ]);

    render(<SymbolInput onSubmit={vi.fn()} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'AAPL' } });

    await waitFor(() => screen.getByText('Apple Inc.'), { timeout: 2000 });

    fireEvent.mouseDown(screen.getByText('Apple Inc.').closest('li')!);

    await waitFor(() => {
      expect(input.value).toBe('AAPL');
      expect(screen.queryByText('Apple Inc.')).not.toBeInTheDocument();
    });
  });

  it('submitting with unrecognized symbol shows error', async () => {
    mockSearchSymbols.mockResolvedValue([]);

    render(<SymbolInput onSubmit={vi.fn()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'FAKE' } });

    await act(async () => {
      fireEvent.submit(input.closest('form')!);
    });

    await waitFor(() => {
      expect(screen.getByText(/"FAKE" is not a recognized ticker symbol./)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('submitting with valid selected symbol calls onSubmit', async () => {
    mockSearchSymbols.mockResolvedValue([
      { symbol: 'AAPL', description: 'Apple Inc.' },
    ]);

    const onSubmit = vi.fn();
    render(<SymbolInput onSubmit={onSubmit} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'AAPL' } });

    await waitFor(() => screen.getByText('Apple Inc.'), { timeout: 2000 });

    // Select the suggestion
    fireEvent.mouseDown(screen.getByText('Apple Inc.').closest('li')!);

    await act(async () => {
      fireEvent.submit(input.closest('form')!);
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('AAPL');
    });
  });

  it('submit button is disabled while loading', async () => {
    // Make search hang
    mockSearchSymbols.mockReturnValue(new Promise(() => {}));

    render(<SymbolInput onSubmit={vi.fn()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'AAPL' } });

    const submitBtn = screen.getByRole('button');
    await act(async () => {
      fireEvent.submit(input.closest('form')!);
    });

    await waitFor(() => {
      expect(submitBtn).toBeDisabled();
    });
  });
});
