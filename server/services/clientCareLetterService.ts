import { PRACTICE_AREA_LABELS, type Case, type PracticeArea } from "@shared/schema";
import { logAuditEvent } from "../auditMiddleware";
import { storage } from "../storage";
import { DocumentService } from "./documentService";

/** Matter-opening letter. Skipped when a letter is already on the file. */
export async function ensureClientCareLetter(caseRecord: Case, userId: string): Promise<void> {
  if (caseRecord.clientCareLetterId) return;
  if (caseRecord.matterKind && caseRecord.matterKind !== "client") return;

  const fp = await storage.getFirmProfile();
  if (!fp?.firmName) return;

  const documentService = new DocumentService();
  const paLabel = caseRecord.practiceArea
    ? PRACTICE_AREA_LABELS[caseRecord.practiceArea as PracticeArea] || caseRecord.practiceArea
    : "General";
  const feeEarnerUser = await storage.getUser(caseRecord.assignedToUserId || userId);
  const feeEarnerDisplayName = feeEarnerUser
    ? [feeEarnerUser.firstName, feeEarnerUser.lastName].filter(Boolean).join(" ") || feeEarnerUser.email || "Fee Earner"
    : "Fee Earner";
  const result = await documentService.generateClientCareLetter({
    firmName: fp.firmName,
    firmAddress: [fp.addressLine1, fp.addressLine2, fp.city, fp.postcode].filter(Boolean).join(", ") || undefined,
    firmPhone: fp.phone || undefined,
    firmEmail: fp.email || undefined,
    sraNumber: fp.sraNumber || undefined,
    feeEarnerName: feeEarnerDisplayName,
    clientName: caseRecord.clientName,
    matterDescription: caseRecord.title,
    practiceArea: paLabel,
    costsEstimate: caseRecord.costsEstimate || undefined,
    matterReference: caseRecord.matterReference || undefined,
  });
  const doc = await storage.createDocument({
    caseId: caseRecord.id,
    type: "client_care_letter",
    content: result.content,
    version: 1,
    versionType: "system_generated",
    createdBy: userId,
  });
  await storage.updateCase(caseRecord.id, { clientCareLetterId: doc.id }, userId);
  await logAuditEvent(userId, "document_generated", {
    caseId: caseRecord.id,
    documentId: doc.id,
    metadata: {
      action: "auto_generate_client_care_letter",
      practiceArea: caseRecord.practiceArea,
      generationCost: result.cost,
      automatic: true,
    },
  });
}
