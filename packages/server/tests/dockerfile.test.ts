import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { PROJECT_ROOT } from '../src/config.js';

describe('Dockerfile', () => {
  const dockerfilePath = resolve(PROJECT_ROOT, 'Dockerfile');

  it('exists', () => {
    expect(existsSync(dockerfilePath)).toBe(true);
  });

  it('uses node:20-alpine', () => {
    const content = readFileSync(dockerfilePath, 'utf-8');
    expect(content).toContain('node:20-alpine');
  });

  it('copies workspace packages', () => {
    const content = readFileSync(dockerfilePath, 'utf-8');
    expect(content).toContain('packages/shared');
    expect(content).toContain('packages/server');
  });

  it('exposes port 8001', () => {
    const content = readFileSync(dockerfilePath, 'utf-8');
    expect(content).toContain('EXPOSE 8001');
  });

  it('uses node entrypoint', () => {
    const content = readFileSync(dockerfilePath, 'utf-8');
    expect(content).toContain('node');
    expect(content).toContain('dist/web/app.js');
  });
});

describe('Project structure', () => {
  it('has watchlist.json', () => {
    expect(existsSync(resolve(PROJECT_ROOT, 'watchlist.json'))).toBe(true);
  });

  it('watchlist.json contains valid data', () => {
    const data = JSON.parse(readFileSync(resolve(PROJECT_ROOT, 'watchlist.json'), 'utf-8'));
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('symbol');
  });

  it('has .env.example', () => {
    expect(existsSync(resolve(PROJECT_ROOT, '.env.example'))).toBe(true);
  });

  it('.env.example contains required keys', () => {
    const content = readFileSync(resolve(PROJECT_ROOT, '.env.example'), 'utf-8');
    expect(content).toContain('ANTHROPIC_API_KEY');
    expect(content).toContain('OPENAI_API_KEY');
    expect(content).toContain('FINNHUB_API_KEY');
    expect(content).toContain('DATABASE_URL');
    expect(content).toContain('MODEL');
  });
});
