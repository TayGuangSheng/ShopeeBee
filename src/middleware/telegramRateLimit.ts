import type { MiddlewareFn } from "telegraf";
import type { BotContext } from "../bot/types.js";
import type { InMemoryRateLimiter } from "../services/rateLimiter.js";

export function createTelegramRateLimitMiddleware(
  rateLimiter: InMemoryRateLimiter
): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    const profile = ctx.state.userProfile;
    const access = ctx.state.access;

    if (!profile) {
      return next();
    }

    const decision = rateLimiter.consume(profile.telegramId, access?.isAdmin === true);
    if (!decision.allowed) {
      const retryAfterSeconds = Math.ceil(decision.retryAfterMs / 1_000);
      await ctx.reply(`Rate limit reached. Try again in ${retryAfterSeconds}s.`);
      return undefined;
    }

    return next();
  };
}
