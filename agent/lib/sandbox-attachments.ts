import type { LinqChannelConfig } from "eve/channels/linq";
import { MAX_SEND_BYTES, readCapped } from "./sandbox-files";

/** What the send_file tool returns. The Linq channel turns it into an attachment. */
export interface QueuedFile {
  readonly queued: true;
  readonly path: string;
  readonly filename: string;
  readonly bytes: number;
  readonly caption: string | null;
}

type OnActionResult = NonNullable<NonNullable<LinqChannelConfig["events"]>["action.result"]>;

// The slice of the Chat SDK thread used here. eve ships the Chat SDK without
// its type files, so `channel.thread` would otherwise be `any`.
interface LinqThread {
  readonly id: string;
  readonly adapter: {
    postMessage(threadId: string, message: { markdown: string; files: { data: Uint8Array; filename: string }[] }, options: { idempotencyKey: string }): Promise<unknown>;
  };
  post(message: string): Promise<unknown>;
}

/**
 * Channel half of send_file, registered as the Linq channel's `action.result`
 * handler. A tool has no handle on the conversation it runs in; only channel
 * event handlers receive the thread. So the tool validates and describes the
 * file, and this handler reads the bytes from the sandbox and posts them. The
 * Linq adapter uploads them through Linq's pre-signed attachment API, so no
 * public file hosting is involved.
 */
export const deliverQueuedFile: OnActionResult = async (event, channel, ctx) => {
  const { result } = event;
  if (result.kind !== "tool-result" || result.toolName !== "send_file" || event.status !== "completed") return;
  const thread = channel.thread as LinqThread | null;
  if (!thread) return;
  const file = result.output as unknown as QueuedFile;
  try {
    const stream = await (await ctx.getSandbox()).readFile({ path: file.path });
    if (!stream) throw new Error("the file is no longer in the sandbox");
    const data = await readCapped(stream, MAX_SEND_BYTES);
    // Event handlers can run more than once for one event. The call id lets
    // Linq drop a repeat instead of sending the file twice.
    const options = { idempotencyKey: `send_file-${result.callId}` };
    await thread.adapter.postMessage(thread.id, { markdown: file.caption ?? file.filename, files: [{ data, filename: file.filename }] }, options);
  } catch (error) {
    // eve logs and swallows errors thrown by channel event handlers, and the
    // model was already told "queued", so the owner has to hear about it here.
    await thread.post(`I could not attach ${file.filename}: ${error instanceof Error ? error.message : String(error)}`);
  }
};
