import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

const markdownMarkers = /(^|\n)\s*(#{1,6}\s|[-*]\s|\d+\.\s)|\*\*|`/;

export default defineEval({
  description: "A greeting gets a short, plain-text reply and no tool calls.",
  tags: ["stage-0", "smoke"],
  async test(t) {
    await t.send("hey, you there?");
    t.succeeded();
    t.usedNoTools();
    t.check(
      t.reply,
      satisfies<string>((reply) => reply.length > 0 && reply.length <= 300, "reply is at most 300 characters"),
    );
    t.check(
      t.reply,
      satisfies<string>((reply) => !markdownMarkers.test(reply), "reply contains no Markdown"),
    );
  },
});
