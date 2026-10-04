import { calendar, type calendar_v3 } from "@googleapis/calendar";
import { auth, gmail, type gmail_v1 } from "@googleapis/gmail";
import { connect } from "@vercel/connect/eve";
import type { ToolContext } from "eve/tools";

/**
 * The narrowest scopes that cover Steward's five Google tools: read mail, send
 * mail, and read or write calendar events. Never the full-mailbox scope.
 */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
];

/**
 * The owner's Google grant lives in Vercel Connect, keyed to the session's
 * authenticated user. Steward never stores a token: eve asks Connect for a
 * short-lived one per step, and starts the consent flow when there is none.
 */
const googleGrant = connect({
  connector: process.env.GOOGLE_CONNECTOR ?? "google/steward",
  tokenParams: { scopes: GOOGLE_SCOPES },
});

export interface GoogleClients {
  readonly gmail: gmail_v1.Gmail;
  readonly calendar: calendar_v3.Calendar;
}

/** Runs one Google API call with clients authorised as the current user. */
export async function withGoogle<T>(ctx: ToolContext, call: (google: GoogleClients) => Promise<T>): Promise<T> {
  const { token } = await ctx.getToken(googleGrant);
  const client = new auth.OAuth2();
  client.setCredentials({ access_token: token });
  try {
    return await call({ gmail: gmail({ version: "v1", auth: client }), calendar: calendar({ version: "v3", auth: client }) });
  } catch (error) {
    // The grant was revoked after the token was issued. Ask the owner to sign in
    // again instead of handing the model a dead-token error.
    if (isUnauthorized(error)) ctx.requireAuth(googleGrant);
    throw error;
  }
}

export function isUnauthorized(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { status, code, response } = error as { status?: unknown; code?: unknown; response?: { status?: unknown } };
  return status === 401 || code === 401 || response?.status === 401;
}

type Header = { name?: string | null; value?: string | null };

/** Header names are case-insensitive, and senders do vary the case. */
export function headerValue(headers: readonly Header[] | undefined, name: string): string {
  const wanted = name.toLowerCase();
  return headers?.find((header) => header.name?.toLowerCase() === wanted)?.value ?? "";
}

export const MAX_BODY_CHARS = 8_000;

/**
 * The readable text of a Gmail message: the first text/plain part, else the
 * first text/html part with its markup removed. Capped so one long thread
 * cannot fill the model's context.
 */
export function plainTextBody(payload: gmail_v1.Schema$MessagePart | undefined, maxChars = MAX_BODY_CHARS): string {
  const html = findPart(payload, "text/html");
  const text = decodePart(findPart(payload, "text/plain")) ?? (html ? stripHtml(decodePart(html) ?? "") : "");
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n[truncated]` : text;
}

function findPart(part: gmail_v1.Schema$MessagePart | undefined, mimeType: string): gmail_v1.Schema$MessagePart | undefined {
  if (!part) return undefined;
  // A part with a filename is an attachment, not the message body.
  if (part.mimeType === mimeType && !part.filename && part.body?.data) return part;
  for (const child of part.parts ?? []) {
    const found = findPart(child, mimeType);
    if (found) return found;
  }
  return undefined;
}

function decodePart(part: gmail_v1.Schema$MessagePart | undefined): string | undefined {
  const data = part?.body?.data;
  return data ? Buffer.from(data, "base64url").toString("utf8") : undefined;
}

function stripHtml(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .trim();
}
