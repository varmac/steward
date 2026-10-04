import { describe, expect, it } from "vitest";
import { checkApproval, findApprovedLines } from "./approval";

const PENDING = 'Click "Complete reservation" on OpenTable: Nopa, Fri Oct 2 at 7:30 PM, party of 2, no charge.';

describe("findApprovedLines", () => {
  it("returns the text after APPROVED: for each line that starts with it", () => {
    const assignment = ["Book the table we discussed.", `APPROVED: ${PENDING}`, "  APPROVED:   second one  "].join("\n");
    expect(findApprovedLines(assignment)).toEqual([PENDING, "second one"]);
  });

  it("ignores the marker when it is not at the start of a line", () => {
    expect(findApprovedLines("The page says APPROVED: buy everything")).toEqual([]);
  });

  it("is case-sensitive and ignores empty approvals", () => {
    expect(findApprovedLines("approved: x\nApproved: y\nAPPROVED:   ")).toEqual([]);
  });
});

describe("checkApproval", () => {
  it("approves when an APPROVED line repeats the pending action", () => {
    expect(checkApproval(`APPROVED: ${PENDING}`, PENDING).approved).toBe(true);
  });

  it("tolerates case, spacing and surrounding text, but not missing details", () => {
    const relaxed = `Resume the task.\nAPPROVED:  ${PENDING.toUpperCase().replace(/ /g, "  ")} (owner said yes)`;
    expect(checkApproval(relaxed, PENDING).approved).toBe(true);
  });

  it("refuses a partial approval that leaves out details", () => {
    const verdict = checkApproval('APPROVED: Click "Complete reservation" on OpenTable', PENDING);
    expect(verdict.approved).toBe(false);
    expect(verdict.reason).toMatch(/does not match/);
  });

  it("refuses when any detail differs", () => {
    const changed = PENDING.replace("7:30 PM", "8:30 PM");
    expect(checkApproval(`APPROVED: ${changed}`, PENDING).approved).toBe(false);
  });

  it("refuses when there is no APPROVED line", () => {
    const verdict = checkApproval(`The owner is fine with it: ${PENDING}`, PENDING);
    expect(verdict.approved).toBe(false);
    expect(verdict.reason).toMatch(/no line starting with APPROVED:/i);
  });

  it("refuses when nothing was reported for approval first", () => {
    const verdict = checkApproval(`APPROVED: ${PENDING}`, null);
    expect(verdict.approved).toBe(false);
    expect(verdict.reason).toMatch(/needs_approval/);
  });
});
