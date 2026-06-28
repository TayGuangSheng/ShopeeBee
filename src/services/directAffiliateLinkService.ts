import type { Logger } from "pino";
import { AppError } from "../utils/errors.js";

export interface DirectAffiliateLinkConfig {
  affiliateId: string | undefined;
  subId: string;
  expandShortLinks: boolean;
}

export interface DirectAffiliateLinkResult {
  affiliateLink: string;
  attempts: number;
}

export interface DirectAffiliateHealth {
  mode: "direct";
  affiliateIdConfigured: boolean;
  shortLinkExpansion: boolean;
}

const SHORT_LINK_HOSTS = new Set(["s.shopee.sg", "shope.ee", "shp.ee"]);

export class DirectAffiliateLinkService {
  public constructor(
    private readonly config: DirectAffiliateLinkConfig,
    private readonly logger: Logger
  ) {}

  public async convertLink(productUrl: string): Promise<DirectAffiliateLinkResult> {
    if (!this.config.affiliateId) {
      throw new AppError({
        code: "AFFILIATE_ID_NOT_CONFIGURED",
        message: "SHOPEE_AFFILIATE_ID is not configured.",
        publicMessage: "Affiliate link generation is not configured yet."
      });
    }

    const destinationUrl = await this.resolveDestinationUrl(productUrl);
    const affiliateLink = new URL("https://s.shopee.sg/an_redir");
    affiliateLink.searchParams.set("origin_link", destinationUrl);
    affiliateLink.searchParams.set("affiliate_id", this.config.affiliateId);
    affiliateLink.searchParams.set("sub_id", this.config.subId);

    return {
      affiliateLink: affiliateLink.toString(),
      attempts: 1
    };
  }

  public async getHealth(): Promise<DirectAffiliateHealth> {
    return {
      mode: "direct",
      affiliateIdConfigured: Boolean(this.config.affiliateId),
      shortLinkExpansion: this.config.expandShortLinks
    };
  }

  public async close(): Promise<void> {
    return undefined;
  }

  private async resolveDestinationUrl(productUrl: string): Promise<string> {
    const inputUrl = new URL(productUrl);
    const shouldExpand = this.config.expandShortLinks && SHORT_LINK_HOSTS.has(inputUrl.hostname.toLowerCase());
    const resolvedUrl = shouldExpand ? await this.expandShortLink(inputUrl.toString()) : inputUrl.toString();

    return this.cleanProductUrl(resolvedUrl);
  }

  private async expandShortLink(shortUrl: string): Promise<string> {
    try {
      const response = await fetch(shortUrl, {
        method: "HEAD",
        redirect: "follow"
      });

      return response.url;
    } catch (headError) {
      this.logger.debug({ error: headError, shortUrl }, "Shopee short link HEAD expansion failed; trying GET");
    }

    try {
      const response = await fetch(shortUrl, {
        method: "GET",
        redirect: "follow",
        headers: {
          range: "bytes=0-0"
        }
      });

      return response.url;
    } catch (error) {
      throw new AppError({
        code: "SHORT_LINK_EXPANSION_FAILED",
        message: error instanceof Error ? error.message : String(error),
        publicMessage: "Could not expand the Shopee short link. Try sending the full Shopee product link.",
        cause: error
      });
    }
  }

  private cleanProductUrl(productUrl: string): string {
    const url = new URL(productUrl);
    url.search = "";
    url.hash = "";
    return url.toString();
  }
}
