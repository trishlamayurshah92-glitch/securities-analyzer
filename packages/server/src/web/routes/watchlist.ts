import { Router } from 'express';
import { prisma } from '../../lib/db.js';
import { AnalysisService } from '../../services/analysis-service.js';
import type { AuthRequest } from '../middleware/auth.js';

export const watchlistRouter = Router();

watchlistRouter.get('/', async (req, res) => {
  const userId = (req as AuthRequest).userId;
  try {
    const items = await prisma.watchlistItem.findMany({
      where: { userId },
      orderBy: { addedAt: 'asc' },
    });
    res.json(items.map((i) => ({ id: i.id, symbol: i.symbol, addedAt: i.addedAt.toISOString() })));
  } catch (e: any) {
    res.status(500).json({ detail: String(e) });
  }
});

watchlistRouter.post('/', async (req, res) => {
  const userId = (req as AuthRequest).userId;
  const symbol = ((req.body.symbol as string) ?? '').toUpperCase().trim();
  if (!symbol) {
    res.status(400).json({ detail: 'Symbol cannot be empty' });
    return;
  }

  try {
    const item = await prisma.watchlistItem.create({ data: { userId, symbol } });
    res.status(201).json({
      id: item.id,
      symbol: item.symbol,
      addedAt: item.addedAt.toISOString(),
      message: `${symbol} added to watchlist`,
    });

    setImmediate(() => {
      const service = new AnalysisService();
      service.runAnalysis({ symbols: [symbol], userId }).catch((err: unknown) =>
        console.error(`Background analysis failed for ${symbol}:`, err),
      );
    });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      res.status(409).json({ detail: `${symbol} already in watchlist` });
    } else {
      res.status(500).json({ detail: String(e) });
    }
  }
});

watchlistRouter.delete('/:symbol', async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId;
  const symbol = req.params.symbol.toUpperCase().trim();

  try {
    const count = await prisma.watchlistItem.deleteMany({ where: { userId, symbol } });
    if (count.count === 0) {
      res.status(404).json({ detail: `${symbol} not found in watchlist` });
    } else {
      res.json({ symbol, message: `${symbol} removed from watchlist` });
    }
  } catch (e: any) {
    res.status(500).json({ detail: String(e) });
  }
});
