const URL_PATTERN =
  /https?:\/\/[^\s<>"'`]+|(?:www\.)?shopee\.sg\/[^\s<>"'`]+|s\.shopee\.sg\/[^\s<>"'`]+|shope\.ee\/[^\s<>"'`]+|(?:sg\.)?shp\.ee\/[^\s<>"'`]+/gi;

const ALLOWED_HOSTS = new Set(["shopee.sg", "www.shopee.sg", "s.shopee.sg", "shope.ee", "shp.ee", "sg.shp.ee"]);

export interface NormalizedShopeeUrl {
  originalUrl: string;
  normalizedUrl: string;
  hostname: string;
}

export interface InvalidShopeeUrl {
  originalUrl: string;
  code: "INVALID_URL" | "UNSUPPORTED_DOMAIN";
  message: string;
}

export type ShopeeUrlValidation = NormalizedShopeeUrl | InvalidShopeeUrl;

function trimUrlPunctuation(value: string): string {
  return value.trim().replace(/[),.;!?]+$/u, "");
}

export function extractUrlsFromText(text: string): string[] {
  const matches = text.match(URL_PATTERN) ?? [];
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const match of matches) {
    const url = trimUrlPunctuation(match);
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls;
}

export function validateShopeeUrl(input: string): ShopeeUrlValidation {
  const originalUrl = trimUrlPunctuation(input);
  const parseableUrl = /^https?:\/\//iu.test(originalUrl) ? originalUrl : `https://${originalUrl}`;

  try {
    const url = new URL(parseableUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      return {
        originalUrl,
        code: "INVALID_URL",
        message: "Only HTTP or HTTPS Shopee links are supported."
      };
    }

    const hostname = url.hostname.toLowerCase();
    if (!ALLOWED_HOSTS.has(hostname)) {
      return {
        originalUrl,
        code: "UNSUPPORTED_DOMAIN",
        message: "Send a Shopee Singapore product link or supported Shopee short link."
      };
    }

    url.protocol = "https:";
    url.hash = "";
    if (hostname === "www.shopee.sg") {
      url.hostname = "shopee.sg";
    }

    return {
      originalUrl,
      normalizedUrl: url.toString(),
      hostname: url.hostname.toLowerCase()
    };
  } catch {
    return {
      originalUrl,
      code: "INVALID_URL",
      message: "That does not look like a valid URL."
    };
  }
}

export function isValidShopeeUrl(value: ShopeeUrlValidation): value is NormalizedShopeeUrl {
  return "normalizedUrl" in value;
}

export function extractFirstShopeeUrl(text: string): ShopeeUrlValidation | undefined {
  const [firstUrl] = extractUrlsFromText(text);
  return firstUrl ? validateShopeeUrl(firstUrl) : undefined;
}

export function isLikelyAffiliateUrl(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    const hostname = url.hostname.toLowerCase();
    const value = candidate.toLowerCase();

    return (
      ["shope.ee", "s.shopee.sg", "shp.ee", "sg.shp.ee"].includes(hostname) ||
      value.includes("utm_medium=affiliate") ||
      value.includes("utm_source=an_") ||
      value.includes("af_siteid=") ||
      value.includes("affiliate")
    );
  } catch {
    return false;
  }
}
