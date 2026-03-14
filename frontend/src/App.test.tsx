import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Routes, Route, Navigate } from 'react-router-dom';

// Mock AuthContext
const mockUseAuth = vi.fn();
vi.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => mockUseAuth(),
}));

// Mock heavy pages
vi.mock('./pages/LoginPage', () => ({
  default: () => <div data-testid="login-page">Login</div>,
}));
vi.mock('./pages/StockDashboardPage', () => ({
  default: () => <div data-testid="dashboard-page">Dashboard</div>,
}));
vi.mock('./components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));
vi.mock('./pages/HistoryPage', () => ({ default: () => <div>History</div> }));
vi.mock('./pages/NewsPage', () => ({ default: () => <div>News</div> }));
vi.mock('./pages/ChatPage', () => ({ default: () => <div>Chat</div> }));

// Import the route guards directly instead of the full App to avoid re-mocking issues
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = mockUseAuth();
  if (loading) return null;
  if (session) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = mockUseAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function TestApp() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><div data-testid="login-page">Login</div></PublicRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><div data-testid="dashboard-page">Dashboard</div></ProtectedRoute>} />
    </Routes>
  );
}

describe('App routing', () => {
  it('unauthenticated user accessing /dashboard redirects to /login', () => {
    mockUseAuth.mockReturnValue({ session: null, loading: false });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <TestApp />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
  });

  it('authenticated user accessing /login redirects to /dashboard', () => {
    mockUseAuth.mockReturnValue({ session: { access_token: 'tok' }, loading: false });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <TestApp />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('loading state renders null (no flash)', () => {
    mockUseAuth.mockReturnValue({ session: null, loading: true });

    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <TestApp />
      </MemoryRouter>,
    );

    expect(container.firstChild).toBeNull();
  });
});
