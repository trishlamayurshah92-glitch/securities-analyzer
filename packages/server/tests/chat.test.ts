import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before the dynamic import of the route
// ---------------------------------------------------------------------------

vi.mock('../src/config.js', () => ({
  // Point to a path that does not exist so the route treats the watchlist as empty
  WATCHLIST_PATH: '/nonexistent/watchlist.json',
}));

vi.mock('../src/agent/chat-prompts.js', () => ({
  buildChatSystemPrompt: vi.fn(() => 'You are a stock assistant.'),
}));

const mockCallTool = vi.fn();
const mockGetAllTools = vi.fn().mockReturnValue([]);
const mockGetMCPManager = vi.fn();

vi.mock('../src/agent/mcp-singleton.js', () => ({
  getMCPManager: () => mockGetMCPManager(),
}));

// Anthropic SDK: expose the stream function so tests can control it per-call
const mockAnthropicStream = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { stream: mockAnthropicStream },
  })),
}));

// OpenAI SDK: expose the create function so tests can control it per-call
const mockOpenAICreate = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockOpenAICreate } },
  })),
}));

// ---------------------------------------------------------------------------
// Import route after mocks are registered
// ---------------------------------------------------------------------------

const { chatRouter } = await import('../src/web/routes/chat.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/chat', chatRouter);
  return app;
}

/** Parse all `data:` lines from a raw SSE body into typed event objects. */
function parseSSE(body: string): Array<Record<string, unknown>> {
  return body
    .split('\n\n')
    .flatMap((block) => block.split('\n').filter((l) => l.startsWith('data: ')))
    .map((line) => { try { return JSON.parse(line.slice(6)); } catch { return null; } })
    .filter(Boolean) as Array<Record<string, unknown>>;
}

/**
 * Build a fake Anthropic streaming object.
 * `textChunks` are fired synchronously when `on('text', handler)` is called,
 * matching real behaviour where text events emit before finalMessage resolves.
 */
function makeAnthropicStream(textChunks: string[], finalMsg: object) {
  return {
    on: vi.fn((event: string, handler: (t: string) => void) => {
      if (event === 'text') textChunks.forEach((t) => handler(t));
    }),
    finalMessage: vi.fn().mockResolvedValue(finalMsg),
  };
}

/** Default MCP manager stub used by most tests. */
function defaultMCPManager(tools: object[] = []) {
  return { getAllToolsForClaude: () => tools, callTool: mockCallTool };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.MODEL;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.OPENAI_API_KEY;

  // Default: MCP manager resolves immediately with no tools
  mockGetMCPManager.mockResolvedValue(defaultMCPManager());
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/chat — input validation', () => {
  it('returns 400 when message field is absent', async () => {
    const res = await request(createApp()).post('/api/chat').send({});
    expect(res.status).toBe(400);
    expect(res.body.detail).toBeTruthy();
  });

  it('returns 400 when message is not a string', async () => {
    const res = await request(createApp()).post('/api/chat').send({ message: 123 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when message is an empty string', async () => {
    const res = await request(createApp()).post('/api/chat').send({ message: '' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/chat — SSE setup', () => {
  it('sets Content-Type: text/event-stream', async () => {
    process.env.MODEL = 'gpt-4o';
    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: 'Hi', tool_calls: null } }],
    });

    const res = await request(createApp()).post('/api/chat').send({ message: 'hi' });

    expect(res.headers['content-type']).toContain('text/event-stream');
  });

  it('sets Cache-Control: no-cache', async () => {
    process.env.MODEL = 'gpt-4o';
    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: 'Hi', tool_calls: null } }],
    });

    const res = await request(createApp()).post('/api/chat').send({ message: 'hi' });

    expect(res.headers['cache-control']).toContain('no-cache');
  });
});

