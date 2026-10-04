import { describe, expect, it } from "vitest";
import { buildResult, keepsBrowserOpen, resultSchema } from "./result";

const LIVE = "https://live.example/browser/abc";

describe("keepsBrowserOpen", () => {
  it("keeps the browser only while the owner still has something to do", () => {
    expect(keepsBrowserOpen("needs_owner")).toBe(true);
    expect(keepsBrowserOpen("needs_approval")).toBe(true);
    expect(keepsBrowserOpen("done")).toBe(false);
    expect(keepsBrowserOpen("failed")).toBe(false);
  });
});

describe("buildResult", () => {
  it("returns a bare result for done and drops the soon-dead live view link", () => {
    expect(buildResult({ status: "done", summary: "Booked.", pendingAction: "ignored" }, LIVE)).toEqual({
      status: "done",
      summary: "Booked.",
    });
  });

  it("attaches the live view link to needs_owner", () => {
    expect(buildResult({ status: "needs_owner", summary: "OpenTable wants a login." }, LIVE)).toEqual({
      status: "needs_owner",
      summary: "OpenTable wants a login.",
      liveViewUrl: LIVE,
    });
  });

  it("refuses needs_owner without an open browser, because there is nothing to take over", () => {
    expect(() => buildResult({ status: "needs_owner", summary: "Login needed." }, null)).toThrow(/open browser/);
  });

  it("requires the exact pending action for needs_approval", () => {
    expect(() => buildResult({ status: "needs_approval", summary: "Ready." }, LIVE)).toThrow(/pendingAction/);
    expect(() => buildResult({ status: "needs_approval", summary: "Ready.", pendingAction: "  " }, LIVE)).toThrow(
      /pendingAction/,
    );
  });

  it("carries the pending action and the link for needs_approval", () => {
    const result = buildResult(
      { status: "needs_approval", summary: "Ready to book.", pendingAction: " Click Reserve: Nopa, 7:30 PM, 2 people " },
      LIVE,
    );
    expect(result).toEqual({
      status: "needs_approval",
      summary: "Ready to book.",
      pendingAction: "Click Reserve: Nopa, 7:30 PM, 2 people",
      liveViewUrl: LIVE,
    });
  });

  it("requires a summary", () => {
    expect(() => buildResult({ status: "failed", summary: " " }, null)).toThrow(/summary/);
  });

  it("always produces something the published schema accepts", () => {
    const result = buildResult({ status: "failed", summary: "Site is down." }, null);
    expect(resultSchema.parse(result)).toEqual(result);
  });
});
