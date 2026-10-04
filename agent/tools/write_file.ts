import { defineTool } from "eve/tools";
import { writeFile, type WriteFileToolOutput } from "eve/tools/write_file";
import { gate, withReceipt } from "../lib/gatekeeper";
import { resolveWorkspacePath } from "../lib/sandbox-files";

// eve's built-in sandbox file writer behind the Gatekeeper, narrowed to
// /workspace so that "reversible" stays true: nothing outside the scratch area
// (shell profile, installed skills under $HOME) can be rewritten.
export default defineTool({
  ...writeFile,
  description: `${writeFile.description}\n\nFiles live in your sandbox. Only paths inside /workspace can be written.`,
  approval: gate("write_file"),
  execute: withReceipt("write_file", async (input, ctx) => {
    const filePath = resolveWorkspacePath(input.filePath);
    return (await writeFile.execute({ ...input, filePath }, ctx)) as WriteFileToolOutput;
  }),
});
