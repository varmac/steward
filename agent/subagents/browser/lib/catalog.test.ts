// Lives in lib/ because eve treats every module under tools/ as a tool.
import { describe, expect, it } from "vitest";
import catalog from "../tools/catalog";

describe("browser-loop catalog", async () => {
  const resolve = catalog.events["session.started"];
  if (!resolve) throw new Error("catalog must resolve its tools on session.started");
  // The resolver ignores its arguments; eve passes the event and a resolve context.
  const tools = await resolve({}, {} as never);

  it("exposes the element-level browser tools under browser-loop's own names", () => {
    expect(Object.keys(tools)).toEqual(
      expect.arrayContaining(["browser_navigate", "browser_snapshot", "browser_click", "browser_fill", "browser_wait_for"]),
    );
  });

  it("withholds free-form page JavaScript", () => {
    expect(Object.keys(tools)).not.toContain("browser_evaluate");
  });

  it("hands eve plain JSON Schema objects", () => {
    for (const [name, tool] of Object.entries(tools)) {
      const schema = tool.inputSchema as unknown as Record<string, unknown>;
      expect(tool.description, name).toBeTruthy();
      expect(schema.type, name).toBe("object");
      expect(JSON.parse(JSON.stringify(schema)), name).toEqual(schema);
    }
  });
});
