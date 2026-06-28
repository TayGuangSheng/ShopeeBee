import { describe, expect, it } from "vitest";
import { InMemoryRateLimiter } from "./rateLimiter.js";

describe("InMemoryRateLimiter", () => {
  it("limits requests within the configured window", () => {
    const limiter = new InMemoryRateLimiter(1_000, 2);

    expect(limiter.consume("u1", false, 0).allowed).toBe(true);
    expect(limiter.consume("u1", false, 10).allowed).toBe(true);
    const denied = limiter.consume("u1", false, 20);

    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterMs).toBe(980);
  });

  it("resets after the window and bypasses admins", () => {
    const limiter = new InMemoryRateLimiter(1_000, 1);

    expect(limiter.consume("u1", false, 0).allowed).toBe(true);
    expect(limiter.consume("u1", false, 1_100).allowed).toBe(true);
    expect(limiter.consume("admin", true, 0).allowed).toBe(true);
    expect(limiter.consume("admin", true, 0).allowed).toBe(true);
  });
});
