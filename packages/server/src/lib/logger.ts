type Level = 'info' | 'warn' | 'error';

function log(level: Level, message: string, context?: Record<string, unknown>) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...context }));
}

export const logger = {
  info:  (msg: string, ctx?: Record<string, unknown>) => log('info', msg, ctx),
  warn:  (msg: string, ctx?: Record<string, unknown>) => log('warn', msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),
};
