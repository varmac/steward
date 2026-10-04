import { describe, expect, it } from "vitest";
import { rejectUnverified } from "./linq-webhook";

const request = new Request("https://example.com/eve/v1/linq", { method: "POST" });
const body = new Uint8Array();

describe("rejectUnverified", () => {
  it("returns false when the underlying verifier reports failure as null", async () => {
    expect(await rejectUnverified(async () => null)(request, body)).toBe(false);
  });

  it("returns false when the underlying verifier reports undefined or false", async () => {
    expect(await rejectUnverified(async () => undefined)(request, body)).toBe(false);
    expect(await rejectUnverified(async () => false)(request, body)).toBe(false);
  });

  it("returns false when the underlying verifier throws", async () => {
    expect(
      await rejectUnverified(async () => {
        throw new Error("jwks unreachable");
      })(request, body),
    ).toBe(false);
  });

  it("returns false for truthy values that are not an identity", async () => {
    for (const value of [true, 1, "ok", {}, { principalId: 42 }, new Response("challenge", { status: 401 })]) {
      expect(await rejectUnverified(async () => value)(request, body)).toBe(false);
    }
  });

  it("returns true only for a verified identity", async () => {
    expect(await rejectUnverified(async () => ({ principalId: "vercel:project" }))(request, body)).toBe(true);
  });
});
