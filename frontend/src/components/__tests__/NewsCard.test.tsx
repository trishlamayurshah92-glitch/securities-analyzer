import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import NewsCard from '../NewsCard';
import type { NewsArticle } from '../../api/client';

const article: NewsArticle = {
  headline: 'Apple Hits All-Time High',
  summary: 'Stock surges on strong earnings beat.',
  source: 'Reuters',
  datetime: new Date('2024-06-01T12:00:00Z').toISOString(),
  url: 'https://example.com/article',
};

describe('NewsCard', () => {
  it('renders headline as a link with correct href', () => {
    render(<NewsCard article={article} />);
    const link = screen.getByRole('link', { name: /apple hits all-time high/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com/article');
  });

  it('headline link opens in new tab', () => {
    render(<NewsCard article={article} />);
    const link = screen.getByRole('link', { name: /apple hits all-time high/i });
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders source text', () => {
    render(<NewsCard article={article} />);
    expect(screen.getByText(/Reuters/)).toBeInTheDocument();
  });

  it('renders formatted date', () => {
    render(<NewsCard article={article} />);
    // The date formatting depends on locale, just check something date-like is visible
    const dateEl = screen.getByText(/Jun|2024/i);
    expect(dateEl).toBeInTheDocument();
  });

  it('renders summary when article.summary is truthy', () => {
    render(<NewsCard article={article} />);
    expect(screen.getByText('Stock surges on strong earnings beat.')).toBeInTheDocument();
  });

  it('does NOT render summary when article.summary is falsy', () => {
    const noSummary = { ...article, summary: '' };
    render(<NewsCard article={noSummary} />);
    expect(screen.queryByText('Stock surges on strong earnings beat.')).not.toBeInTheDocument();
  });
});
