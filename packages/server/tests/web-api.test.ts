import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock Prisma
const mockPrisma = {
  watchlistItem: {
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  analysisSnapshot: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
};
vi.mock('../src/lib/db.js', () => ({ prisma: mockPrisma }));

// Mock vector-store for history route
const mockSearchHistory = vi.fn();
const mockGetSentimentTrend = vi.fn();
vi.mock('../src/lib/vector-store.js', () => ({
  searchHistory: (...args: unknown[]) => mockSearchHistory(...args),
  getSentimentTrend: (...args: unknown[]) => mockGetSentimentTrend(...args),
  storeAnalysis: vi.fn().mockResolvedValue({ status: 'stored', id: '1' }),
  storeEmbedding: vi.fn().mockResolvedValue(undefined),
}));

// Mock parse-snapshot for analyze route
vi.mock('../src/lib/parse-snapshot.js', () => ({
  parseSnapshotsFromReport: vi.fn().mockReturnValue([]),
}));

// Mock MCP manager and orchestrator (used by analyze route)
vi.mock('../src/agent/mcp-singleton.js', () => ({
  getMCPManager: vi.fn().mockResolvedValue({}),
}));
vi.mock('../src/agent/orchestrator.js', () => ({
  StockAnalysisOrchestrator: vi.fn().mockImplementation(() => ({})),
}));

// Mock analysis service
const mockRunAnalysis = vi.fn();
vi.mock('../src/services/analysis-service.js', () => ({
  AnalysisService: vi.fn().mockImplementation(() => ({
    runAnalysis: mockRunAnalysis,
  })),
}));

const { watchlistRouter } = await import('../src/web/routes/watchlist.js');
const { analyzeRouter } = await import('../src/web/routes/analyze.js');
const { historyRouter } = await import('../src/web/routes/history.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/watchlist', watchlistRouter);
  app.use('/api/analyze', analyzeRouter);
  app.use('/api/history', historyRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Ensure setImmediate background tasks don't crash with "cannot read .catch of undefined"
  mockRunAnalysis.mockResolvedValue({});
});

describe('GET /api/watchlist', () => {
  it('returns the watchlist from Prisma', async () => {
    mockPrisma.watchlistItem.findMany.mockResolvedValue([
      { id: 1, symbol: 'AAPL', addedAt: new Date('2024-01-01') },
      { id: 2, symbol: 'NVDA', addedAt: new Date('2024-01-02') },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/watchlist');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].symbol).toBe('AAPL');
    expect(res.body[1].symbol).toBe('NVDA');
  });
});

describe('POST /api/watchlist', () => {
  it('adds a symbol', async () => {
    mockPrisma.watchlistItem.create.mockResolvedValue({
      id: 3,
      symbol: 'GOOGL',
      addedAt: new Date('2024-01-03'),
    });

    const app = createApp();
    const res = await request(app)
      .post('/api/watchlist')
      .send({ symbol: 'GOOGL' });

    expect(res.status).toBe(201);
    expect(res.body.symbol).toBe('GOOGL');
    expect(res.body.message).toContain('added');
    expect(mockPrisma.watchlistItem.create).toHaveBeenCalledWith({
      data: { symbol: 'GOOGL' },
    });
  });

  it('uppercases the symbol', async () => {
    mockPrisma.watchlistItem.create.mockResolvedValue({
      id: 4,
      symbol: 'TSLA',
      addedAt: new Date(),
    });

    const app = createApp();
    const res = await request(app)
      .post('/api/watchlist')
      .send({ symbol: 'tsla' });

    expect(res.status).toBe(201);
    expect(res.body.symbol).toBe('TSLA');
  });

  it('returns 400 for empty symbol', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/watchlist')
      .send({ symbol: '' });

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain('empty');
  });

  it('returns 409 for duplicate symbol', async () => {
    mockPrisma.watchlistItem.create.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
    );

    const app = createApp();
    const res = await request(app)
      .post('/api/watchlist')
      .send({ symbol: 'AAPL' });

    expect(res.status).toBe(409);
    expect(res.body.detail).toContain('already in watchlist');
  });
});

describe('DELETE /api/watchlist/:symbol', () => {
  it('removes a symbol', async () => {
    mockPrisma.watchlistItem.delete.mockResolvedValue({ id: 1, symbol: 'AAPL', addedAt: new Date() });

    const app = createApp();
    const res = await request(app).delete('/api/watchlist/AAPL');

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('removed');
    expect(mockPrisma.watchlistItem.delete).toHaveBeenCalledWith({
      where: { symbol: 'AAPL' },
    });
  });

  it('returns 404 for non-existent symbol', async () => {
    mockPrisma.watchlistItem.delete.mockRejectedValue(
      Object.assign(new Error('Record not found'), { code: 'P2025' }),
    );

    const app = createApp();
    const res = await request(app).delete('/api/watchlist/FAKE');

    expect(res.status).toBe(404);
    expect(res.body.detail).toContain('not found');
  });

  it('is case-insensitive', async () => {
    mockPrisma.watchlistItem.delete.mockResolvedValue({ id: 1, symbol: 'AAPL', addedAt: new Date() });

    const app = createApp();
    const res = await request(app).delete('/api/watchlist/aapl');
    expect(res.status).toBe(200);
    expect(mockPrisma.watchlistItem.delete).toHaveBeenCalledWith({
      where: { symbol: 'AAPL' },
    });
  });
});

