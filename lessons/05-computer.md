# Lesson 05: the computer

**Lines we own:** about 300

## The idea

Some requests are data work: unpack this, convert that, chart the top ten. The right tool is a computer with a shell and a filesystem. Companion calls this the user's "personal computer". In Steward it is a **sandbox**: an isolated Linux microVM with a `/workspace` directory, started on demand.

The code that runs there is untrusted by construction. The model writes it, often from third-party data. So this lesson is mostly about what the sandbox may not do.

## What we rented

The framework ships `bash`, `read_file` and `write_file` tools that target the sandbox, and a sandbox backend for each environment: a Firecracker microVM when deployed, a local VM or Docker in development. We opt the three tools back in and wrap them with the Gatekeeper.

## Default-deny network

The framework's default sandbox can reach the whole internet. Ours can reach three package registries and nothing else. The policy is 3 lines in `agent/sandbox.ts`.

The firewall only understands domain allow-lists, and "any URL the owner mentions" cannot be written as one. So downloads happen outside the sandbox. `download_file` runs in the application process, checks the URL, fetches it, and writes the bytes into `/workspace`.

```
owner: "chart this CSV: https://…"
  download_file  (app process)  https only · public IPs only · each redirect re-checked · 25 MB cap
        │ writes bytes
        ▼
  /workspace/data.csv  ──  bash: python chart.py  (sandbox: no internet)
        │
        ▼
  send_file  →  attachment in the thread
```

Untrusted code never gets an open network connection, and the one component that does fetch from the internet runs no untrusted code.

`download_file` is classed `reversible` and `untrusted`. A GET request can carry data out in its URL, so once the session has read outside content, a download asks the owner first.

## Getting a file back to the thread

A tool has no handle on the conversation it runs in. Only the channel does. So `send_file` is a checkpoint and the channel does the delivery:

1. `send_file` checks that the path stays inside `/workspace`, the extension is on an allow-list and the file is under 8 MB. It goes through the approval gate and writes the receipt. It returns `queued`.
2. The Linq channel's `action.result` handler sees that result, reads the bytes from the sandbox and posts them as an attachment, with the tool call id as an idempotency key because event handlers can fire twice.

No public file hosting is involved. The messaging provider's upload API takes the bytes directly.

## What persists

Nothing in the sandbox is meant to persist. Results leave through `send_file`. Anything worth remembering goes to memory or stays in the conversation.

## What the tests prove

| Check | Claim |
|---|---|
| `sandbox-files.test.ts` | `..` traversal and absolute paths outside `/workspace` are rejected; the size cap holds when the file lies about its length |
| `sandbox-download.test.ts` | Non-https, embedded credentials, odd ports, loopback, private ranges and the cloud metadata address are all refused, on the first URL and on every redirect |

Known gap: a DNS answer could change between the IP check and the connection. The code says so.

## How the products do this

Muse gives each user a persistent VM and puts the agent in a container inside it, with a kernel-level monitor on every outbound connection. Companion gives each user a persistent cloud computer and has not said how it is isolated. Steward's sandbox is ephemeral and its egress rule is a static allow-list, which is much less, and enough to make "run this script on that file" safe to offer.
