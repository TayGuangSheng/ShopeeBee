import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional()
);

const optionalSecret = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional()
);

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return value;
}, z.boolean());

const envSchema = z
  .object({
    TELEGRAM_BOT_TOKEN: z.string().min(1),
    BOT_MODE: z.enum(["polling", "webhook"]).default("polling"),
    PUBLIC_WEBHOOK_URL: optionalUrl,
    RENDER_EXTERNAL_URL: optionalUrl,
    ADMIN_USERNAMES: z.string().default(""),
    ADMIN_USER_IDS: z.string().default(""),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    DATABASE_URL: z.string().min(1).default("file:../data/shopeebee.db"),
    SHOPEE_AFFILIATE_ID: optionalSecret,
    SHOPEE_AFFILIATE_SUB_ID: z.string().min(1).default("shopeebee"),
    SHOPEE_EXPAND_SHORT_LINKS: booleanFromEnv.default(true),
    SHOPEE_CONVERSION_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    QUEUE_CONCURRENCY: z.coerce.number().int().min(1).max(5).default(1),
    MAX_LINKS_PER_MESSAGE: z.coerce.number().int().min(1).max(10).default(5)
  })
  .superRefine((value, ctx) => {
    if (value.BOT_MODE === "webhook" && !value.PUBLIC_WEBHOOK_URL && !value.RENDER_EXTERNAL_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["PUBLIC_WEBHOOK_URL"],
        message: "PUBLIC_WEBHOOK_URL or RENDER_EXTERNAL_URL is required when BOT_MODE=webhook"
      });
    }
  });

export type BotMode = "polling" | "webhook";

export interface AppConfig {
  telegramBotToken: string;
  botMode: BotMode;
  publicWebhookUrl: string | undefined;
  adminUsernames: Set<string>;
  adminUserIds: Set<string>;
  port: number;
  logLevel: string;
  databaseUrl: string;
  shopeeAffiliateId: string | undefined;
  shopeeAffiliateSubId: string;
  shopeeExpandShortLinks: boolean;
  shopeeConversionTimeoutMs: number;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  queueConcurrency: number;
  maxLinksPerMessage: number;
}

export function parseIdSet(value: string): Set<string> {
  return new Set(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

export function normalizeTelegramUsername(value: string): string {
  return value.trim().replace(/^@/u, "").toLowerCase();
}

export function parseUsernameSet(value: string): Set<string> {
  return new Set(
    value
      .split(",")
      .map(normalizeTelegramUsername)
      .filter(Boolean)
  );
}

export function parseAppConfig(source: Record<string, unknown>): AppConfig {
  const parsed = envSchema.parse(source);

  return {
    telegramBotToken: parsed.TELEGRAM_BOT_TOKEN,
    botMode: parsed.BOT_MODE,
    publicWebhookUrl: parsed.PUBLIC_WEBHOOK_URL ?? parsed.RENDER_EXTERNAL_URL,
    adminUsernames: parseUsernameSet(parsed.ADMIN_USERNAMES),
    adminUserIds: parseIdSet(parsed.ADMIN_USER_IDS),
    port: parsed.PORT,
    logLevel: parsed.LOG_LEVEL,
    databaseUrl: parsed.DATABASE_URL,
    shopeeAffiliateId: parsed.SHOPEE_AFFILIATE_ID,
    shopeeAffiliateSubId: parsed.SHOPEE_AFFILIATE_SUB_ID,
    shopeeExpandShortLinks: parsed.SHOPEE_EXPAND_SHORT_LINKS,
    shopeeConversionTimeoutMs: parsed.SHOPEE_CONVERSION_TIMEOUT_MS,
    rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: parsed.RATE_LIMIT_MAX,
    queueConcurrency: parsed.QUEUE_CONCURRENCY,
    maxLinksPerMessage: parsed.MAX_LINKS_PER_MESSAGE
  };
}

export function loadAppConfig(): AppConfig {
  return parseAppConfig(process.env);
}
