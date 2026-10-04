import { defineEval } from "eve/evals";

export default defineEval({
  description: "A website task is delegated to the browser worker, and the delegation is accepted.",
  tags: ["stage-4", "browser"],
  timeoutMs: 240_000,
  async test(t) {
    await t.send("Use the browser to open https://example.com and tell me the page heading.");
    t.calledSubagent("browser");
    t.noFailedActions();
  },
});
