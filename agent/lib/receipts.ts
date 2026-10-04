import { createHash } from "node:crypto";
import pg from "pg";
import { policyFor, type ActionClass } from "./policy";

export interface Receipt {
  readonly sessionId: string;
  readonly tool: string;
  readonly actionClass: ActionClass;
  readonly payloadHash: string;
  /** Stored for reversible and consequential actions only. Reads keep the hash alone. */
  readonly payload: unknown | null;
  readonly outcome: "started" | "ok" | "error";
  readonly detail: string | null;
}

/** Stable JSON: object keys sorted, so the same payload always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

export function buildReceipt(
  sessionId: string,
  tool: string,
  payload: unknown,
  outcome: Receipt["outcome"],
  detail: string | null = null,
): Receipt {
  const actionClass = policyFor(tool).class;
  return {
    sessionId,
    tool,
    actionClass,
    payloadHash: hashPayload(payload),
    payload: actionClass === "observe" ? null : payload,
    outcome,
    detail: detail === null ? null : detail.slice(0, 500),
  };
}

let pool: pg.Pool | undefined;

function database(): pg.Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  pool ??= new pg.Pool({ connectionString: url, max: 2 });
  return pool;
}

const CREATE_TABLE = `
  create table if not exists receipts (
    id bigint generated always as identity primary key,
    at timestamptz not null default now(),
    session_id text not null,
    tool text not null,
    action_class text not null,
    payload_hash text not null,
    payload jsonb,
    outcome text not null,
    detail text
  )`;

let tableReady: Promise<unknown> | undefined;

/** Appends one receipt. Without DATABASE_URL (local dev) it logs instead. */
export async function writeReceipt(receipt: Receipt): Promise<void> {
  const db = database();
  if (!db) {
    console.info("[receipt]", JSON.stringify({ ...receipt, payload: undefined }));
    return;
  }
  tableReady ??= db.query(CREATE_TABLE);
  await tableReady;
  await db.query(
    `insert into receipts (session_id, tool, action_class, payload_hash, payload, outcome, detail)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      receipt.sessionId,
      receipt.tool,
      receipt.actionClass,
      receipt.payloadHash,
      receipt.payload === null ? null : JSON.stringify(receipt.payload),
      receipt.outcome,
      receipt.detail,
    ],
  );
}

export interface ReceiptRow {
  at: string;
  tool: string;
  action_class: string;
  outcome: string;
  detail: string | null;
  payload: unknown;
}

/** Recent actions that changed something, newest first. Reads are left out unless asked for. */
export async function recentReceipts(sinceHours: number, includeReads: boolean): Promise<ReceiptRow[] | null> {
  const db = database();
  if (!db) return null;
  tableReady ??= db.query(CREATE_TABLE);
  await tableReady;
  const result = await db.query<ReceiptRow>(
    `select at, tool, action_class, outcome, detail, payload from receipts
     where at > now() - make_interval(hours => $1)
       and outcome <> 'started'
       and ($2 or action_class <> 'observe')
     order by at desc limit 50`,
    [sinceHours, includeReads],
  );
  return result.rows;
}
