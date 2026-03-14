import { describe, it, expect } from 'vitest';
import { SYSTEM_PROMPT } from '../src/agent/prompts.js';

describe('SYSTEM_PROMPT', () => {
  it('is a non-empty string', () => {
    expect(typeof SYSTEM_PROMPT).toBe('string');
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it('contains workflow steps', () => {
    expect(SYSTEM_PROMPT).toContain('Check Historical Context');
    expect(SYSTEM_PROMPT).toContain('Fetch Fresh Data');
    expect(SYSTEM_PROMPT).toContain('Analyze and Synthesize');
    expect(SYSTEM_PROMPT).toContain('Optionally Fetch Market Context');
  });

  it('references all MCP tools', () => {
    expect(SYSTEM_PROMPT).toContain('search_history');
    expect(SYSTEM_PROMPT).toContain('get_sentiment_trend');
    expect(SYSTEM_PROMPT).toContain('get_company_news');
    expect(SYSTEM_PROMPT).toContain('get_stock_fundamentals');
    expect(SYSTEM_PROMPT).toContain('get_price_history');
    expect(SYSTEM_PROMPT).toContain('get_analyst_recommendations');
    expect(SYSTEM_PROMPT).toContain('get_market_news');
  });

  it('contains report format sections', () => {
    expect(SYSTEM_PROMPT).toContain('Sentiment:');
    expect(SYSTEM_PROMPT).toContain('News Summary:');
    expect(SYSTEM_PROMPT).toContain('Fundamentals Snapshot:');
    expect(SYSTEM_PROMPT).toContain('Price Action:');
    expect(SYSTEM_PROMPT).toContain('Portfolio Summary');
  });

  it('contains guidelines', () => {
    expect(SYSTEM_PROMPT).toContain('Guidelines');
    expect(SYSTEM_PROMPT).toContain('data-driven');
  });
});
