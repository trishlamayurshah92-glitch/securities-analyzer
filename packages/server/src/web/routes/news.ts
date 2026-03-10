import { Router } from 'express';

export const newsRouter = Router();

const asyncHandler = (fn: Function) =>
  (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next);

newsRouter.get('/:symbol', asyncHandler(async (req: any, res: any) => {
  const symbol = req.params.symbol.toUpperCase().trim();
  const daysBack = parseInt(req.query.days_back as string) || 7;

  const apiKey = process.env.FINNHUB_API_KEY ?? '';
  const toTs = Math.floor(Date.now() / 1000);
  const fromTs = toTs - daysBack * 24 * 60 * 60;

  const url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${new Date(fromTs * 1000).toISOString().slice(0, 10)}&to=${new Date(toTs * 1000).toISOString().slice(0, 10)}&token=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!Array.isArray(data)) {
      res.json([]);
      return;
    }

    const articles = data
      .slice(0, 20)
      .map((item: any) => ({
        headline: item.headline ?? '',
        summary: item.summary ?? '',
        source: item.source ?? '',
        datetime: new Date((item.datetime ?? 0) * 1000).toISOString(),
        url: item.url ?? '',
      }))
      .sort((a: any, b: any) => b.datetime.localeCompare(a.datetime));

    res.json(articles);
  } catch {
    res.json([]);
  }
}));
