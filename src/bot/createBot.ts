import { Telegraf } from "telegraf";
import type { Logger } from "pino";
import type { AppConfig } from "../config/env.js";
import type { ConversionRepository } from "../database/repositories.js";
import { createTelegramAccessMiddleware } from "../middleware/telegramAccess.js";
import { createTelegramRateLimitMiddleware } from "../middleware/telegramRateLimit.js";
import type { AccessControlService } from "../services/accessControlService.js";
import type { ConversionService } from "../services/conversionService.js";
import type { InMemoryRateLimiter } from "../services/rateLimiter.js";
import { extractUrlsFromText } from "../utils/url.js";
import { formatConversionResult } from "./formatters.js";
import type { BotContext } from "./types.js";

export interface BotDependencies {
  config: AppConfig;
  logger: Logger;
  repository: ConversionRepository;
  accessControl: AccessControlService;
  rateLimiter: InMemoryRateLimiter;
  conversionService: ConversionService;
}

export function createBot(dependencies: BotDependencies): Telegraf<BotContext> {
  const bot = new Telegraf<BotContext>(dependencies.config.telegramBotToken);

  bot.use(
    createTelegramAccessMiddleware(
      dependencies.accessControl,
      dependencies.repository,
      dependencies.logger
    )
  );
  bot.use(createTelegramRateLimitMiddleware(dependencies.rateLimiter));

  bot.on("text", async (ctx) => {
    const profile = ctx.state.userProfile;
    const access = ctx.state.access;

    if (!profile || !access) {
      return;
    }

    const urls = extractUrlsFromText(ctx.message.text);
    if (urls.length === 0) {
      await ctx.reply("Send a Shopee Singapore product link.");
      return;
    }

    const selectedUrls = urls.slice(0, dependencies.config.maxLinksPerMessage);
    if (urls.length > selectedUrls.length) {
      await ctx.reply(`Processing the first ${selectedUrls.length} links from this message.`);
    }

    for (const url of selectedUrls) {
      const submission = await dependencies.conversionService.submitConversion(profile, access, url);

      if (!submission.accepted) {
        await ctx.reply(submission.message);
        continue;
      }

      await ctx.reply("Converting link...");
      try {
        const result = await submission.result;
        await ctx.reply(formatConversionResult(result));
      } catch (error) {
        dependencies.logger.error(
          { error, conversionId: submission.conversionId },
          "Unhandled conversion result error"
        );
        await ctx.reply("Could not complete conversion. Please try again.");
      }
    }
  });

  bot.catch((error, ctx) => {
    dependencies.logger.error({ error, updateType: ctx.updateType }, "Unhandled Telegram bot error");
    void ctx.reply("Something went wrong while handling that message.").catch(() => undefined);
  });

  return bot;
}
