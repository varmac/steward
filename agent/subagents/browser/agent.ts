import { defineAgent } from "eve";
import { resultSchema } from "./lib/result";

export default defineAgent({
  // The root agent reads this to decide when to delegate, and how.
  description:
    "Does ONE bounded task on websites in a cloud browser that keeps the owner's logins: look something up, fill a form, prepare a booking or order. Put everything it needs in `message`; it cannot see this conversation or talk to the owner. It returns { status, summary, liveViewUrl?, pendingAction? }. needs_owner: text the owner the liveViewUrl and the summary, and when they say they are finished, call again with the same agentId. needs_approval: ask the owner about pendingAction, and only after a clear yes call again with the same agentId and a line `APPROVED: <pendingAction copied verbatim>`. It never types passwords or card numbers. Run one browser task at a time.",
  model: "anthropic/claude-sonnet-5",
  // No bash, file or web tools. The worker's whole surface is tools/.
  defaultTools: false,
  // The result contract. eve applies it to a fresh delegation; the instructions
  // repeat it so a resumed turn answers in the same shape.
  outputSchema: resultSchema,
  build: {
    // browser-loop pulls in sharp, a native addon that must not be bundled.
    externalDependencies: ["@onkernel/browser-loop", "sharp"],
  },
});
