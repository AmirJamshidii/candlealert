type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  module?: string;
  symbol?: string;
  message: string;
  data?: unknown;
}

function formatEntry(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level.toUpperCase()}]`,
  ];
  if (entry.module) parts.push(`[${entry.module}]`);
  if (entry.symbol) parts.push(`[${entry.symbol}]`);
  parts.push(entry.message);
  if (entry.data !== undefined) {
    parts.push(typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data));
  }
  return parts.join(' ');
}

function log(level: LogLevel, message: string, meta?: { module?: string; symbol?: string; data?: unknown }) {
  const entry: LogEntry = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...meta,
  };
  const line = formatEntry(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (message: string, meta?: { module?: string; symbol?: string; data?: unknown }) =>
    log('info', message, meta),
  warn: (message: string, meta?: { module?: string; symbol?: string; data?: unknown }) =>
    log('warn', message, meta),
  error: (message: string, meta?: { module?: string; symbol?: string; data?: unknown }) =>
    log('error', message, meta),
  debug: (message: string, meta?: { module?: string; symbol?: string; data?: unknown }) =>
    log('debug', message, meta),
};
