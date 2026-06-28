import { PrismaClient } from "@prisma/client";
import type { Logger } from "pino";

export function createPrismaClient(logger: Logger): PrismaClient {
  const prisma = new PrismaClient({
    log: [
      { emit: "event", level: "error" },
      { emit: "event", level: "warn" }
    ]
  });

  prisma.$on("error", (event: { target: string; message: string }) => {
    logger.error({ target: event.target, message: event.message }, "Prisma error");
  });

  prisma.$on("warn", (event: { target: string; message: string }) => {
    logger.warn({ target: event.target, message: event.message }, "Prisma warning");
  });

  return prisma;
}
