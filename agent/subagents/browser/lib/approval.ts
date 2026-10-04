/**
 * The "never the last click" check, as pure functions.
 *
 * An approval only counts when it repeats an action this worker already
 * reported with `needs_approval`. That binds every approval to details the
 * worker actually saw on the page (merchant, date, price), so the owner never
 * approves something vaguer than what the button does.
 */
export const APPROVAL_PREFIX = "APPROVED:";

export interface ApprovalVerdict {
  readonly approved: boolean;
  /** Written for the worker model: what to do next. */
  readonly reason: string;
}

/** The approved text of every line that starts with `APPROVED:`. */
export function findApprovedLines(assignment: string): string[] {
  return assignment
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith(APPROVAL_PREFIX))
    .map((line) => line.slice(APPROVAL_PREFIX.length).trim())
    .filter((text) => text.length > 0);
}

/** Case and spacing survive a text-message round trip badly, so ignore them. */
function normalize(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function checkApproval(assignment: string, pendingAction: string | null): ApprovalVerdict {
  if (!pendingAction) {
    return {
      approved: false,
      reason:
        "No action has been reported for approval yet. Stop before the final click and finish with needs_approval and the exact pendingAction.",
    };
  }

  const approvedLines = findApprovedLines(assignment);
  if (approvedLines.length === 0) {
    return {
      approved: false,
      reason: "The assignment has no line starting with APPROVED:. Finish with needs_approval again.",
    };
  }

  // The approval must contain the whole pending action. The reverse would let
  // a vague "APPROVED: place the order" unlock any order.
  const wanted = normalize(pendingAction);
  if (approvedLines.some((line) => normalize(line).includes(wanted))) {
    return {
      approved: true,
      reason:
        "Approved. Re-read the page first: if any detail now differs from the approved text, do not click; finish with needs_approval and the new details.",
    };
  }

  return {
    approved: false,
    reason: `The APPROVED line does not match the pending action. Finish with needs_approval again. Pending action: ${pendingAction}`,
  };
}
