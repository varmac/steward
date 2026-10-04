import { describe, expect, it } from "vitest";
import { buildReceipt, canonicalJson, hashPayload } from "./receipts";

describe("hashPayload", () => {
  it("is the same for the same payload regardless of key order", () => {
    expect(hashPayload({ to: "a@example.com", body: "hi" })).toBe(hashPayload({ body: "hi", to: "a@example.com" }));
  });

  it("changes when any field changes", () => {
    expect(hashPayload({ to: "a@example.com", body: "hi" })).not.toBe(hashPayload({ to: "a@example.com", body: "hi!" }));
  });

  it("handles nesting, arrays and undefined fields", () => {
    expect(canonicalJson({ b: [2, { d: 1, c: undefined }], a: null })).toBe('{"a":null,"b":[2,{"d":1}]}');
  });
});

describe("buildReceipt", () => {
  it("keeps only the hash for reads", () => {
    const receipt = buildReceipt("s1", "gmail_search", { query: "from:bank" }, "ok");
    expect(receipt.actionClass).toBe("observe");
    expect(receipt.payload).toBeNull();
    expect(receipt.payloadHash).toHaveLength(64);
  });

  it("keeps the exact payload for consequential actions", () => {
    const payload = { to: ["peter@example.com"], subject: "Late", body: "15 min" };
    const receipt = buildReceipt("s1", "gmail_send", payload, "started");
    expect(receipt.actionClass).toBe("consequential");
    expect(receipt.payload).toEqual(payload);
  });

  it("classes an unknown tool as consequential and truncates long error detail", () => {
    const receipt = buildReceipt("s1", "mystery_tool", {}, "error", "x".repeat(2_000));
    expect(receipt.actionClass).toBe("consequential");
    expect(receipt.detail).toHaveLength(500);
  });
});
