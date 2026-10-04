import { describe, expect, it } from "vitest";
import { isOwner, normalizePhone } from "./owner";

describe("normalizePhone", () => {
  it("keeps a clean E.164 number", () => {
    expect(normalizePhone("+14155550123")).toBe("+14155550123");
  });

  it("strips spaces, dashes, dots and parentheses", () => {
    expect(normalizePhone("+1 (415) 555-0123")).toBe("+14155550123");
    expect(normalizePhone("+44 20.7946.0958")).toBe("+442079460958");
  });

  it("rejects numbers without a country code", () => {
    expect(normalizePhone("4155550123")).toBeNull();
  });

  it("rejects text, email handles and empty values", () => {
    expect(normalizePhone("peter@example.com")).toBeNull();
    expect(normalizePhone("+1415555CALL")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });
});

describe("isOwner", () => {
  it("matches the owner's number in any formatting", () => {
    expect(isOwner("+1 415-555-0123", "+14155550123")).toBe(true);
  });

  it("rejects a different number", () => {
    expect(isOwner("+14155550199", "+14155550123")).toBe(false);
  });

  it("rejects everyone when the owner number is unset or invalid", () => {
    expect(isOwner("+14155550123", undefined)).toBe(false);
    expect(isOwner("+14155550123", "")).toBe(false);
    expect(isOwner("+14155550123", "not-a-number")).toBe(false);
  });

  it("rejects a sender with no usable number", () => {
    expect(isOwner(undefined, "+14155550123")).toBe(false);
    expect(isOwner("peter@example.com", "+14155550123")).toBe(false);
  });
});
