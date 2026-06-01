import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import 'dotenv/config';
import express from 'express';

process.on('unhandledRejection', (reason) => {
  console.error('[startup] Unhandled rejection (process kept alive):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[startup] Uncaught exception:', err);
});
import cors from 'cors';
import { watchlistRouter } from './routes/watchlist.js';
import { analyzeRouter } from './routes/analyze.js';
import { historyRouter } from './routes/history.js';
import { newsRouter } from './routes/news.js';
import { chatRouter } from './routes/chat.js';
import { searchRouter } from './routes/search.js';
import { quickfactsRouter } from './routes/quickfacts.js';
import { getMCPManager } from '../agent/mcp-singleton.js';
import { logger } from '../lib/logger.js';
import { requireAuth } from './middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
  credentials: true,
}));
app.use(express.json());

app.use((req, _res, next) => {
  (req as any).requestId = randomUUID();
  (req as any).startTime = Date.now();
  logger.info('request_start', { requestId: (req as any).requestId, method: req.method, path: req.path });
  next();
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api', requireAuth);
app.use('/api/watchlist', watchlistRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/history', historyRouter);
app.use('/api/news', newsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/search', searchRouter);
app.use('/api/quickfacts', quickfactsRouter);

app.use((req, res, next) => {
  res.on('finish', () => {
    logger.info('request_end', {
      requestId: (req as any).requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: Date.now() - (req as any).startTime,
    });
  });
  next();
});

// Warm up MCP servers at boot (non-blocking)
getMCPManager().catch((e) => console.error('[mcp-warmup] init failed (non-fatal):', e));

// Serve frontend static files in production
const frontendDist = resolve(__dirname, '..', '..', '..', '..', 'frontend', 'dist');
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (_req, res) => {
    res.sendFile(resolve(frontendDist, 'index.html'));
  });
}

export { app };

const PORT = parseInt(process.env.PORT ?? '8001', 10);
app.listen(PORT, () => {
  console.log(`Stockwatch API running on http://localhost:${PORT}`);
});
