import type { FastifyInstance } from "fastify";
import type { Telegraf } from "telegraf";
import { createBot } from "./bot/createBot.js";
import type { BotContext } from "./bot/types.js";
import { loadAppConfig } from "./config/env.js";
import { createPrismaClient } from "./database/prisma.js";
import { PrismaConversionRepository } from "./database/repositories.js";
import { createLogger } from "./logger.js";
import { createHttpServer } from "./server/httpServer.js";
import { AccessControlService } from "./services/accessControlService.js";
import { ConversionService } from "./services/conversionService.js";
import { DirectAffiliateLinkService } from "./services/directAffiliateLinkService.js";
import { HealthService } from "./services/healthService.js";
import { InMemoryRateLimiter } from "./services/rateLimiter.js";
import { ensureRuntimeDirectories } from "./utils/runtime.js";

async function main(): Promise<void> {
  const config = loadAppConfig();
  process.env.DATABASE_URL = config.databaseUrl;

  await ensureRuntimeDirectories(config);

  const logger = createLogger(config);
  const prisma = createPrismaClient(logger);
  await prisma.$connect();

  const repository = new PrismaConversionRepository(prisma);
  const accessControl = AccessControlService.fromConfig(config);
  const rateLimiter = new InMemoryRateLimiter(config.rateLimitWindowMs, config.rateLimitMax);
  const linkGenerator = new DirectAffiliateLinkService(
    {
      affiliateId: config.shopeeAffiliateId,
      subId: config.shopeeAffiliateSubId,
      expandShortLinks: config.shopeeExpandShortLinks
    },
    logger.child({ component: "direct-affiliate-link" })
  );
  const conversionService = new ConversionService(
    repository,
    linkGenerator,
    {
      queueConcurrency: config.queueConcurrency,
      conversionTimeoutMs: config.shopeeConversionTimeoutMs
    },
    logger.child({ component: "conversion-service" })
  );
  const healthService = new HealthService(repository, linkGenerator, conversionService);
  const bot = createBot({
    config,
    logger: logger.child({ component: "telegram-bot" }),
    repository,
    accessControl,
    rateLimiter,
    conversionService
  });
  const server = createHttpServer({
    logger: logger.child({ component: "http-server" }),
    healthService,
    bot
  });

  await bot.telegram.deleteMyCommands().catch((error: unknown) => {
    logger.warn({ error }, "Unable to clear Telegram command menu");
  });
  await server.listen({ port: config.port, host: "0.0.0.0" });

  if (config.botMode === "webhook") {
    const webhookBaseUrl = config.publicWebhookUrl?.replace(/\/+$/u, "");
    if (webhookBaseUrl) {
      await bot.telegram.setWebhook(`${webhookBaseUrl}/telegram/webhook`);
      logger.info({ port: config.port, webhookBaseUrl }, "ShopeeBee started in webhook mode");
    } else {
      logger.warn(
        { port: config.port },
        "ShopeeBee started in webhook mode without PUBLIC_WEBHOOK_URL; set the webhook URL after deploy"
      );
    }
  } else {
    await bot.telegram.deleteWebhook();
    await bot.launch();
    logger.info({ port: config.port }, "ShopeeBee started in polling mode");
  }

  registerShutdownHandlers({
    logger,
    server,
    bot,
    conversionService,
    linkGenerator,
    disconnectDatabase: () => prisma.$disconnect()
  });
}

interface ShutdownDependencies {
  logger: ReturnType<typeof createLogger>;
  server: FastifyInstance;
  bot: Telegraf<BotContext>;
  conversionService: ConversionService;
  linkGenerator: DirectAffiliateLinkService;
  disconnectDatabase: () => Promise<void>;
}

function registerShutdownHandlers(dependencies: ShutdownDependencies): void {
  let shuttingDown = false;

  const shutdown = async (signal: string, exitCode = 0): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    dependencies.logger.info({ signal }, "Shutting down");

    await Promise.allSettled([
      dependencies.bot.stop(signal),
      dependencies.server.close(),
      dependencies.conversionService.drain(),
      dependencies.linkGenerator.close()
    ]);
    await dependencies.disconnectDatabase().catch((error: unknown) => {
      dependencies.logger.warn({ error }, "Database disconnect failed");
    });

    process.exit(exitCode);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.once("uncaughtException", (error) => {
    dependencies.logger.fatal({ error }, "Uncaught exception");
    void shutdown("uncaughtException", 1);
  });
  process.once("unhandledRejection", (error) => {
    dependencies.logger.fatal({ error }, "Unhandled rejection");
    void shutdown("unhandledRejection", 1);
  });
}

main().catch((error: unknown) => {
  const logger = createLogger({ logLevel: process.env.LOG_LEVEL ?? "info" });
  logger.fatal({ error }, "Failed to start ShopeeBee");
  process.exit(1);
});