describe('POST /api/chat — OpenAI path (no tool calls)', () => {
  beforeEach(() => {
    process.env.MODEL = 'gpt-4o';
  });

  it('streams token events then sends done', async () => {
    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: 'Hello world', tool_calls: null } }],
    });

    const res = await request(createApp()).post('/api/chat').send({ message: 'hi' });
    const events = parseSSE(res.text);

    const allText = events.filter((e) => e.type === 'token').map((e) => e.content).join('');
    expect(allText).toBe('Hello world');
    expect(events.at(-1)).toMatchObject({ type: 'done' });
  });

  it('done is always the very last SSE event', async () => {
    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: 'Response text', tool_calls: null } }],
    });

    const res = await request(createApp()).post('/api/chat').send({ message: 'test' });
    const events = parseSSE(res.text);

    expect(events.at(-1)?.type).toBe('done');
  });

  it('handles null content without stalling', async () => {
    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: null, tool_calls: null } }],
    });

    const res = await request(createApp()).post('/api/chat').send({ message: 'test' });
    const events = parseSSE(res.text);

    expect(events.at(-1)).toMatchObject({ type: 'done' });
  });

  it('includes system prompt and user message in the LLM call', async () => {
    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: 'ok', tool_calls: null } }],
    });

    await request(createApp()).post('/api/chat').send({ message: 'What is AAPL?' });

    const msgs: any[] = mockOpenAICreate.mock.calls[0][0].messages;
    expect(msgs[0].role).toBe('system');
    expect(msgs.at(-1)).toMatchObject({ role: 'user', content: 'What is AAPL?' });
  });

  it('prepends conversation history to the message list', async () => {
    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: 'ok', tool_calls: null } }],
    });

    await request(createApp())
      .post('/api/chat')
      .send({
        message: 'Follow-up',
        history: [
          { role: 'user', content: 'First question' },
          { role: 'assistant', content: 'First answer' },
        ],
      });

    const msgs: any[] = mockOpenAICreate.mock.calls[0][0].messages;
    const roles = msgs.map((m: any) => m.role);
    // system + user(history) + assistant(history) + user(current)
    expect(roles).toEqual(['system', 'user', 'assistant', 'user']);
  });
});

