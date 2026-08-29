import { db } from "../db";
import { documents } from "../../shared/schema";
import { and, eq } from "drizzle-orm";

/** Mark active matter documents as adopted so secure share can proceed (demo / showcase). */
export async function approveCaseDocumentsForSharing(
  caseId: string,
  userId: string,
): Promise<number> {
  const activeDocuments = await db
    .select({ id: documents.id, status: documents.status })
    .from(documents)
    .where(and(eq(documents.caseId, caseId), eq(documents.isActive, true)));

  const now = new Date();
  let approved = 0;
  for (const doc of activeDocuments) {
    if (doc.status === "approved") continue;
    await db
      .update(documents)
      .set({
        status: "approved",
        versionType: "fee_earner_approved",
        approvedBy: userId,
        approvedAt: now,
      })
      .where(eq(documents.id, doc.id));
    approved++;
  }
  return approved;
}
