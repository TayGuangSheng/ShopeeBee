import pino, { type Logger } from "pino";
import type { AppConfig } from "./config/env.js";

export function createLogger(config: Pick<AppConfig, "logLevel">): Logger {
  return pino({
    level: config.logLevel,
    redact: {
      paths: [
        "telegramBotToken",
        "TELEGRAM_BOT_TOKEN",
        "password",
        "*.password",
        "headers.authorization",
        "req.headers.authorization"
      ],
      censor: "[redacted]"
    },
    base: null,
    timestamp: pino.stdTimeFunctions.isoTime
  });
}
