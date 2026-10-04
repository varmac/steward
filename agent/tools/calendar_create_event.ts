import { defineTool } from "eve/tools";
import { z } from "zod";
import { gate, withReceipt } from "../lib/gatekeeper";
import { withGoogle } from "../lib/google";

// With `timeZone` given, Google accepts a local time or one with an offset.
const dateTime = z.iso.datetime({ offset: true, local: true }).describe("ISO 8601, for example 2026-03-01T09:00:00.");

export default defineTool({
  description:
    "Create an event on the owner's primary Google Calendar. The owner must approve every event. When attendees are given, Google emails each of them an invitation.",
  inputSchema: z.object({
    summary: z.string().min(1).max(250),
    start: dateTime,
    end: dateTime,
    timeZone: z.string().min(1).describe("IANA time zone, for example America/Toronto."),
    location: z.string().optional(),
    description: z.string().optional(),
    attendees: z.array(z.email()).optional(),
  }),
  label: { start: ({ summary, start }) => `Create event: ${summary} (${start})` },
  approval: gate("calendar_create_event"),
  execute: withReceipt("calendar_create_event", async ({ summary, start, end, timeZone, location, description, attendees = [] }, ctx) =>
    withGoogle(ctx, async ({ calendar }) => {
      const { data } = await calendar.events.insert({
        calendarId: "primary",
        // Google's default is to notify nobody, which would create silent invitations.
        sendUpdates: attendees.length > 0 ? "all" : "none",
        requestBody: {
          summary,
          location,
          description,
          start: { dateTime: start, timeZone },
          end: { dateTime: end, timeZone },
          attendees: attendees.map((email) => ({ email })),
        },
      });
      return { created: true, id: data.id ?? "", link: data.htmlLink ?? "" };
    }),
  ),
});
