import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LoadingOverlay from '../LoadingOverlay';

describe('LoadingOverlay', () => {
  it('renders "Analyzing..." text', () => {
    render(<LoadingOverlay />);
    expect(screen.getByText('Analyzing...')).toBeInTheDocument();
  });

  it('is rendered with fixed positioning class', () => {
    const { container } = render(<LoadingOverlay />);
    const overlay = container.firstChild as HTMLElement;
    expect(overlay.className).toContain('fixed');
  });

  it('renders the time estimate text', () => {
    render(<LoadingOverlay />);
    expect(screen.getByText(/30.60 seconds/i)).toBeInTheDocument();
  });
});
