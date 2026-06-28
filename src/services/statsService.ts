import type { ConversionRepository, GlobalStats, UserStats } from "../database/repositories.js";

export class StatsService {
  public constructor(private readonly repository: ConversionRepository) {}

  public getUserStats(telegramUserId: string): Promise<UserStats> {
    return this.repository.getUserStats(telegramUserId);
  }

  public getGlobalStats(): Promise<GlobalStats> {
    return this.repository.getGlobalStats();
  }
}
