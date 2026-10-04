import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decide, isGatedElsewhere, POLICY, policyFor } from "./policy";

describe("decide", () => {
  it("always allows observe tools", () => {
    expect(decide("gmail_search", false)).toBe("allow");
    expect(decide("gmail_search", true)).toBe("allow");
  });

  it("allows reversible tools only while the session is untainted", () => {
    expect(decide("write_file", false)).toBe("allow");
    expect(decide("write_file", true)).toBe("ask");
  });

  it("always asks for consequential tools", () => {
    expect(decide("gmail_send", false)).toBe("ask");
    expect(decide("gmail_send", true)).toBe("ask");
  });

  it("treats a tool that is not in the table as consequential and untrusted", () => {
    expect(policyFor("launch_rocket")).toEqual({ class: "consequential", untrusted: true });
    expect(decide("launch_rocket", false)).toBe("ask");
  });
});

describe("tools that run outside our process", () => {
  it("treats GitHub MCP tools as untrusted reads", () => {
    expect(policyFor("github__search_code")).toEqual({ class: "observe", untrusted: true });
    expect(decide("github__search_code", true)).toBe("allow");
  });

  it("marks web_search and github tools for the receipt hook, and nothing else", () => {
    expect(isGatedElsewhere("web_search")).toBe(true);
    expect(isGatedElsewhere("github__get_issue")).toBe(true);
    expect(isGatedElsewhere("gmail_send")).toBe(false);
  });

  it("does not let a look-alike prefix through", () => {
    expect(decide("github_delete_repo", false)).toBe("ask");
  });
});

describe("policy table", () => {
  const toolsDir = join(import.meta.dirname, "..", "tools");
  const toolFiles = readdirSync(toolsDir).filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));

  it("lists every tool file under agent/tools", () => {
    const missing = toolFiles.map((file) => file.replace(/\.ts$/, "")).filter((name) => !(name in POLICY));
    expect(missing).toEqual([]);
  });
});
