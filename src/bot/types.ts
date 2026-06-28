import type { Context } from "telegraf";
import type { TelegramUserProfile, UserAccessFlags } from "../database/repositories.js";

export interface BotState {
  userProfile?: TelegramUserProfile;
  access?: UserAccessFlags;
}

export type BotContext = Context & {
  state: BotState;
};
