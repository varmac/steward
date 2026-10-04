# Lesson 01: the channel

**Lines we own:** 19 in the channel file, 54 in `agent/lib/`

## The idea

The message thread carries your request and Steward's reply. It does no work. The agent runs on a server you never see. This is why products like Companion and Instinct can say "there is no new interface": the interface is one you already have, and the work happens elsewhere.

A channel therefore has three jobs:

1. **Receive.** Accept a webhook from the messaging provider and prove it really came from them.
2. **Identify.** Turn "a message from this phone number" into "a request from this person".
3. **Deliver.** Send the agent's reply back to the right thread.

Steward writes code for the second job only.

## What we rented

| Need | Rented from | What it gives us |
|---|---|---|
| An iMessage phone number | Linq | A real line that sends and receives iMessage and SMS, and calls our webhook |
| Credentials and webhook forwarding | Vercel Connect | Holds the Linq API token, so there is no Linq secret in our repo or env file. It forwards webhooks to us signed with the project's own identity. |
| Webhook verification, thread-to-session mapping, reply delivery, read receipts | eve's `linqChannel` | One conversation maps to one durable session. A new message while Steward is working steers the current turn. |
| Hosting | Vercel (Hobby) | `eve deploy` builds and ships the agent |

## What we wrote

1. **`agent/lib/owner.ts`** (17 lines). `normalizePhone` accepts a full international number and rejects everything else. `isOwner` is true only when both numbers are valid and equal.
2. **`agent/lib/linq-inbound.ts`** (19 lines). The inbound policy: drop Steward's own messages, drop anyone who is not the owner, and give the owner one stable identity, `owner`.
3. **`agent/channels/linq.ts`** (8 lines). Connects the two rented pieces to our policy.

## The decision that matters: who may talk to it

A phone number is public. Anyone can text it. By default eve would start a session for every sender, and each session spends your model budget. From stage 2 on, a session can also read your email. So the allowlist is the first thing built on top of the channel, before any tool exists.

Three details are worth copying:

- **It fails closed.** If `OWNER_PHONE` is missing or malformed, `isOwner` is false for everyone. A configuration mistake locks everyone out instead of letting everyone in. The test "drops everyone when OWNER_PHONE is not configured" pins this down.
- **It runs before the model.** A stranger's message returns `null` from `onMessage`. No session is created and no tokens are spent. It is also never marked as read, so a stranger cannot tell whether the number is an agent.
- **Identity is separate from the phone number.** The owner's principal is `owner`. It is not derived from the phone number. When memory arrives in stage 2 it will belong to `owner`, so it follows you to any channel added later.

## Check that the webhook rejects unsigned requests

The allowlist is only as good as the webhook's signature check. `agent/lib/linq-webhook.ts` accepts a request only when it verifies as the token broker's signed identity, and rejects everything else. Test your own deployment. Both of these must return 401:

```bash
curl -i -X POST https://<your-app>/eve/v1/linq -H 'content-type: application/json' -d '{}'
curl -i -X POST https://<your-app>/eve/v1/linq -H 'content-type: application/json' \
  -H 'authorization: Bearer not-a-real-token' -d '{"event_type":"message.received"}'
```

## What this does not protect against

- **SMS sender spoofing.** iMessage senders are authenticated by Apple. Plain SMS sender IDs can be forged. The Linq line accepts both. For a personal MVP this is an accepted risk, and it is one reason consequential actions will need an approval in stage 3.
- **Group chats.** If the owner adds Steward's number to a group, Steward answers the owner's messages in front of the group. We do not handle this yet.
- **The web route.** eve's HTTP channel is deployed too. In production it rejects everyone, because the scaffold's `placeholderAuth()` refuses to run there. We checked: an unauthenticated request gets a 401.

## Try it

```bash
npm test                 # 12 tests, including the four inbound-policy cases
npm run deploy           # eve deploy
curl https://<your-app>.vercel.app/eve/v1/health
```

Then text the Linq number from the owner's phone, and once from any other phone. The first gets a reply. The second gets silence.

## How the products do this

Companion asks for your phone number at signup and links it to a paid account. That is the same phone-to-identity mapping with billing attached. Instinct adds voice calls on the same number. Muse avoids the problem of spoofable senders because its channels (its own app, WhatsApp) authenticate the user cryptographically. Its approvals also travel on a separate path from the chat, so a forged chat message cannot approve anything.
