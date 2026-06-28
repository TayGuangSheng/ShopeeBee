import { describe, expect, it } from "vitest";
import { normalizeTelegramUsername, parseAppConfig, parseIdSet, parseUsernameSet } from "./env.js";

describe("env config", () => {
  it("parses ids from comma separated env values", () => {
    expect([...parseIdSet("123, 456,,789")]).toEqual(["123", "456", "789"]);
  });

  it("normalizes Telegram usernames from comma separated env values", () => {
    expect(normalizeTelegramUsername("@OwnerName")).toBe("ownername");
    expect([...parseUsernameSet("@OwnerName, second_admin")]).toEqual(["ownername", "second_admin"]);
  });

  it("parses a valid polling config", () => {
    const config = parseAppConfig({
      TELEGRAM_BOT_TOKEN: "token",
      ADMIN_USERNAMES: "@owner",
      SHOPEE_AFFILIATE_ID: "14382300002",
      SHOPEE_AFFILIATE_SUB_ID: "telegram",
      SHOPEE_EXPAND_SHORT_LINKS: "false"
    });

    expect(config.botMode).toBe("polling");
    expect(config.adminUsernames.has("owner")).toBe(true);
    expect(config.shopeeAffiliateId).toBe("14382300002");
    expect(config.shopeeAffiliateSubId).toBe("telegram");
    expect(config.shopeeExpandShortLinks).toBe(false);
  });

  it("allows webhook mode before the public URL is configured", () => {
    const config = parseAppConfig({
      TELEGRAM_BOT_TOKEN: "token",
      BOT_MODE: "webhook"
    });

    expect(config.botMode).toBe("webhook");
    expect(config.publicWebhookUrl).toBeUndefined();
  });

  it("uses Render's external URL for webhook mode", () => {
    const config = parseAppConfig({
      TELEGRAM_BOT_TOKEN: "token",
      BOT_MODE: "webhook",
      RENDER_EXTERNAL_URL: "https://shopeebee.onrender.com"
    });

    expect(config.publicWebhookUrl).toBe("https://shopeebee.onrender.com");
  });
});
