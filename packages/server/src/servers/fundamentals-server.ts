import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();
const server = new McpServer({ name: 'fundamentals', version: '1.0.0' });

server.registerTool(
  'get_stock_fundamentals',
  {
    description: 'Get fundamental financial data for a stock.',
    inputSchema: {
      symbol: z.string().describe('Stock ticker symbol (e.g. AAPL)'),
    },
  },
  async ({ symbol }) => {
    const sym = symbol.toUpperCase().trim();

    try {
      const result = await yahooFinance.quoteSummary(sym, {
        modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'financialData', 'summaryProfile'],
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            symbol: sym,
            name: result.price?.longName ?? result.price?.shortName ?? null,
            sector: result.summaryProfile?.sector ?? null,
            market_cap: result.price?.marketCap ?? null,
            pe_ratio: result.summaryDetail?.trailingPE ?? null,
            eps: result.defaultKeyStatistics?.trailingEps ?? null,
            price: result.price?.regularMarketPrice ?? null,
            '52_week_high': result.summaryDetail?.fiftyTwoWeekHigh ?? null,
            '52_week_low': result.summaryDetail?.fiftyTwoWeekLow ?? null,
            beta: result.defaultKeyStatistics?.beta ?? null,
            dividend_yield: result.summaryDetail?.dividendYield ?? null,
            revenue: result.financialData?.totalRevenue ?? null,
            profit_margin: result.defaultKeyStatistics?.profitMargins ?? null,
            debt_to_equity: result.financialData?.debtToEquity ?? null,
          }),
        }],
      };
    } catch {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            symbol: sym,
            name: null, sector: null, market_cap: null, pe_ratio: null,
            eps: null, price: null, '52_week_high': null, '52_week_low': null,
            beta: null, dividend_yield: null, revenue: null,
            profit_margin: null, debt_to_equity: null,
          }),
        }],
      };
    }
  },
);

function periodToStartDate(period: string): Date {
  const now = new Date();
  switch (period) {
    case '1d': now.setDate(now.getDate() - 2); break;
    case '5d': now.setDate(now.getDate() - 7); break;
    case '1mo': now.setMonth(now.getMonth() - 1); break;
    case '3mo': now.setMonth(now.getMonth() - 3); break;
    case '6mo': now.setMonth(now.getMonth() - 6); break;
    case '1y': now.setFullYear(now.getFullYear() - 1); break;
    default: now.setMonth(now.getMonth() - 1);
  }
  return now;
}

server.registerTool(
  'get_price_history',
  {
    description: 'Get price history and percentage changes for a stock.',
    inputSchema: {
      symbol: z.string().describe('Stock ticker symbol (e.g. AAPL)'),
      period: z.string().default('1mo').describe('Time period - 1d, 5d, 1mo, 3mo, 6mo, 1y (default 1mo)'),
    },
  },
  async ({ symbol, period }) => {
    const sym = symbol.toUpperCase().trim();

    try {
      const startDate = periodToStartDate(period);
      const result = await yahooFinance.chart(sym, {
        period1: startDate,
        interval: '1d',
      });

      const quotes = result.quotes;
      if (!quotes || quotes.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              symbol: sym, current_price: null,
              price_change_1d: null, price_change_5d: null, price_change_1mo: null,
              data_points: [],
            }),
          }],
        };
      }

      const currentPrice = quotes[quotes.length - 1].close!;

      function pctChange(n: number): number | null {
        if (quotes.length > n) {
          const old = quotes[quotes.length - 1 - n].close!;
          return old ? Math.round(((currentPrice - old) / old) * 10000) / 100 : null;
        }
        return null;
      }

      const dataPoints = quotes.slice(-30).map((q) => ({
        date: q.date.toISOString().split('T')[0],
        open: Math.round((q.open ?? 0) * 100) / 100,
        high: Math.round((q.high ?? 0) * 100) / 100,
        low: Math.round((q.low ?? 0) * 100) / 100,
        close: Math.round((q.close ?? 0) * 100) / 100,
        volume: q.volume ?? 0,
      }));

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            symbol: sym,
            current_price: Math.round(currentPrice * 100) / 100,
            price_change_1d: pctChange(1),
            price_change_5d: pctChange(5),
            price_change_1mo: quotes.length > 1 ? pctChange(quotes.length - 1) : null,
            data_points: dataPoints,
          }),
        }],
      };
    } catch {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            symbol: sym, current_price: null,
            price_change_1d: null, price_change_5d: null, price_change_1mo: null,
            data_points: [],
          }),
        }],
      };
    }
  },
);

server.registerTool(
  'get_analyst_recommendations',
  {
    description: 'Get analyst recommendations and price targets for a stock.',
    inputSchema: {
      symbol: z.string().describe('Stock ticker symbol (e.g. AAPL)'),
    },
  },
  async ({ symbol }) => {
    const sym = symbol.toUpperCase().trim();
    const result: Record<string, unknown> = {
      symbol: sym,
      recommendations: [],
      target_price: null,
      target_high: null,
      target_low: null,
      number_of_analysts: null,
    };

    try {
      const summary = await yahooFinance.quoteSummary(sym, {
        modules: ['financialData', 'recommendationTrend'],
      });

      result.target_price = summary.financialData?.targetMeanPrice ?? null;
      result.target_high = summary.financialData?.targetHighPrice ?? null;
      result.target_low = summary.financialData?.targetLowPrice ?? null;
      result.number_of_analysts = summary.financialData?.numberOfAnalystOpinions ?? null;

      if (summary.recommendationTrend?.trend) {
        result.recommendations = summary.recommendationTrend.trend.map((t) => ({
          period: t.period,
          strongBuy: t.strongBuy,
          buy: t.buy,
          hold: t.hold,
          sell: t.sell,
          strongSell: t.strongSell,
        }));
      }
    } catch {
      // leave defaults
    }

    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
