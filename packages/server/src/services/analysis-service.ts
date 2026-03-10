import { readFileSync, existsSync } from 'fs';
import type { AnalysisResult } from '@stockwatch/shared';
import { StockAnalysisOrchestrator } from '../agent/orchestrator.js';
import { WATCHLIST_PATH } from '../config.js';
import { prisma } from '../lib/db.js';
import { storeAnalysis } from '../lib/vector-store.js';
import { parseSnapshotsFromReport } from '../lib/parse-snapshot.js';

export class AnalysisService {
  private orchestrator: StockAnalysisOrchestrator | null;

  constructor(orchestrator?: StockAnalysisOrchestrator) {
    this.orchestrator = orchestrator ?? null;
  }

  async runAnalysis(options?: {
    symbols?: string[];
    watchlistPath?: string;
    model?: string;
    userId?: string;
  }): Promise<AnalysisResult> {
    let watchlist: Array<{ symbol: string }>;

    if (options?.symbols && options.symbols.length > 0) {
      // Use provided symbols directly — no file required
      watchlist = options.symbols.map((s) => ({ symbol: s.toUpperCase() }));
    } else if (options?.watchlistPath) {
      // CLI path: explicit file override
      watchlist = this.loadWatchlist(options.watchlistPath);
    } else {
      // Web path: load from DB
      const items = await prisma.watchlistItem.findMany({ orderBy: { addedAt: 'asc' } });
      watchlist = items.map((i) => ({ symbol: i.symbol }));
    }

    if (!this.orchestrator) {
      this.orchestrator = new StockAnalysisOrchestrator({
        model: options?.model,
        userId: options?.userId,
      });
    }

    try {
      await this.orchestrator.setup();

      const start = Date.now();
      const report = await this.orchestrator.analyzeWatchlist(watchlist);
      const duration = (Date.now() - start) / 1000;

      if (options?.userId) {
        const symbols = watchlist.map((w) => w.symbol);
        const parsed = parseSnapshotsFromReport(report, symbols);

        await Promise.allSettled(
          parsed.map((p) =>
            storeAnalysis(
              options.userId!,
              p.symbol,
              p.reportText,
              p.sentiment,
              p.price,
              {
                company_name:   p.companyName,
                pe_ratio:       p.peRatio,
                market_cap:     p.marketCap,
                beta:           p.beta,
                week_52_high:   p.week52High,
                week_52_low:    p.week52Low,
                dividend_yield: p.dividendYield,
              },
            ).then((r) => {
              if (r.status === 'error') {
                console.error(`[analysis-service] storeAnalysis failed for ${p.symbol}:`, r.message);
              }
            }),
          ),
        );
      }

      return {
        report,
        stocks_analyzed: watchlist.map((s) => s.symbol),
        model: this.orchestrator.model,
        duration_seconds: Math.round(duration * 100) / 100,
      };
    } finally {
      try {
        await this.orchestrator.cleanup();
      } catch {
        // ignore cleanup errors
      }
    }
  }

  private loadWatchlist(path: string): Array<{ symbol: string }> {
    if (!existsSync(path)) {
      throw new Error(
        `Watchlist file not found: ${path}. ` +
        'Create one or specify a valid path with --watchlist.',
      );
    }
    return JSON.parse(readFileSync(path, 'utf-8'));
  }
}
