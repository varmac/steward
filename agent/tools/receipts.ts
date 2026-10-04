import { defineTool } from "eve/tools";
import { z } from "zod";
import { gate, withReceipt } from "../lib/gatekeeper";
import { recentReceipts } from "../lib/receipts";

export default defineTool({
  description:
    "List what Steward actually did recently, from the append-only receipts log. Use it when the owner asks what you did, sent, changed or tried. By default it lists actions that changed something; set includeReads to also list searches and reads.",
  inputSchema: z.object({
    sinceHours: z.number().int().min(1).max(720).default(24),
    includeReads: z.boolean().default(false),
  }),
  approval: gate("receipts"),
  execute: withReceipt("receipts", async ({ sinceHours, includeReads }) => {
    const rows = await recentReceipts(sinceHours, includeReads);
    if (rows === null) return { available: false, reason: "No receipts database is configured in this environment." };
    return { available: true, receipts: rows };
  }),
});
