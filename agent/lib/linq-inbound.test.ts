import { afterEach, describe, expect, it, vi } from "vitest";
import { ownerOnly } from "./linq-inbound";

type Args = Parameters<typeof ownerOnly>;

function message(author: { userName: string; isMe?: boolean }) {
  return {
    author: { userId: "linq-user-1", fullName: author.userName, isBot: false, isMe: false, ...author },
  } as unknown as Args[1];
}

const ctx = {} as Args[0];

afterEach(() => vi.unstubAllEnvs());

describe("ownerOnly", () => {
  it("accepts the owner and gives them the stable owner principal", async () => {
    vi.stubEnv("OWNER_PHONE", "+14155550123");
    const result = await ownerOnly(ctx, message({ userName: "+1 (415) 555-0123" }));
    expect(result?.auth?.principalId).toBe("owner");
    expect(result?.auth?.principalType).toBe("user");
    // A constant subject lets a scheduled run act as the same principal.
    expect(result?.auth?.subject).toBe("owner");
  });

  it("drops a message from any other number", async () => {
    vi.stubEnv("OWNER_PHONE", "+14155550123");
    expect(await ownerOnly(ctx, message({ userName: "+14155550199" }))).toBeNull();
  });

  it("drops everyone when OWNER_PHONE is not configured", async () => {
    vi.stubEnv("OWNER_PHONE", "");
    expect(await ownerOnly(ctx, message({ userName: "+14155550123" }))).toBeNull();
  });

  it("drops Steward's own outbound messages", async () => {
    vi.stubEnv("OWNER_PHONE", "+14155550123");
    expect(await ownerOnly(ctx, message({ userName: "+14155550123", isMe: true }))).toBeNull();
  });
});
