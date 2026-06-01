import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { MCPClientManager } from './mcp-client.js';
import { SYSTEM_PROMPT } from './prompts.js';
import { SUBMIT_STOCK_ANALYSIS_TOOL } from './tool-schemas.js';
import { StructuredStockAnalysisV1Schema } from '@stockwatch/shared';
import { ToolLoopError, AnalysisTimeoutError, ConfigError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

const MAX_TOOL_ITERATIONS = 30;
const TOOL_TIMEOUT_MS = 30_000;
const OVERALL_TIMEOUT_MS = 10 * 60 * 1000;

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVERS_DIR = join(__dirname, '..', 'servers');
const DEFAULT_MODEL = 'gemini-2.5-flash';

function isOpenAIModel(model: string): boolean {
  return !model.startsWith('claude-');
}

function getModel(): string {
  return process.env.MODEL ?? DEFAULT_MODEL;
}

async function createClient(model: string): Promise<Anthropic | OpenAI> {
  if (isOpenAIModel(model)) {
    // Auto-configure for Gemini models
    if (model.startsWith('gemini-')) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new ConfigError('GEMINI_API_KEY environment variable is required for Gemini models.');
      }
      return new OpenAI({
        apiKey,
        baseURL: process.env.OPENAI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta/openai/',
      });
    }
    return new OpenAI();
  }

  const gcpProject = process.env.GCP_PROJECT;
  if (gcpProject) {
    try {
      const { AnthropicVertex } = await import('@anthropic-ai/vertex-sdk');
      return new AnthropicVertex({
        projectId: gcpProject,
        region: process.env.GCP_REGION ?? 'us-central1',
      });
    } catch {
      // vertex SDK not installed, fall back to regular Anthropic
    }
  }

  return new Anthropic();
}

interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

function convertToolsForOpenAI(tools: ToolDef[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));
}

export class StockAnalysisOrchestrator {
  model: string;
  private client: Anthropic | OpenAI | null;
  private mcpManager: MCPClientManager;
  private externalManager: boolean;
  private userId: string;
  private structuredPayloads = new Map<string, unknown>();

  constructor(options?: {
    client?: Anthropic | OpenAI;
    mcpManager?: MCPClientManager;
    model?: string;
    userId?: string;
  }) {
    this.model = options?.model ?? getModel();
    this.client = options?.client ?? null;
    this.externalManager = options?.mcpManager !== undefined;
    this.mcpManager = options?.mcpManager ?? new MCPClientManager();
    this.userId = options?.userId ?? '';
  }

  async setup(): Promise<void> {
    if (!this.client) {
      this.client = await createClient(this.model);
    }

    if (!this.mcpManager.isConnected()) {
      const env = { ...process.env } as Record<string, string>;
      if (this.userId) {
        env.ANALYSIS_USER_ID = this.userId;
      }
      await this.mcpManager.connectServer(
        'news', 'node', [join(SERVERS_DIR, 'news-server.js')], env,
      );
      await this.mcpManager.connectServer(
        'fundamentals', 'node', [join(SERVERS_DIR, 'fundamentals-server.js')], env,
      );
      await this.mcpManager.connectServer(
        'history', 'node', [join(SERVERS_DIR, 'history-server.js')], env,
      );
    }
  }

  async analyzeWatchlist(watchlist: Array<{ symbol: string }>): Promise<{ report: string; structuredPayloads: Map<string, unknown> }> {
    this.structuredPayloads.clear();
    if (isOpenAIModel(this.model)) {
      return this.runOpenAILoop(watchlist);
    }
    return this.runAnthropicLoop(watchlist);
  }

