import { z } from "zod";

/** What the root agent gets back from one browser task. */
export const resultSchema = z.object({
  status: z.enum(["done", "needs_owner", "needs_approval", "failed"]),
  summary: z.string().describe("What happened, or for needs_owner the one-sentence reason the owner is needed."),
  liveViewUrl: z.string().optional().describe("Kernel live view link. Present while the browser is kept open."),
  pendingAction: z.string().optional().describe("needs_approval only: exactly what the next click will do."),
});

export type BrowserResult = z.infer<typeof resultSchema>;
export type BrowserStatus = BrowserResult["status"];

export interface FinishInput {
  readonly status: BrowserStatus;
  readonly summary: string;
  readonly pendingAction?: string;
}

/** The browser outlives the turn only while the owner still has something to do in it. */
export function keepsBrowserOpen(status: BrowserStatus): boolean {
  return status === "needs_owner" || status === "needs_approval";
}

/**
 * Builds the result from what the worker claims plus what the code knows.
 * The live view link always comes from the session, never from the model.
 */
export function buildResult(input: FinishInput, liveViewUrl: string | null): BrowserResult {
  const summary = input.summary.trim();
  if (!summary) throw new Error("summary is required.");

  if (!keepsBrowserOpen(input.status)) return { status: input.status, summary };

  if (input.status === "needs_owner") {
    if (!liveViewUrl) {
      throw new Error("needs_owner requires an open browser for the owner to take over. Open the page first, or finish with failed.");
    }
    return { status: "needs_owner", summary, liveViewUrl };
  }

  const pendingAction = input.pendingAction?.trim();
  if (!pendingAction) {
    throw new Error("pendingAction is required for needs_approval: say exactly what the next click will do.");
  }
  return { status: "needs_approval", summary, pendingAction, ...(liveViewUrl ? { liveViewUrl } : {}) };
}
