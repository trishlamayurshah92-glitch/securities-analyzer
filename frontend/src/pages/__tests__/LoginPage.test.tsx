import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LoginPage from '../LoginPage';

const mockSignInWithGoogle = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    session: null,
    user: null,
    loading: false,
    signInWithGoogle: mockSignInWithGoogle,
    signOut: vi.fn(),
  }),
}));

describe('LoginPage', () => {
  it('renders "Sign in with Google" button', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
  });

  it('clicking button calls signInWithGoogle', () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }));
    expect(mockSignInWithGoogle).toHaveBeenCalled();
  });
});
