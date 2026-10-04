import { defineAgent } from "eve";

export default defineAgent({
  // Swap this one string to change the model. It routes through Vercel AI Gateway.
  model: "anthropic/claude-sonnet-5",
  // eve enables bash, file and web tools by default. Steward starts with none
  // and opts each capability in as a later stage introduces it.
  defaultTools: false,
  limits: {
    maxTokenCostUsdPerSession: 2,
  },
});
