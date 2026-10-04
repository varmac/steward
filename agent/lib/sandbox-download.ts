import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import type { ToolContext } from "eve/tools";
import { readCapped, resolveWorkspacePath } from "./sandbox-files";

/**
 * Downloads for the sandbox happen here, in the app runtime, not inside the
 * sandbox. The sandbox firewall can only allow named domains, so letting it
 * reach "any https URL" would mean opening all egress to untrusted code. This
 * way the sandbox stays limited to package registries and one audited function
 * touches the open internet.
 */
export const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;
const MAX_REDIRECTS = 5;

// Destinations a caller-supplied URL must never reach (SSRF): loopback,
// private, carrier NAT, link-local (cloud metadata), multicast and reserved.
const blocked = new BlockList();
for (const [network, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.168.0.0", 16], ["224.0.0.0", 3]] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [["::", 127], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

export function isPublicAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 0) return false;
  // BlockList also matches IPv4-mapped IPv6 (::ffff:10.0.0.1) against the IPv4 rules.
  return !blocked.check(ip, family === 4 ? "ipv4" : "ipv6");
}

export function parseDownloadUrl(raw: string): URL {
  const url = URL.canParse(raw) ? new URL(raw) : null;
  if (url?.protocol !== "https:") throw new Error("Only https URLs can be downloaded.");
  if (url.username || url.password) throw new Error("URLs with embedded credentials are not allowed.");
  if (url.port) throw new Error("Only the default https port is allowed.");
  return url;
}

type Resolver = (hostname: string) => Promise<readonly { address: string }[]>;

/** Throws unless every address the host resolves to is public. */
export async function assertPublicHost(hostname: string, resolve: Resolver = (host) => lookup(host, { all: true })): Promise<void> {
  const literal = hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(literal) ? [literal] : (await resolve(hostname)).map((entry) => entry.address);
  if (addresses.length === 0 || !addresses.every(isPublicAddress)) {
    throw new Error(`${hostname} is not a public internet host.`);
  }
}

/**
 * Fetches a public https URL and writes it into /workspace. Redirects are
 * followed by hand so that every hop gets the same checks. Residual risk: the
 * host is resolved again by fetch, so DNS rebinding between check and connect
 * is not closed here.
 */
export async function downloadToWorkspace(input: { url: string; path: string }, ctx: ToolContext) {
  const path = resolveWorkspacePath(input.path);
  let url = parseDownloadUrl(input.url);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url.hostname);
    const response = await fetch(url, { redirect: "manual", signal: ctx.abortSignal });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      url = parseDownloadUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok || !response.body) throw new Error(`Download failed with HTTP ${response.status}.`);
    const bytes = await readCapped(response.body, MAX_DOWNLOAD_BYTES);
    const sandbox = await ctx.getSandbox();
    await sandbox.writeBinaryFile({ path, content: bytes });
    // Only our own facts go back to the model. The body stays in the sandbox
    // until bash or read_file opens it, and those calls taint the session.
    return { path, bytes: bytes.byteLength };
  }
  throw new Error("Too many redirects.");
}
