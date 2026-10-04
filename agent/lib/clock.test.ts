import { describe, expect, it } from "vitest";
import { clockLine, ownerTimeZone } from "./clock";

describe("clockLine", () => {
  it("states the owner's local weekday, date, time and zone", () => {
    // 00:30 UTC on Sunday is still Saturday evening in Los Angeles.
    const line = clockLine(new Date("2026-09-20T00:30:00Z"), "America/Los_Angeles");
    expect(line).toContain("Saturday, 19 September 2026");
    expect(line).toContain("5:30 PM");
    expect(line).toContain("America/Los_Angeles");
    expect(line).toContain("UTC-07:00");
  });

  it("spells out tomorrow so the model does not have to do date arithmetic", () => {
    const line = clockLine(new Date("2026-09-20T00:30:00Z"), "America/Los_Angeles");
    expect(line).toContain("Tomorrow is Sunday, 20 September 2026");
  });

  it("handles a zone east of UTC across the date line", () => {
    const line = clockLine(new Date("2026-12-31T20:00:00Z"), "Asia/Kolkata");
    expect(line).toContain("Friday, 1 January 2027");
    expect(line).toContain("UTC+05:30");
  });
});

describe("ownerTimeZone", () => {
  it("uses OWNER_TIMEZONE when it is a real IANA zone", () => {
    expect(ownerTimeZone({ OWNER_TIMEZONE: "Europe/London" })).toBe("Europe/London");
  });

  it("falls back to Pacific time when unset or invalid", () => {
    expect(ownerTimeZone({})).toBe("America/Los_Angeles");
    expect(ownerTimeZone({ OWNER_TIMEZONE: "Mars/Olympus" })).toBe("America/Los_Angeles");
  });
});
