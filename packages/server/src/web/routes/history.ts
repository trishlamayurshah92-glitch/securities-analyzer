import { Router } from 'express';
import { searchHistory, getSentimentTrend } from '../../lib/vector-store.js';
import { prisma } from '../../lib/db.js';
import { computeDiff } from '../../lib/compute-diff.js';
import type { AuthRequest } from '../middleware/auth.js';

export const historyRouter = Router();

const asyncHandler = (fn: Function) =>
  (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next);

historyRouter.get('/:symbol/trend', asyncHandler(async (req: any, res: any) => {
  const userId = (req as AuthRequest).userId;
  const { symbol } = req.params;
  const days = parseInt(req.query.days as string) || 30;
  const result = await getSentimentTrend(userId, symbol, days);
  res.json(result);
}));

historyRouter.get('/:symbol/diff', asyncHandler(async (req: any, res: any) => {
  const userId = (req as AuthRequest).userId;
  const { symbol } = req.params;
  const snapshots = await prisma.analysisSnapshot.findMany({
    where: { userId, symbol: symbol.toUpperCase() },
    orderBy: { createdAt: 'desc' },
    take: 2,
    select: {
      id: true,
      symbol: true,
      createdAt: true,
      sentiment: true,
      price: true,
      peRatio: true,
      marketCap: true,
    },
  });

  if (snapshots.length < 2) {
    res.status(404).json({ detail: 'Not enough snapshots to compute diff' });
    return;
  }

  // snapshots[0] = most recent, snapshots[1] = previous
  const diff = computeDiff(snapshots[1], snapshots[0]);
  res.json(diff);
}));

historyRouter.get('/:symbol/latest', asyncHandler(async (req: any, res: any) => {
  const userId = (req as AuthRequest).userId;
  const { symbol } = req.params;
  const snap = await prisma.analysisSnapshot.findFirst({
    where: { userId, symbol: symbol.toUpperCase() },
    orderBy: { createdAt: 'desc' },
  });

  if (!snap) {
    res.json(null);
    return;
  }

  res.json({
    score: 1,
    date: snap.createdAt.toISOString(),
    sentiment: snap.sentiment,
    price: snap.price,
    text: '',
    company_name: snap.companyName,
    pe_ratio: snap.peRatio,
    market_cap: snap.marketCap,
    beta: snap.beta,
    week_52_high: snap.week52High,
    week_52_low: snap.week52Low,
    dividend_yield: snap.dividendYield,
    structured_data: snap.structuredData ?? null,
  });
}));

historyRouter.get('/:symbol', asyncHandler(async (req: any, res: any) => {
  const userId = (req as AuthRequest).userId;
  const { symbol } = req.params;
  const query = (req.query.query as string) ?? 'recent analysis';
  const topK = parseInt(req.query.top_k as string) || 10;
  const result = await searchHistory(userId, symbol, query, topK);
  res.json(result);
}));
