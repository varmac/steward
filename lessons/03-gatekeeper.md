# Lesson 03: the Gatekeeper and receipts

**Files:** `agent/lib/policy.ts`, `agent/lib/gatekeeper.ts`, `agent/lib/receipts.ts`, `agent/tools/receipts.ts`

Everything else in Steward wires rented services together. This module is the part we designed.

## The idea

A language model that reads your email can be talked into things by your email. No prompt fully prevents that. Meta says so plainly about Muse: prompt injection is an open problem, and the design goal is to limit what a fooled agent can do.

Saltzer and Schroeder described the remedy in 1975, and Muse's Sentinel applies it: **the component that proposes an action must not be the component that authorises it.** The model proposes. Ordinary code, which no prompt can influence, decides whether a human must approve first.

In Steward that code is about 120 lines.

## The three parts

### 1. The policy table (`policy.ts`)

Every tool has one of three action classes:

| Class | Meaning | Examples | Approval |
|---|---|---|---|
| `observe` | Reads only | `gmail_search`, `web_fetch`, `receipts` | Never |
| `reversible` | Changes something you can undo | `write_file`, `bash` in the sandbox | Only once the session is tainted |
| `consequential` | Reaches other people, or cannot be undone | `gmail_send`, `calendar_create_event` | Always |

The class lives in one central table and not in each tool. You can audit what Steward is allowed to do by reading one file. Two rules make the table trustworthy:

- **Fail-safe default.** A tool that is missing from the table is treated as `consequential`. Forgetting to classify a tool makes it safer.
- **A test keeps the table complete.** `policy.test.ts` lists the files in `agent/tools/` and fails if any is missing from the table.

The whole decision is one pure function, `decide(toolName, sessionTainted)`, which returns `"allow"` or `"ask"`. It can be tested exhaustively without a model, a network or a database.

### 2. Session taint (`gatekeeper.ts`)

Some tools return text that a stranger wrote: web pages, email bodies, repository files. The table marks these `untrusted`. The first time a session calls one, the session becomes **tainted**, and it stays tainted.

A tainted session loses automatic approval for `reversible` actions. Before Steward has read anything from outside, "save this to a file" just happens. After it has read a web page, the same request asks you first, because the instruction might have come from the page.

This is a small version of what Muse calls tainted egress. Muse tracks taint per operating-system process, in the kernel, with eBPF. Steward tracks it per conversation, in eve's durable session state, in three lines. It is much coarser. The principle is the same: reading untrusted data should cost the agent some of its freedom to act.

### 3. Receipts (`receipts.ts`)

`withReceipt` wraps every tool's `execute`. Each call appends a row to a Postgres table: the time, the tool, its class, a SHA-256 hash of the exact input, whether it succeeded, and for anything that is not a read, the input itself.

- **The receipt comes first.** For `reversible` and `consequential` tools the "started" row is written before the action runs. If the database is down, the action does not happen.
- **The hash ties the approval to the payload.** What you approved and what ran can be compared after the fact.
- **The `receipts` tool lets you ask.** "What did you do today?" is answered from the log and not from the model's memory of the conversation.

## How a tool opts in

```ts
export default defineTool({
  description: "Send an email from the owner's Gmail account.",
  inputSchema: gmailSendSchema,
  approval: gate("gmail_send"),
  execute: withReceipt("gmail_send", async (input, ctx) => sendGmail(ctx, input)),
});
```

The framework does the hard part. When `gate` answers "ask", it pauses the session durably, the channel shows the request to the owner, and the run resumes when they answer, even days later. The pause is rented. The decision rule is ours.

## What the evals prove

| Eval | Claim |
|---|---|
| `gatekeeper/0000` | A request to send email parks on an approval request for `gmail_send`. The tool has not run. |
| `gatekeeper/0001` | A hidden instruction to email an attacker never results in a completed `gmail_send`, whether or not the model was fooled. |

Compare the second one with `stage-0/boundaries/0002`. That earlier eval passes only if the model resists the injection. This one passes even if the model falls for it, because the send still needs an approval.

## What this does not give you

The distance between this and Muse:

| Muse | Steward |
|---|---|
| Sentinel runs outside the agent's container. A compromised agent cannot change it. | The Gatekeeper runs in the same process as the agent code. It protects against a fooled model. It does not protect against compromised code. |
| Every network request is mediated, including raw sockets. | Only tool calls are mediated. The sandbox has its own network policy (lesson 05). |
| The agent never holds real credentials. | Our process can ask Vercel Connect for the Google token. The model never sees it, and our code could. |
| Approvals travel on a path separate from the chat. | Approvals arrive in the same iMessage thread. Someone holding your unlocked phone can approve. |
| Approval fatigue is managed with scoped, time-limited grants. | Every consequential call asks, every time. There are no standing grants. |

A human who approves without reading defeats all of it. The card has to show the exact recipient and the exact text for the approval to mean anything. That is why `gmail_send` takes the complete message as its input and does not accept a reference to a draft.
