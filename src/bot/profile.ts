import type { BotContext } from "./types.js";
import type { TelegramUserProfile } from "../database/repositories.js";

export function profileFromContext(ctx: BotContext): TelegramUserProfile | undefined {
  const from = ctx.from;
  if (!from) {
    return undefined;
  }

  const profile: TelegramUserProfile = {
    telegramId: String(from.id)
  };

  if (from.username) {
    profile.username = from.username;
  }
  if (from.first_name) {
    profile.firstName = from.first_name;
  }
  if (from.last_name) {
    profile.lastName = from.last_name;
  }

  return profile;
}
