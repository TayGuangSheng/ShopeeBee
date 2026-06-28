import { ConversionStatus, type LinkConversion, type PrismaClient, type User } from "@prisma/client";

export interface TelegramUserProfile {
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

export interface UserAccessFlags {
  isAllowed: boolean;
  isAdmin: boolean;
}

export interface CreateConversionInput {
  telegramUserId: string;
  originalLink: string;
  normalizedLink: string;
  status?: ConversionStatus;
  errorCode?: string;
  errorMessage?: string;
}

export interface CompleteConversionInput {
  id: string;
  generatedAffiliateLink: string;
  durationMs: number;
  attempts: number;
}

export interface FailConversionInput {
  id: string;
  errorCode: string;
  errorMessage: string;
  durationMs?: number;
  attempts?: number;
}

export interface UserStats {
  total: number;
  success: number;
  failed: number;
  queued: number;
  processing: number;
}

export interface GlobalStats extends UserStats {
  users: number;
  allowedUsers: number;
  adminUsers: number;
}

export interface ConversionRepository {
  upsertUser(profile: TelegramUserProfile, access: UserAccessFlags): Promise<User>;
  createConversion(input: CreateConversionInput): Promise<LinkConversion>;
  markProcessing(id: string): Promise<LinkConversion>;
  markSuccess(input: CompleteConversionInput): Promise<LinkConversion>;
  markFailure(input: FailConversionInput): Promise<LinkConversion>;
  getUserStats(telegramUserId: string): Promise<UserStats>;
  getGlobalStats(): Promise<GlobalStats>;
  checkConnection(): Promise<boolean>;
}

export class PrismaConversionRepository implements ConversionRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async upsertUser(profile: TelegramUserProfile, access: UserAccessFlags): Promise<User> {
    return this.prisma.user.upsert({
      where: { telegramId: profile.telegramId },
      create: {
        telegramId: profile.telegramId,
        username: profile.username ?? null,
        firstName: profile.firstName ?? null,
        lastName: profile.lastName ?? null,
        isAllowed: access.isAllowed,
        isAdmin: access.isAdmin
      },
      update: {
        username: profile.username ?? null,
        firstName: profile.firstName ?? null,
        lastName: profile.lastName ?? null,
        isAllowed: access.isAllowed,
        isAdmin: access.isAdmin
      }
    });
  }

  public async createConversion(input: CreateConversionInput): Promise<LinkConversion> {
    const user = await this.prisma.user.findUnique({
      where: { telegramId: input.telegramUserId },
      select: { id: true }
    });

    const data = user
      ? {
          user: { connect: { id: user.id } },
          telegramUserId: input.telegramUserId,
          originalLink: input.originalLink,
          normalizedLink: input.normalizedLink,
          status: input.status ?? ConversionStatus.QUEUED,
          errorCode: input.errorCode ?? null,
          errorMessage: input.errorMessage ?? null,
          completedAt: input.status === ConversionStatus.FAILED ? new Date() : null
        }
      : {
        telegramUserId: input.telegramUserId,
        originalLink: input.originalLink,
        normalizedLink: input.normalizedLink,
        status: input.status ?? ConversionStatus.QUEUED,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        completedAt: input.status === ConversionStatus.FAILED ? new Date() : null
      };

    return this.prisma.linkConversion.create({ data });
  }

  public async markProcessing(id: string): Promise<LinkConversion> {
    return this.prisma.linkConversion.update({
      where: { id },
      data: { status: ConversionStatus.PROCESSING }
    });
  }

  public async markSuccess(input: CompleteConversionInput): Promise<LinkConversion> {
    return this.prisma.linkConversion.update({
      where: { id: input.id },
      data: {
        status: ConversionStatus.SUCCESS,
        generatedAffiliateLink: input.generatedAffiliateLink,
        durationMs: input.durationMs,
        attempts: input.attempts,
        errorCode: null,
        errorMessage: null,
        completedAt: new Date()
      }
    });
  }

  public async markFailure(input: FailConversionInput): Promise<LinkConversion> {
    return this.prisma.linkConversion.update({
      where: { id: input.id },
      data: {
        status: ConversionStatus.FAILED,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        durationMs: input.durationMs ?? null,
        attempts: input.attempts ?? 0,
        completedAt: new Date()
      }
    });
  }

  public async getUserStats(telegramUserId: string): Promise<UserStats> {
    const [total, success, failed, queued, processing] = await Promise.all([
      this.prisma.linkConversion.count({ where: { telegramUserId } }),
      this.prisma.linkConversion.count({ where: { telegramUserId, status: ConversionStatus.SUCCESS } }),
      this.prisma.linkConversion.count({ where: { telegramUserId, status: ConversionStatus.FAILED } }),
      this.prisma.linkConversion.count({ where: { telegramUserId, status: ConversionStatus.QUEUED } }),
      this.prisma.linkConversion.count({ where: { telegramUserId, status: ConversionStatus.PROCESSING } })
    ]);

    return { total, success, failed, queued, processing };
  }

  public async getGlobalStats(): Promise<GlobalStats> {
    const [users, allowedUsers, adminUsers, total, success, failed, queued, processing] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { isAllowed: true } }),
        this.prisma.user.count({ where: { isAdmin: true } }),
        this.prisma.linkConversion.count(),
        this.prisma.linkConversion.count({ where: { status: ConversionStatus.SUCCESS } }),
        this.prisma.linkConversion.count({ where: { status: ConversionStatus.FAILED } }),
        this.prisma.linkConversion.count({ where: { status: ConversionStatus.QUEUED } }),
        this.prisma.linkConversion.count({ where: { status: ConversionStatus.PROCESSING } })
      ]);

    return { users, allowedUsers, adminUsers, total, success, failed, queued, processing };
  }

  public async checkConnection(): Promise<boolean> {
    await this.prisma.$queryRaw`SELECT 1`;
    return true;
  }
}
