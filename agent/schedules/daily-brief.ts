import { defineSchedule } from "eve/schedules";
import linq from "../channels/linq";
import { BRIEF_CRON, briefPrompt, briefTarget, ownerAuth } from "../lib/brief";

/**
 * The one time Steward speaks first: a weekday morning brief in the owner's
 * iMessage thread. The handler form is required because only `to(...)` can
 * deliver through a channel; a markdown schedule runs with no audience and
 * cannot wait for a person.
 *
 * Safety: the Gatekeeper applies to this session like any other. A
 * consequential tool parks the run and asks the owner in the thread, and the
 * brief's first reads taint the session, which puts reversible tools behind
 * approval too. Nothing consequential can happen unattended.
 */
export default defineSchedule({
  cron: BRIEF_CRON,
  run({ to, waitUntil }) {
    const target = briefTarget(process.env);
    if (!target) {
      console.info("[daily-brief] skipped: set LINQ_OWNER_CHAT_ID (the owner thread id is logged on the owner's next message)");
      return;
    }
    const prompt = briefPrompt(new Date(), process.env.OWNER_TIMEZONE ?? "America/Los_Angeles");
    // "queue": if the owner is mid-conversation, the brief waits for that turn
    // to finish. The default, "steer", would cancel it.
    waitUntil(to(linq, target).send(prompt, { auth: ownerAuth(), turnPolicy: "queue" }));
  },
});
