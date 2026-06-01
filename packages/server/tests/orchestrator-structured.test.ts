import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type OpenAI from 'openai';

// Mock the MCP client manager
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
    isConnected: () => true,
  })),
}));

const { StockAnalysisOrchestrator } = await import('../src/agent/orchestrator.js');

const validPayload = {
  schemaVersion: 1,
  symbol: 'AAPL',
  companyName: 'Apple Inc.',
  sentiment: 'Bullish',
  price: 182.5,
  peRatio: 28.1,
  marketCap: 2.8e12,
  beta: 1.29,
  week52High: 199.62,
  week52Low: 124.17,
  dividendYield: 0.0055,
  eps: 6.42,
  analystConsensus: 'Buy',
  analystPriceTarget: 210.0,
  bullCase: ['Strong ecosystem', 'Services growth'],
  bearCase: ['High valuation', 'China risk'],
  risks: ['Macro slowdown', 'Regulatory pressure'],
  catalysts: ['iPhone cycle', 'AI features'],
  valuation: 'Fair value',
  conclusion: 'Hold',
  completenessScore: 0.9,
  dataConfidence: 'high',
  missingFields: [],
};

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

describe('Orchestrator structured analysis — Anthropic loop', () => {
  it('captures valid submit_stock_analysis in structuredPayloads', async () => {
    const mockCreate = vi.fn()
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tool_struct_1',
            name: 'submit_stock_analysis',
            input: validPayload,
          },
        ],
      } as unknown as Anthropic.Message)
      .mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: '### AAPL - Apple Inc.\n\n**Sentiment:** Bullish' }],
      } as unknown as Anthropic.Message);

    const mockClient = { messages: { create: mockCreate } } as unknown as Anthropic;

    const orchestrator = new StockAnalysisOrchestrator({
      client: mockClient,
      model: 'claude-sonnet-4-20250514',
    });

    const { report, structuredPayloads } = await orchestrator.analyzeWatchlist([{ symbol: 'AAPL' }]);

    expect(report).toContain('AAPL');
    expect(structuredPayloads.has('AAPL')).toBe(true);
    const data = structuredPayloads.get('AAPL') as typeof validPayload;
    expect(data.sentiment).toBe('Bullish');
    expect(data.beta).toBe(1.29);
  });

  it('returns {"status":"ok"} to LLM for submit_stock_analysis (not MCP called)', async () => {
    const mockCreate = vi.fn()
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tool_struct_2',
            name: 'submit_stock_analysis',
            input: validPayload,
          },
        ],
      } as unknown as Anthropic.Message)
      .mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Done.' }],
      } as unknown as Anthropic.Message);

    const mockClient = { messages: { create: mockCreate } } as unknown as Anthropic;

    const orchestrator = new StockAnalysisOrchestrator({
      client: mockClient,
      model: 'claude-sonnet-4-20250514',
    });

    await orchestrator.analyzeWatchlist([{ symbol: 'AAPL' }]);

    // MCP callTool should NOT have been called for submit_stock_analysis
    expect(mockCallTool).not.toHaveBeenCalledWith('submit_stock_analysis', expect.anything());

    // Second call to create should include tool_result with status ok
    const secondCall = mockCreate.mock.calls[1][0];
    const toolResults = secondCall.messages[secondCall.messages.length - 1].content;
    expect(toolResults[0].content).toBe('{"status":"ok"}');
    expect(toolResults[0].tool_use_id).toBe('tool_struct_2');
  });

  it('sets null entry for invalid submit_stock_analysis payload', async () => {
    const invalidPayload = { schemaVersion: 1, symbol: 'AAPL' }; // missing many required fields

    const mockCreate = vi.fn()
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tool_struct_3',
            name: 'submit_stock_analysis',
            input: invalidPayload,
          },
        ],
      } as unknown as Anthropic.Message)
      .mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Done.' }],
      } as unknown as Anthropic.Message);

    const mockClient = { messages: { create: mockCreate } } as unknown as Anthropic;

    const orchestrator = new StockAnalysisOrchestrator({
      client: mockClient,
      model: 'claude-sonnet-4-20250514',
    });

    const { structuredPayloads } = await orchestrator.analyzeWatchlist([{ symbol: 'AAPL' }]);

    expect(structuredPayloads.has('AAPL')).toBe(true);
    expect(structuredPayloads.get('AAPL')).toBeNull();
  });
});

