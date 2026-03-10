import { Router } from 'express';
import { AnalysisService } from '../../services/analysis-service.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/db.js';
import type { AuthRequest } from '../middleware/auth.js';

export const analyzeRouter = Router();

const asyncHandler = (fn: Function) =>
  (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next);

analyzeRouter.post('/', asyncHandler(async (req: any, res: any) => {
  const userId = (req as AuthRequest).userId;
  const { symbols: bodySymbols, model } = req.body;

  // Load symbols from Prisma watchlist if none provided in request
  let symbols: string[] = bodySymbols;
  if (!symbols || symbols.length === 0) {
    const items = await prisma.watchlistItem.findMany({
      where: { userId },
      orderBy: { addedAt: 'asc' },
    });
    symbols = items.map((i) => i.symbol);
    if (symbols.length === 0) {
      res.status(404).json({ code: 'NOT_FOUND', detail: 'Watchlist is empty' });
      return;
    }
  }

  const service = new AnalysisService();

  try {
    const result = await service.runAnalysis({ symbols, model, userId });
    res.json(result);
  } catch (e: unknown) {
    if (e instanceof AppError) {
      res.status(e.statusCode).json({ code: e.code, detail: e.message });
    } else {
      res.status(500).json({ code: 'INTERNAL', detail: String(e) });
    }
  }
}));
