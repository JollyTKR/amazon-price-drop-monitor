import pino, { type Logger, type LoggerOptions } from "pino";

export type AppLogger = Logger;

export function createLogger(options: LoggerOptions = {}): AppLogger {
  return pino({
    level: process.env.LOG_LEVEL ?? "info",
    ...options,
  });
}

export const logger = createLogger();
