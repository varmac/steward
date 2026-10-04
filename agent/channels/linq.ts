import { connectLinqCredentials } from "@vercel/connect/eve";
import { vercelOidc } from "eve/channels/auth";
import { linqChannel } from "eve/channels/linq";
import { ownerOnly } from "../lib/linq-inbound";
import { rejectUnverified } from "../lib/linq-webhook";
import { deliverQueuedFile } from "../lib/sandbox-attachments";

export default linqChannel({
  credentials: {
    ...connectLinqCredentials(process.env.LINQ_CONNECTOR ?? "linq/steward"),
    // Vercel Connect forwards Linq's webhooks signed with this project's OIDC
    // identity. Accept only requests that verify as that identity.
    webhookVerifier: rejectUnverified(vercelOidc()),
  },
  onMessage: ownerOnly,
  // send_file validates and queues; only the channel holds the thread, so it delivers.
  events: { "action.result": deliverQueuedFile },
});
