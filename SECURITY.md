# Security policy

Steward is a reference implementation for learning. It is not production software, and it is meant to run for one person. The limits of its design are listed in the README.

## Reporting a problem

Report security problems privately through GitHub: **Security → Report a vulnerability** on this repository. Please do not open a public issue.

Include what you found, how to reproduce it, and the commit you tested. You should get a reply within a week.

## Scope

In scope: the code in this repository, including the Gatekeeper (`agent/lib/policy.ts`, `agent/lib/gatekeeper.ts`), the inbound webhook check, the sandbox network policy and the guarded download.

Out of scope: the hosted services Steward rents (Vercel, Linq, Kernel, Neon, Google, GitHub). Report problems in those to their vendors. If a problem is in a dependency such as eve, report it upstream; you are welcome to tell us too, so the lessons can be corrected.

## If you run your own copy

- Keep `.env.local` out of version control. The repository ignores it.
- Check that your Linq webhook rejects unsigned requests (lesson 01 has the two `curl` commands).
- Never share your owner thread id, phone number or live-view links in issues.
