import type { ConversionRepository } from "../database/repositories.js";
import type { ConversionService } from "./conversionService.js";

export interface LinkGenerationHealth {
  mode: string;
  affiliateIdConfigured: boolean;
  shortLinkExpansion?: boolean;
}

export interface HealthReport {
  ok: boolean;
  ready: boolean;
  uptimeSeconds: number;
  database: {
    ok: boolean;
    error?: string;
  };
  linkGeneration: LinkGenerationHealth;
  queue: {
    size: number;
    pending: number;
    isPaused: boolean;
  };
}

export interface LinkGenerationHealthProvider {
  getHealth(): Promise<LinkGenerationHealth>;
}

export class HealthService {
  public constructor(
    private readonly repository: ConversionRepository,
    private readonly linkGenerationProvider: LinkGenerationHealthProvider,
    private readonly conversionService: ConversionService
  ) {}

  public async getHealth(): Promise<HealthReport> {
    let databaseOk = false;
    let databaseError: string | undefined;

    try {
      databaseOk = await this.repository.checkConnection();
    } catch (error) {
      databaseError = error instanceof Error ? error.message : String(error);
    }

    const linkGeneration = await this.linkGenerationProvider.getHealth();
    const queue = this.conversionService.getQueueStatus();
    const ready = databaseOk && linkGeneration.affiliateIdConfigured && !queue.isPaused;

    const database = databaseError
      ? {
          ok: databaseOk,
          error: databaseError
        }
      : {
          ok: databaseOk
        };

    return {
      ok: databaseOk,
      ready,
      uptimeSeconds: Math.round(process.uptime()),
      database,
      linkGeneration,
      queue
    };
  }
}
