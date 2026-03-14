import { db } from "./db";
import { clients, cases } from "@shared/schema";
import { eq, isNull, sql, and } from "drizzle-orm";

export async function migrateClientsFromCases(): Promise<void> {
  try {
    const unlinkedCases = await db.select({ id: cases.id, clientName: cases.clientName, createdBy: cases.createdBy })
      .from(cases)
      .where(isNull(cases.clientId));

    if (unlinkedCases.length === 0) {
      console.log("[CLIENT_MIGRATION] No unlinked cases found, skipping");
      return;
    }

    console.log(`[CLIENT_MIGRATION] Found ${unlinkedCases.length} cases without clientId, backfilling...`);

    const clientCache = new Map<string, string>();
    let created = 0;
    let linked = 0;

    for (const c of unlinkedCases) {
      const normalName = c.clientName.trim().toLowerCase();
      const cacheKey = `${c.createdBy}::${normalName}`;

      if (!clientCache.has(cacheKey)) {
        const existing = await db.select({ id: clients.id })
          .from(clients)
          .where(and(eq(clients.createdBy, c.createdBy), sql`LOWER(${clients.name}) = ${normalName}`))
          .limit(1);

        if (existing.length > 0) {
          clientCache.set(cacheKey, existing[0].id);
        } else {
          const [newClient] = await db.insert(clients)
            .values({ name: c.clientName.trim(), createdBy: c.createdBy })
            .returning({ id: clients.id });
          clientCache.set(cacheKey, newClient.id);
          created++;
        }
      }

      await db.update(cases)
        .set({ clientId: clientCache.get(cacheKey)! })
        .where(eq(cases.id, c.id));
      linked++;
    }

    console.log(`[CLIENT_MIGRATION] Complete: created ${created} clients, linked ${linked} cases`);
  } catch (error) {
    console.error("[CLIENT_MIGRATION] Error during migration:", error);
  }
}
