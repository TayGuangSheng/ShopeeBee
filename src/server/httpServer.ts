import Fastify, { type FastifyInstance } from "fastify";
import type { Telegraf } from "telegraf";
import type { Logger } from "pino";
import type { Update } from "telegraf/types";
import type { BotContext } from "../bot/types.js";
import type { HealthService } from "../services/healthService.js";

export interface HttpServerDependencies {
  logger: Logger;
  healthService: HealthService;
  bot: Telegraf<BotContext>;
}

export function createHttpServer(dependencies: HttpServerDependencies): FastifyInstance {
  const server = Fastify({ logger: false });

  server.setErrorHandler((error, request, reply) => {
    dependencies.logger.error(
      {
        error,
        method: request.method,
        url: request.url
      },
      "HTTP request failed"
    );

    void reply.status(500).send({
      ok: false,
      error: "internal_server_error"
    });
  });

  server.get("/health", async (_request, reply) => {
    const report = await dependencies.healthService.getHealth();
    return reply.status(report.ok ? 200 : 503).send(report);
  });

  server.get("/ready", async (_request, reply) => {
    const report = await dependencies.healthService.getHealth();
    return reply.status(report.ready ? 200 : 503).send(report);
  });

  server.post("/telegram/webhook", async (request, reply) => {
    await dependencies.bot.handleUpdate(request.body as Update);
    return reply.send({ ok: true });
  });

  return server;
}