describe('POST /api/chat — OpenAI path (tool calls)', () => {
  const TOOL = {
    name: 'get_stock_fundamentals',
    description: 'Get fundamentals',
    input_schema: { type: 'object', properties: { symbol: { type: 'string' } } },
  };

  beforeEach(() => {
    process.env.MODEL = 'gpt-4o';
    mockGetMCPManager.mockResolvedValue(defaultMCPManager([TOOL]));
  });

  it('emits tool_start and tool_done, calls callTool, ends with done', async () => {
    mockCallTool.mockResolvedValue('{"price":150}');
    mockOpenAICreate
      .mockResolvedValueOnce({
        choices: [{
          message: {
            role: 'assistant', content: null,
            tool_calls: [{
              id: 'call_1', type: 'function',
              function: { name: 'get_stock_fundamentals', arguments: '{"symbol":"AAPL"}' },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'AAPL is $150.', tool_calls: null } }],
      });

    const res = await request(createApp())
      .post('/api/chat')
      .send({ message: 'What is AAPL price?' });

    const events = parseSSE(res.text);
    const types = events.map((e) => e.type);

    expect(types).toContain('tool_start');
    expect(types).toContain('tool_done');
    expect(events.find((e) => e.type === 'tool_start')).toMatchObject({ name: 'get_stock_fundamentals' });
    expect(mockCallTool).toHaveBeenCalledWith('get_stock_fundamentals', { symbol: 'AAPL' });
    expect(events.at(-1)).toMatchObject({ type: 'done' });
  });

  it('passes tool result back to LLM in the second call', async () => {
    mockCallTool.mockResolvedValue('{"price":200}');
    mockOpenAICreate
      .mockResolvedValueOnce({
        choices: [{
          message: {
            role: 'assistant', content: null,
            tool_calls: [{
              id: 'call_1', type: 'function',
              function: { name: 'get_stock_fundamentals', arguments: '{"symbol":"MSFT"}' },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'MSFT is $200.', tool_calls: null } }],
      });

    await request(createApp()).post('/api/chat').send({ message: 'MSFT price?' });

    const secondCallMessages: any[] = mockOpenAICreate.mock.calls[1][0].messages;
    const toolMsg = secondCallMessages.find((m: any) => m.role === 'tool');
    expect(toolMsg).toBeDefined();
    expect(toolMsg.content).toContain('200');
    expect(toolMsg.tool_call_id).toBe('call_1');
  });

  it('stream still terminates when callTool throws (no stall)', async () => {
    mockCallTool.mockRejectedValue(new Error('MCP server down'));
    mockOpenAICreate
      .mockResolvedValueOnce({
        choices: [{
          message: {
            role: 'assistant', content: null,
            tool_calls: [{
              id: 'call_1', type: 'function',
              function: { name: 'get_stock_fundamentals', arguments: '{"symbol":"AAPL"}' },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Could not fetch data.', tool_calls: null } }],
      });

    const res = await request(createApp()).post('/api/chat').send({ message: 'AAPL?' });
    const events = parseSSE(res.text);
    const lastType = events.at(-1)?.type;

    // Stream MUST terminate — frontend only clears streaming=true on done or error
    expect(['done', 'error']).toContain(lastType);
  });
});

describe('POST /api/chat — Anthropic path (no tool calls)', () => {
  beforeEach(() => {
    process.env.MODEL = 'claude-sonnet-4-20250514';
  });

  it('fires token events for each streamed chunk', async () => {
    mockAnthropicStream.mockReturnValue(
      makeAnthropicStream(['Hello ', 'world'], {
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Hello world' }],
      }),
    );

    const res = await request(createApp()).post('/api/chat').send({ message: 'hi' });
    const events = parseSSE(res.text);

    const text = events.filter((e) => e.type === 'token').map((e) => e.content).join('');
    expect(text).toBe('Hello world');
    expect(events.at(-1)).toMatchObject({ type: 'done' });
  });

  it('done is always the very last SSE event', async () => {
    mockAnthropicStream.mockReturnValue(
      makeAnthropicStream(['Hi'], {
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Hi' }],
      }),
    );

    const res = await request(createApp()).post('/api/chat').send({ message: 'test' });
    const events = parseSSE(res.text);

    expect(events.at(-1)?.type).toBe('done');
  });

  it('breaks when stop_reason is end_turn with no tool blocks', async () => {
    const stream = makeAnthropicStream([], {
      stop_reason: 'end_turn',
      content: [],
    });
    mockAnthropicStream.mockReturnValue(stream);

    const res = await request(createApp()).post('/api/chat').send({ message: 'ok' });
    const events = parseSSE(res.text);

    // Should only call stream once (no retry loop)
    expect(mockAnthropicStream).toHaveBeenCalledTimes(1);
    expect(events.at(-1)).toMatchObject({ type: 'done' });
  });
});

describe('POST /api/chat — Anthropic path (tool calls)', () => {
  const TOOL = {
    name: 'get_company_news',
    description: 'Get news',
    input_schema: { type: 'object' },
  };

  beforeEach(() => {
    process.env.MODEL = 'claude-sonnet-4-20250514';
    mockGetMCPManager.mockResolvedValue(defaultMCPManager([TOOL]));
  });

  it('executes tool, emits tool events, ends with done', async () => {
    mockCallTool.mockResolvedValue('[{"headline":"Big news"}]');

    mockAnthropicStream
      .mockReturnValueOnce(
        makeAnthropicStream([], {
          stop_reason: 'tool_use',
          content: [
            { type: 'tool_use', id: 'tu_1', name: 'get_company_news', input: { symbol: 'TSLA' } },
          ],
        }),
      )
      .mockReturnValueOnce(
        makeAnthropicStream(['TSLA news is positive.'], {
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'TSLA news is positive.' }],
        }),
      );

    const res = await request(createApp()).post('/api/chat').send({ message: 'TSLA news?' });
    const events = parseSSE(res.text);
    const types = events.map((e) => e.type);

    expect(types).toContain('tool_start');
    expect(types).toContain('tool_done');
    expect(events.find((e) => e.type === 'tool_start')).toMatchObject({ name: 'get_company_news' });
    expect(mockCallTool).toHaveBeenCalledWith('get_company_news', { symbol: 'TSLA' });
    expect(events.at(-1)).toMatchObject({ type: 'done' });
  });

  it('wraps callTool error as is_error tool_result and continues', async () => {
    mockCallTool.mockRejectedValueOnce(new Error('Finnhub rate limit'));

    mockAnthropicStream
      .mockReturnValueOnce(
        makeAnthropicStream([], {
          stop_reason: 'tool_use',
          content: [
            { type: 'tool_use', id: 'tu_err', name: 'get_company_news', input: { symbol: 'X' } },
          ],
        }),
      )
      .mockReturnValueOnce(
        makeAnthropicStream(['Could not fetch.'], {
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Could not fetch.' }],
        }),
      );

    const res = await request(createApp()).post('/api/chat').send({ message: 'X news?' });

    // Error tool result must be passed in the second LLM call
    const secondCallMessages: any[] = mockAnthropicStream.mock.calls[1][0].messages;
    const toolResultMsg = secondCallMessages.find(
      (m: any) => Array.isArray(m.content) && m.content.some((b: any) => b.type === 'tool_result'),
    );
    expect(toolResultMsg).toBeDefined();
    const toolResult = toolResultMsg.content.find((b: any) => b.type === 'tool_result');
    expect(toolResult.is_error).toBe(true);
    expect(toolResult.content).toContain('Error');

    // Stream terminates normally
    const events = parseSSE(res.text);
    expect(events.at(-1)).toMatchObject({ type: 'done' });
  });
});

describe('POST /api/chat — error handling (no stall guarantee)', () => {
  it('sends error event when LLM API throws — stream does not hang', async () => {
    process.env.MODEL = 'gpt-4o';
    mockOpenAICreate.mockRejectedValue(new Error('Rate limit exceeded'));

    const res = await request(createApp()).post('/api/chat').send({ message: 'test' });
    const events = parseSSE(res.text);

    expect(events.some((e) => e.type === 'error')).toBe(true);
  });

  it('sends error event when getMCPManager rejects — stream does not hang', async () => {
    process.env.MODEL = 'gpt-4o';
    mockGetMCPManager.mockRejectedValue(new Error('MCP servers unavailable'));

    const res = await request(createApp()).post('/api/chat').send({ message: 'test' });
    const events = parseSSE(res.text);

    expect(events.some((e) => e.type === 'error')).toBe(true);
  });

  it('stream always ends with done or error — never leaves frontend in streaming=true', async () => {
    // This is the core anti-stall regression test.
    // The frontend only clears streaming=true when it receives 'done' or 'error'.
    // If neither arrives the UI is permanently locked in "Thinking..." state.
    process.env.MODEL = 'gpt-4o';
    mockOpenAICreate.mockRejectedValue(new Error('Network failure'));

    const res = await request(createApp()).post('/api/chat').send({ message: 'test' });
    const events = parseSSE(res.text);

    const terminates = events.some((e) => e.type === 'done' || e.type === 'error');
    expect(terminates).toBe(true);
  });

  it('error event includes a human-readable message', async () => {
    process.env.MODEL = 'gpt-4o';
    mockOpenAICreate.mockRejectedValue(new Error('503 Service Unavailable'));

    const res = await request(createApp()).post('/api/chat').send({ message: 'test' });
    const events = parseSSE(res.text);
    const errorEvent = events.find((e) => e.type === 'error') as any;

    expect(typeof errorEvent?.message).toBe('string');
    expect(errorEvent.message.length).toBeGreaterThan(0);
  });
});
