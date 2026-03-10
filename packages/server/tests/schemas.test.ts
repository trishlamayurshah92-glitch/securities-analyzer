import { describe, it, expect } from 'vitest';
import {
  SentimentSchema,
  NewsArticleSchema,
  StockFundamentalsSchema,
  StockAnalysisSchema,
  AnalysisResultSchema,
  WatchlistItemSchema,
  HistoryMatchSchema,
  TrendPointSchema,
  AddSymbolRequestSchema,
  AnalyzeRequestSchema,
} from '@stockwatch/shared';

describe('SentimentSchema', () => {
  it('accepts valid sentiments', () => {
    expect(SentimentSchema.parse('Bullish')).toBe('Bullish');
    expect(SentimentSchema.parse('Bearish')).toBe('Bearish');
    expect(SentimentSchema.parse('Neutral')).toBe('Neutral');
    expect(SentimentSchema.parse('Mixed')).toBe('Mixed');
  });

  it('rejects invalid sentiment', () => {
    expect(() => SentimentSchema.parse('bullish')).toThrow();
    expect(() => SentimentSchema.parse('Unknown')).toThrow();
    expect(() => SentimentSchema.parse('')).toThrow();
  });
});

describe('NewsArticleSchema', () => {
  it('parses valid article', () => {
    const article = NewsArticleSchema.parse({
      headline: 'Test headline',
      summary: 'Test summary',
      source: 'Reuters',
      datetime: '2024-01-01T00:00:00Z',
      url: 'https://example.com',
    });
    expect(article.headline).toBe('Test headline');
    expect(article.source).toBe('Reuters');
  });

  it('rejects article missing required fields', () => {
    expect(() => NewsArticleSchema.parse({ headline: 'Test' })).toThrow();
  });
});

describe('StockFundamentalsSchema', () => {
  it('parses with all optional fields null', () => {
    const data = StockFundamentalsSchema.parse({ symbol: 'AAPL' });
    expect(data.symbol).toBe('AAPL');
    expect(data.name).toBeUndefined();
    expect(data.pe_ratio).toBeUndefined();
  });

  it('parses with all fields populated', () => {
    const data = StockFundamentalsSchema.parse({
      symbol: 'AAPL',
      name: 'Apple Inc.',
      sector: 'Technology',
      market_cap: 3000000000000,
      pe_ratio: 28.5,
      eps: 6.42,
      price: 182.52,
      week_52_high: 199.62,
      week_52_low: 124.17,
      beta: 1.29,
      dividend_yield: 0.0055,
      revenue: 383000000000,
      profit_margin: 0.253,
      debt_to_equity: 176.3,
    });
    expect(data.name).toBe('Apple Inc.');
    expect(data.market_cap).toBe(3000000000000);
  });

  it('accepts null for optional fields', () => {
    const data = StockFundamentalsSchema.parse({
      symbol: 'AAPL',
      name: null,
      price: null,
    });
    expect(data.name).toBeNull();
    expect(data.price).toBeNull();
  });
});

describe('StockAnalysisSchema', () => {
  it('parses valid analysis', () => {
    const analysis = StockAnalysisSchema.parse({
      symbol: 'AAPL',
      name: 'Apple Inc.',
      sentiment: 'Bullish',
      report: 'Stock looks good',
      price: 182.52,
      date: '2024-01-01T00:00:00Z',
    });
    expect(analysis.sentiment).toBe('Bullish');
    expect(analysis.symbol).toBe('AAPL');
  });

  it('rejects invalid sentiment value', () => {
    expect(() =>
      StockAnalysisSchema.parse({
        symbol: 'AAPL',
        sentiment: 'VeryBullish',
        report: 'test',
        date: '2024-01-01',
      }),
    ).toThrow();
  });
});

describe('AnalysisResultSchema', () => {
  it('parses valid result', () => {
    const result = AnalysisResultSchema.parse({
      report: '# Analysis Report',
      stocks_analyzed: ['AAPL', 'NVDA'],
      model: 'gpt-4o-mini',
      duration_seconds: 12.5,
    });
    expect(result.stocks_analyzed).toHaveLength(2);
    expect(result.model).toBe('gpt-4o-mini');
  });

  it('rejects missing fields', () => {
    expect(() => AnalysisResultSchema.parse({ report: 'test' })).toThrow();
  });
});

describe('WatchlistItemSchema', () => {
  it('parses valid item', () => {
    expect(WatchlistItemSchema.parse({ symbol: 'AAPL' }).symbol).toBe('AAPL');
  });

  it('rejects missing symbol', () => {
    expect(() => WatchlistItemSchema.parse({})).toThrow();
  });
});

describe('HistoryMatchSchema', () => {
  it('parses valid match', () => {
    const match = HistoryMatchSchema.parse({
      score: 0.95,
      date: '2024-01-01',
      sentiment: 'Bullish',
      price: 182.5,
      text: 'Analysis text',
    });
    expect(match.score).toBe(0.95);
  });

  it('accepts null price', () => {
    const match = HistoryMatchSchema.parse({
      score: 0.8,
      date: '2024-01-01',
      sentiment: 'Neutral',
      price: null,
      text: 'text',
    });
    expect(match.price).toBeNull();
  });
});

describe('TrendPointSchema', () => {
  it('parses valid trend point', () => {
    const point = TrendPointSchema.parse({
      date: '2024-01-01',
      sentiment: 'Bullish',
      price: 182.5,
    });
    expect(point.sentiment).toBe('Bullish');
  });
});

describe('AddSymbolRequestSchema', () => {
  it('parses valid request', () => {
    expect(AddSymbolRequestSchema.parse({ symbol: 'AAPL' }).symbol).toBe('AAPL');
  });
});

describe('AnalyzeRequestSchema', () => {
  it('parses with optional fields', () => {
    const req = AnalyzeRequestSchema.parse({});
    expect(req.symbols).toBeUndefined();
    expect(req.model).toBeUndefined();
  });

  it('parses with all fields', () => {
    const req = AnalyzeRequestSchema.parse({
      symbols: ['AAPL', 'NVDA'],
      model: 'gpt-4o-mini',
    });
    expect(req.symbols).toEqual(['AAPL', 'NVDA']);
  });
});
