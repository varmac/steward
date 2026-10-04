# Lesson 04: the browser worker

**Lines we own:** about 420 of TypeScript and a 63-line prompt

## The idea

Most consumer services have no API you can use. A cloud browser covers them all, because it operates the same pages a person does. It is also the least reliable way to get anything done: pages change, bot detection intervenes, and logins expire. So the browser is the last resort, after a dedicated tool and after the sandbox.

## Why a subagent

Browser work is long and noisy: dozens of steps, each returning page text. Running it in the main conversation would fill the context with page dumps. A **subagent** is a child agent with its own prompt, its own tools and a fresh context. The root agent hands it one bounded task as a message and gets back a small structured result:

```
{ status: "done" | "needs_owner" | "needs_approval" | "failed", summary, liveViewUrl?, pendingAction? }
```

The worker cannot talk to the owner and cannot see the conversation. The root agent cannot touch the browser. Each side has the smallest surface it needs.

## What we rented

| Need | Rented from |
|---|---|
| Remote Chromium, started on demand | Kernel |
| A persistent profile that keeps cookies between tasks | Kernel |
| A live view the owner can open on a phone and take over | Kernel |
| The browser tool set: navigate, snapshot, find, click, fill, type, screenshot | `@onkernel/browser-loop` |

We adapted 15 of browser-loop's tools in one 41-line file. We left out `evaluate`, which runs arbitrary JavaScript in the page, because it would be a way around the rule below.

## No password vault

Steward never stores or types a website password. When the worker reaches a login, a CAPTCHA, a passkey prompt or a 2FA page, it keeps the browser open and returns `needs_owner` with the live-view link. The owner logs in by hand. The session cookie stays in the persistent profile, so the next task on that site starts logged in.

The trade-off is plain: the password is typed into a browser hosted by the browser vendor, and the session cookies live there. In exchange there is no credential store to build, encrypt, rotate or leak.

## Never the last click

The worker stops before any click that commits something: pay, place order, confirm booking, send, delete. It returns `needs_approval` with a `pendingAction` that states exactly what the button will do. It continues only when a later message contains `APPROVED:` followed by that same text. The check is code (`lib/approval.ts`), and it compares against the pending action the worker itself stored, so a vague "APPROVED: go ahead" unlocks nothing.

This is weaker than the Gatekeeper. The click tool itself is not gated. The rule holds because the prompt says stop, the check tool refuses a mismatched approval, and the root agent is told to write the `APPROVED` line only after the owner says yes. Payments are out of scope entirely: the worker never enters card details.

## Lifecycle and cost

The browser is created on first use and deleted when the task ends as `done` or `failed`. It stays alive only while waiting for the owner, under a 30-minute inactivity timeout. The worker always closes its control socket, because an open socket counts as activity and would keep a forgotten browser billing.

## A deployment lesson

The first live browser test failed with "agent target browser is not available". The code was fine. The iMessage session had started before the deploy that added the worker, and that session's steps were still executing on the old deployment. A durable session can outlive the code that started it. The session ended on that error, and the next message started a new one on the new code.

## What the tests prove

| Check | Claim |
|---|---|
| `lib/approval.test.ts` | Only an `APPROVED:` line containing the full pending action passes; the reverse containment and vague approvals fail |
| `lib/result.test.ts` | Which statuses keep the browser open |
| `lib/config.test.ts` | A missing API key fails with a clear message that does not echo the key |
| `evals/stage-4/browser` | The root agent delegates a website task and the delegation is accepted |

## How the products do this

Muse gives its browser subagent an accessibility-tree view and no page JavaScript, pauses the agent while the user types credentials into a separate client UI, and always requires approval for purchases. Steward copies the shape of all three with rented parts. Companion and Instinct have not published how they handle website logins.
