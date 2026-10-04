# Lesson 02: read-only tools, connections and memory

**Lines we own:** about 260, plus a 45-line clock helper

## The idea

A model can do nothing by itself. A **tool** is a named function the model may ask the runtime to call: a description the model reads, a typed input schema, and an executor. The list of tools is the assistant's whole capability, which is why stage 0 switched the defaults off and this stage adds tools one file at a time.

This stage adds only tools that read. Nothing here can change anything in the world. Tools with side effects arrive in stage 3, after the Gatekeeper exists.

## Three kinds of tool

| Kind | Example | Who wrote the executor | Lines |
|---|---|---|---|
| Built-in, opted back in | `web_fetch`, `web_search` | The framework | 7 to 12 each |
| Hand-written wrapper over a vendor API | `gmail_search`, `gmail_read_thread`, `calendar_list_events` | Us, over Google's client library | 30 to 40 each |
| Discovered from a remote MCP server | `github__*` | GitHub | 18 for the whole connection |

The third kind is the cheapest and the least controllable. An MCP connection gives you every tool the server publishes, under names the server chooses. We ask GitHub's server for read-only mode with a header, so the restriction is enforced on their side and does not depend on us tracking their tool names.

## Credentials without storing any

The Google tools never see a refresh token. `agent/lib/google.ts` declares a grant (connector name plus scopes) and calls `ctx.getToken()`. Vercel Connect holds the OAuth grant for the current principal and returns a short-lived access token. When there is no grant yet, the framework pauses the run, sends the owner a consent link in the thread, and resumes after consent.

Scopes are the narrowest that work: `gmail.readonly`, `gmail.send`, `calendar.events`. A unit test asserts that the full-mailbox scope is never requested.

One practical limit: the grant belongs to an authenticated user, so these tools cannot run in local development. They run in the deployed thread.

## Memory

`agent/memory/profile.ts` is 13 lines. It declares one small document per principal, stored in a private Blob store, recalled before every turn, and edited by the model through two tools the provider supplies. The description tells the model what belongs there: durable preferences, never secrets.

Memory is scoped to the principal. The owner's principal is the constant `owner` from lesson 01, so memory follows the person and not the phone number.

## The model has no clock

The first live test asked for "tomorrow's calendar" on a Saturday and got Monday. Nothing had told the model the date. `agent/instructions/clock.ts` now adds one system line at the start of every turn: today's date, the local time, the zone and UTC offset, and tomorrow's date written out so the model does no date arithmetic. It is system context, so it refreshes each turn and never accumulates in history.

## Untrusted output

Everything these tools return was written by someone else: an email body, a web page, a repository file. The policy table marks them `untrusted`. Lesson 03 explains what that flag does.

## What the evals and tests prove

| Check | Claim |
|---|---|
| `evals/stage-2/clock` | Asked what day tomorrow is, the reply names the right weekday for the owner's zone |
| `google.test.ts` | Body extraction prefers plain text, strips HTML, skips attachments, caps length; the full-mailbox scope is absent |
| `clock.test.ts` | Correct local date across the date line, east and west of UTC, and with an invalid zone name |

## How the products do this

Companion advertises 1,000+ integrations through ChatGPT's marketplace plus custom MCP servers and CLIs: the same three kinds of tool at larger scale. Muse separates "connectors" that run in a privileged worker from the agent that requests them, so the agent never holds the credential. Steward gets a weaker version of that separation by renting it: the token broker holds the grant, and our process only ever sees a short-lived token.
