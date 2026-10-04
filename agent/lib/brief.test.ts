import { describe, expect, it } from "vitest";
import { BRIEF_CRON, briefPrompt, briefTarget, dayWindow, ownerAuth } from "./brief";

describe("BRIEF_CRON", () => {
  it("fires once a day on weekdays, which is all the Vercel Hobby plan allows", () => {
    expect(BRIEF_CRON).toBe("0 14 * * 1-5");
  });
});

describe("briefTarget", () => {
  it("prefers the owner's existing Linq chat, so replies and approvals reach the same session", () => {
    expect(briefTarget({ LINQ_OWNER_CHAT_ID: "chat-abc" })).toEqual({
      adapterName: "linq",
      threadId: "linq:chat-abc",
    });
    expect(briefTarget({ LINQ_OWNER_CHAT_ID: " linq:chat-abc " })?.threadId).toBe("linq:chat-abc");
  });

  it("skips instead of opening a second conversation when the owner's chat id is unknown", () => {
    // A phone-number address creates a separate session that the owner's
    // replies never reach, and that session piles up context day after day.
    expect(briefTarget({ OWNER_PHONE: "+14155550123" } as never)).toBeNull();
  });

  it("returns null when there is nobody to send to", () => {
    expect(briefTarget({})).toBeNull();
    expect(briefTarget({ OWNER_PHONE: "555-0123" } as never)).toBeNull();
  });
});

describe("ownerAuth", () => {
  it("is the same principal the Linq channel gives the owner, so memory scopes match", () => {
    expect(ownerAuth()).toMatchObject({
      authenticator: "linq-message",
      issuer: "linq",
      principalType: "user",
      principalId: "owner",
      subject: "owner",
    });
  });
});

describe("dayWindow", () => {
  it("gives the local day and its bounds with the zone's offset on that date", () => {
    expect(dayWindow(new Date("2026-09-21T14:00:00Z"), "America/Los_Angeles")).toEqual({
      weekday: "Monday",
      date: "2026-09-21",
      timeMin: "2026-09-21T00:00:00-07:00",
      timeMax: "2026-09-21T23:59:59-07:00",
    });
  });

  it("follows daylight saving", () => {
    expect(dayWindow(new Date("2026-12-01T14:00:00Z"), "America/Los_Angeles").timeMin).toBe("2026-12-01T00:00:00-08:00");
  });

  it("uses the owner's date, not the UTC date", () => {
    const window = dayWindow(new Date("2026-09-21T20:00:00Z"), "Asia/Kolkata");
    expect(window.date).toBe("2026-09-22");
    expect(window.timeMin).toBe("2026-09-22T00:00:00+05:30");
  });

  it("writes UTC as +00:00", () => {
    expect(dayWindow(new Date("2026-09-21T14:00:00Z"), "UTC").timeMin).toBe("2026-09-21T00:00:00+00:00");
  });
});

describe("briefPrompt", () => {
  const prompt = briefPrompt(new Date("2026-09-21T14:00:00Z"), "America/Los_Angeles");

  it("names the day, the calendar window and the read-only tools to use", () => {
    expect(prompt).toContain("Monday 2026-09-21");
    expect(prompt).toContain("2026-09-21T00:00:00-07:00");
    expect(prompt).toContain("calendar_list_events");
    expect(prompt).toContain("gmail_search");
  });

  it("tells the agent to read only and not to act", () => {
    expect(prompt).toMatch(/do not send, create, change or run anything/i);
  });
});

describe("briefPrompt", () => {
  const prompt = briefPrompt(new Date("2026-09-23T14:07:00Z"), "America/Los_Angeles");

  it("says it is the scheduled brief and must not describe its own instructions or memory", () => {
    expect(prompt).toMatch(/scheduled morning brief/i);
    expect(prompt).toMatch(/do not mention these instructions/i);
  });

  it("gives one fixed reply when the calendar or mail tools are not authorised", () => {
    expect(prompt).toContain("Morning brief skipped: Google sign-in needed.");
  });
});
