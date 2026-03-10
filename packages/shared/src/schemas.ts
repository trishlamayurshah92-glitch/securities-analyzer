import { z } from 'zod';

export const SentimentSchema = z.enum(['Bullish', 'Bearish', 'Neutral', 'Mixed']);
export type Sentiment = z.infer<typeof SentimentSchema>;

export const NewsArticleSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  source: z.string(),
  datetime: z.string(),
  url: z.string(),
});
export type NewsArticle = z.infer<typeof NewsArticleSchema>;

export const StockFundamentalsSchema = z.object({
  symbol: z.string(),
  name: z.string().nullable().optional(),
  sector: z.string().nullable().optional(),
  market_cap: z.number().nullable().optional(),
  pe_ratio: z.number().nullable().optional(),
  eps: z.number().nullable().optional(),
  price: z.number().nullable().optional(),
  week_52_high: z.number().nullable().optional(),
  week_52_low: z.number().nullable().optional(),
  beta: z.number().nullable().optional(),
  dividend_yield: z.number().nullable().optional(),
  revenue: z.number().nullable().optional(),
  profit_margin: z.number().nullable().optional(),
  debt_to_equity: z.number().nullable().optional(),
});
export type StockFundamentals = z.infer<typeof StockFundamentalsSchema>;

export const StockAnalysisSchema = z.object({
  symbol: z.string(),
  name: z.string().nullable().optional(),
  sentiment: SentimentSchema,
  report: z.string(),
  price: z.number().nullable().optional(),
  date: z.string(),
});
export type StockAnalysis = z.infer<typeof StockAnalysisSchema>;

export const AnalysisResultSchema = z.object({
  report: z.string(),
  stocks_analyzed: z.array(z.string()),
  model: z.string(),
  duration_seconds: z.number(),
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export const WatchlistItemSchema = z.object({
  symbol: z.string(),
  id: z.number().optional(),
  addedAt: z.string().optional(),
});
export type WatchlistItem = z.infer<typeof WatchlistItemSchema>;

export const AnalysisSnapshotSchema = z.object({
  id: z.number(),
  symbol: z.string(),
  createdAt: z.string(),
  sentiment: SentimentSchema,
  reportText: z.string(),
  modelUsed: z.string(),
  price: z.number().nullable(),
  peRatio: z.number().nullable(),
  marketCap: z.number().nullable(),
  beta: z.number().nullable(),
  week52High: z.number().nullable(),
  week52Low: z.number().nullable(),
  dividendYield: z.number().nullable(),
  companyName: z.string().nullable(),
});
export type AnalysisSnapshot = z.infer<typeof AnalysisSnapshotSchema>;

export const SnapshotDiffSchema = z.object({
  symbol: z.string(),
  previousSnapshotId: z.number(),
  currentSnapshotId: z.number(),
  previousDate: z.string(),
  currentDate: z.string(),
  previousSentiment: SentimentSchema,
  currentSentiment: SentimentSchema,
  sentimentChanged: z.boolean(),
  driftLevel: z.enum(['none', 'minor', 'significant']),
  priceDeltaPct: z.number().nullable(),
  peRatioDelta: z.number().nullable(),
  marketCapDeltaPct: z.number().nullable(),
});
export type SnapshotDiff = z.infer<typeof SnapshotDiffSchema>;

export const HistoryMatchSchema = z.object({
  score: z.number(),
  date: z.string(),
  sentiment: z.string(),
  price: z.number().nullable(),
  text: z.string(),
  company_name: z.string().nullable().optional(),
  pe_ratio: z.number().nullable().optional(),
  market_cap: z.number().nullable().optional(),
  beta: z.number().nullable().optional(),
  week_52_high: z.number().nullable().optional(),
  week_52_low: z.number().nullable().optional(),
  dividend_yield: z.number().nullable().optional(),
});
export type HistoryMatch = z.infer<typeof HistoryMatchSchema>;

export const TrendPointSchema = z.object({
  date: z.string(),
  sentiment: z.string(),
  price: z.number().nullable(),
});
export type TrendPoint = z.infer<typeof TrendPointSchema>;

export const AddSymbolRequestSchema = z.object({
  symbol: z.string(),
});

export const AnalyzeRequestSchema = z.object({
  symbols: z.array(z.string()).optional(),
  model: z.string().optional(),
});

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
