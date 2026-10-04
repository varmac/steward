/**
 * Builds the RFC 5322 message that Gmail's `messages.send` expects in `raw`.
 * Pure on purpose: everything that could let a model smuggle extra headers into
 * an outgoing email is decided here, where it can be tested without a network.
 */
export interface OutgoingMessage {
  readonly to: readonly string[];
  readonly cc?: readonly string[];
  readonly subject: string;
  /** Plain text. */
  readonly body: string;
  /** Message-ID of the message being replied to, for example "<abc@mail.example.com>". */
  readonly inReplyTo?: string;
}

/** Returns the whole message, base64url-encoded. Gmail fills in From and Date. */
export function buildRawMessage(message: OutgoingMessage): string {
  if (message.to.length === 0) throw new Error("An email needs at least one recipient.");

  const headers = [`To: ${message.to.map((address) => headerSafe("to", address)).join(", ")}`];
  if (message.cc?.length) headers.push(`Cc: ${message.cc.map((address) => headerSafe("cc", address)).join(", ")}`);
  headers.push(`Subject: ${encodeSubject(headerSafe("subject", message.subject))}`);
  if (message.inReplyTo) {
    const parent = headerSafe("inReplyTo", message.inReplyTo);
    headers.push(`In-Reply-To: ${parent}`, `References: ${parent}`);
  }
  headers.push("MIME-Version: 1.0", 'Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: base64");

  // A base64 body sidesteps the 998-character line limit and 8-bit transport issues.
  const body = Buffer.from(message.body, "utf8").toString("base64").replace(/.{76}(?=.)/g, "$&\r\n");
  return Buffer.from(`${headers.join("\r\n")}\r\n\r\n${body}`, "utf8").toString("base64url");
}

/**
 * A CR or LF inside a header value starts a new header, which is how "Bcc:" gets
 * injected. Refuse instead of stripping, so the caller sees the attempt.
 */
function headerSafe(field: string, value: string): string {
  if (/[\r\n]/.test(value)) throw new Error(`The ${field} value must not contain a line break.`);
  return value.trim();
}

/** RFC 2047: non-ASCII header text travels as =?UTF-8?B?...?= words of at most 75 characters. */
function encodeSubject(subject: string): string {
  if (/^[\x20-\x7e]*$/.test(subject)) return subject;
  const words: string[] = [];
  let chunk = "";
  // Iterating by code point keeps a multi-byte character inside one word.
  for (const char of subject) {
    // 45 bytes become 60 base64 characters; with the 12-character wrapper that is 72.
    if (Buffer.byteLength(chunk + char, "utf8") > 45) {
      words.push(chunk);
      chunk = "";
    }
    chunk += char;
  }
  words.push(chunk);
  return words.map((word) => `=?UTF-8?B?${Buffer.from(word, "utf8").toString("base64")}?=`).join("\r\n ");
}
