import { describe, expect, it } from "vitest";
import {
  extractUrlsFromText,
  isLikelyAffiliateUrl,
  isValidShopeeUrl,
  validateShopeeUrl
} from "./url.js";

describe("Shopee URL utilities", () => {
  it("extracts and trims URLs from a Telegram message", () => {
    expect(extractUrlsFromText("buy https://shopee.sg/item?x=1, then https://example.com/a.")).toEqual([
      "https://shopee.sg/item?x=1",
      "https://example.com/a"
    ]);
  });

  it("extracts and normalizes bare Shopee links without a scheme", () => {
    expect(extractUrlsFromText("convert s.shopee.sg/abc123 and sg.shp.ee/JpFzUVUM, thanks")).toEqual([
      "s.shopee.sg/abc123",
      "sg.shp.ee/JpFzUVUM"
    ]);

    const result = validateShopeeUrl("s.shopee.sg/abc123");
    expect(isValidShopeeUrl(result)).toBe(true);
    if (isValidShopeeUrl(result)) {
      expect(result.normalizedUrl).toBe("https://s.shopee.sg/abc123");
    }
  });

  it("accepts Shopee Singapore and supported short domains", () => {
    const product = validateShopeeUrl("http://www.shopee.sg/product/1/2#reviews");
    const short = validateShopeeUrl("https://shope.ee/abc123");
    const regionalShort = validateShopeeUrl("https://sg.shp.ee/JpFzUVUM");

    expect(isValidShopeeUrl(product)).toBe(true);
    expect(isValidShopeeUrl(short)).toBe(true);
    expect(isValidShopeeUrl(regionalShort)).toBe(true);
    if (isValidShopeeUrl(product)) {
      expect(product.normalizedUrl).toBe("https://shopee.sg/product/1/2");
    }
  });

  it("rejects unsupported domains", () => {
    const result = validateShopeeUrl("https://shopee.com.my/product/1/2");
    expect(isValidShopeeUrl(result)).toBe(false);
    if (!isValidShopeeUrl(result)) {
      expect(result.code).toBe("UNSUPPORTED_DOMAIN");
    }
  });

  it("identifies likely affiliate links", () => {
    expect(isLikelyAffiliateUrl("https://shope.ee/abc")).toBe(true);
    expect(isLikelyAffiliateUrl("https://sg.shp.ee/JpFzUVUM")).toBe(true);
    expect(isLikelyAffiliateUrl("https://shopee.sg/product/1/2?utm_medium=affiliate")).toBe(true);
    expect(isLikelyAffiliateUrl("https://shopee.sg/product/1/2")).toBe(false);
  });
});
