import { defaultLinqAuth, type LinqChannelConfig } from "eve/channels/linq";
import { isOwner } from "./owner";

type OnMessage = NonNullable<LinqChannelConfig["onMessage"]>;

/**
 * Inbound policy for the iMessage thread. Linq puts the sender's phone number
 * (or email handle) in author.userName. Anyone who is not the owner is dropped
 * before a session or a model call exists.
 */
export const ownerOnly: OnMessage = (ctx, message) => {
  if (message.author.isMe) return null;
  if (!isOwner(message.author.userName, process.env.OWNER_PHONE)) return null;
  logOwnerThreadOnce(ctx.thread?.id);
  return {
    // One stable principal, with a constant subject, so memory and token
    // grants belong to the owner whether a turn came from a message or from
    // a schedule (see brief.ts ownerAuth).
    auth: { ...defaultLinqAuth(message), principalId: "owner", subject: "owner" },
  };
};

let loggedThread: string | undefined;

/** The daily brief needs this id as LINQ_OWNER_CHAT_ID. Logged once per process. */
function logOwnerThreadOnce(threadId: string | undefined) {
  if (!threadId || threadId === loggedThread || process.env.LINQ_OWNER_CHAT_ID) return;
  loggedThread = threadId;
  console.info(`[steward] owner thread id: ${threadId.replace(/^linq:/, "")} (set LINQ_OWNER_CHAT_ID to enable the daily brief)`);
}
