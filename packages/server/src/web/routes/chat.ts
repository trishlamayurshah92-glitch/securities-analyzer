import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { createUserMCPManager } from '../../agent/mcp-singleton.js';
import { buildChatSystemPrompt } from '../../agent/chat-prompts.js';
import type { RagContextBlock } from '../../agent/chat-prompts.js';
import { prisma } from '../../lib/db.js';
import { searchHistoryBroadQuery } from '../../lib/vector-store.js';
import type { MCPClientManager } from '../../agent/mcp-client.js';

export const chatRouter = Router();

const asyncHandler = (fn: Function) =>
  (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next);

type SSEEvent =
  | { type: 'token'; content: string }
  | { type: 'tool_start'; name: string }
  | { type: 'tool_done'; name: string }
  | { type: 'context_retrieved'; count: number }
  | { type: 'done' }
  | { type: 'error'; message: string };

function sendEvent(res: any, event: SSEEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function createAnthropicClient(): Anthropic {
  const gcpProject = process.env.GCP_PROJECT;
  if (gcpProject) {
    // Vertex handled by dynamic import; fall through to standard client
  }
  return new Anthropic();
}

function createOpenAIClient(model: string): OpenAI {
  if (model.startsWith('gemini-')) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is required for Gemini models.');
    return new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta/openai/',
    });
  }
  return new OpenAI();
}

async function runAnthropicStreamingLoop(
  model: string,
  system: string,
  tools: Anthropic.Tool[],
  messages: Anthropic.MessageParam[],
  mcpManager: MCPClientManager,
  res: any,
): Promise<void> {
  const client = createAnthropicClient();

  while (true) {
    const stream = client.messages.stream({
      model,
      max_tokens: 4096,
      system,
      tools,
      messages,
    });

    stream.on('text', (text) => sendEvent(res, { type: 'token', content: text }));

    const finalMsg = await stream.finalMessage();

    if (finalMsg.stop_reason === 'end_turn') break;

    const toolUseBlocks = finalMsg.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    if (toolUseBlocks.length === 0) break;

    messages.push({ role: 'assistant', content: finalMsg.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of toolUseBlocks) {
      sendEvent(res, { type: 'tool_start', name: block.name });
      try {
        const result = await mcpManager.callTool(block.name, block.input as Record<string, unknown>);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
      } catch (e) {
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: `Error: ${e}`, is_error: true });
      }
      sendEvent(res, { type: 'tool_done', name: block.name });
    }

    messages.push({ role: 'user', content: toolResults });
  }
}

async function runOpenAIStreamingLoop(
  model: string,
  system: string,
  tools: OpenAI.Chat.Completions.ChatCompletionTool[],
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  mcpManager: MCPClientManager,
  res: any,
): Promise<void> {
  const client = createOpenAIClient(model);

  const createParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model,
    messages,
  };
  if (tools.length > 0) createParams.tools = tools;

  while (true) {
    const response = await client.chat.completions.create(createParams);
    const message = response.choices[0].message;

    if (message.tool_calls && message.tool_calls.length > 0) {
      messages.push(message);

      for (const toolCall of message.tool_calls) {
        sendEvent(res, { type: 'tool_start', name: toolCall.function.name });
        let result: string;
        try {
          const args = JSON.parse(toolCall.function.arguments);
          result = await mcpManager.callTool(toolCall.function.name, args);
        } catch (e) {
          result = `Error: ${e}`;
        }
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
        sendEvent(res, { type: 'tool_done', name: toolCall.function.name });
      }

      createParams.messages = messages;
    } else {
      // Stream final text token-by-token (simulate streaming for UX consistency)
      const text = message.content ?? '';
      const chunkSize = 20;
      for (let i = 0; i < text.length; i += chunkSize) {
        sendEvent(res, { type: 'token', content: text.slice(i, i + chunkSize) });
      }
      break;
    }
  }
}

chatRouter.post('/', asyncHandler(async (req: any, res: any) => {
  const { message, history = [] } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ detail: 'message is required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let mcpManager: Awaited<ReturnType<typeof createUserMCPManager>> | undefined;
  try {
    const userId = (req as any).userId as string;

    const [items, mcpManagerResult, ragMatches] = await Promise.all([
      prisma.watchlistItem.findMany({ where: { userId }, select: { symbol: true } }),
      createUserMCPManager(userId),
      searchHistoryBroadQuery(userId, message, 6),
    ]);
    mcpManager = mcpManagerResult;

    const watchlist = items.map((i) => i.symbol);
    const rawTools = mcpManager.getAllToolsForClaude();

    sendEvent(res, { type: 'context_retrieved', count: ragMatches.length });

    const ragContext: RagContextBlock[] = ragMatches.map((m) => ({
      symbol: m.symbol,
      section: m.section,
      date: m.date,
      sentiment: m.sentiment,
      price: m.price,
      text: m.text,
    }));

    const systemPrompt = buildChatSystemPrompt(watchlist, ragContext);

    const model = process.env.MODEL ?? 'gemini-2.5-flash';
    const isAnthropic = model.startsWith('claude-');

    if (isAnthropic) {
      const anthropicTools = rawTools as Anthropic.Tool[];
      const messages: Anthropic.MessageParam[] = [
        ...history.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user', content: message },
      ];
      await runAnthropicStreamingLoop(model, systemPrompt, anthropicTools, messages, mcpManager, res);
    } else {
      const openAITools: OpenAI.Chat.Completions.ChatCompletionTool[] = rawTools.map((t) => ({
        type: 'function' as const,
        function: { name: t.name, description: t.description, parameters: t.input_schema },
      }));
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...history.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user', content: message },
      ];
      await runOpenAIStreamingLoop(model, systemPrompt, openAITools, messages, mcpManager, res);
    }

    sendEvent(res, { type: 'done' });
  } catch (e) {
    sendEvent(res, { type: 'error', message: String(e) });
  } finally {
    res.end();
    await mcpManager?.cleanup();
  }
}));
