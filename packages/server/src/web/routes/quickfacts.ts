import { Router } from 'express';
import YahooFinance from 'yahoo-finance2';
import type { AuthRequest } from '../middleware/auth.js';

export const quickfactsRouter = Router();
const yf = new YahooFinance();

quickfactsRouter.get('/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase().trim();
  try {
    const result = await yf.quoteSummary(symbol, {
      modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'financialData', 'summaryProfile'],
    });
    res.json({
      symbol,
      company_name: result.price?.longName ?? result.price?.shortName ?? null,
      price: result.price?.regularMarketPrice ?? null,
      pe_ratio: result.summaryDetail?.trailingPE ?? null,
      market_cap: result.price?.marketCap ?? null,
      beta: result.defaultKeyStatistics?.beta ?? null,
      week_52_high: result.summaryDetail?.fiftyTwoWeekHigh ?? null,
      week_52_low: result.summaryDetail?.fiftyTwoWeekLow ?? null,
      dividend_yield: result.summaryDetail?.dividendYield ?? null,
      eps: result.defaultKeyStatistics?.trailingEps ?? null,
      sector: result.summaryProfile?.sector ?? null,
    });
  } catch (e: any) {
    res.status(404).json({ detail: `Could not fetch data for ${symbol}: ${e.message}` });
  }
});
