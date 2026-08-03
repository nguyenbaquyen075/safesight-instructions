// SPDX-License-Identifier: MIT

/**
 * SafeSight AI — Logger (Winston-compatible browser-safe logger)
 *
 * MANDATORY: Use this logger everywhere. console.log is FORBIDDEN.
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  meta?: Record<string, unknown>;
}

class Logger {
  private context: string;

  constructor(context = 'app') {
    this.context = context;
  }

  private formatEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: this.context,
      meta,
    };
  }

  private output(entry: LogEntry): void {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.context}]`;
    const metaStr = entry.meta ? ` ${JSON.stringify(entry.meta)}` : '';

    switch (entry.level) {
      case 'error':
        // eslint-disable-next-line no-console
        console.error(`${prefix} ${entry.message}${metaStr}`);
        break;
      case 'warn':
        // eslint-disable-next-line no-console
        console.warn(`${prefix} ${entry.message}${metaStr}`);
        break;
      case 'debug':
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.debug(`${prefix} ${entry.message}${metaStr}`);
        }
        break;
      default:
        // eslint-disable-next-line no-console
        console.info(`${prefix} ${entry.message}${metaStr}`);
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.output(this.formatEntry('error', message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.output(this.formatEntry('warn', message, meta));
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.output(this.formatEntry('info', message, meta));
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.output(this.formatEntry('debug', message, meta));
  }

  child(context: string): Logger {
    return new Logger(`${this.context}:${context}`);
  }
}

export const logger = new Logger('safesight');
export default logger;
