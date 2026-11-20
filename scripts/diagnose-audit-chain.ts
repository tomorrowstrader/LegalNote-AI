/**
 * Read-only diagnosis of why a case's audit entries fail verification.
 *
 * Uses the live AUDIT_SIGNING_KEY from the environment (via `railway run`). The key is
 * never printed, logged or written anywhere. Only counts and time offsets are printed:
 * no metadata, names or content. Runs in a READ ONLY transaction.
 *
 *   railway run npx tsx scripts/diagnose-audit-chain.ts <caseId>
 *   npx tsx scripts/diagnose-audit-chain.ts --self-test      (no database, no key)
 */
import crypto from "crypto";
import pg from "pg";
import { buildAuditEntryContent, computeAuditChainHash, resolvePayloadVersion } from "../server/services/auditChain";

// Stored timestamps have no time zone and are UTC. Read them as UTC on any machine.
pg.types.setTypeParser(1114, (value: string) => new Date(value.replace(" ", "T") + "Z"));

const SEARCH_MS = 5000;

interface Entry {
  id: string;
  eventType: string;
  userId: string;
  caseId: string | null;
  documentId: string | null;
  transcriptId: string | null;
  audioRecordingId: string | null;
  metadata: Record<string, unknown>;
  severity: string;
  timestamp: Date;
  chainHash: string | null;
  payloadVersion: number | null;
  previousEntryId: string | null;
}

function contentFor(entry: Entry, timestampIso: string, metadata = entry.metadata): string {
  return buildAuditEntryContent(resolvePayloadVersion(entry.payloadVersion ?? undefined), {
    eventType: entry.eventType,
    userId: entry.userId,
    caseId: entry.caseId,
    documentId: entry.documentId,
    transcriptId: entry.transcriptId,
    audioRecordingId: entry.audioRecordingId,
    metadata: metadata ?? {},
    severity: entry.severity ?? "info",
    timestamp: timestampIso,
  });
}

/** How each entry fares. Returns the signing offset in ms when only the time differs. */
function diagnose(entries: Entry[], key: string) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const sorted = [...entries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const result = {
    total: entries.length,
    unsigned: 0,
    passAsVerified: 0,
    passWithSignerPrevious: 0,
    passAfterTimeShift: 0,
    offsetsMs: [] as number[],
    stillFailing: { metadataUpToOneKey: 0, metadataTwoOrMoreKeys: 0 },
    stillFailingDays: new Map<string, number>(),
  };

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    if (!entry.chainHash) {
      result.unsigned++;
      continue;
    }
    const verifierPrevious = i === 0 ? "GENESIS" : (sorted[i - 1].chainHash ?? "GENESIS");
    const signerPrevious = entry.previousEntryId
      ? (byId.get(entry.previousEntryId)?.chainHash ?? "GENESIS")
      : "GENESIS";
    const storedIso = entry.timestamp.toISOString();

    if (computeAuditChainHash(contentFor(entry, storedIso), verifierPrevious, key) === entry.chainHash) {
      result.passAsVerified++;
      continue;
    }
    if (computeAuditChainHash(contentFor(entry, storedIso), signerPrevious, key) === entry.chainHash) {
      result.passWithSignerPrevious++;
      continue;
    }

    let found: number | null = null;
    const base = entry.timestamp.getTime();
    for (let delta = 1; delta <= SEARCH_MS && found === null; delta++) {
      for (const offset of [-delta, delta]) {
        const iso = new Date(base + offset).toISOString();
        const content = contentFor(entry, iso);
        if (
          computeAuditChainHash(content, signerPrevious, key) === entry.chainHash ||
          computeAuditChainHash(content, verifierPrevious, key) === entry.chainHash
        ) {
          found = offset;
          break;
        }
      }
    }
    if (found !== null) {
      result.passAfterTimeShift++;
      result.offsetsMs.push(found);
      continue;
    }

    const keyCount = Object.keys(entry.metadata ?? {}).length;
    if (keyCount <= 1) result.stillFailing.metadataUpToOneKey++;
    else result.stillFailing.metadataTwoOrMoreKeys++;
    const day = storedIso.slice(0, 10);
    result.stillFailingDays.set(day, (result.stillFailingDays.get(day) ?? 0) + 1);
  }
  return result;
}

