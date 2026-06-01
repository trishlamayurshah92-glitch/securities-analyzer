import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock the orchestrator
const mockSetup = vi.fn();
const mockAnalyzeWatchlist = vi.fn();
const mockCleanup = vi.fn();

vi.mock('../src/agent/orchestrator.js', () => ({
  StockAnalysisOrchestrator: vi.fn().mockImplementation(() => ({
    model: 'gpt-4o-mini',
    setup: mockSetup,
    analyzeWatchlist: mockAnalyzeWatchlist,
    cleanup: mockCleanup,
  })),
}));

const { AnalysisService } = await import('../src/services/analysis-service.js');

let tmpDir: string;
let watchlistPath: string;

beforeEach(() => {
  vi.clearAllMocks();
  tmpDir = mkdtempSync(join(tmpdir(), 'stockwatch-test-'));
  watchlistPath = join(tmpDir, 'watchlist.json');
  writeFileSync(watchlistPath, JSON.stringify([
    { symbol: 'AAPL' },
    { symbol: 'NVDA' },
    { symbol: 'GOOGL' },
  ]));
  mockAnalyzeWatchlist.mockResolvedValue({ report: '# Report\n\nAnalysis complete.', structuredPayloads: new Map() });
});

describe('AnalysisService', () => {
  it('runs analysis on full watchlist', async () => {
    const service = new AnalysisService();
    const result = await service.runAnalysis({ watchlistPath });

    expect(result.report).toContain('# Report');
    expect(result.stocks_analyzed).toEqual(['AAPL', 'NVDA', 'GOOGL']);
    expect(result.model).toBe('gpt-4o-mini');
    expect(result.duration_seconds).toBeGreaterThanOrEqual(0);
    expect(mockSetup).toHaveBeenCalled();
    expect(mockCleanup).toHaveBeenCalled();
  });

  it('filters by symbols', async () => {
    const service = new AnalysisService();
    const result = await service.runAnalysis({
      watchlistPath,
      symbols: ['AAPL', 'NVDA'],
    });

    expect(result.stocks_analyzed).toEqual(['AAPL', 'NVDA']);
    const callArg = mockAnalyzeWatchlist.mock.calls[0][0];
    expect(callArg).toHaveLength(2);
  });

  it('case-insensitive symbol matching', async () => {
    const service = new AnalysisService();
    const result = await service.runAnalysis({
      watchlistPath,
      symbols: ['aapl'],
    });

    expect(result.stocks_analyzed).toEqual(['AAPL']);
  });

  it('throws when watchlist file not found', async () => {
    const service = new AnalysisService();
    await expect(
      service.runAnalysis({ watchlistPath: '/nonexistent/watchlist.json' }),
    ).rejects.toThrow('Watchlist file not found');
  });

  it('cleans up even on error', async () => {
    mockAnalyzeWatchlist.mockRejectedValue(new Error('LLM error'));
    const service = new AnalysisService();

    await expect(service.runAnalysis({ watchlistPath })).rejects.toThrow('LLM error');
    expect(mockCleanup).toHaveBeenCalled();
  });
});
