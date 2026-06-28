import { ConversionStatus, type LinkConversion, type User } from "@prisma/client";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import type {
  CompleteConversionInput,
  ConversionRepository,
  CreateConversionInput,
  FailConversionInput,
  GlobalStats,
  TelegramUserProfile,
  UserAccessFlags,
  UserStats
} from "../database/repositories.js";
import { AppError } from "../utils/errors.js";
import { ConversionService } from "./conversionService.js";

class FakeRepository implements ConversionRepository {
  public readonly records = new Map<string, LinkConversion>();
  private nextId = 1;

  public async upsertUser(profile: TelegramUserProfile, access: UserAccessFlags): Promise<User> {
    return {
      id: `user-${profile.telegramId}`,
      telegramId: profile.telegramId,
      username: profile.username ?? null,
      firstName: profile.firstName ?? null,
      lastName: profile.lastName ?? null,
      isAllowed: access.isAllowed,
      isAdmin: access.isAdmin,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  public async createConversion(input: CreateConversionInput): Promise<LinkConversion> {
    const record: LinkConversion = {
      id: `c${this.nextId}`,
      userId: `user-${input.telegramUserId}`,
      telegramUserId: input.telegramUserId,
      originalLink: input.originalLink,
      normalizedLink: input.normalizedLink,
      generatedAffiliateLink: null,
      status: input.status ?? ConversionStatus.QUEUED,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      attempts: 0,
      durationMs: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: input.status === ConversionStatus.FAILED ? new Date() : null
    };
    this.nextId += 1;
    this.records.set(record.id, record);
    return record;
  }

  public async markProcessing(id: string): Promise<LinkConversion> {
    return this.patch(id, { status: ConversionStatus.PROCESSING });
  }

  public async markSuccess(input: CompleteConversionInput): Promise<LinkConversion> {
    return this.patch(input.id, {
      status: ConversionStatus.SUCCESS,
      generatedAffiliateLink: input.generatedAffiliateLink,
      durationMs: input.durationMs,
      attempts: input.attempts,
      completedAt: new Date()
    });
  }

  public async markFailure(input: FailConversionInput): Promise<LinkConversion> {
    return this.patch(input.id, {
      status: ConversionStatus.FAILED,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      durationMs: input.durationMs ?? null,
      attempts: input.attempts ?? 0,
      completedAt: new Date()
    });
  }

  public async getUserStats(): Promise<UserStats> {
    return { total: 0, success: 0, failed: 0, queued: 0, processing: 0 };
  }

  public async getGlobalStats(): Promise<GlobalStats> {
    return {
      users: 0,
      allowedUsers: 0,
      adminUsers: 0,
      total: 0,
      success: 0,
      failed: 0,
      queued: 0,
      processing: 0
    };
  }

  public async checkConnection(): Promise<boolean> {
    return true;
  }

  private patch(id: string, data: Partial<LinkConversion>): LinkConversion {
    const current = this.records.get(id);
    if (!current) {
      throw new Error(`Missing conversion ${id}`);
    }

    const updated = { ...current, ...data, updatedAt: new Date() };
    this.records.set(id, updated);
    return updated;
  }
}

const logger = pino({ level: "silent" });
const user: TelegramUserProfile = { telegramId: "123" };
const access: UserAccessFlags = { isAllowed: true, isAdmin: false };

describe("ConversionService", () => {
  it("queues and completes a valid Shopee conversion", async () => {
    const repository = new FakeRepository();
    const linkGenerator = {
      convertLink: vi.fn(async () => ({ affiliateLink: "https://shope.ee/generated", attempts: 1 }))
    };
    const service = new ConversionService(
      repository,
      linkGenerator,
      { queueConcurrency: 1, conversionTimeoutMs: 5_000 },
      logger
    );

    const submission = await service.submitConversion(user, access, "https://shopee.sg/product/1/2");

    expect(submission.accepted).toBe(true);
    if (submission.accepted) {
      const result = await submission.result;
      expect(result.ok).toBe(true);
      expect(linkGenerator.convertLink).toHaveBeenCalledWith("https://shopee.sg/product/1/2");
      expect(repository.records.get(submission.conversionId)?.status).toBe(ConversionStatus.SUCCESS);
    }
  });

  it("records invalid links as failed conversions", async () => {
    const repository = new FakeRepository();
    const service = new ConversionService(
      repository,
      { convertLink: vi.fn() },
      { queueConcurrency: 1, conversionTimeoutMs: 5_000 },
      logger
    );

    const submission = await service.submitConversion(user, access, "https://example.com/item");

    expect(submission.accepted).toBe(false);
    expect(repository.records.get(submission.conversionId)?.status).toBe(ConversionStatus.FAILED);
    expect(repository.records.get(submission.conversionId)?.errorCode).toBe("UNSUPPORTED_DOMAIN");
  });

  it("records link generation failures and returns public error text", async () => {
    const repository = new FakeRepository();
    const service = new ConversionService(
      repository,
      {
        convertLink: vi.fn(async () => {
          throw new AppError({
            code: "AFFILIATE_ID_NOT_CONFIGURED",
            message: "missing affiliate ID",
            publicMessage: "Affiliate link generation is not configured yet.",
            attempts: 1
          });
        })
      },
      { queueConcurrency: 1, conversionTimeoutMs: 5_000 },
      logger
    );

    const submission = await service.submitConversion(user, access, "https://shopee.sg/product/1/2");

    expect(submission.accepted).toBe(true);
    if (submission.accepted) {
      const result = await submission.result;
      expect(result.ok).toBe(false);
      expect(repository.records.get(submission.conversionId)?.status).toBe(ConversionStatus.FAILED);
      expect(repository.records.get(submission.conversionId)?.attempts).toBe(1);
      if (!result.ok) {
        expect(result.message).toBe("Affiliate link generation is not configured yet.");
      }
    }
  });
});
