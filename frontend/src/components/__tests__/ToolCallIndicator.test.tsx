import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ToolCallIndicator from '../ToolCallIndicator';

describe('ToolCallIndicator', () => {
  it('get_stock_fundamentals → renders "Checking fundamentals"', () => {
    render(<ToolCallIndicator tools={['get_stock_fundamentals']} />);
    expect(screen.getByText('Checking fundamentals')).toBeInTheDocument();
  });

  it('get_price_history → renders "Loading price history"', () => {
    render(<ToolCallIndicator tools={['get_price_history']} />);
    expect(screen.getByText('Loading price history')).toBeInTheDocument();
  });

  it('get_analyst_recommendations → renders "Fetching analyst ratings"', () => {
    render(<ToolCallIndicator tools={['get_analyst_recommendations']} />);
    expect(screen.getByText('Fetching analyst ratings')).toBeInTheDocument();
  });

  it('get_company_news → renders "Fetching latest news"', () => {
    render(<ToolCallIndicator tools={['get_company_news']} />);
    expect(screen.getByText('Fetching latest news')).toBeInTheDocument();
  });

  it('search_history → renders "Searching analysis history"', () => {
    render(<ToolCallIndicator tools={['search_history']} />);
    expect(screen.getByText('Searching analysis history')).toBeInTheDocument();
  });

  it('multiple tools → renders one indicator per tool', () => {
    render(<ToolCallIndicator tools={['get_company_news', 'get_stock_fundamentals', 'search_history']} />);
    expect(screen.getByText('Fetching latest news')).toBeInTheDocument();
    expect(screen.getByText('Checking fundamentals')).toBeInTheDocument();
    expect(screen.getByText('Searching analysis history')).toBeInTheDocument();
  });

  it('empty tools renders nothing', () => {
    const { container } = render(<ToolCallIndicator tools={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
