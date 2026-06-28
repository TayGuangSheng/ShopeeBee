import { describe, expect, it } from "vitest";
import { AccessControlService } from "./accessControlService.js";

describe("AccessControlService", () => {
  it("allows admins by Telegram username", () => {
    const service = new AccessControlService(new Set(["owner"]));

    expect(service.getAccessForUser({ telegramId: "2", username: "Owner" })).toEqual({
      isAllowed: true,
      isAdmin: true
    });
  });

  it("accepts legacy admin IDs as a fallback", () => {
    const service = new AccessControlService(new Set(), new Set(["2"]));

    expect(service.getAccessForUser({ telegramId: "2" })).toEqual({
      isAllowed: true,
      isAdmin: true
    });
  });

  it("allows normal users without any configured user list", () => {
    const service = new AccessControlService(new Set(["owner"]));

    expect(service.getAccessForUser({ telegramId: "3" })).toEqual({
      isAllowed: true,
      isAdmin: false
    });
  });

  it("allows direct access checks for normal users", () => {
    const restricted = new AccessControlService(new Set(["owner"]));

    expect(restricted.isAllowed("3")).toBe(true);
  });
});
