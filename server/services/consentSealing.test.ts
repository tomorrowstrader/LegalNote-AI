import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  AUDIT_PAYLOAD_V1,
  AUDIT_PAYLOAD_V2,
  buildAuditEntryContent,
  computeAuditChainHash,
  verifyAuditChainEntries,
} from "./auditChain";
import {
  buildConsentCanonicalPayload,
  hashConsentPayload,
  signConsentHash,
  verifyConsentSignature,
} from "./consentCanonical";

const TEST_KEY = "test-audit-signing-key-for-unit-tests";

describe("consentCanonical", () => {
  beforeEach(() => {
    process.env.AUDIT_SIGNING_KEY = TEST_KEY;
  });

  it("produces stable hash for identical canonical payloads", () => {
    const ts = new Date("2026-07-14T12:00:00.000Z");
    const payload = buildConsentCanonicalPayload({
      caseId: "case-1",
      solicitorId: "user-1",
      consentGiven: true,
      consentTimestamp: ts,
      disclaimerScriptVersion: "v1",
      consentModality: "verbal_recorded",
      source: "quick_record_button",
    });
    expect(hashConsentPayload(payload)).toBe(hashConsentPayload(payload));
  });

  it("detects signature mismatch for altered hash (in-memory arithmetic only)", () => {
    const ts = new Date("2026-07-14T12:00:00.000Z");
    const payload = buildConsentCanonicalPayload({
      caseId: "case-1",
      solicitorId: "user-1",
      consentGiven: true,
      consentTimestamp: ts,
      disclaimerScriptVersion: "v1",
      consentModality: "verbal_recorded",
      source: "quick_record_button",
    });
    const hash = hashConsentPayload(payload);
    const sig = signConsentHash(hash);
    expect(verifyConsentSignature(hash, sig)).toBe(true);
    expect(verifyConsentSignature(hash + "x", sig)).toBe(false);
  });
});

describe("auditChain", () => {
  beforeEach(() => {
    process.env.AUDIT_SIGNING_KEY = TEST_KEY;
  });

  it("v2 payload includes audioRecordingId; v1 does not", () => {
    const fields = {
      eventType: "consent_given",
      userId: "user-1",
      caseId: "case-1",
      documentId: null,
      transcriptId: null,
      audioRecordingId: "audio-1",
      metadata: { source: "test" },
      severity: "info",
      timestamp: "2026-07-14T12:00:00.000Z",
    };
    const v1 = buildAuditEntryContent(AUDIT_PAYLOAD_V1, fields);
    const v2 = buildAuditEntryContent(AUDIT_PAYLOAD_V2, fields);
    expect(v1).not.toContain("audioRecordingId");
    expect(v2).toContain("audioRecordingId");
    expect(v1).not.toBe(v2);
  });

  it("verifies a simple two-entry chain", () => {
    const ts = "2026-07-14T12:00:00.000Z";
    const entry1Content = buildAuditEntryContent(AUDIT_PAYLOAD_V2, {
      eventType: "case_created",
      userId: "user-1",
      caseId: "case-1",
      documentId: null,
      transcriptId: null,
      audioRecordingId: null,
      metadata: {},
      severity: "info",
      timestamp: ts,
    });
    const hash1 = computeAuditChainHash(entry1Content, "GENESIS", TEST_KEY);

    const entry2Content = buildAuditEntryContent(AUDIT_PAYLOAD_V2, {
      eventType: "consent_given",
      userId: "user-1",
      caseId: "case-1",
      documentId: null,
      transcriptId: null,
      audioRecordingId: "audio-1",
      metadata: { source: "test" },
      severity: "info",
      timestamp: "2026-07-14T12:01:00.000Z",
    });
    const hash2 = computeAuditChainHash(entry2Content, hash1, TEST_KEY);

    const { chainIntact, failedEntryIds } = verifyAuditChainEntries(
      [
        {
          id: "e1",
          eventType: "case_created",
          userId: "user-1",
          caseId: "case-1",
          documentId: null,
          transcriptId: null,
          audioRecordingId: null,
          metadata: {},
          severity: "info",
          timestamp: ts,
          chainHash: hash1,
          payloadVersion: AUDIT_PAYLOAD_V2,
        },
        {
          id: "e2",
          eventType: "consent_given",
          userId: "user-1",
          caseId: "case-1",
          documentId: null,
          transcriptId: null,
          audioRecordingId: "audio-1",
          metadata: { source: "test" },
          severity: "info",
          timestamp: "2026-07-14T12:01:00.000Z",
          chainHash: hash2,
          payloadVersion: AUDIT_PAYLOAD_V2,
        },
      ],
      TEST_KEY,
    );

    expect(chainIntact).toBe(true);
    expect(failedEntryIds).toEqual([]);
  });
});

describe("PR0 client consent_given audit acceptance", () => {
  it("has no client logAuditEvent call sites for consent_given", () => {
    const clientDir = path.resolve(__dirname, "../../client/src");
    const pattern = /logAuditEvent\s*\(\s*\{[^}]*eventType:\s*["']consent_given["']/s;
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(tsx|ts)$/.test(entry.name)) {
          const content = fs.readFileSync(full, "utf8");
          if (pattern.test(content)) {
            offenders.push(path.relative(clientDir, full));
          }
        }
      }
    };

    walk(clientDir);
    expect(offenders).toEqual([]);
  });
});
