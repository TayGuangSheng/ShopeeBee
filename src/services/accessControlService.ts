import type { AppConfig } from "../config/env.js";
import { normalizeTelegramUsername } from "../config/env.js";
import type { TelegramUserProfile, UserAccessFlags } from "../database/repositories.js";

export class AccessControlService {
  public constructor(
    private readonly adminUsernames: Set<string>,
    private readonly adminUserIds: Set<string> = new Set()
  ) {}

  public static fromConfig(config: Pick<AppConfig, "adminUsernames" | "adminUserIds">): AccessControlService {
    return new AccessControlService(config.adminUsernames, config.adminUserIds);
  }

  public getAccessForUser(profile: TelegramUserProfile): UserAccessFlags {
    const isAdmin = this.isAdmin(profile.telegramId, profile.username);

    return {
      isAdmin,
      isAllowed: true
    };
  }

  public isAdmin(telegramUserId: string, username?: string): boolean {
    if (username && this.adminUsernames.has(normalizeTelegramUsername(username))) {
      return true;
    }

    return this.adminUserIds.has(telegramUserId);
  }

  public isAllowed(telegramUserId: string): boolean {
    return Boolean(telegramUserId);
  }
}
