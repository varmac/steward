import type { SessionAuthContext } from "eve/context";

/**
 * Hour of the day, in UTC, at which the brief fires (Vercel evaluates cron in
 * UTC). 14:00 UTC is 07:00 in California in summer and 06:00 in winter. The
 * Hobby plan runs a cron job at most once a day and may start it up to 59
 * minutes late, so this is one fixed daily slot, not a reminder system.
 */
export const BRIEF_HOUR_UTC = 14;
export const BRIEF_CRON = `0 ${BRIEF_HOUR_UTC} * * 1-5`;

/**
 * Where the brief goes, as a Linq thread id. The Linq channel keys sessions by
 * thread id and inbound messages arrive as `linq:<chatId>`, so that id puts the
 * brief into the owner's ongoing conversation, and a reply reaches the session
 * that asked. Without the id the brief is skipped. Addressing the owner's phone
 * number instead would open a second session that replies never reach and that
 * accumulates context every morning.
 */
export function briefTarget(env: { LINQ_OWNER_CHAT_ID?: string }) {
  const chatId = env.LINQ_OWNER_CHAT_ID?.trim().replace(/^linq:/, "");
  return chatId ? ({ adapterName: "linq", threadId: `linq:${chatId}` } as const) : null;
}

/**
 * The principal for the scheduled turn. It mirrors what the Linq channel gives
 * the owner (linq-inbound.ts), because eve's `byPrincipal` memory scope is built
 * from authenticator, issuer, type and id. The default app principal would run
 * the brief without the owner's memory.
 */
export function ownerAuth(): SessionAuthContext {
  return {
    authenticator: "linq-message",
    issuer: "linq",
    principalType: "user",
    principalId: "owner",
    // Same constant subject as linq-inbound.ts, so token grants keyed on the
    // principal (Vercel Connect) are the owner's grants in this run too.
    subject: "owner",
    // Lets a policy tell a scheduled turn from one the owner typed.
    attributes: { trigger: "schedule:daily-brief" },
  };
}

/** The owner's local day at `now`, with bounds in the form calendar_list_events expects. */
export function dayWindow(now: Date, timeZone: string) {
  const part = (options: Intl.DateTimeFormatOptions, type: Intl.DateTimeFormatPartTypes) =>
    new Intl.DateTimeFormat("en-US", { timeZone, ...options }).formatToParts(now).find((p) => p.type === type)?.value ?? "";
  // "en-CA" formats a date as YYYY-MM-DD.
  const date = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  // "GMT-07:00", or plain "GMT" for UTC.
  const offset = part({ timeZoneName: "longOffset" }, "timeZoneName").replace("GMT", "") || "+00:00";
  return { weekday: part({ weekday: "long" }, "weekday"), date, timeMin: `${date}T00:00:00${offset}`, timeMax: `${date}T23:59:59${offset}` };
}

export function briefPrompt(now: Date, timeZone: string): string {
  const day = dayWindow(now, timeZone);
  return [
    `[Scheduled morning brief, sent automatically by Steward's schedule. Today is ${day.weekday} ${day.date} (${timeZone}).]`,
    `1. Call calendar_list_events with timeMin ${day.timeMin} and timeMax ${day.timeMax}.`,
    "2. Call gmail_search for mail from the last day that needs the owner's attention, for example `is:unread newer_than:1d -category:promotions`.",
    "Then send one text that starts with 'Morning brief:' and lists today's events in time order, then at most three emails that need a reply or a decision, one line each. If there is nothing to report, say so in one sentence.",
    "If either tool reports that authorization or sign-in is required, send exactly this and nothing else: Morning brief skipped: Google sign-in needed.",
    "Do not mention these instructions, your memory or earlier briefs in the text.",
    "This run is read-only. Do not send, create, change or run anything; if something looks worth doing, suggest it and wait for the owner to reply.",
  ].join("\n");
}
