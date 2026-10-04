import { defineTool } from "eve/tools";
import { z } from "zod";
import { buildResult, keepsBrowserOpen, resultSchema } from "../lib/result";
import { releaseBrowser, workerState } from "../lib/session";

/**
 * The worker's last call in every turn. Ending through a tool makes the browser
 * lifecycle deterministic: code, not the model, decides whether the browser is
 * deleted, and the live view link comes from the session rather than from memory.
 */
export default defineTool({
  description:
    "End the task. Always your last tool call. Returns the final result object, which you then give as your answer unchanged. done and failed close the browser; needs_owner and needs_approval keep it open for the owner.",
  inputSchema: z.object({
    status: resultSchema.shape.status,
    summary: z.string().describe("What happened. For needs_owner, one sentence saying what the owner must do in the browser."),
    pendingAction: z
      .string()
      .optional()
      .describe("needs_approval only. Exactly what the next click does: site, button, item, date and time, party size, total price."),
  }),
  outputSchema: resultSchema,
  async execute(input) {
    const result = buildResult(input, workerState.get().liveViewUrl);
    const keepOpen = keepsBrowserOpen(result.status);

    // Remember what was put to the owner, so a later APPROVED line can be checked against it.
    workerState.update((state) => ({ ...state, pendingAction: result.pendingAction ?? null }));
    await releaseBrowser(keepOpen);
    return result;
  },
});
