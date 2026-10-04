# Lesson 06: speaking first

**Lines we own:** about 90

## The idea

Everything so far starts with a message from the owner. An assistant that follows up, reminds and briefs has to start a turn by itself. The primitive is a **schedule**: a cron entry that starts an agent session with a prompt we wrote and delivers the result through a channel.

Steward has one: a weekday morning brief with today's calendar and the emails that need attention.

## What we rented

The framework turns a schedule file into a platform cron job and gives the handler a `to(channel, target).send(prompt, { auth })` call that starts a session and delivers its output to a specific conversation.

## Three decisions in 29 lines

**Which conversation.** The channel keys sessions by thread. The brief targets the owner's existing thread id (`LINQ_OWNER_CHAT_ID`, logged on the owner's first message), so it joins the session the owner already talks in and a reply reaches the same session. Without that id the brief is skipped. Addressing the phone number instead would open a second session that the owner's replies never reach. An early version did that, and the side session piled up failed mornings until the model started describing its own context back to the owner.

**Who it runs as.** The handler passes the same principal the channel assigns to the owner, including a constant `subject`, so the brief reads the owner's memory and uses the owner's Google grant. If any field differs, the token broker treats the run as a different user and every Google call asks for sign-in. It adds one attribute, `trigger: "schedule:daily-brief"`.

**What it may do.** Nobody is watching a scheduled run. The Gatekeeper reads that `trigger` attribute and denies every tool that is not `observe`. A scheduled run can read and report. It cannot send, write or run anything, whatever the prompt or an email it reads says. This is 4 lines in `gate()`.

The schedule also sends with `turnPolicy: "queue"`, so a brief waits for an active conversation turn to finish. The default would cancel it.

## The hosting plan shapes the feature

On the free hosting plan a cron job may run at most once a day, and it fires some time within its hour. A per-minute dispatcher that checks a table of user-created reminders fails at deploy time. So "remind me at 3pm" is not in the MVP, and the brief arrives between 7 and 8.

The general pattern for user-created schedules is a table of rows, one per-minute schedule that claims due rows with an atomic lease, and tools to create and cancel them. It needs a paid plan and about 350 more lines.

**What it says when it cannot work.** The prompt gives one fixed reply for a missing Google grant and tells the model not to describe its instructions or memory. An unattended run with nothing to report will otherwise talk about whatever it can see.

## Cost to watch

The brief adds tokens every weekday to one long-lived session. The per-session spend cap will eventually pause that session and ask the owner whether to continue. That is the cap working as intended, and it is a prompt to think about when a session should end.

## What the tests prove

| Check | Claim |
|---|---|
| `brief.test.ts` | The day window is correct in the owner's zone; the target prefers the thread id and falls back to the phone number; with neither, the schedule skips |
| `policy.test.ts` + `gate()` | Non-read tools are denied when the turn's trigger starts with `schedule:` |

To trigger the schedule in development: `curl -X POST http://localhost:2000/eve/v1/dev/schedules/daily-brief`. It sends a real message.

## How the products do this

Instinct's pitch is proactivity: it follows up on threads you dropped and calls or texts first. Muse runs schedules and event triggers inside the user's persistent VM. Both need what this lesson's 4-line rule stands in for: a clear answer to what an unattended agent is allowed to do.
