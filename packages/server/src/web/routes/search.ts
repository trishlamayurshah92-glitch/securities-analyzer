import { Router } from 'express';

export const searchRouter = Router();

const asyncHandler = (fn: Function) =>
  (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next);

searchRouter.get('/', asyncHandler(async (req: any, res: any) => {
  const q = (req.query.q as string ?? '').trim().toUpperCase();
  if (!q) return res.json([]);

  const apiKey = process.env.FINNHUB_API_KEY ?? '';
  const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!Array.isArray(data?.result)) return res.json([]);

    const results = data.result
      .filter((item: any) => item.type === 'Common Stock' || item.type === 'ETP')
      .slice(0, 8)
      .map((item: any) => ({
        symbol: item.symbol as string,
        description: item.description as string,
      }));

    res.json(results);
  } catch {
    res.json([]);
  }
}));
