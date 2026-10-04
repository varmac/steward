# Steward

A personal assistant you text. It reads your mail and calendar, sends email with your approval, works on files in a sandbox, uses websites through a cloud browser, and sends a morning brief.

Steward is a reference build for learning how assistants like Companion, Instinct and Meta's Muse are put together. It is about 1,700 lines of TypeScript on rented services. It serves one person and is not production software.

**Start with the guide,** *How to build a personal assistant you can text* (link to be added when it is published). It maps the system to a five-layer model, follows one message through every component, and gives the build order. The `lessons/` folder here has one short note per stage.

## What it is made of

| Layer | Rented | Written here |
|---|---|---|
| Channel | Linq (iMessage line), Vercel Connect, eve's Linq channel | Owner allowlist |
| Control plane | eve durable sessions, Vercel Workflow, Vercel Cron | One schedule |
| Reasoning | Any model through Vercel AI Gateway | Instructions, a per-turn clock line |
| Tool router | eve tools and approval pause | **Gatekeeper**: policy table, session taint, receipts |
| Execution | Google APIs, GitHub MCP server, Vercel Sandbox, Kernel cloud browser | Thin tool wrappers, browser worker, guarded download |

## The design in four rules

1. **The agent starts with no tools.** A capability exists only if there is a file for it under `agent/tools/`.
2. **The model proposes, code authorises.** Every tool is classed `observe`, `reversible` or `consequential` in `agent/lib/policy.ts`. Consequential tools always need the owner's approval. A tool missing from the table counts as consequential.
3. **Reading untrusted content costs freedom.** Once a session has read a web page, an email or a repository, reversible actions need approval too.
4. **Secrets stay out of the model and out of this code.** OAuth grants live in a token broker. Website passwords are typed by the owner into a live view of the remote browser. Nothing here stores either.

## Run it

Requires Node 24.

```bash
npm install
cp .env.example .env.local     # add AI_GATEWAY_API_KEY
npm run dev                    # chat in the terminal
npm test                       # unit tests
npm run check                  # typecheck, tests and the public-tree privacy scan
npm run eval                   # behaviour checks against the real model
```

Mail, calendar, memory storage, the browser and the iMessage channel need accounts. The guide's "Build it in this order" section lists what to provision at each stage. In outline:

```bash
npx eve link                               # hosting project
npx eve add channel/linq                   # messaging line; then set OWNER_PHONE
npx eve add memory/file                    # Blob store for memory
npx vercel integration add neon            # Postgres for receipts
npx vercel integration add kernel          # cloud browser
npx vercel connect create google --connection-method oauth --name steward --data @credentials.json
npx eve deploy
```

## Layout

```
agent/
  agent.ts                 model, defaultTools: false, spend cap
  instructions.md          system prompt
  instructions/clock.ts    today's date and zone, added every turn
  channels/linq.ts         iMessage channel
  lib/policy.ts            the policy table
  lib/gatekeeper.ts        approval gate, taint, receipt wrapper
  lib/receipts.ts          append-only log
  hooks/                   receipts for tools that run outside this process
  tools/                   one file per capability
  connections/github.ts    remote MCP server
  memory/profile.ts        durable facts about the owner
  sandbox.ts               default-deny network policy
  subagents/browser/       the browser worker
  schedules/daily-brief.ts the one proactive run
evals/                     behaviour checks, grouped by stage
lessons/                   one teaching note per stage
```

## Limits

The Gatekeeper protects against a model that has been fooled. It runs in the same process as the agent, so it does not protect against compromised code. Approvals arrive in the same thread as the conversation. The hosting, messaging, browser and database providers can each read the data that passes through them. The guide's Limits section has the full list.

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first. Report security problems privately, as described in [SECURITY.md](SECURITY.md).

## Credits

Built on [eve](https://github.com/vercel/eve), [Kernel](https://kernel.sh), [Linq](https://linqapp.com), [Neon](https://neon.tech) and Vercel. The combination of these services was shown to work by [OpenInstinct](https://github.com/Merit-Systems/OpenInstinct). Steward's design, code and prompts are its own. The security ideas follow Saltzer and Schroeder and Meta's published Muse architecture.

## License

[MIT](LICENSE)
