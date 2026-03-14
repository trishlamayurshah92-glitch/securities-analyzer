import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AnalysisReport from '../AnalysisReport';

// Mock react-markdown to avoid full markdown rendering in jsdom
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));
vi.mock('remark-gfm', () => ({ default: () => {} }));

describe('AnalysisReport', () => {
  const props = {
    markdown: '# AAPL Analysis\n\nThis looks great.',
    model: 'gemini-2.5-flash',
    duration: 42,
    stocks: ['AAPL', 'NVDA'],
  };

  it('renders model name', () => {
    render(<AnalysisReport {...props} />);
    expect(screen.getByText('gemini-2.5-flash')).toBeInTheDocument();
  });

  it('renders duration in seconds', () => {
    render(<AnalysisReport {...props} />);
    expect(screen.getByText('42s')).toBeInTheDocument();
  });

  it('renders stocks as comma-separated list', () => {
    render(<AnalysisReport {...props} />);
    expect(screen.getByText('AAPL, NVDA')).toBeInTheDocument();
  });

  it('renders markdown content', () => {
    render(<AnalysisReport {...props} />);
    const md = screen.getByTestId('markdown');
    expect(md).toBeInTheDocument();
    expect(md.textContent).toContain('AAPL Analysis');
  });
});