  private async runAnthropicLoop(watchlist: Array<{ symbol: string }>): Promise<{ report: string; structuredPayloads: Map<string, unknown> }> {
    const client = this.client as Anthropic;
    const tools = [
      ...this.mcpManager.getAllToolsForClaude()
        .filter((t) => t.name !== 'store_analysis' && t.name !== 'submit_stock_analysis'),
      SUBMIT_STOCK_ANALYSIS_TOOL,
    ];

    const symbols = watchlist.map((s) => s.symbol).join(', ');
    const watchlistJson = JSON.stringify(watchlist, null, 2);
    const userMessage =
      `Analyze the following stocks from my watchlist: ${symbols}\n\n` +
      `Watchlist:\n${watchlistJson}\n\n` +
      'Please follow your workflow for each stock and produce a full report.';

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: userMessage },
    ];

    let response: Anthropic.Message;
    let iterations = 0;

    let overallTimeoutHandle: ReturnType<typeof setTimeout>;
    const overallTimeout = new Promise<never>((_, reject) => {
      overallTimeoutHandle = setTimeout(
        () => reject(new AnalysisTimeoutError(`Analysis timed out after ${OVERALL_TIMEOUT_MS}ms`)),
        OVERALL_TIMEOUT_MS,
      );
    });

    const loop = async (): Promise<Anthropic.Message> => {
      while (true) {
        if (++iterations > MAX_TOOL_ITERATIONS) {
          throw new ToolLoopError(`Exceeded maximum tool iterations (${MAX_TOOL_ITERATIONS})`);
        }

        response = await client.messages.create({
          model: this.model,
          max_tokens: 8192,
          system: SYSTEM_PROMPT,
          tools: tools as Anthropic.Tool[],
          messages,
        });

        if (response.stop_reason === 'end_turn') return response;

        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
        );

        if (toolUseBlocks.length === 0) return response;

        messages.push({ role: 'assistant', content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const toolBlock of toolUseBlocks) {
          if (toolBlock.name === 'submit_stock_analysis') {
            const parsed = StructuredStockAnalysisV1Schema.safeParse(toolBlock.input);
            if (parsed.success) {
              this.structuredPayloads.set(parsed.data.symbol.toUpperCase(), parsed.data);
              logger.info('structured_analysis_captured', { symbol: parsed.data.symbol });
            } else {
              logger.warn('structured_analysis_invalid', {
                symbol: (toolBlock.input as any)?.symbol,
                issues: parsed.error.issues,
              });
              this.structuredPayloads.set(
                String((toolBlock.input as any)?.symbol ?? '').toUpperCase(),
                null,
              );
            }
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolBlock.id,
              content: '{"status":"ok"}',
            });
            continue;
          }

          const t0 = Date.now();
          logger.info('tool_call', { tool: toolBlock.name, iteration: iterations });
          try {
            const result = await this.mcpManager.callToolWithTimeout(
              toolBlock.name,
              toolBlock.input as Record<string, unknown>,
              TOOL_TIMEOUT_MS,
            );
            logger.info('tool_done', { tool: toolBlock.name, duration_ms: Date.now() - t0, iteration: iterations });
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolBlock.id,
              content: result,
            });
          } catch (e) {
            logger.error('tool_error', { tool: toolBlock.name, error: String(e), duration_ms: Date.now() - t0 });
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolBlock.id,
              content: `Error: ${String(e)}`,
              is_error: true,
            });
          }
        }

        messages.push({ role: 'user', content: toolResults });
      }
    };

    try {
      response = await Promise.race([loop(), overallTimeout]);
    } finally {
      clearTimeout(overallTimeoutHandle!);
    }

    const report = response!.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return { report, structuredPayloads: this.structuredPayloads };
  }

  private async runOpenAILoop(watchlist: Array<{ symbol: string }>): Promise<{ report: string; structuredPayloads: Map<string, unknown> }> {
    const client = this.client as OpenAI;
    const tools = convertToolsForOpenAI([
      ...this.mcpManager.getAllToolsForClaude()
        .filter((t) => t.name !== 'store_analysis' && t.name !== 'submit_stock_analysis'),
      SUBMIT_STOCK_ANALYSIS_TOOL,
    ]);

    const symbols = watchlist.map((s) => s.symbol).join(', ');
    const watchlistJson = JSON.stringify(watchlist, null, 2);
    const userMessage =
      `Analyze the following stocks from my watchlist: ${symbols}\n\n` +
      `Watchlist:\n${watchlistJson}\n\n` +
      'Please follow your workflow for each stock and produce a full report.';

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ];

    const createParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
      model: this.model,
      messages,
    };
    if (tools.length > 0) {
      createParams.tools = tools;
    }

    let message: OpenAI.Chat.Completions.ChatCompletionMessage;
    let iterations = 0;

    let overallTimeoutHandle: ReturnType<typeof setTimeout>;
    const overallTimeout = new Promise<never>((_, reject) => {
      overallTimeoutHandle = setTimeout(
        () => reject(new AnalysisTimeoutError(`Analysis timed out after ${OVERALL_TIMEOUT_MS}ms`)),
        OVERALL_TIMEOUT_MS,
      );
    });

    const loop = async (): Promise<OpenAI.Chat.Completions.ChatCompletionMessage> => {
      while (true) {
        if (++iterations > MAX_TOOL_ITERATIONS) {
          throw new ToolLoopError(`Exceeded maximum tool iterations (${MAX_TOOL_ITERATIONS})`);
        }

        const response = await client.chat.completions.create(createParams);
        message = response.choices[0].message;

        if (message.tool_calls && message.tool_calls.length > 0) {
          messages.push(message);

          for (const toolCall of message.tool_calls) {
            const fn = toolCall.function;

            if (fn.name === 'submit_stock_analysis') {
              let parsedArgs: unknown;
              try {
                parsedArgs = JSON.parse(fn.arguments);
              } catch {
                parsedArgs = {};
              }
              const parsed = StructuredStockAnalysisV1Schema.safeParse(parsedArgs);
              if (parsed.success) {
                this.structuredPayloads.set(parsed.data.symbol.toUpperCase(), parsed.data);
                logger.info('structured_analysis_captured', { symbol: parsed.data.symbol });
              } else {
                logger.warn('structured_analysis_invalid', {
                  symbol: (parsedArgs as any)?.symbol,
                  issues: parsed.error.issues,
                });
                this.structuredPayloads.set(
                  String((parsedArgs as any)?.symbol ?? '').toUpperCase(),
                  null,
                );
              }
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: '{"status":"ok"}',
              });
              continue;
            }

            const t0 = Date.now();
            logger.info('tool_call', { tool: fn.name, iteration: iterations });
            let result: string;
            try {
              const args = JSON.parse(fn.arguments);
              result = await this.mcpManager.callToolWithTimeout(fn.name, args, TOOL_TIMEOUT_MS);
              logger.info('tool_done', { tool: fn.name, duration_ms: Date.now() - t0, iteration: iterations });
            } catch (e) {
              logger.error('tool_error', { tool: fn.name, error: String(e), duration_ms: Date.now() - t0 });
              result = `Error: ${String(e)}`;
            }

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: result,
            });
          }

          createParams.messages = messages;
        } else {
          return message;
        }
      }
    };

    try {
      message = await Promise.race([loop(), overallTimeout]);
    } finally {
      clearTimeout(overallTimeoutHandle!);
    }

    return { report: message!.content ?? '', structuredPayloads: this.structuredPayloads };
  }

  async cleanup(): Promise<void> {
    // Don't clean up externally-provided managers (e.g. persistent singleton)
    if (!this.externalManager) {
      await this.mcpManager.cleanup();
    }
  }
}
