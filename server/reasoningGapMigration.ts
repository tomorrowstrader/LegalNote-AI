import { db } from "./db";
import { documents } from "@shared/schema";
import { like, or } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { generateDocumentHash } from "./utils/documentHash";

const VISIBLE_PLACEHOLDERS = [
  "Reasoning behind advice not recorded in this session.",
  "Reasoning behind advice not recorded in this session",
  "No reasoning recorded in this session.",
  "No reasoning recorded in this session",
];

export async function migrateReasoningGapPlaceholders(): Promise<void> {
  try {
    const conditions = VISIBLE_PLACEHOLDERS.map(p => like(documents.content, `%${p}%`));
    const affected = await db
      .select({ id: documents.id, content: documents.content })
      .from(documents)
      .where(or(...conditions));

    if (affected.length === 0) {
      console.log("[REASONING_GAP_MIGRATION] No documents with visible placeholders found, skipping");
      return;
    }

    console.log(`[REASONING_GAP_MIGRATION] Found ${affected.length} document(s) with visible placeholder text, replacing with HTML comment markers`);

    let updated = 0;
    for (const doc of affected) {
      let newContent = doc.content;
      for (const placeholder of VISIBLE_PLACEHOLDERS) {
        newContent = newContent.split(placeholder).join("<!-- REASONING_GAP: Reasoning behind advice -->");
      }
      if (newContent !== doc.content) {
        await db
          .update(documents)
          .set({ content: newContent, contentHash: generateDocumentHash(newContent) })
          .where(sql`${documents.id} = ${doc.id}`);
        updated++;
      }
    }

    console.log(`[REASONING_GAP_MIGRATION] Complete: updated ${updated} document(s)`);
  } catch (error) {
    console.error("[REASONING_GAP_MIGRATION] Error during migration:", error);
  }
}
