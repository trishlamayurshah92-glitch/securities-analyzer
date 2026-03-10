import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Test 1: chunkReport (pure unit, no mocks needed) ----
describe('chunkReport', () => {
  it('splits a report into sections', async () => {
    const { chunkReport } = await import('../src/lib/vector-store.js');
    const report = `**Summary:** Good company.\n**Bull Case:** Growth potential.\n**Bear Case:** High debt.`;
    const chunks = chunkReport(report);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].section).toBe('summary');
  });

  it('returns empty array when no sections found (fallback handled in storeAnalysis)', async () => {
    const { chunkReport } = await import('../src/lib/vector-store.js');
    const report = 'Plain text with no headers.';
    const chunks = chunkReport(report);
    expect(chunks).toHaveLength(0);
  });
});

// ---- Test 2: storeAnalysis (mocked DB + mocked embed) ----
describe('storeAnalysis (mocked)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mock('../src/lib/db.js', () => ({
      prisma: {
        analysisSnapshot: {
          create: vi.fn().mockResolvedValue({ id: 42 }),
        },
        $executeRaw: vi.fn().mockResolvedValue(1),
      },
    }));
    // mock Google GenAI so embed() returns a fake 768-dim vector
    vi.mock('@google/generative-ai', () => ({
      GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
        getGenerativeModel: vi.fn().mockReturnValue({
          embedContent: vi.fn().mockResolvedValue({
            embedding: { values: new Array(768).fill(0.1) },
          }),
        }),
      })),
    }));
  });

  it('creates a snapshot and inserts embedding rows', async () => {
    const { storeAnalysis } = await import('../src/lib/vector-store.js');
    const { prisma } = await import('../src/lib/db.js');

    const result = await storeAnalysis(
      'user-123',
      'AAPL',
      '**Summary:** Strong fundamentals.\n**Bull Case:** AI growth.',
      'bullish',
    );

    expect(result.status).toBe('stored');
    expect(prisma.analysisSnapshot.create).toHaveBeenCalledOnce();
    expect(prisma.$executeRaw).toHaveBeenCalled(); // one call per section
  });

  it('returns error status (does not throw) when DB fails', async () => {
    const { prisma } = await import('../src/lib/db.js');
    (prisma.analysisSnapshot.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB connection failed'));

    const { storeAnalysis } = await import('../src/lib/vector-store.js');
    const result = await storeAnalysis('user-123', 'AAPL', 'Some report', 'neutral');

    expect(result.status).toBe('error');
    expect(result.message).toContain('DB connection failed');
  });
});

// ---- Test 3: embed() real API (skipped without key) ----
describe('embed() real API', () => {
  it.skipIf(!process.env.GEMINI_API_KEY)('returns a 768-dim vector for real text', async () => {
    vi.resetModules(); // use real modules
    const { embed } = await import('../src/lib/vector-store.js');
    const result = await embed('Apple Inc is a technology company.');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(768);
    expect(typeof result[0]).toBe('number');
  }, 15_000);
});
