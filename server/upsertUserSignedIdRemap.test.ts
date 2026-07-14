import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

describe("Phase 0: upsertUser must not remap signed user ids", () => {
  it("does not contain signed-ID FK remap in storage.ts", () => {
    const storagePath = path.resolve(__dirname, "storage.ts");
    const source = fs.readFileSync(storagePath, "utf8");

    expect(source).not.toContain("{ table: 'audit_trail', column: 'user_id' }");
    expect(source).not.toContain("{ table: 'consent_logs', column: 'solicitor_id' }");
    expect(source).not.toMatch(
      /UPDATE\s+\$\{sql\.identifier\(table\)\}\s+SET\s+\$\{sql\.identifier\(column\)\}\s+=\s+\$\{newId\}/,
    );
  });
});

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("Phase 0: identity collision leaves sealed columns unchanged", () => {
  const originalUserId = `phase0-original-${randomUUID()}`;
  const collidingUserId = `phase0-colliding-${randomUUID()}`;
  const sharedEmail = `${originalUserId}@phase0.test`;
  let caseId: string;
  let auditEntryId: string;
  let consentLogId: string;
  let db: typeof import("./db").db;
  let pool: typeof import("./db").pool;
  let eq: typeof import("drizzle-orm").eq;
  let users: typeof import("@shared/schema").users;
  let cases: typeof import("@shared/schema").cases;
  let auditTrail: typeof import("@shared/schema").auditTrail;
  let consentLogs: typeof import("@shared/schema").consentLogs;
  let storage: InstanceType<typeof import("./storage").DbStorage>;

  beforeAll(async () => {
    ({ db, pool } = await import("./db"));
    ({ eq } = await import("drizzle-orm"));
    ({ users, cases, auditTrail, consentLogs } = await import("@shared/schema"));
    const { DbStorage } = await import("./storage");
    storage = new DbStorage();

    await db.insert(users).values({
      id: originalUserId,
      email: sharedEmail,
      firstName: "Original",
      lastName: "User",
    });

    const [createdCase] = await db
      .insert(cases)
      .values({
        title: "Phase 0 remap guard",
        clientName: "Phase 0 Client",
        sourceType: "audio",
        createdBy: originalUserId,
      })
      .returning();
    caseId = createdCase.id;

    const [audit] = await db
      .insert(auditTrail)
      .values({
        eventType: "phase0_remap_guard",
        userId: originalUserId,
        caseId,
        severity: "info",
        metadata: {},
      })
      .returning();
    auditEntryId = audit.id;

    const [consent] = await db
      .insert(consentLogs)
      .values({
        caseId,
        solicitorId: originalUserId,
        consentGiven: true,
        disclaimerScriptVersion: "v-phase0",
        consentModality: "verbal_attested",
        sealingStatus: "sealed",
      })
      .returning();
    consentLogId = consent.id;
  });

  afterAll(async () => {
    if (!db || !pool) return;
    const { SEAL_BYPASS_DB_ROLE, withSealBypass } = await import("./sealTriggerAssertion");
    const { sql } = await import("drizzle-orm");
    const who = await db.execute(sql`SELECT current_user AS role`);
    const rows = (who.rows ?? who) as Array<{ role: string }>;
    if (rows[0]?.role === SEAL_BYPASS_DB_ROLE) {
      await withSealBypass(async (tx) => {
        await tx.delete(auditTrail).where(eq(auditTrail.id, auditEntryId));
        await tx.delete(consentLogs).where(eq(consentLogs.id, consentLogId));
        await tx.delete(cases).where(eq(cases.id, caseId));
        await tx.delete(users).where(eq(users.id, originalUserId));
        await tx.delete(users).where(eq(users.id, collidingUserId));
      });
    } else {
      console.warn(
        `[SEAL] Phase 0 cleanup skipped — connect as ${SEAL_BYPASS_DB_ROLE} to remove sealed fixtures.`,
      );
    }
    await pool.end();
  });

  it("does not rewrite audit_trail.user_id or consent_logs.solicitor_id on email collision", async () => {
    try {
      await storage.upsertUser({
        id: collidingUserId,
        email: sharedEmail,
        firstName: "Colliding",
        lastName: "Identity",
      });
    } catch {
      // Unique email conflict is acceptable. Remap is not.
    }

    const [audit] = await db.select().from(auditTrail).where(eq(auditTrail.id, auditEntryId));
    const [consent] = await db.select().from(consentLogs).where(eq(consentLogs.id, consentLogId));
    const [originalUser] = await db.select().from(users).where(eq(users.id, originalUserId));

    expect(audit.userId).toBe(originalUserId);
    expect(consent.solicitorId).toBe(originalUserId);
    expect(originalUser).toBeDefined();
    expect(originalUser.id).toBe(originalUserId);
  });
});
