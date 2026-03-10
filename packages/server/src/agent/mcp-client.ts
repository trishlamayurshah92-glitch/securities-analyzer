import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ToolTimeoutError } from '../lib/errors.js';

function isNetworkError(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  return err?.code === 'ECONNRESET' || (err?.message ?? '').includes('fetch failed');
}

async function withRetry<T>(fn: () => Promise<T>, retries = 1, delayMs = 500): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (retries > 0 && isNetworkError(e)) {
      await new Promise((r) => setTimeout(r, delayMs));
      return withRetry(fn, retries - 1, delayMs);
    }
    throw e;
  }
}

interface ToolInfo {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export class MCPClientManager {
  private sessions = new Map<string, Client>();
  private transports: StdioClientTransport[] = [];
  private toolToServer = new Map<string, string>();
  private tools: ToolInfo[] = [];

  async connectServer(
    name: string,
    command: string,
    args: string[],
    env?: Record<string, string>,
  ): Promise<void> {
    const transport = new StdioClientTransport({ command, args, env });
    const client = new Client({ name: `stockwatch-${name}`, version: '1.0.0' });
    await client.connect(transport);

    this.sessions.set(name, client);
    this.transports.push(transport);

    const { tools } = await client.listTools();
    for (const tool of tools) {
      this.toolToServer.set(tool.name, name);
      this.tools.push({
        name: tool.name,
        description: tool.description ?? '',
        input_schema: tool.inputSchema as Record<string, unknown>,
      });
    }
  }

  isConnected(): boolean {
    return this.sessions.size > 0;
  }

  getAllToolsForClaude(): ToolInfo[] {
    return this.tools;
  }

  getToolToServer(): Map<string, string> {
    return this.toolToServer;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const serverName = this.toolToServer.get(name);
    if (!serverName) {
      throw new Error(`Unknown tool: ${name}`);
    }

    const client = this.sessions.get(serverName)!;
    const result = await client.callTool({ name, arguments: args });

    const texts: string[] = [];
    for (const content of result.content as Array<{ type: string; text?: string }>) {
      if (content.text) {
        texts.push(content.text);
      }
    }
    return texts.join('\n');
  }

  async callToolWithTimeout(
    name: string,
    args: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<string> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new ToolTimeoutError(`Tool "${name}" timed out after ${timeoutMs}ms`)), timeoutMs),
    );
    return withRetry(() => Promise.race([this.callTool(name, args), timeout]));
  }

  async cleanup(): Promise<void> {
    for (const transport of this.transports) {
      try {
        await transport.close();
      } catch {
        // ignore cleanup errors
      }
    }
    this.sessions.clear();
    this.toolToServer.clear();
    this.tools.length = 0;
    this.transports.length = 0;
  }
}
