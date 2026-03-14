import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChat } from '../useChat';

const mockStreamChat = vi.fn();

vi.mock('../../api/chatClient', () => ({
  streamChat: (...args: unknown[]) => mockStreamChat(...args),
}));

describe('useChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: do nothing (simulates streaming that never finishes)
    mockStreamChat.mockResolvedValue(undefined);
  });

  it('sendMessage adds user message and empty assistant message', async () => {
    const { result } = renderHook(() => useChat());

    await act(() => result.current.sendMessage('Hello'));

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toEqual({ role: 'user', content: 'Hello' });
    expect(result.current.messages[1].role).toBe('assistant');
  });

  it('streaming=true after sendMessage starts', async () => {
    // Never resolves — streaming stays true throughout
    mockStreamChat.mockReturnValue(new Promise<void>(() => {}));

    const { result } = renderHook(() => useChat());

    // Start sendMessage without awaiting
    act(() => { result.current.sendMessage('Hello'); });

    // streaming should be true once the state update is flushed
    await waitFor(() => expect(result.current.streaming).toBe(true));
  });

  it('onToken callback appends content to last assistant message', async () => {
    mockStreamChat.mockImplementation(async (_msg: string, _hist: unknown, callbacks: {
      onToken: (t: string) => void;
      onDone: () => void;
      onToolStart: (n: string) => void;
      onToolDone: (n: string) => void;
      onError: (m: string) => void;
    }) => {
      callbacks.onToken('Hello ');
      callbacks.onToken('world');
      callbacks.onDone();
    });

    const { result } = renderHook(() => useChat());

    await act(() => result.current.sendMessage('Hi'));

    const assistantMsg = result.current.messages.find((m) => m.role === 'assistant');
    expect(assistantMsg?.content).toBe('Hello world');
  });

  it('onToolStart adds to activeTools', async () => {
    let capturedCallbacks: {
      onToolStart: (n: string) => void;
      onDone: () => void;
      onToken: (t: string) => void;
      onToolDone: (n: string) => void;
      onError: (m: string) => void;
    } | null = null;

    mockStreamChat.mockImplementation(async (_msg: string, _hist: unknown, callbacks: typeof capturedCallbacks) => {
      capturedCallbacks = callbacks;
      // Never call done — keep streaming
    });

    const { result } = renderHook(() => useChat());

    act(() => { result.current.sendMessage('Hi'); });

    await waitFor(() => expect(capturedCallbacks).not.toBeNull());

    act(() => { capturedCallbacks!.onToolStart('get_company_news'); });

    expect(result.current.activeTools).toContain('get_company_news');
  });

  it('onToolDone removes from activeTools', async () => {
    let capturedCallbacks: {
      onToolStart: (n: string) => void;
      onToolDone: (n: string) => void;
      onDone: () => void;
      onToken: (t: string) => void;
      onError: (m: string) => void;
    } | null = null;

    mockStreamChat.mockImplementation(async (_msg: string, _hist: unknown, callbacks: typeof capturedCallbacks) => {
      capturedCallbacks = callbacks;
    });

    const { result } = renderHook(() => useChat());

    act(() => { result.current.sendMessage('Hi'); });
    await waitFor(() => expect(capturedCallbacks).not.toBeNull());

    act(() => { capturedCallbacks!.onToolStart('get_company_news'); });
    expect(result.current.activeTools).toContain('get_company_news');

    act(() => { capturedCallbacks!.onToolDone('get_company_news'); });
    expect(result.current.activeTools).not.toContain('get_company_news');
  });

  it('onDone callback sets streaming=false', async () => {
    let capturedCallbacks: {
      onDone: () => void;
      onToken: (t: string) => void;
      onToolStart: (n: string) => void;
      onToolDone: (n: string) => void;
      onError: (m: string) => void;
    } | null = null;

    mockStreamChat.mockImplementation(async (_msg: string, _hist: unknown, callbacks: typeof capturedCallbacks) => {
      capturedCallbacks = callbacks;
    });

    const { result } = renderHook(() => useChat());

    act(() => { result.current.sendMessage('Hi'); });
    await waitFor(() => expect(capturedCallbacks).not.toBeNull());

    expect(result.current.streaming).toBe(true);
    act(() => { capturedCallbacks!.onDone(); });

    await waitFor(() => expect(result.current.streaming).toBe(false));
  });

  it('onError sets error and removes empty assistant message', async () => {
    let capturedCallbacks: {
      onError: (m: string) => void;
      onToken: (t: string) => void;
      onToolStart: (n: string) => void;
      onToolDone: (n: string) => void;
      onDone: () => void;
    } | null = null;

    mockStreamChat.mockImplementation(async (_msg: string, _hist: unknown, callbacks: typeof capturedCallbacks) => {
      capturedCallbacks = callbacks;
    });

    const { result } = renderHook(() => useChat());

    act(() => { result.current.sendMessage('Hi'); });
    await waitFor(() => expect(capturedCallbacks).not.toBeNull());

    // No tokens received, empty assistant message
    act(() => { capturedCallbacks!.onError('stream failed'); });

    await waitFor(() => {
      expect(result.current.error).toBe('stream failed');
      // Empty assistant message should be removed, only user message remains
      expect(result.current.messages).toHaveLength(1);
    });
  });

  it('clearMessages resets messages and error to initial state', async () => {
    mockStreamChat.mockImplementation(async (_msg: string, _hist: unknown, callbacks: {
      onDone: () => void;
      onToken: (t: string) => void;
      onToolStart: (n: string) => void;
      onToolDone: (n: string) => void;
      onError: (m: string) => void;
    }) => {
      callbacks.onDone();
    });

    const { result } = renderHook(() => useChat());
    await act(() => result.current.sendMessage('Hi'));

    expect(result.current.messages).toHaveLength(2);

    act(() => result.current.clearMessages());

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });
});
