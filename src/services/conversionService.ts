import { ConversionStatus } from "@prisma/client";
import PQueue from "p-queue";
import type { Logger } from "pino";
import type {
  ConversionRepository,
  TelegramUserProfile,
  UserAccessFlags
} from "../database/repositories.js";
import { AppError, asAppError } from "../utils/errors.js";
import { elapsedMs, withTimeout } from "../utils/time.js";
import { isValidShopeeUrl, validateShopeeUrl } from "../utils/url.js";

export interface AffiliateConversionResult {
  affiliateLink: string;
  attempts: number;
}

export interface AffiliateLinkGenerator {
  convertLink(productUrl: string): Promise<AffiliateConversionResult>;
}

export interface ConversionServiceConfig {
  queueConcurrency: number;
  conversionTimeoutMs: number;
}

export interface ConversionSuccess {
  ok: true;
  conversionId: string;
  affiliateLink: string;
  attempts: number;
  durationMs: number;
}

export interface ConversionFailure {
  ok: false;
  conversionId: string;
  code: string;
  message: string;
}

export type ConversionResult = ConversionSuccess | ConversionFailure;

export interface AcceptedConversionSubmission {
  accepted: true;
  conversionId: string;
  result: Promise<ConversionResult>;
}

export interface RejectedConversionSubmission {
  accepted: false;
  conversionId: string;
  code: string;
  message: string;
}

export type ConversionSubmission = AcceptedConversionSubmission | RejectedConversionSubmission;

export class ConversionService {
  private readonly queue: PQueue;

  public constructor(
    private readonly repository: ConversionRepository,
    private readonly linkGenerator: AffiliateLinkGenerator,
    private readonly config: ConversionServiceConfig,
    private readonly logger: Logger
  ) {
    this.queue = new PQueue({ concurrency: config.queueConcurrency });
  }

  public async submitConversion(
    user: TelegramUserProfile,
    access: UserAccessFlags,
    originalLink: string
  ): Promise<ConversionSubmission> {
    await this.repository.upsertUser(user, access);

    const validation = validateShopeeUrl(originalLink);
    if (!isValidShopeeUrl(validation)) {
      const record = await this.repository.createConversion({
        telegramUserId: user.telegramId,
        originalLink: validation.originalUrl,
        normalizedLink: validation.originalUrl,
        status: ConversionStatus.FAILED,
        errorCode: validation.code,
        errorMessage: validation.message
      });

      return {
        accepted: false,
        conversionId: record.id,
        code: validation.code,
        message: validation.message
      };
    }

    const record = await this.repository.createConversion({
      telegramUserId: user.telegramId,
      originalLink: validation.originalUrl,
      normalizedLink: validation.normalizedUrl,
      status: ConversionStatus.QUEUED
    });

    const result = this.queue.add(() => this.processConversion(record.id, validation.normalizedUrl)).then((value) => {
      if (!value) {
        throw new AppError({
          code: "QUEUE_ABORTED",
          message: "Conversion queue returned without a result.",
          publicMessage: "The queued conversion was interrupted."
        });
      }

      return value;
    });

    return {
      accepted: true,
      conversionId: record.id,
      result
    };
  }

  public getQueueStatus(): { size: number; pending: number; isPaused: boolean } {
    return {
      size: this.queue.size,
      pending: this.queue.pending,
      isPaused: this.queue.isPaused
    };
  }

  public async drain(timeoutMs = 15_000): Promise<void> {
    this.queue.pause();
    await withTimeout(this.queue.onIdle(), timeoutMs, "QUEUE_DRAIN_TIMEOUT").catch((error: unknown) => {
      this.logger.warn({ error }, "Timed out while waiting for conversion queue to drain");
    });
  }

  private async processConversion(conversionId: string, normalizedUrl: string): Promise<ConversionResult> {
    const startedAt = Date.now();
    await this.repository.markProcessing(conversionId);

    try {
      const conversion = await withTimeout(
        this.linkGenerator.convertLink(normalizedUrl),
        this.config.conversionTimeoutMs,
        "SHOPEE_CONVERSION_TIMEOUT"
      );
      const durationMs = elapsedMs(startedAt);

      await this.repository.markSuccess({
        id: conversionId,
        generatedAffiliateLink: conversion.affiliateLink,
        durationMs,
        attempts: conversion.attempts
      });

      return {
        ok: true,
        conversionId,
        affiliateLink: conversion.affiliateLink,
        attempts: conversion.attempts,
        durationMs
      };
    } catch (error) {
      const appError = asAppError(error, "CONVERSION_FAILED");
      const durationMs = elapsedMs(startedAt);

      const failureInput = {
        id: conversionId,
        errorCode: appError.code,
        errorMessage: appError.message,
        durationMs
      };

      await this.repository.markFailure(
        appError.attempts === undefined
          ? failureInput
          : {
              ...failureInput,
              attempts: appError.attempts
            }
      );

      this.logger.warn(
        {
          conversionId,
          code: appError.code,
          retryable: appError.retryable,
          error: appError.message
        },
        "Conversion failed"
      );

      return {
        ok: false,
        conversionId,
        code: appError.code,
        message: appError.publicMessage
      };
    }
  }
}
