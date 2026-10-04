import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE, readConfig } from "./config";

describe("readConfig", () => {
  it("fails with a clear error when KERNEL_API_KEY is missing", () => {
    expect(() => readConfig({})).toThrow(/KERNEL_API_KEY is not set/);
  });

  it("treats a blank KERNEL_API_KEY as missing", () => {
    expect(() => readConfig({ KERNEL_API_KEY: "   " })).toThrow(/KERNEL_API_KEY is not set/);
  });

  it("never echoes the key in an error", () => {
    const attempt = () => readConfig({ KERNEL_API_KEY: "sk-secret", KERNEL_PROFILE: "bad name!" });
    expect(attempt).toThrow(/KERNEL_PROFILE/);
    expect(attempt).not.toThrow(/sk-secret/);
  });

  it("defaults the profile and keeps stealth off", () => {
    expect(readConfig({ KERNEL_API_KEY: "k" })).toEqual({
      apiKey: "k",
      profileName: DEFAULT_PROFILE,
      stealth: false,
    });
    expect(DEFAULT_PROFILE).toBe("steward-owner");
  });

  it("reads the profile name and the stealth opt-in", () => {
    const config = readConfig({ KERNEL_API_KEY: "k", KERNEL_PROFILE: "owner.main_1", KERNEL_STEALTH: "true" });
    expect(config.profileName).toBe("owner.main_1");
    expect(config.stealth).toBe(true);
  });

  it("rejects profile names Kernel would refuse", () => {
    expect(() => readConfig({ KERNEL_API_KEY: "k", KERNEL_PROFILE: "has space" })).toThrow(/KERNEL_PROFILE/);
    expect(() => readConfig({ KERNEL_API_KEY: "k", KERNEL_PROFILE: "a".repeat(256) })).toThrow(/KERNEL_PROFILE/);
  });
});
