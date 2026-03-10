import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { searchHistory, storeAnalysis, getSentimentTrend } from '../lib/vector-store.js';

const userId = process.env.ANALYSIS_USER_ID ?? '';

const server = new McpServer({ name: 'history', version: '1.0.0' });

server.registerTool(
  'search_history',
  {
    description: 'Search past analyses for a stock using semantic search. Use the optional section parameter to retrieve only a specific section (e.g. "risks", "valuation", "conclusion").',
    inputSchema: {
      symbol: z.string().describe('Stock ticker symbol to filter results'),
      query: z.string().describe('Natural language search query'),
      top_k: z.number().default(5).describe('Number of results to return (default 5)'),
      section: z
        .enum(['summary', 'bull_case', 'bear_case', 'risks', 'catalysts', 'valuation', 'conclusion'])
        .optional()
        .describe('Filter results to a specific section of the analysis'),
    },
  },
  async ({ symbol, query, top_k, section }) => {
    const matches = await searchHistory(userId, symbol, query, top_k, section ?? null);
    return { content: [{ type: 'text' as const, text: JSON.stringify(matches) }] };
  },
);

server.registerTool(
  'store_analysis',
  {
    description: 'Store an analysis in the history database for future reference.',
    inputSchema: {
      symbol: z.string().describe('Stock ticker symbol'),
      analysis_text: z.string().describe('The full analysis text to store'),
      sentiment: z.string().describe('Sentiment label (Bullish, Bearish, Neutral, Mixed)'),
      price: z.number().optional().describe('Current stock price at time of analysis'),
      company_name: z.string().optional().describe('Company full name'),
      pe_ratio: z.number().optional().describe('Price-to-earnings ratio'),
      market_cap: z.number().optional().describe('Market capitalization in dollars'),
      beta: z.number().optional().describe('Beta (market sensitivity)'),
      week_52_high: z.number().optional().describe('52-week high price'),
      week_52_low: z.number().optional().describe('52-week low price'),
      dividend_yield: z.number().optional().describe('Dividend yield as a decimal'),
    },
  },
  async ({ symbol, analysis_text, sentiment, price, company_name, pe_ratio, market_cap, beta, week_52_high, week_52_low, dividend_yield }) => {
    const result = await storeAnalysis(userId, symbol, analysis_text, sentiment, price, {
      company_name, pe_ratio, market_cap, beta, week_52_high, week_52_low, dividend_yield,
    });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
  },
);

server.registerTool(
  'get_sentiment_trend',
  {
    description: 'Get historical sentiment scores to show trends over time.',
    inputSchema: {
      symbol: z.string().describe('Stock ticker symbol'),
      days: z.number().default(30).describe('Number of days to look back (default 30)'),
    },
  },
  async ({ symbol, days }) => {
    const trend = await getSentimentTrend(userId, symbol, days);
    return { content: [{ type: 'text' as const, text: JSON.stringify(trend) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
