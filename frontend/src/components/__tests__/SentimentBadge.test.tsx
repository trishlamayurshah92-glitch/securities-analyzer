import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SentimentBadge from '../SentimentBadge';

describe('SentimentBadge', () => {
  it('renders "Bullish" text', () => {
    render(<SentimentBadge sentiment="Bullish" />);
    expect(screen.getByText('Bullish')).toBeInTheDocument();
  });

  it('applies blue styling for Bullish', () => {
    render(<SentimentBadge sentiment="Bullish" />);
    const badge = screen.getByText('Bullish');
    expect(badge.className).toContain('text-[#0052CC]');
  });

  it('renders "Bearish" text', () => {
    render(<SentimentBadge sentiment="Bearish" />);
    expect(screen.getByText('Bearish')).toBeInTheDocument();
  });

  it('applies red styling for Bearish', () => {
    render(<SentimentBadge sentiment="Bearish" />);
    const badge = screen.getByText('Bearish');
    expect(badge.className).toContain('text-red-700');
  });

  it('renders "Mixed" with yellow styling', () => {
    render(<SentimentBadge sentiment="Mixed" />);
    const badge = screen.getByText('Mixed');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-yellow-700');
  });

  it('renders "Neutral" with gray styling', () => {
    render(<SentimentBadge sentiment="Neutral" />);
    const badge = screen.getByText('Neutral');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-gray-600');
  });

  it('renders "N/A" when sentiment is null', () => {
    render(<SentimentBadge sentiment={null} />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('renders "N/A" when sentiment is undefined', () => {
    render(<SentimentBadge sentiment={undefined} />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });
});
