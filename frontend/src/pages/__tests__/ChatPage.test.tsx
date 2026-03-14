import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatPage from '../ChatPage';

const mockUseChat = vi.fn();

vi.mock('../../hooks/useChat', () => ({
  useChat: () => mockUseChat(),
}));

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));
vi.mock('remark-gfm', () => ({ default: () => {} }));

const defaultChat = {
  messages: [],
  streaming: false,
  activeTools: [],
  error: null,
  sendMessage: vi.fn(),
  clearMessages: vi.fn(),
};

function renderPage(overrides = {}) {
  mockUseChat.mockReturnValue({ ...defaultChat, ...overrides });
  return render(<ChatPage />);
}

describe('ChatPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows 4 starter prompts when messages=[]', () => {
    renderPage({ messages: [] });
    const buttons = screen.getAllByRole('button');
    // Starter prompts are buttons plus the Send button
    const starterButtons = buttons.filter((b) => b.className.includes('rounded-full'));
    expect(starterButtons).toHaveLength(4);
  });

  it('clicking starter prompt calls sendMessage with prompt text', () => {
    const sendMessage = vi.fn();
    renderPage({ messages: [], sendMessage });
    const starterButton = screen.getByRole('button', { name: /Any news on NVDA/i });
    fireEvent.click(starterButton);
    expect(sendMessage).toHaveBeenCalledWith('Any news on NVDA?');
  });

  it('hides starter prompts when messages are present', async () => {
    renderPage({
      messages: [{ role: 'user', content: 'Hello' }, { role: 'assistant', content: 'Hi!' }],
    });
    await waitFor(() => {
      expect(screen.queryByText(/Any news on NVDA/i)).not.toBeInTheDocument();
    });
  });

  it('Send button is disabled when streaming=true', () => {
    renderPage({ streaming: true });
    const sendBtn = screen.getByRole('button', { name: /Send/i });
    expect(sendBtn).toBeDisabled();
  });

  it('Send button is disabled when input is empty', () => {
    renderPage({ streaming: false });
    const sendBtn = screen.getByRole('button', { name: /Send/i });
    expect(sendBtn).toBeDisabled();
  });

  it('pressing Enter calls sendMessage', () => {
    const sendMessage = vi.fn();
    renderPage({ sendMessage });
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'What is AAPL doing?' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(sendMessage).toHaveBeenCalledWith('What is AAPL doing?');
  });

  it('pressing Shift+Enter does NOT send', () => {
    const sendMessage = vi.fn();
    renderPage({ sendMessage });
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'line1' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('error banner shown when error is set', () => {
    renderPage({ error: 'Something went wrong' });
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
