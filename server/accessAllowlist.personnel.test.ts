import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

describe("isLegalNotePersonnel", () => {
  const originalAdmin = process.env.ADMIN_USER_ID;
  const originalPersonnel = process.env.LEGALNOTE_PERSONNEL_USER_IDS;

  beforeEach(() => {
    vi.resetModules();
    process.env.ADMIN_USER_ID = "admin-user-1";
    delete process.env.LEGALNOTE_PERSONNEL_USER_IDS;
  });

  afterEach(() => {
    if (originalAdmin === undefined) delete process.env.ADMIN_USER_ID;
    else process.env.ADMIN_USER_ID = originalAdmin;
    if (originalPersonnel === undefined) delete process.env.LEGALNOTE_PERSONNEL_USER_IDS;
    else process.env.LEGALNOTE_PERSONNEL_USER_IDS = originalPersonnel;
  });

  it("treats ADMIN_USER_ID as LegalNote personnel", async () => {
    const { isLegalNotePersonnel } = await import("./accessAllowlist");
    expect(isLegalNotePersonnel("admin-user-1")).toBe(true);
    expect(isLegalNotePersonnel("firm-user-9")).toBe(false);
  });

  it("includes optional LEGALNOTE_PERSONNEL_USER_IDS", async () => {
    process.env.LEGALNOTE_PERSONNEL_USER_IDS = "staff-a, staff-b";
    const { isLegalNotePersonnel } = await import("./accessAllowlist");
    expect(isLegalNotePersonnel("staff-a")).toBe(true);
    expect(isLegalNotePersonnel("staff-b")).toBe(true);
    expect(isLegalNotePersonnel("firm-user-9")).toBe(false);
  });
});
