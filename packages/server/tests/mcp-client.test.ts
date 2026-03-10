import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockConnect = vi.fn();
const mockListTools = vi.fn();
const mockCallTool = vi.fn();
const mockClose = vi.fn();

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    listTools: mockListTools,
    callTool: mockCallTool,
  })),
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn().mockImplementation(() => ({
    close: mockClose,
  })),
}));

const { MCPClientManager } = await import('../src/agent/mcp-client.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MCPClientManager', () => {
  it('connects to a server and registers tools', async () => {
    mockListTools.mockResolvedValue({
      tools: [
        {
          name: 'get_company_news',
          description: 'Get news',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_market_news',
          description: 'Get market news',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
    });

    const manager = new MCPClientManager();
    await manager.connectServer('news', 'node', ['fake-server.js']);

    const tools = manager.getAllToolsForClaude();
    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe('get_company_news');
    expect(tools[1].name).toBe('get_market_news');
    expect(mockConnect).toHaveBeenCalled();
  });

  it('maps tools to servers', async () => {
    mockListTools.mockResolvedValue({
      tools: [
        { name: 'tool_a', description: '', inputSchema: {} },
      ],
    });

    const manager = new MCPClientManager();
    await manager.connectServer('server_a', 'node', ['a.js']);

    const map = manager.getToolToServer();
    expect(map.get('tool_a')).toBe('server_a');
  });

  it('calls tool on the correct server', async () => {
    mockListTools.mockResolvedValue({
      tools: [{ name: 'my_tool', description: '', inputSchema: {} }],
    });
    mockCallTool.mockResolvedValue({
      content: [{ type: 'text', text: '{"result": "ok"}' }],
    });

    const manager = new MCPClientManager();
    await manager.connectServer('test', 'node', ['test.js']);

    const result = await manager.callTool('my_tool', { arg: 'value' });
    expect(result).toBe('{"result": "ok"}');
    expect(mockCallTool).toHaveBeenCalledWith({
      name: 'my_tool',
      arguments: { arg: 'value' },
    });
  });

  it('throws on unknown tool', async () => {
    mockListTools.mockResolvedValue({ tools: [] });

    const manager = new MCPClientManager();
    await manager.connectServer('test', 'node', ['test.js']);

    await expect(manager.callTool('nonexistent', {})).rejects.toThrow('Unknown tool: nonexistent');
  });

  it('joins multiple text contents', async () => {
    mockListTools.mockResolvedValue({
      tools: [{ name: 'multi', description: '', inputSchema: {} }],
    });
    mockCallTool.mockResolvedValue({
      content: [
        { type: 'text', text: 'line1' },
        { type: 'text', text: 'line2' },
      ],
    });

    const manager = new MCPClientManager();
    await manager.connectServer('test', 'node', ['test.js']);
    const result = await manager.callTool('multi', {});
    expect(result).toBe('line1\nline2');
  });

  it('cleanup clears all state', async () => {
    mockListTools.mockResolvedValue({
      tools: [{ name: 'tool', description: '', inputSchema: {} }],
    });

    const manager = new MCPClientManager();
    await manager.connectServer('test', 'node', ['test.js']);
    expect(manager.getAllToolsForClaude()).toHaveLength(1);

    await manager.cleanup();
    expect(manager.getAllToolsForClaude()).toHaveLength(0);
    expect(manager.getToolToServer().size).toBe(0);
    expect(mockClose).toHaveBeenCalled();
  });
});
