const E164 = /^\+[1-9]\d{6,14}$/;

/** Returns the number in E.164 form, or null when it is not a full international number. */
export function normalizePhone(value: string | undefined): string | null {
  if (!value) return null;
  const compact = value.replace(/[\s().-]/g, "");
  return E164.test(compact) ? compact : null;
}

/**
 * Steward serves one person. A sender is the owner only when both numbers are
 * valid and equal, so a missing or malformed OWNER_PHONE locks everyone out.
 */
export function isOwner(sender: string | undefined, ownerPhone: string | undefined): boolean {
  const owner = normalizePhone(ownerPhone);
  return owner !== null && normalizePhone(sender) === owner;
}
