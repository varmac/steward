import { defineTool } from "eve/tools";
import { z } from "zod";
import { gate, withReceipt } from "../lib/gatekeeper";
import type { QueuedFile } from "../lib/sandbox-attachments";
import { MAX_SEND_BYTES, readCapped, resolveWorkspacePath, sendableName } from "../lib/sandbox-files";

// This tool is the checkpoint: path guard, type check, size cap, approval and
// receipt. The bytes leave through the Linq channel's `action.result` handler
// (agent/lib/sandbox-attachments.ts), because only the channel holds the thread.
export default defineTool({
  description:
    "Send one file from your sandbox to the owner as an attachment in the iMessage thread, for example a chart (PNG) or a table (CSV). The path must be inside /workspace and the file at most 8 MB. The result says `queued`: the channel delivers the attachment right after this call, and tells the owner itself if delivery fails. Outside the iMessage thread (local development) nothing is delivered.",
  inputSchema: z.object({
    path: z.string().min(1).describe("File inside /workspace, absolute or relative to /workspace."),
    caption: z.string().max(300).optional().describe("One short line of plain text shown with the file."),
  }),
  label: { start: ({ path }) => `Send file: ${path}` },
  approval: gate("send_file"),
  execute: withReceipt("send_file", async ({ path, caption }, ctx): Promise<QueuedFile> => {
    const absolute = resolveWorkspacePath(path);
    const filename = sendableName(absolute);
    const sandbox = await ctx.getSandbox();
    const stream = await sandbox.readFile({ path: absolute, abortSignal: ctx.abortSignal });
    if (!stream) throw new Error(`No file at ${absolute}.`);
    // Reading through the cap checks the size without trusting the sandbox to report it.
    const { byteLength } = await readCapped(stream, MAX_SEND_BYTES);
    if (byteLength === 0) throw new Error(`${absolute} is empty.`);
    return { queued: true, path: absolute, filename, bytes: byteLength, caption: caption ?? null };
  }),
});
