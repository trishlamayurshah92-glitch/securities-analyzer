export class AppError extends Error {
  constructor(message: string, public readonly code: string, public readonly statusCode: number) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ToolLoopError extends AppError {
  constructor(m: string) { super(m, 'TOOL_LOOP', 500); }
}

export class ToolTimeoutError extends AppError {
  constructor(m: string) { super(m, 'TOOL_TIMEOUT', 504); }
}

export class AnalysisTimeoutError extends AppError {
  constructor(m: string) { super(m, 'ANALYSIS_TIMEOUT', 504); }
}

export class ConfigError extends AppError {
  constructor(m: string) { super(m, 'CONFIG_ERROR', 500); }
}

export class NotFoundError extends AppError {
  constructor(m: string) { super(m, 'NOT_FOUND', 404); }
}

export class ValidationError extends AppError {
  constructor(m: string) { super(m, 'VALIDATION', 400); }
}
