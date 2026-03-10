import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY ?? '';

const server = new McpServer({ name: 'news', version: '1.0.0' });

server.registerTool(
  'get_company_news',
  {
    description: 'Get recent news articles for a specific company.',
    inputSchema: {
      symbol: z.string().describe('Stock ticker symbol (e.g. AAPL)'),
      days_back: z.number().default(7).describe('Number of days to look back for news (default 7)'),
    },
  },
  async ({ symbol, days_back }) => {
    if (!symbol?.trim()) {
      return { content: [{ type: 'text' as const, text: JSON.stringify([]) }] };
    }

    const end = new Date();
    const start = new Date(end.getTime() - days_back * 24 * 60 * 60 * 1000);
    const from = start.toISOString().split('T')[0];
    const to = end.toISOString().split('T')[0];
    const sym = symbol.toUpperCase().trim();

    try {
      const url = `https://finnhub.io/api/v1/company-news?symbol=${sym}&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`;
      const res = await fetch(url);
      const raw: unknown = await res.json();

      if (!Array.isArray(raw)) {
        return { content: [{ type: 'text' as const, text: JSON.stringify([]) }] };
      }

      const articles = raw.slice(0, 10).map((item: Record<string, unknown>) => ({
        headline: (item.headline as string) ?? '',
        summary: (item.summary as string) ?? '',
        source: (item.source as string) ?? '',
        datetime: new Date(((item.datetime as number) ?? 0) * 1000).toISOString(),
        url: (item.url as string) ?? '',
      }));

      return { content: [{ type: 'text' as const, text: JSON.stringify(articles) }] };
    } catch {
      return { content: [{ type: 'text' as const, text: JSON.stringify([]) }] };
    }
  },
);

server.registerTool(
  'get_market_news',
  {
    description: 'Get general market news for broader context.',
    inputSchema: {
      category: z.string().default('general').describe('News category (default "general")'),
    },
  },
  async ({ category }) => {
    try {
      const url = `https://finnhub.io/api/v1/news?category=${category}&token=${FINNHUB_API_KEY}`;
      const res = await fetch(url);
      const raw: unknown = await res.json();

      if (!Array.isArray(raw)) {
        return { content: [{ type: 'text' as const, text: JSON.stringify([]) }] };
      }

      const articles = raw.slice(0, 10).map((item: Record<string, unknown>) => ({
        headline: (item.headline as string) ?? '',
        summary: (item.summary as string) ?? '',
        source: (item.source as string) ?? '',
        datetime: new Date(((item.datetime as number) ?? 0) * 1000).toISOString(),
        url: (item.url as string) ?? '',
      }));

      return { content: [{ type: 'text' as const, text: JSON.stringify(articles) }] };
    } catch {
      return { content: [{ type: 'text' as const, text: JSON.stringify([]) }] };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
