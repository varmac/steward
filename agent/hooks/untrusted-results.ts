import { defineHook } from "eve/hooks";
import { taint } from "../lib/gatekeeper";
import { isGatedElsewhere, policyFor } from "../lib/policy";
import { buildReceipt, writeReceipt } from "../lib/receipts";

/**
 * Two kinds of tool never reach withReceipt(): web_search runs inside the model
 * provider, and GitHub tools run on GitHub's MCP server. This hook sees their
 * results on the event stream and does the two things withReceipt would have
 * done: taint the session and leave a receipt.
 */
export default defineHook({
  events: {
    async "action.result"(event, ctx) {
      const { result, status } = event.data;
      if (result.kind !== "tool-result" || !isGatedElsewhere(result.toolName)) return;
      if (policyFor(result.toolName).untrusted) {
        taint.update((state) => (state.tainted ? state : { tainted: true, firstSource: result.toolName }));
      }
      const outcome = status === "completed" ? "ok" : "error";
      await writeReceipt(buildReceipt(ctx.session.id, result.toolName, { callId: result.callId }, outcome)).catch((error) =>
        console.error("[receipt] write failed", error instanceof Error ? error.message : error),
      );
    },
  },
});
