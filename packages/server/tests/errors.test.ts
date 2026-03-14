import { describe, it, expect } from 'vitest';
import {
  AppError,
  ToolLoopError,
  ToolTimeoutError,
  AnalysisTimeoutError,
  ConfigError,
  NotFoundError,
  ValidationError,
} from '../src/lib/errors.js';

describe('Error classes', () => {
  it('ToolLoopError has statusCode 500 and code TOOL_LOOP', () => {
    const err = new ToolLoopError('too many iterations');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('TOOL_LOOP');
  });

  it('ToolTimeoutError has statusCode 504 and code TOOL_TIMEOUT', () => {
    const err = new ToolTimeoutError('timed out');
    expect(err.statusCode).toBe(504);
    expect(err.code).toBe('TOOL_TIMEOUT');
  });

  it('AnalysisTimeoutError has statusCode 504 and code ANALYSIS_TIMEOUT', () => {
    const err = new AnalysisTimeoutError('analysis timed out');
    expect(err.statusCode).toBe(504);
    expect(err.code).toBe('ANALYSIS_TIMEOUT');
  });

  it('ConfigError has statusCode 500 and code CONFIG_ERROR', () => {
    const err = new ConfigError('missing key');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('CONFIG_ERROR');
  });

  it('NotFoundError has statusCode 404 and code NOT_FOUND', () => {
    const err = new NotFoundError('resource missing');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });

  it('ValidationError has statusCode 400 and code VALIDATION', () => {
    const err = new ValidationError('invalid input');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION');
  });

  it('all errors are instanceof AppError', () => {
    expect(new ToolLoopError('x')).toBeInstanceOf(AppError);
    expect(new ToolTimeoutError('x')).toBeInstanceOf(AppError);
    expect(new AnalysisTimeoutError('x')).toBeInstanceOf(AppError);
    expect(new ConfigError('x')).toBeInstanceOf(AppError);
    expect(new NotFoundError('x')).toBeInstanceOf(AppError);
    expect(new ValidationError('x')).toBeInstanceOf(AppError);
  });

  it('all errors are instanceof Error', () => {
    expect(new ToolLoopError('x')).toBeInstanceOf(Error);
    expect(new ToolTimeoutError('x')).toBeInstanceOf(Error);
    expect(new AnalysisTimeoutError('x')).toBeInstanceOf(Error);
    expect(new ConfigError('x')).toBeInstanceOf(Error);
    expect(new NotFoundError('x')).toBeInstanceOf(Error);
    expect(new ValidationError('x')).toBeInstanceOf(Error);
  });

  it('error message is preserved', () => {
    const err = new NotFoundError('my message');
    expect(err.message).toBe('my message');
  });
});
