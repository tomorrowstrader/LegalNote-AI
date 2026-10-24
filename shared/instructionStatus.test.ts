import { describe, expect, it } from "vitest";
import {
  attendanceEnquiryRule,
  parseInstructionStatus,
  resolveInstructionsTaken,
} from "./instructionStatus";

describe("instruction status", () => {
  it("keeps an unknown value as instructed, and recognises not_applicable", () => {
    expect(parseInstructionStatus(undefined)).toBe("instructed");
    expect(parseInstructionStatus("instructed")).toBe("instructed");
    expect(parseInstructionStatus("enquiry")).toBe("enquiry");
    expect(parseInstructionStatus("not_applicable")).toBe("not_applicable");
  });

  it("lets the meeting answer override the matter", () => {
    expect(resolveInstructionsTaken("enquiry", null)).toBe(false);
    expect(resolveInstructionsTaken("enquiry", undefined)).toBe(false);
    expect(resolveInstructionsTaken("enquiry", true)).toBe(true);
    expect(resolveInstructionsTaken("instructed", null)).toBe(true);
    expect(resolveInstructionsTaken("instructed", false)).toBe(false);
    expect(resolveInstructionsTaken("not_applicable", null)).toBe(true);
    expect(resolveInstructionsTaken("not_applicable", false)).toBe(false);
  });

  it("writes the enquiry rule only when instructions have not been taken", () => {
    expect(attendanceEnquiryRule(false)).toContain("prospective client");
    expect(attendanceEnquiryRule(false)).toContain("THE FIRM HAS NOT BEEN INSTRUCTED");
    expect(attendanceEnquiryRule(true)).toBe("");
    expect(attendanceEnquiryRule(undefined)).toBe("");
  });
});
