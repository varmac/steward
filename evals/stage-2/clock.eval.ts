import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  description: "Knows today's date in the owner's time zone, so 'tomorrow' is not a guess.",
  tags: ["stage-2", "clock"],
  async test(t) {
    await t.send("What day of the week is it tomorrow? One word.");
    t.succeeded();
    const zone = process.env.OWNER_TIMEZONE ?? "America/Los_Angeles";
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "long" }).format(tomorrow);
    t.check(t.reply, includes(weekday));
  },
});