describe('Orchestrator structured analysis — OpenAI loop', () => {
  it('captures valid submit_stock_analysis in structuredPayloads', async () => {
    const mockCreate = vi.fn()
      .mockResolvedValueOnce({
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_struct_1',
              type: 'function',
              function: { name: 'submit_stock_analysis', arguments: JSON.stringify(validPayload) },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            role: 'assistant',
            content: '### AAPL - Apple Inc.\n\n**Sentiment:** Bullish',
            tool_calls: null,
          },
        }],
      });

    const mockClient = {
      chat: { completions: { create: mockCreate } },
    } as unknown as OpenAI;

    const orchestrator = new StockAnalysisOrchestrator({
      client: mockClient,
      model: 'gpt-4o-mini',
    });

    const { report, structuredPayloads } = await orchestrator.analyzeWatchlist([{ symbol: 'AAPL' }]);

    expect(report).toContain('AAPL');
    expect(structuredPayloads.has('AAPL')).toBe(true);
    const data = structuredPayloads.get('AAPL') as typeof validPayload;
    expect(data.sentiment).toBe('Bullish');
    expect(data.beta).toBe(1.29);
  });

  it('returns {"status":"ok"} to LLM and does not call MCP for submit_stock_analysis', async () => {
    const mockCreate = vi.fn()
      .mockResolvedValueOnce({
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_struct_2',
              type: 'function',
              function: { name: 'submit_stock_analysis', arguments: JSON.stringify(validPayload) },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: { role: 'assistant', content: 'Done.', tool_calls: null },
        }],
      });

    const mockClient = {
      chat: { completions: { create: mockCreate } },
    } as unknown as OpenAI;

    const orchestrator = new StockAnalysisOrchestrator({
      client: mockClient,
      model: 'gpt-4o-mini',
    });

    await orchestrator.analyzeWatchlist([{ symbol: 'AAPL' }]);

    // MCP callTool should NOT have been called for submit_stock_analysis
    expect(mockCallTool).not.toHaveBeenCalledWith('submit_stock_analysis', expect.anything());

    // Second call should have a tool message with status ok
    const secondCallMessages = mockCreate.mock.calls[1][0].messages;
    const toolMsg = secondCallMessages.find(
      (m: any) => m.role === 'tool' && m.tool_call_id === 'call_struct_2',
    );
    expect(toolMsg).toBeDefined();
    expect(toolMsg.content).toBe('{"status":"ok"}');
  });

  it('sets null entry for invalid payload', async () => {
    const invalidPayload = { schemaVersion: 1, symbol: 'AAPL' };

    const mockCreate = vi.fn()
      .mockResolvedValueOnce({
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_struct_3',
              type: 'function',
              function: { name: 'submit_stock_analysis', arguments: JSON.stringify(invalidPayload) },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: { role: 'assistant', content: 'Done.', tool_calls: null },
        }],
      });

    const mockClient = {
      chat: { completions: { create: mockCreate } },
    } as unknown as OpenAI;

    const orchestrator = new StockAnalysisOrchestrator({
      client: mockClient,
      model: 'gpt-4o-mini',
    });

    const { structuredPayloads } = await orchestrator.analyzeWatchlist([{ symbol: 'AAPL' }]);

    expect(structuredPayloads.has('AAPL')).toBe(true);
    expect(structuredPayloads.get('AAPL')).toBeNull();
  });
});
