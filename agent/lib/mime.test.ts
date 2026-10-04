import { describe, expect, it } from "vitest";
import { buildRawMessage } from "./mime";

/** Decodes the base64url output back into header lines and the decoded body. */
function parse(raw: string) {
  const text = Buffer.from(raw, "base64url").toString("utf8");
  const [head, body] = text.split("\r\n\r\n");
  const headers = head.replace(/\r\n[ \t]+/g, " ").split("\r\n");
  return { headers, bodyLines: body.split("\r\n"), body: Buffer.from(body, "base64").toString("utf8") };
}

/** Decodes every RFC 2047 base64 encoded-word in a header value. */
function decodeWords(value: string) {
  return [...value.matchAll(/=\?UTF-8\?B\?([^?]+)\?=/g)].map((match) => Buffer.from(match[1], "base64").toString("utf8")).join("");
}

describe("buildRawMessage", () => {
  it("builds a plain-text message with joined recipients", () => {
    const { headers, body } = parse(
      buildRawMessage({ to: ["a@example.com", "b@example.com"], cc: ["c@example.com"], subject: "Hello", body: "Hi there\nSecond line" }),
    );
    expect(headers).toContain("To: a@example.com, b@example.com");
    expect(headers).toContain("Cc: c@example.com");
    expect(headers).toContain("Subject: Hello");
    expect(headers).toContain("MIME-Version: 1.0");
    expect(headers).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(headers).toContain("Content-Transfer-Encoding: base64");
    expect(body).toBe("Hi there\nSecond line");
  });

  it("omits Cc and reply headers when they are not given", () => {
    const { headers } = parse(buildRawMessage({ to: ["a@example.com"], subject: "Hello", body: "x" }));
    expect(headers.some((line) => /^(Cc|In-Reply-To|References):/.test(line))).toBe(false);
  });

  it("sets In-Reply-To and References for a reply", () => {
    const { headers } = parse(buildRawMessage({ to: ["a@example.com"], subject: "Re: Hello", body: "x", inReplyTo: "<abc@mail.example.com>" }));
    expect(headers).toContain("In-Reply-To: <abc@mail.example.com>");
    expect(headers).toContain("References: <abc@mail.example.com>");
  });

  it("rejects CR or LF in any header value", () => {
    const base = { to: ["a@example.com"], subject: "Hello", body: "x" };
    expect(() => buildRawMessage({ ...base, subject: "Hello\r\nBcc: evil@example.com" })).toThrow(/line break/);
    expect(() => buildRawMessage({ ...base, to: ["a@example.com\nBcc: evil@example.com"] })).toThrow(/line break/);
    expect(() => buildRawMessage({ ...base, cc: ["c@example.com\rX: y"] })).toThrow(/line break/);
    expect(() => buildRawMessage({ ...base, inReplyTo: "<id>\nBcc: evil@example.com" })).toThrow(/line break/);
  });

  it("requires at least one recipient", () => {
    expect(() => buildRawMessage({ to: [], subject: "Hello", body: "x" })).toThrow(/recipient/);
  });

  it("encodes a non-ASCII subject as RFC 2047 base64", () => {
    const { headers } = parse(buildRawMessage({ to: ["a@example.com"], subject: "Café réservé ☕", body: "x" }));
    const subject = headers.find((line) => line.startsWith("Subject: "))!;
    expect(subject).toMatch(/^Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
    expect(decodeWords(subject)).toBe("Café réservé ☕");
  });

  it("splits a long non-ASCII subject into encoded words of at most 75 characters", () => {
    const subject = "日本語の件名🎉".repeat(12);
    const raw = Buffer.from(buildRawMessage({ to: ["a@example.com"], subject, body: "x" }), "base64url").toString("utf8");
    const folded = raw.split("\r\n\r\n")[0].match(/Subject: (.*(?:\r\n[ \t].*)*)/)![1];
    const words = folded.split(/\r\n[ \t]/);
    expect(words.length).toBeGreaterThan(1);
    for (const word of words) expect(word.length).toBeLessThanOrEqual(75);
    // Each word must decode on its own, so no multi-byte character is split.
    expect(decodeWords(folded)).toBe(subject);
  });

  it("wraps the base64 body at 76 characters and keeps non-ASCII text intact", () => {
    const text = "Grüße aus Zürich. ".repeat(40);
    const { bodyLines, body } = parse(buildRawMessage({ to: ["a@example.com"], subject: "Hello", body: text }));
    for (const line of bodyLines) expect(line.length).toBeLessThanOrEqual(76);
    expect(body).toBe(text);
  });

  it("returns base64url without padding", () => {
    expect(buildRawMessage({ to: ["a@example.com"], subject: "Hello??>>", body: "??>>~~" })).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
