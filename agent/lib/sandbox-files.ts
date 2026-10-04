import { posix } from "node:path";

export const WORKSPACE_ROOT = "/workspace";

/** Attachment cap for send_file. Linq accepts more, but a text thread should not carry more. */
export const MAX_SEND_BYTES = 8 * 1024 * 1024;

/**
 * Turns a path the model supplied into an absolute path to a file inside
 * /workspace, or throws. The check is lexical: it stops `..` and absolute-path
 * escapes. A symlink could still point elsewhere in the sandbox, which is
 * acceptable because the sandbox holds no secrets; the boundary that matters is
 * the sandbox itself.
 */
export function resolveWorkspacePath(input: string): string {
  const resolved = input.includes("\0") ? "" : posix.resolve(WORKSPACE_ROOT, input);
  if (!resolved.startsWith(`${WORKSPACE_ROOT}/`)) {
    throw new Error(`Path must point to a file inside ${WORKSPACE_ROOT}: ${JSON.stringify(input)}`);
  }
  return resolved;
}

// The Linq adapter labels an upload by its extension and refuses ones it does
// not know. Checking here lets the model fix the name instead of failing later.
const SENDABLE = new Set(["png", "jpg", "jpeg", "gif", "webp", "pdf", "csv", "txt", "json", "html", "zip", "xlsx", "docx"]);

/** File name to show in the thread. Throws for a type that cannot go out as an attachment. */
export function sendableName(absolutePath: string): string {
  const name = posix.basename(absolutePath);
  const extension = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  if (!SENDABLE.has(extension)) {
    throw new Error(`${name} cannot be sent. Supported types: ${[...SENDABLE].join(", ")}.`);
  }
  return name;
}

/** Reads a byte stream into memory, giving up as soon as it passes `maxBytes`. */
export async function readCapped(stream: ReadableStream<Uint8Array>, maxBytes: number): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = stream.getReader();
  for (let next = await reader.read(); !next.done; next = await reader.read()) {
    total += next.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`File is larger than the ${Math.floor(maxBytes / (1024 * 1024))} MB limit.`);
    }
    chunks.push(next.value);
  }
  return Buffer.concat(chunks);
}
