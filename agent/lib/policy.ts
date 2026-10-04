/**
 * The policy table. Every tool Steward can call is listed here with an action
 * class. The Gatekeeper reads this table; tools do not decide their own risk.
 *
 * - observe:       reads only. Never needs approval.
 * - reversible:    changes something that can be undone. Auto-allowed until the
 *                  session has read untrusted content, then needs approval.
 * - consequential: reaches other people or cannot be undone. Always needs approval.
 *
 * `untrusted: true` marks tools whose output is written by third parties (web
 * pages, email bodies, repository content). Calling one taints the session.
 */
export type ActionClass = "observe" | "reversible" | "consequential";

export interface ToolPolicy {
  readonly class: ActionClass;
  readonly untrusted?: boolean;
}

export const POLICY: Readonly<Record<string, ToolPolicy>> = {
  // Stage 2: read-only tools
  web_search: { class: "observe", untrusted: true },
  web_fetch: { class: "observe", untrusted: true },
  gmail_search: { class: "observe", untrusted: true },
  gmail_read_thread: { class: "observe", untrusted: true },
  calendar_list_events: { class: "observe", untrusted: true },
  // Stage 3: first tools with side effects
  receipts: { class: "observe" },
  gmail_send: { class: "consequential" },
  calendar_create_event: { class: "consequential" },
  // Stage 4: delegating to the browser worker. Starting it changes nothing by
  // itself, and what it reports back was read from web pages. The worker stops
  // before any consequential click and needs an APPROVED line to continue.
  browser: { class: "observe", untrusted: true },
  // Stage 5: the sandbox computer
  bash: { class: "reversible", untrusted: true },
  read_file: { class: "observe", untrusted: true },
  write_file: { class: "reversible" },
  send_file: { class: "reversible" },
  // An arbitrary GET can carry data out in its URL, so it needs approval once tainted.
  download_file: { class: "reversible", untrusted: true },
};

/** GitHub's MCP server is asked for read-only tools (see agent/connections/github.ts). */
const GITHUB_READ: ToolPolicy = { class: "observe", untrusted: true };

/** Tools that run outside our process, so a hook writes their receipt and taint. */
export function isGatedElsewhere(toolName: string): boolean {
  return toolName === "web_search" || toolName.startsWith("github__");
}

/** Fail-safe default: a tool missing from the table is treated as consequential. */
export function policyFor(toolName: string): ToolPolicy {
  if (toolName.startsWith("github__")) return GITHUB_READ;
  return POLICY[toolName] ?? { class: "consequential", untrusted: true };
}

export type Decision = "allow" | "ask";

/** The whole authorisation rule, as a pure function. */
export function decide(toolName: string, sessionTainted: boolean): Decision {
  const { class: actionClass } = policyFor(toolName);
  if (actionClass === "observe") return "allow";
  if (actionClass === "reversible") return sessionTainted ? "ask" : "allow";
  return "ask";
}
