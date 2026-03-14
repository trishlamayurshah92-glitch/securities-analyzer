import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { streamChat } from '../chatClient';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

function makeSSEStream(lines: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(new TextEncoder().encode(line));
      }
      controller.close();
    },
  });
}

describe('streamChat', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts to /api/chat with message and history', async () => {
    fetchMock.mockResolvedValue({ body: makeSSEStream([]) });
    const history = [{ role: 'user' as const, content: 'prev' }];
    await streamChat('hello', history, {
      onToken: vi.fn(),
      onToolStart: vi.fn(),
      onToolDone: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ message: 'hello', history }),
    }));
  });

  it('token SSE event triggers onToken callback', async () => {
    const sseData = 'data: {"type":"token","content":"Hello"}\n\n';
    fetchMock.mockResolvedValue({ body: makeSSEStream([sseData]) });

    const onToken = vi.fn();
    await streamChat('hi', [], {
      onToken,
      onToolStart: vi.fn(),
      onToolDone: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    });

    expect(onToken).toHaveBeenCalledWith('Hello');
  });

  it('tool_start SSE event triggers onToolStart', async () => {
    const sseData = 'data: {"type":"tool_start","name":"get_company_news"}\n\n';
    fetchMock.mockResolvedValue({ body: makeSSEStream([sseData]) });

    const onToolStart = vi.fn();
    await streamChat('hi', [], {
      onToken: vi.fn(),
      onToolStart,
      onToolDone: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    });

    expect(onToolStart).toHaveBeenCalledWith('get_company_news');
  });

  it('tool_done SSE event triggers onToolDone', async () => {
    const sseData = 'data: {"type":"tool_done","name":"get_company_news"}\n\n';
    fetchMock.mockResolvedValue({ body: makeSSEStream([sseData]) });

    const onToolDone = vi.fn();
    await streamChat('hi', [], {
      onToken: vi.fn(),
      onToolStart: vi.fn(),
      onToolDone,
      onDone: vi.fn(),
      onError: vi.fn(),
    });

    expect(onToolDone).toHaveBeenCalledWith('get_company_news');
  });

  it('done SSE event triggers onDone', async () => {
    const sseData = 'data: {"type":"done"}\n\n';
    fetchMock.mockResolvedValue({ body: makeSSEStream([sseData]) });

    const onDone = vi.fn();
    await streamChat('hi', [], {
      onToken: vi.fn(),
      onToolStart: vi.fn(),
      onToolDone: vi.fn(),
      onDone,
      onError: vi.fn(),
    });

    expect(onDone).toHaveBeenCalled();
  });

  it('error SSE event triggers onError', async () => {
    const sseData = 'data: {"type":"error","message":"something failed"}\n\n';
    fetchMock.mockResolvedValue({ body: makeSSEStream([sseData]) });

    const onError = vi.fn();
    await streamChat('hi', [], {
      onToken: vi.fn(),
      onToolStart: vi.fn(),
      onToolDone: vi.fn(),
      onDone: vi.fn(),
      onError,
    });

    expect(onError).toHaveBeenCalledWith('something failed');
  });
});
