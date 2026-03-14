import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChatMessage from '../ChatMessage';
import type { ChatMessage as ChatMsg } from '../../api/chatClient';

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));
vi.mock('remark-gfm', () => ({ default: () => {} }));

describe('ChatMessage', () => {
  it('user message is right-aligned', () => {
    const msg: ChatMsg = { role: 'user', content: 'Hello!' };
    const { container } = render(<ChatMessage message={msg} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('justify-end');
  });

  it('assistant message is left-aligned', () => {
    const msg: ChatMsg = { role: 'assistant', content: 'Hi there!' };
    const { container } = render(<ChatMessage message={msg} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('justify-start');
  });

  it('empty assistant content shows blinking cursor element', () => {
    const msg: ChatMsg = { role: 'assistant', content: '' };
    const { container } = render(<ChatMessage message={msg} />);
    const cursor = container.querySelector('.animate-pulse');
    expect(cursor).toBeInTheDocument();
  });

  it('non-empty assistant content renders markdown', () => {
    const msg: ChatMsg = { role: 'assistant', content: '## Analysis\n\nLooks good.' };
    render(<ChatMessage message={msg} />);
    expect(screen.getByTestId('markdown')).toBeInTheDocument();
  });

  it('user message renders plain text without markdown wrapper', () => {
    const msg: ChatMsg = { role: 'user', content: 'What is AAPL?' };
    render(<ChatMessage message={msg} />);
    expect(screen.queryByTestId('markdown')).not.toBeInTheDocument();
    expect(screen.getByText('What is AAPL?')).toBeInTheDocument();
  });
});
