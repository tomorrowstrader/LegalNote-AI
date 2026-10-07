import { describe, expect, it } from "vitest";
import {
  attendanceEnquiryRule,
  parseInstructionStatus,
  resolveInstructionsTaken,
} from "./instructionStatus";

describe("instruction status", () => {
  it("keeps an unknown or instructed value as instructed", () => {
    expect(parseInstructionStatus(undefined)).toBe("instructed");
    expect(parseInstructionStatus("instructed")).toBe("instructed");
    expect(parseInstructionStatus("enquiry")).toBe("enquiry");
  });

  it("lets the meeting answer override the matter", () => {
    expect(resolveInstructionsTaken("enquiry", null)).toBe(false);
    expect(resolveInstructionsTaken("enquiry", undefined)).toBe(false);
    expect(resolveInstructionsTaken("enquiry", true)).toBe(true);
    expect(resolveInstructionsTaken("instructed", null)).toBe(true);
    expect(resolveInstructionsTaken("instructed", false)).toBe(false);
  });

  it("writes the enquiry rule only when instructions have not been taken", () => {
    expect(attendanceEnquiryRule(false)).toContain("prospective client");
    expect(attendanceEnquiryRule(false)).toContain("THE FIRM HAS NOT BEEN INSTRUCTED");
    expect(attendanceEnquiryRule(true)).toBe("");
    expect(attendanceEnquiryRule(undefined)).toBe("");
  });
});
