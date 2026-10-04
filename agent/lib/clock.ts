const DEFAULT_TIME_ZONE = "America/Los_Angeles";

/** The owner's IANA time zone from OWNER_TIMEZONE, or Pacific time when unset or invalid. */
export function ownerTimeZone(env: { OWNER_TIMEZONE?: string }): string {
  const zone = env.OWNER_TIMEZONE;
  if (!zone) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone });
    return zone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function longDate(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" })
    .format(at)
    .replace(/^(\w+) /, "$1, ");
}

function utcOffset(at: Date, timeZone: string): string {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((part) => part.type === "timeZoneName")?.value;
  return name === "GMT" || !name ? "UTC+00:00" : name.replace("GMT", "UTC");
}

/**
 * A model has no clock. Without this line "tomorrow" is a guess. It states
 * today and tomorrow outright, because models are unreliable at date arithmetic.
 */
export function clockLine(now: Date, timeZone: string): string {
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(now);
  // 24 hours on from "now" lands on the next local date in every zone except
  // during a DST change, where it can be off by an hour but not by a day.
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return [
    `It is ${longDate(now, timeZone)}, ${time} for the owner (${timeZone}, ${utcOffset(now, timeZone)}).`,
    `Tomorrow is ${longDate(tomorrow, timeZone)}.`,
    "Resolve every relative date (today, tomorrow, Friday, next week) from these lines, and pass times to tools with this UTC offset.",
  ].join(" ");
}
