import { defineTool } from "eve/tools";
import { z } from "zod";
import { gate, withReceipt } from "../lib/gatekeeper";
import { withGoogle } from "../lib/google";
import { buildRawMessage } from "../lib/mime";

export default defineTool({
  description:
    "Send a plain-text email from the owner's Gmail account. The owner must approve every send. To reply inside a thread, pass that thread's `threadId`, the `messageId` of the message being answered as `inReplyTo`, and keep its subject (prefixed with `Re: `).",
  inputSchema: z.object({
    to: z.array(z.email()).min(1),
    cc: z.array(z.email()).optional(),
    subject: z.string().min(1).max(250),
    body: z.string().min(1).describe("Plain text."),
    threadId: z.string().optional(),
    inReplyTo: z.string().optional().describe("Message-ID header of the message being replied to."),
  }),
  label: { start: ({ to, subject }) => `Send email to ${to.join(", ")}: ${subject}` },
  approval: gate("gmail_send"),
  execute: withReceipt("gmail_send", async ({ threadId, ...message }, ctx) =>
    withGoogle(ctx, async ({ gmail }) => {
      // buildRawMessage refuses header injection before anything reaches Google.
      const raw = buildRawMessage(message);
      const { data } = await gmail.users.messages.send({ userId: "me", requestBody: { raw, threadId } });
      return { sent: true, id: data.id ?? "", threadId: data.threadId ?? "" };
    }),
  ),
});
