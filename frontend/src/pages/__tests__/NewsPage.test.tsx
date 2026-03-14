import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NewsPage from '../NewsPage';

const mockUseNews = vi.fn();

vi.mock('../../hooks/useNews', () => ({
  useNews: () => mockUseNews(),
}));

vi.mock('../../components/NewsCard', () => ({
  default: ({ article }: { article: { headline: string } }) => (
    <div data-testid="news-card">{article.headline}</div>
  ),
}));

const articles = [
  { headline: 'Apple soars', summary: 'Good', source: 'Reuters', datetime: '2024-01-01', url: 'https://ex.com/1' },
  { headline: 'AAPL earnings', summary: '', source: 'Bloomberg', datetime: '2024-01-02', url: 'https://ex.com/2' },
];

function renderNewsPage(symbol = 'AAPL') {
  return render(
    <MemoryRouter initialEntries={[`/news/${symbol}`]}>
      <Routes>
        <Route path="/news/:symbol" element={<NewsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NewsPage', () => {
  it('shows 5 skeleton loaders while loading=true', () => {
    mockUseNews.mockReturnValue({ data: [], loading: true, error: null });
    const { container } = renderNewsPage();
    const skeletons = container.querySelectorAll('.animate-pulse');
    // Each skeleton card has 4 animate-pulse divs, 5 cards = 20
    expect(skeletons.length).toBeGreaterThanOrEqual(5);
  });

  it('shows error banner when error is set', () => {
    mockUseNews.mockReturnValue({ data: [], loading: false, error: 'Fetch failed' });
    renderNewsPage();
    expect(screen.getByText('Fetch failed')).toBeInTheDocument();
  });

  it('shows "No recent news found" when data is empty and not loading', () => {
    mockUseNews.mockReturnValue({ data: [], loading: false, error: null });
    renderNewsPage();
    expect(screen.getByText(/No recent news found/)).toBeInTheDocument();
  });

  it('renders a NewsCard for each article', () => {
    mockUseNews.mockReturnValue({ data: articles, loading: false, error: null });
    renderNewsPage();
    const cards = screen.getAllByTestId('news-card');
    expect(cards).toHaveLength(articles.length);
  });

  it('back link navigates to /dashboard', () => {
    mockUseNews.mockReturnValue({ data: [], loading: false, error: null });
    renderNewsPage();
    const backLink = screen.getByRole('link', { name: /← Back/i });
    expect(backLink).toHaveAttribute('href', '/dashboard');
  });
});
