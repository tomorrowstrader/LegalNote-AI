import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./accessAllowlist", () => ({
  isLegalNotePersonnel: vi.fn(),
}));

vi.mock("./auditMiddleware", () => ({
  logAuditEvent: vi.fn(),
}));

import { isLegalNotePersonnel } from "./accessAllowlist";
import { logAuditEvent } from "./auditMiddleware";
import { logPersonnelMatterAccess } from "./personnelAccessAudit";

describe("logPersonnelMatterAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not audit firm users", async () => {
    vi.mocked(isLegalNotePersonnel).mockReturnValue(false);
    await logPersonnelMatterAccess({
      userId: "firm-user",
      caseId: "case-1",
      resource: "case",
    });
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it("writes personnel_matter_accessed for LegalNote staff", async () => {
    vi.mocked(isLegalNotePersonnel).mockReturnValue(true);
    await logPersonnelMatterAccess({
      userId: "admin-user",
      caseId: "case-1",
      resource: "transcript",
      transcriptId: "tr-1",
      reason: "support ticket 42",
    });
    expect(logAuditEvent).toHaveBeenCalledWith(
      "admin-user",
      "personnel_matter_accessed",
      expect.objectContaining({
        caseId: "case-1",
        transcriptId: "tr-1",
        severity: "warning",
        metadata: expect.objectContaining({
          actorType: "legalnote_personnel",
          resource: "transcript",
          reason: "support ticket 42",
        }),
      }),
    );
  });
});
