import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock marked-terminal since it's terminal-specific
vi.mock('marked-terminal', () => ({
  markedTerminal: () => ({}),
}));

const { displayReport } = await import('../src/cli/display.js');

const mockResult = {
  report: '# Test Report\n\nThis is a test.',
  stocks_analyzed: ['AAPL', 'NVDA'],
  model: 'gpt-4o-mini',
  duration_seconds: 12.5,
};

let tmpDir: string;

beforeEach(() => {
  vi.restoreAllMocks();
  tmpDir = mkdtempSync(join(tmpdir(), 'stockwatch-cli-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('displayReport', () => {
  it('outputs to terminal with markdown rendering', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    displayReport(mockResult, 'terminal');

    expect(logSpy).toHaveBeenCalled();
    // Last call should be the summary line
    const lastCall = logSpy.mock.calls[logSpy.mock.calls.length - 1][0];
    expect(lastCall).toContain('2 stocks');
    expect(lastCall).toContain('gpt-4o-mini');
    expect(lastCall).toContain('12.5s');
  });

  it('outputs raw markdown without output path', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    displayReport(mockResult, 'markdown');

    expect(logSpy).toHaveBeenCalledWith('# Test Report\n\nThis is a test.');
  });

  it('writes markdown to file when output path given', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const outPath = join(tmpDir, 'report.md');

    displayReport(mockResult, 'markdown', outPath);

    const written = readFileSync(outPath, 'utf-8');
    expect(written).toBe('# Test Report\n\nThis is a test.');
    expect(logSpy).toHaveBeenCalledWith(`Report written to ${outPath}`);
  });

  it('outputs JSON without output path', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    displayReport(mockResult, 'json');

    const output = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.report).toBe('# Test Report\n\nThis is a test.');
    expect(parsed.stocks_analyzed).toEqual(['AAPL', 'NVDA']);
    expect(parsed.model).toBe('gpt-4o-mini');
    expect(parsed.duration_seconds).toBe(12.5);
  });

  it('writes JSON to file when output path given', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const outPath = join(tmpDir, 'report.json');

    displayReport(mockResult, 'json', outPath);

    const written = readFileSync(outPath, 'utf-8');
    const parsed = JSON.parse(written);
    expect(parsed.model).toBe('gpt-4o-mini');
    expect(parsed.stocks_analyzed).toEqual(['AAPL', 'NVDA']);
    expect(logSpy).toHaveBeenCalledWith(`Report written to ${outPath}`);
  });
});
