import { describe, expect, it } from "vitest";
import { GOOGLE_SCOPES, headerValue, isUnauthorized, plainTextBody } from "./google";

const b64 = (text: string) => Buffer.from(text, "utf8").toString("base64url");

describe("GOOGLE_SCOPES", () => {
  it("never asks for the full-mailbox scope", () => {
    expect(GOOGLE_SCOPES).not.toContain("https://mail.google.com/");
    for (const scope of GOOGLE_SCOPES) expect(scope).toMatch(/^https:\/\/www\.googleapis\.com\/auth\/(gmail|calendar)\./);
  });
});

describe("headerValue", () => {
  const headers = [
    { name: "From", value: "Ann <ann@example.com>" },
    { name: "SUBJECT", value: "Lunch" },
  ];

  it("finds a header regardless of case", () => {
    expect(headerValue(headers, "from")).toBe("Ann <ann@example.com>");
    expect(headerValue(headers, "Subject")).toBe("Lunch");
  });

  it("returns an empty string when the header is missing", () => {
    expect(headerValue(headers, "Cc")).toBe("");
    expect(headerValue(undefined, "From")).toBe("");
  });
});

describe("plainTextBody", () => {
  it("decodes a single-part base64url body", () => {
    expect(plainTextBody({ mimeType: "text/plain", body: { data: b64("Hällo wörld?") } })).toBe("Hällo wörld?");
  });

  it("prefers text/plain over text/html, even when nested", () => {
    const payload = {
      mimeType: "multipart/mixed",
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [
            { mimeType: "text/html", body: { data: b64("<p>html version</p>") } },
            { mimeType: "text/plain", body: { data: b64("plain version") } },
          ],
        },
        { mimeType: "application/pdf", filename: "a.pdf", body: { attachmentId: "att-1" } },
      ],
    };
    expect(plainTextBody(payload)).toBe("plain version");
  });

  it("falls back to HTML with the markup removed", () => {
    const html = "<html><style>p{color:red}</style><body><p>Hello&nbsp;<b>Bob</b> &amp; co</p><script>x()</script></body></html>";
    expect(plainTextBody({ mimeType: "text/html", body: { data: b64(html) } })).toBe("Hello Bob & co");
  });

  it("ignores text attachments", () => {
    const payload = {
      mimeType: "multipart/mixed",
      parts: [{ mimeType: "text/plain", filename: "notes.txt", body: { attachmentId: "att-2" } }],
    };
    expect(plainTextBody(payload)).toBe("");
  });

  it("truncates long bodies and says so", () => {
    const body = plainTextBody({ mimeType: "text/plain", body: { data: b64("x".repeat(9000)) } }, 8000);
    expect(body.startsWith("x".repeat(8000))).toBe(true);
    expect(body).toBe(`${"x".repeat(8000)}\n[truncated]`);
  });

  it("returns an empty string when there is no payload", () => {
    expect(plainTextBody(undefined)).toBe("");
  });
});

describe("isUnauthorized", () => {
  it("recognises a 401 from the Google client", () => {
    expect(isUnauthorized({ status: 401 })).toBe(true);
    expect(isUnauthorized({ code: 401 })).toBe(true);
    expect(isUnauthorized({ response: { status: 401 } })).toBe(true);
  });

  it("does not treat other failures as an auth problem", () => {
    expect(isUnauthorized({ status: 403 })).toBe(false);
    expect(isUnauthorized(new Error("boom"))).toBe(false);
    expect(isUnauthorized(null)).toBe(false);
  });
});
