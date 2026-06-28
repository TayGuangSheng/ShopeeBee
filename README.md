# ShopeeBee

Telegram bot that receives Shopee Singapore product links and returns direct Shopee affiliate redirect links.

The bot no longer logs in to Shopee or controls a browser. It generates links with Shopee's `s.shopee.sg/an_redir` redirect format:

```text
https://s.shopee.sg/an_redir?origin_link=<product_url>&affiliate_id=<affiliate_id>&sub_id=<sub_id>
```

## Features

- One Telegram user action: send a Shopee link and receive the generated affiliate link
- Telegram command menu is cleared on startup
- Supports `shopee.sg`, `www.shopee.sg`, `s.shopee.sg`, `shope.ee`, and `shp.ee`
- Expands Shopee short links before generating the affiliate redirect
- Per-user in-memory rate limiting
- SQLite + Prisma persistence for users and conversion history
- Fastify health endpoints for local/VPS/cloud deployment
- Docker and Docker Compose setup with persistent `/data` volume

## Architecture

```text
src/
  bot/          Telegraf message handler
  config/       dotenv + zod environment parsing
  database/     Prisma client and repository implementation
  middleware/   Telegram access and rate-limit middleware
  server/       Fastify health and webhook routes
  services/     direct affiliate generator, conversion queue, stats, health
  utils/        URL parsing, errors, timing, runtime dirs
prisma/         schema and SQLite migration
scripts/        local operational scripts
```

## Local Setup

1. Install Node.js 22.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy and edit environment variables:

   ```bash
   cp .env.example .env
   ```

4. Set your Telegram bot token and Shopee affiliate ID:

   ```env
   TELEGRAM_BOT_TOKEN=
   SHOPEE_AFFILIATE_ID=
   SHOPEE_AFFILIATE_SUB_ID=shopeebee
   ```

5. Generate Prisma client and apply migrations:

   ```bash
   npm run db:generate
   npm run db:deploy
   ```

6. Start in development mode:

   ```bash
   npm run dev
   ```

## Telegram Flow

Users send a Shopee Singapore product link to the bot as a normal message:

```text
https://shopee.sg/product-name-i.123456.789012
```

The bot replies:

```text
Converting link...
```

Then it sends the generated affiliate link.

The bot does not expose Telegram commands. The user flow is only: send link, receive converted link.

## Environment

Required:

```env
TELEGRAM_BOT_TOKEN=
SHOPEE_AFFILIATE_ID=
```

Important defaults:

```env
BOT_MODE=polling
PORT=3000
DATABASE_URL=file:../data/shopeebee.db
SHOPEE_AFFILIATE_SUB_ID=shopeebee
SHOPEE_EXPAND_SHORT_LINKS=true
SHOPEE_CONVERSION_TIMEOUT_MS=90000
QUEUE_CONCURRENCY=1
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=10
MAX_LINKS_PER_MESSAGE=5
```

Validate the effective config:

```bash
npm run config:check
```

## HTTP Endpoints

- `GET /health` returns service, database, queue, and direct-link generation state.
- `GET /ready` returns `200` only when the database is reachable and `SHOPEE_AFFILIATE_ID` is configured.
- `POST /telegram/webhook` receives Telegram updates when `BOT_MODE=webhook`.

For webhook mode:

```env
BOT_MODE=webhook
PUBLIC_WEBHOOK_URL=https://your-domain.example
```

## Docker VPS Deployment

1. Create `.env` from `.env.example`.
2. Build and start:

   ```bash
   docker compose up -d --build
   ```

3. Confirm health:

   ```bash
   curl http://localhost:3000/health
   ```

The Compose file mounts a named volume at `/data`, which preserves SQLite data across restarts.

## Railway and Render Notes

- Use the provided `Dockerfile`.
- Attach a persistent disk mounted at `/data`.
- Set `PORT`, `TELEGRAM_BOT_TOKEN`, and `SHOPEE_AFFILIATE_ID`.
- Prefer `BOT_MODE=webhook` with `PUBLIC_WEBHOOK_URL` set to the platform public URL.

## Scripts

```bash
npm run dev              # local development
npm run build            # TypeScript build
npm start                # run compiled service
npm test                 # unit and service tests
npm run db:generate      # generate Prisma client
npm run db:deploy        # apply migrations
npm run config:check     # validate environment
```
