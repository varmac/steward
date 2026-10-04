import { defineState } from "eve/context";
import type { SessionContext, ToolContext } from "eve/tools";
import { decide, policyFor } from "./policy";
import { buildReceipt, writeReceipt } from "./receipts";

/**
 * Session taint. It becomes true the first time the session reads content a
 * third party wrote, and it never resets within that session. While tainted,
 * reversible actions lose their automatic approval.
 */
export const taint = defineState("steward.taint", () => ({ tainted: false, firstSource: null as string | null }));

/**
 * Approval policy for a tool. Use as `approval: gate("tool_name")`.
 * The model decides to call a tool. This function, not the model, decides
 * whether the owner must approve the call first.
 */
export function gate(toolName: string) {
  return ({ session }: Pick<SessionContext, "session">) => {
    // A scheduled run has nobody watching. It may read, and nothing else.
    if (isScheduledTurn(session) && policyFor(toolName).class !== "observe") {
      return { type: "denied" as const, reason: "Scheduled runs are read-only. Ask the owner in the thread instead." };
    }
    return decide(toolName, taint.get().tainted) === "ask" ? ("user-approval" as const) : ("not-applicable" as const);
  };
}

function isScheduledTurn(session: SessionContext["session"]): boolean {
  const trigger = session.auth.current?.attributes.trigger;
  return typeof trigger === "string" && trigger.startsWith("schedule:");
}

/**
 * Wraps a tool's execute function. Use as
 * `execute: withReceipt("tool_name", async (input, ctx) => { ... })`.
 *
 * Every call leaves a receipt. For anything that is not a read, a "started"
 * receipt must be written before the action runs: no receipt, no action.
 */
export function withReceipt<TInput, TOutput>(
  toolName: string,
  execute: (input: TInput, ctx: ToolContext) => Promise<TOutput>,
): (input: TInput, ctx: ToolContext) => Promise<TOutput> {
  return async (input, ctx) => {
    const policy = policyFor(toolName);
    const sessionId = ctx.session.id;
    if (policy.class !== "observe") {
      await writeReceipt(buildReceipt(sessionId, toolName, input, "started"));
    }
    try {
      const output = await execute(input, ctx);
      if (policy.untrusted) {
        taint.update((state) => (state.tainted ? state : { tainted: true, firstSource: toolName }));
      }
      await writeReceipt(buildReceipt(sessionId, toolName, input, "ok")).catch(logReceiptFailure);
      return output;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await writeReceipt(buildReceipt(sessionId, toolName, input, "error", detail)).catch(logReceiptFailure);
      throw error;
    }
  };
}

function logReceiptFailure(error: unknown) {
  console.error("[receipt] write failed", error instanceof Error ? error.message : error);
}
