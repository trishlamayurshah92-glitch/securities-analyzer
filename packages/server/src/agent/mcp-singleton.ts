import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { MCPClientManager } from './mcp-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const SERVERS_DIR = join(__dirname, '..', 'servers');

let manager: MCPClientManager | null = null;
let initPromise: Promise<MCPClientManager> | null = null;

export async function createUserMCPManager(userId: string): Promise<MCPClientManager> {
  const m = new MCPClientManager();
  const env = { ...process.env, ANALYSIS_USER_ID: userId } as Record<string, string>;
  await m.connectServer('news', 'node', [join(SERVERS_DIR, 'news-server.js')], env);
  await m.connectServer('fundamentals', 'node', [join(SERVERS_DIR, 'fundamentals-server.js')], env);
  await m.connectServer('history', 'node', [join(SERVERS_DIR, 'history-server.js')], env);
  return m;
}

export async function getMCPManager(): Promise<MCPClientManager> {
  if (manager) return manager;
  if (!initPromise) {
    initPromise = (async () => {
      const m = new MCPClientManager();
      const env = { ...process.env } as Record<string, string>;
      await m.connectServer('news', 'node', [join(SERVERS_DIR, 'news-server.js')], env);
      await m.connectServer('fundamentals', 'node', [join(SERVERS_DIR, 'fundamentals-server.js')], env);
      await m.connectServer('history', 'node', [join(SERVERS_DIR, 'history-server.js')], env);
      manager = m;
      console.log('MCP servers connected (persistent)');
      return m;
    })();
  }
  return initPromise;
}
