import pino from "pino";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../utils/errors.js";
import { DirectAffiliateLinkService } from "./directAffiliateLinkService.js";

const logger = pino({ level: "silent" });

describe("DirectAffiliateLinkService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("generates an an_redir affiliate link for full product URLs", async () => {
    const service = new DirectAffiliateLinkService(
      {
        affiliateId: "14382300002",
        subId: "shopeebee",
        expandShortLinks: true
      },
      logger
    );

    const result = await service.convertLink("https://shopee.sg/product/1/2?sp_atk=abc#reviews");
    const generated = new URL(result.affiliateLink);

    expect(generated.origin + generated.pathname).toBe("https://s.shopee.sg/an_redir");
    expect(generated.searchParams.get("origin_link")).toBe("https://shopee.sg/product/1/2");
    expect(generated.searchParams.get("affiliate_id")).toBe("14382300002");
    expect(generated.searchParams.get("sub_id")).toBe("shopeebee");
    expect(result.attempts).toBe(1);
  });

  it("expands short links before generating the affiliate URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        url: "https://shopee.sg/product/1/2?utm_source=short"
      }))
    );

    const service = new DirectAffiliateLinkService(
      {
        affiliateId: "14382300002",
        subId: "telegram",
        expandShortLinks: true
      },
      logger
    );

    const result = await service.convertLink("https://s.shopee.sg/abc123");
    const generated = new URL(result.affiliateLink);

    expect(fetch).toHaveBeenCalledWith("https://s.shopee.sg/abc123", {
      method: "HEAD",
      redirect: "follow"
    });
    expect(generated.searchParams.get("origin_link")).toBe("https://shopee.sg/product/1/2");
  });

  it("fails clearly when the affiliate ID is missing", async () => {
    const service = new DirectAffiliateLinkService(
      {
        affiliateId: undefined,
        subId: "shopeebee",
        expandShortLinks: true
      },
      logger
    );

    await expect(service.convertLink("https://shopee.sg/product/1/2")).rejects.toMatchObject<AppError>({
      code: "AFFILIATE_ID_NOT_CONFIGURED"
    });
  });
});