function report(result: ReturnType<typeof diagnose>) {
  const offsets = [...result.offsetsMs].sort((a, b) => a - b);
  const median = offsets.length ? offsets[Math.floor(offsets.length / 2)] : null;
  console.log("Entries on the case:              ", result.total);
  console.log("Not signed at all:                ", result.unsigned);
  console.log("Pass exactly as the app checks:   ", result.passAsVerified);
  console.log("Pass using the entry's own link:  ", result.passWithSignerPrevious);
  console.log("Pass once the signed time is used:", result.passAfterTimeShift,
    offsets.length ? `(signed time was ${offsets[0]} to ${offsets[offsets.length - 1]} ms from the stored time, median ${median} ms)` : "");
  console.log("Still failing, metadata 0-1 keys: ", result.stillFailing.metadataUpToOneKey);
  console.log("Still failing, metadata 2+ keys:  ", result.stillFailing.metadataTwoOrMoreKeys);
  if (result.stillFailingDays.size) {
    console.log("Still failing by day (UTC):");
    for (const [day, n] of [...result.stillFailingDays].sort()) console.log(`  ${day}: ${n}`);
  }
}

function selfTest() {
  const key = crypto.randomBytes(32).toString("hex");
  const make = (id: string, ms: number, metadata: Record<string, unknown>, signShiftMs: number, prev: Entry | null, signKey = key): Entry => {
    const entry: Entry = {
      id, eventType: "case_viewed", userId: "u", caseId: "c", documentId: null, transcriptId: null,
      audioRecordingId: null, metadata, severity: "info", timestamp: new Date(ms), chainHash: null,
      payloadVersion: 2, previousEntryId: prev?.id ?? null,
    };
    const signedIso = new Date(ms + signShiftMs).toISOString();
    entry.chainHash = computeAuditChainHash(contentFor(entry, signedIso), prev?.chainHash ?? "GENESIS", signKey);
    return entry;
  };
  const t = Date.UTC(2026, 10, 16, 14, 0, 0);
  const a = make("a", t, {}, 0, null);
  const b = make("b", t + 1000, { x: 1 }, -7, a);
  // Signed with keys in one order; stored (as jsonb would) in another.
  const c = make("c", t + 2000, { longer: 1, s: 2 }, -3, b);
  c.metadata = { s: 2, longer: 1 };
  const d = make("d", t + 3000, {}, 0, c, "some-other-key");
  const r = diagnose([a, b, c, d], key);
  const ok = r.passAsVerified === 1 && r.passAfterTimeShift === 1 && r.offsetsMs[0] === -7 &&
    r.stillFailing.metadataTwoOrMoreKeys === 1 && r.stillFailing.metadataUpToOneKey === 1;
  report(r);
  console.log(ok ? "SELF-TEST PASSED" : "SELF-TEST FAILED");
  process.exit(ok ? 0 : 1);
}

async function main() {
  if (process.argv[2] === "--self-test") return selfTest();
  const caseId = process.argv[2];
  if (!caseId) throw new Error("Usage: npx tsx scripts/diagnose-audit-chain.ts <caseId>");
  const key = process.env.AUDIT_SIGNING_KEY?.trim();
  if (!key) throw new Error("AUDIT_SIGNING_KEY is not set. Run this with `railway run`.");
  console.log("Signing key loaded:", "yes (not shown)");

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const rows = await client.query(
      `SELECT id, event_type, user_id, case_id, document_id, transcript_id, audio_recording_id,
              metadata, severity, "timestamp", chain_hash, payload_version, previous_entry_id
       FROM audit_trail WHERE case_id = $1`,
      [caseId],
    );
    await client.query("ROLLBACK");
    const entries: Entry[] = rows.rows.map((r) => ({
      id: r.id, eventType: r.event_type, userId: r.user_id, caseId: r.case_id, documentId: r.document_id,
      transcriptId: r.transcript_id, audioRecordingId: r.audio_recording_id, metadata: r.metadata ?? {},
      severity: r.severity, timestamp: r.timestamp, chainHash: r.chain_hash,
      payloadVersion: r.payload_version, previousEntryId: r.previous_entry_id,
    }));
    report(diagnose(entries, key));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
