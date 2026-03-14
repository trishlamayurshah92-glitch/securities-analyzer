import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type OpenAI from 'openai';

// Mock the MCP client manager
const mockSetup = vi.fn();
const mockGetAllTools = vi.fn();
const mockCallTool = vi.fn();
const mockCleanup = vi.fn();
const mockConnectServer = vi.fn();

vi.mock('../src/agent/mcp-client.js', () => ({
  MCPClientManager: vi.fn().mockImplementation(() => ({
    connectServer: mockConnectServer,
    getAllToolsForClaude: mockGetAllTools,
    callTool: mockCallTool,
    callToolWithTimeout: (name: string, args: Record<string, unknown>) => mockCallTool(name, args),
    cleanup: mockCleanup,
  })),
}));

const { StockAnalysisOrchestrator } = await import('../src/agent/orchestrator.js');

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAllTools.mockReturnValue([
    {
      name: 'get_company_news',
      description: 'Get news',
      input_schema: { type: 'object', properties: { symbol: { type: 'string' } } },
    },
  ]);
});

describe('StockAnalysisOrchestrator', () => {
  describe('model detection', () => {
    it('defaults to gemini-2.5-flash', () => {
      const orchestrator = new StockAnalysisOrchestrator();
      expect(orchestrator.model).toBe('gemini-2.5-flash');
    });

    it('accepts custom model', () => {
      const orchestrator = new StockAnalysisOrchestrator({ model: 'claude-sonnet-4-20250514' });
      expect(orchestrator.model).toBe('claude-sonnet-4-20250514');
    });
  });

  describe('Anthropic loop', () => {
    it('processes tool calls and returns final text', async () => {
      const mockCreate = vi.fn()
        // First call: model wants to use a tool
        .mockResolvedValueOnce({
          stop_reason: 'tool_use',
          content: [
            { type: 'text', text: 'Let me check the news.' },
            { type: 'tool_use', id: 'tool_1', name: 'get_company_news', input: { symbol: 'AAPL' } },
          ],
        } as unknown as Anthropic.Message)
        // Second call: model returns final answer
        .mockResolvedValueOnce({
          stop_reason: 'end_turn',
          content: [
            { type: 'text', text: '# AAPL Analysis\n\nLooks great!' },
          ],
        } as unknown as Anthropic.Message);

      const mockClient = { messages: { create: mockCreate } } as unknown as Anthropic;
      mockCallTool.mockResolvedValue('[{"headline": "Apple hits record"}]');

      const orchestrator = new StockAnalysisOrchestrator({
        client: mockClient,
        model: 'claude-sonnet-4-20250514',
      });

      // Skip setup (we don't want to spawn real MCP servers)
      const result = await orchestrator.analyzeWatchlist([{ symbol: 'AAPL' }]);

      expect(result).toBe('# AAPL Analysis\n\nLooks great!');
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(mockCallTool).toHaveBeenCalledWith('get_company_news', { symbol: 'AAPL' });
    });

    it('handles tool errors gracefully', async () => {
      const mockCreate = vi.fn()
        .mockResolvedValueOnce({
          stop_reason: 'tool_use',
          content: [
            { type: 'tool_use', id: 'tool_1', name: 'get_company_news', input: { symbol: 'BAD' } },
          ],
        } as unknown as Anthropic.Message)
        .mockResolvedValueOnce({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Error handled.' }],
        } as unknown as Anthropic.Message);

      const mockClient = { messages: { create: mockCreate } } as unknown as Anthropic;
      mockCallTool.mockRejectedValue(new Error('API down'));

      const orchestrator = new StockAnalysisOrchestrator({
        client: mockClient,
        model: 'claude-sonnet-4-20250514',
      });

      const result = await orchestrator.analyzeWatchlist([{ symbol: 'BAD' }]);
      expect(result).toBe('Error handled.');

      // Verify error was sent back as tool_result
      const secondCall = mockCreate.mock.calls[1][0];
      const toolResults = secondCall.messages[secondCall.messages.length - 1].content;
      expect(toolResults[0].is_error).toBe(true);
      expect(toolResults[0].content).toContain('Error: API down');
    });
  });

  describe('OpenAI loop', () => {
    it('processes tool calls and returns final text', async () => {
      const mockCreate = vi.fn()
        // First call: model wants to use a tool
        .mockResolvedValueOnce({
          choices: [{
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: 'call_1',
                type: 'function',
                function: { name: 'get_company_news', arguments: '{"symbol":"NVDA"}' },
              }],
            },
          }],
        })
        // Second call: model returns final answer
        .mockResolvedValueOnce({
          choices: [{
            message: {
              role: 'assistant',
              content: '# NVDA Analysis\n\nAll good!',
              tool_calls: null,
            },
          }],
        });

      const mockClient = {
        chat: { completions: { create: mockCreate } },
      } as unknown as OpenAI;
      mockCallTool.mockResolvedValue('[{"headline": "NVDA surges"}]');

      const orchestrator = new StockAnalysisOrchestrator({
        client: mockClient,
        model: 'gpt-4o-mini',
      });

      const result = await orchestrator.analyzeWatchlist([{ symbol: 'NVDA' }]);

      expect(result).toBe('# NVDA Analysis\n\nAll good!');
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(mockCallTool).toHaveBeenCalledWith('get_company_news', { symbol: 'NVDA' });
    });

    it('returns empty string when content is null', async () => {
      const mockCreate = vi.fn().mockResolvedValueOnce({
        choices: [{
          message: { role: 'assistant', content: null, tool_calls: null },
        }],
      });

      const mockClient = {
        chat: { completions: { create: mockCreate } },
      } as unknown as OpenAI;

      const orchestrator = new StockAnalysisOrchestrator({
        client: mockClient,
        model: 'gpt-4o-mini',
      });

      const result = await orchestrator.analyzeWatchlist([{ symbol: 'AAPL' }]);
      expect(result).toBe('');
    });
  });

  describe('cleanup', () => {
    it('delegates to MCPClientManager', async () => {
      const orchestrator = new StockAnalysisOrchestrator({ model: 'gpt-4o-mini' });
      await orchestrator.cleanup();
      expect(mockCleanup).toHaveBeenCalled();
    });
  });

  describe('ToolLoopError', () => {
    it('throws ToolLoopError after 20 iterations of tool_use', async () => {
      // Always return tool_use to force infinite loop
      const mockCreate = vi.fn().mockResolvedValue({
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'tool_x', name: 'get_company_news', input: { symbol: 'AAPL' } },
        ],
      } as unknown as import('@anthropic-ai/sdk').Message);

      const mockClient = { messages: { create: mockCreate } } as unknown as import('@anthropic-ai/sdk').default;
      mockCallTool.mockResolvedValue('[]');

      const orchestrator = new StockAnalysisOrchestrator({
        client: mockClient,
        model: 'claude-sonnet-4-20250514',
      });

      await expect(
        orchestrator.analyzeWatchlist([{ symbol: 'AAPL' }]),
      ).rejects.toThrow('Exceeded maximum tool iterations');
    }, 10000);
  });

  describe('multiple symbols', () => {
    it('includes all symbols in user message', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Report for all stocks.' }],
      } as unknown as import('@anthropic-ai/sdk').Message);

      const mockClient = { messages: { create: mockCreate } } as unknown as import('@anthropic-ai/sdk').default;

      const orchestrator = new StockAnalysisOrchestrator({
        client: mockClient,
        model: 'claude-sonnet-4-20250514',
      });

      await orchestrator.analyzeWatchlist([
        { symbol: 'AAPL' },
        { symbol: 'NVDA' },
        { symbol: 'TSLA' },
      ]);

      const firstCall = mockCreate.mock.calls[0][0];
      const userMessage = firstCall.messages[0].content as string;
      expect(userMessage).toContain('AAPL');
      expect(userMessage).toContain('NVDA');
      expect(userMessage).toContain('TSLA');
    });
  });
});
