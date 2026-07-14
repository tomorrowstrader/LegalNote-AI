import crypto from "crypto";

/** v1: original signed fields (no audioRecordingId). v2: adds audioRecordingId. */
export const AUDIT_PAYLOAD_V1 = 1;
export const AUDIT_PAYLOAD_V2 = 2;

export type AuditEntrySignFields = {
  eventType: string;
  userId: string;
  caseId: string | null;
  documentId: string | null;
  transcriptId: string | null;
  audioRecordingId: string | null;
  metadata: Record<string, unknown>;
  severity: string;
  timestamp: string;
};

export function buildAuditEntryContent(
  payloadVersion: number,
  fields: AuditEntrySignFields,
): string {
  const base = {
    eventType: fields.eventType,
    userId: fields.userId,
    caseId: fields.caseId,
    documentId: fields.documentId,
    transcriptId: fields.transcriptId,
    metadata: fields.metadata,
    severity: fields.severity,
    timestamp: fields.timestamp,
  };

  if (payloadVersion >= AUDIT_PAYLOAD_V2) {
    return JSON.stringify({
      ...base,
      audioRecordingId: fields.audioRecordingId,
    });
  }

  return JSON.stringify(base);
}

export function computeAuditChainHash(
  entryContent: string,
  previousChainHash: string,
  signingKey: string,
): string {
  return crypto.createHmac("sha256", signingKey).update(entryContent + previousChainHash).digest("hex");
}

export function getAuditSigningKey(): string {
  const signingKey = process.env.AUDIT_SIGNING_KEY?.trim();
  if (!signingKey) {
    throw new Error("AUDIT_SIGNING_KEY is required for sealed audit operations");
  }
  return signingKey;
}

export function resolvePayloadVersion(stored: number | null | undefined): number {
  return stored ?? AUDIT_PAYLOAD_V1;
}

export type AuditChainEntryLike = {
  id: string;
  eventType: string;
  userId: string;
  caseId: string | null;
  documentId: string | null;
  transcriptId: string | null;
  audioRecordingId: string | null;
  metadata: Record<string, unknown> | null;
  severity: string | null;
  timestamp: Date | string;
  chainHash: string | null;
  payloadVersion: number | null;
};

export function verifyAuditChainEntries(
  entries: AuditChainEntryLike[],
  signingKey: string,
): { chainIntact: boolean; failedEntryIds: string[] } {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const failures: string[] = [];
  let chainIntact = true;

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    if (!entry.chainHash) continue;

    const previousChainHash = i === 0 ? "GENESIS" : (sorted[i - 1].chainHash ?? "GENESIS");
    const payloadVersion = resolvePayloadVersion(entry.payloadVersion ?? undefined);
    const entryContent = buildAuditEntryContent(payloadVersion, {
      eventType: entry.eventType,
      userId: entry.userId,
      caseId: entry.caseId,
      documentId: entry.documentId,
      transcriptId: entry.transcriptId,
      audioRecordingId: entry.audioRecordingId,
      metadata: entry.metadata ?? {},
      severity: entry.severity ?? "info",
      timestamp: new Date(entry.timestamp).toISOString(),
    });

    const expectedHash = computeAuditChainHash(entryContent, previousChainHash, signingKey);
    if (entry.chainHash !== expectedHash) {
      chainIntact = false;
      failures.push(entry.id);
    }
  }

  return { chainIntact, failedEntryIds: failures };
}