describe('POST /api/analyze', () => {
  it('runs analysis and returns result', async () => {
    mockRunAnalysis.mockResolvedValue({
      report: '# Report',
      stocks_analyzed: ['AAPL'],
      model: 'gpt-4o-mini',
      duration_seconds: 5.0,
    });

    const app = createApp();
    const res = await request(app)
      .post('/api/analyze')
      .send({ symbols: ['AAPL'] });

    expect(res.status).toBe(200);
    expect(res.body.report).toBe('# Report');
    expect(res.body.stocks_analyzed).toEqual(['AAPL']);
  });

  it('returns 404 when watchlist is empty and no symbols provided', async () => {
    mockPrisma.watchlistItem.findMany.mockResolvedValue([]);

    const app = createApp();
    const res = await request(app).post('/api/analyze').send({});

    expect(res.status).toBe(404);
    expect(res.body.detail).toContain('empty');
  });

  it('loads symbols from Prisma when none provided in body', async () => {
    mockPrisma.watchlistItem.findMany.mockResolvedValue([
      { id: 1, symbol: 'AAPL', addedAt: new Date() },
    ]);
    mockRunAnalysis.mockResolvedValue({
      report: '# Report',
      stocks_analyzed: ['AAPL'],
      model: 'gpt-4o-mini',
      duration_seconds: 3.0,
    });

    const app = createApp();
    const res = await request(app).post('/api/analyze').send({});

    expect(res.status).toBe(200);
    expect(mockRunAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ symbols: ['AAPL'] }),
    );
  });
});

describe('GET /api/history/:symbol', () => {
  it('returns history matches', async () => {
    mockSearchHistory.mockResolvedValue([
      { score: 0.95, date: '2024-01-01', sentiment: 'Bullish', price: 180, text: 'Good' },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/history/AAPL');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].sentiment).toBe('Bullish');
    expect(mockSearchHistory).toHaveBeenCalledWith('AAPL', 'recent analysis', 10);
  });

  it('passes query params', async () => {
    mockSearchHistory.mockResolvedValue([]);

    const app = createApp();
    await request(app).get('/api/history/NVDA?query=earnings&top_k=3');

    expect(mockSearchHistory).toHaveBeenCalledWith('NVDA', 'earnings', 3);
  });
});

describe('GET /api/history/:symbol/trend', () => {
  it('returns sentiment trend', async () => {
    mockGetSentimentTrend.mockResolvedValue([
      { date: '2024-01-01', sentiment: 'Bullish', price: 180 },
      { date: '2024-01-02', sentiment: 'Neutral', price: 178 },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/history/AAPL/trend');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(mockGetSentimentTrend).toHaveBeenCalledWith('AAPL', 30);
  });

  it('passes days param', async () => {
    mockGetSentimentTrend.mockResolvedValue([]);

    const app = createApp();
    await request(app).get('/api/history/AAPL/trend?days=7');

    expect(mockGetSentimentTrend).toHaveBeenCalledWith('AAPL', 7);
  });
});

describe('GET /api/history/:symbol/diff', () => {
  it('returns snapshot diff when 2+ snapshots exist', async () => {
    const now = new Date();
    const earlier = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    mockPrisma.analysisSnapshot.findMany.mockResolvedValue([
      { id: 2, symbol: 'AAPL', createdAt: now, sentiment: 'Bearish', price: 170, peRatio: 25, marketCap: 2.6e12 },
      { id: 1, symbol: 'AAPL', createdAt: earlier, sentiment: 'Bullish', price: 190, peRatio: 28, marketCap: 2.9e12 },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/history/AAPL/diff');

    expect(res.status).toBe(200);
    expect(res.body.symbol).toBe('AAPL');
    expect(res.body.driftLevel).toBe('significant');
    expect(res.body.previousSentiment).toBe('Bullish');
    expect(res.body.currentSentiment).toBe('Bearish');
    expect(res.body.sentimentChanged).toBe(true);
  });

  it('returns 404 when fewer than 2 snapshots', async () => {
    mockPrisma.analysisSnapshot.findMany.mockResolvedValue([
      { id: 1, symbol: 'AAPL', createdAt: new Date(), sentiment: 'Bullish', price: 190, peRatio: 28, marketCap: 2.9e12 },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/history/AAPL/diff');

    expect(res.status).toBe(404);
  });
});
