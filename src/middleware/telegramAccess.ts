import type { MiddlewareFn } from "telegraf";
import type { Logger } from "pino";
import type { ConversionRepository } from "../database/repositories.js";
import type { AccessControlService } from "../services/accessControlService.js";
import { profileFromContext } from "../bot/profile.js";
import type { BotContext } from "../bot/types.js";

export function createTelegramAccessMiddleware(
  accessControl: AccessControlService,
  repository: ConversionRepository,
  logger: Logger
): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    const profile = profileFromContext(ctx);
    if (!profile) {
      return next();
    }

    const access = accessControl.getAccessForUser(profile);
    ctx.state.userProfile = profile;
    ctx.state.access = access;

    await repository.upsertUser(profile, access).catch((error: unknown) => {
      logger.warn({ error, telegramUserId: profile.telegramId }, "Unable to upsert Telegram user");
    });

    return next();
  };
}
