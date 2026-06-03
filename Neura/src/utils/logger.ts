export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99
};

export interface LogContext {
  component?: string;
  requestId?: string;
  providerId?: string;
  modelId?: string;
  [key: string]: unknown;
}

export class Logger {
  private readonly level: LogLevel;
  private readonly context: LogContext;

  constructor(level: LogLevel = "info", context: LogContext = {}) {
    this.level = level;
    this.context = context;
  }

  child(context: LogContext): Logger {
    return new Logger(this.level, { ...this.context, ...context });
  }

  debug(message: string, data: LogContext = {}): void {
    this.write("debug", message, data);
  }

  info(message: string, data: LogContext = {}): void {
    this.write("info", message, data);
  }

  warn(message: string, data: LogContext = {}): void {
    this.write("warn", message, data);
  }

  error(message: string, data: LogContext = {}): void {
    this.write("error", message, data);
  }

  private write(level: Exclude<LogLevel, "silent">, message: string, data: LogContext): void {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[this.level]) {
      return;
    }

    const payload = {
      ts: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...sanitize(data)
    };

    const line = JSON.stringify(payload);
    if (level === "error") {
      process.stderr.write(`${line}\n`);
      return;
    }
    process.stdout.write(`${line}\n`);
  }
}

function sanitize(data: LogContext): LogContext {
  const sanitized: LogContext = {};
  for (const [key, value] of Object.entries(data)) {
    if (/key|token|secret|password/i.test(key)) {
      sanitized[key] = value ? "[redacted]" : value;
      continue;
    }
    if (value instanceof Error) {
      sanitized[key] = {
        name: value.name,
        message: value.message,
        stack: value.stack
      };
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}
