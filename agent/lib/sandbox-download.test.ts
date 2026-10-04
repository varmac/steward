import { describe, expect, it } from "vitest";
import { assertPublicHost, isPublicAddress, parseDownloadUrl } from "./sandbox-download";

describe("parseDownloadUrl", () => {
  it("accepts a plain https URL", () => {
    expect(parseDownloadUrl("https://example.com/data.csv").hostname).toBe("example.com");
  });

  it("rejects other schemes, embedded credentials and odd ports", () => {
    expect(() => parseDownloadUrl("http://example.com/data.csv")).toThrow(/https/);
    expect(() => parseDownloadUrl("file:///etc/passwd")).toThrow(/https/);
    expect(() => parseDownloadUrl("https://user:pw@example.com/")).toThrow(/credentials/);
    expect(() => parseDownloadUrl("https://example.com:8443/")).toThrow(/port/);
    expect(() => parseDownloadUrl("not a url")).toThrow(/https/);
  });
});

describe("isPublicAddress", () => {
  it("accepts ordinary public addresses", () => {
    expect(isPublicAddress("93.184.216.34")).toBe(true);
    expect(isPublicAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(true);
  });

  it("rejects loopback, private, link-local and metadata ranges", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.9", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0"]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
    for (const ip of ["::1", "::", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });

  it("rejects anything that is not an IP literal", () => {
    expect(isPublicAddress("example.com")).toBe(false);
  });
});

describe("assertPublicHost", () => {
  const resolvesTo = (...addresses: string[]) => async () => addresses.map((address) => ({ address }));

  it("passes when every resolved address is public", async () => {
    await expect(assertPublicHost("example.com", resolvesTo("93.184.216.34"))).resolves.toBeUndefined();
  });

  it("fails when any resolved address is private", async () => {
    await expect(assertPublicHost("rebind.test", resolvesTo("93.184.216.34", "10.0.0.5"))).rejects.toThrow(/public/);
  });

  it("checks IP literals without a lookup", async () => {
    const neverCalled = async () => {
      throw new Error("lookup should not run for IP literals");
    };
    await expect(assertPublicHost("169.254.169.254", neverCalled)).rejects.toThrow(/public/);
    await expect(assertPublicHost("[::1]", neverCalled)).rejects.toThrow(/public/);
  });
});
