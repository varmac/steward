import { defineDynamic, defineInstructions } from "eve/instructions";
import { clockLine, ownerTimeZone } from "../lib/clock";

// Refreshed every turn, as system context, so it never piles up in history.
export default defineDynamic({
  events: {
    "turn.started": () => defineInstructions({ content: clockLine(new Date(), ownerTimeZone(process.env)) }),
  },
});
