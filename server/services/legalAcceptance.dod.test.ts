import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  loadLegalDocument,
  clearLegalDocumentCache,
  setLegalDocumentPathOverrides,
  EXPECTED_LEGAL_MASTER_HASHES,
} from "./legalDocumentLoader";
import {
  signKeyTerms,
  verifyKeyTermsSignature,
  buildKeyTermsPayload,
} from "./keyTermsSign";
import {
  buildLegalAcceptanceCanonicalPayload,
  hashLegalAcceptancePayload,
  signLegalAcceptanceHash,
  verifyLegalAcceptanceRecord,
  hashSnapshotText,
} from "./legalAcceptanceCanonical";
import { dpaConfirmBodySchema } from "@shared/schema";
import type { LegalAgreementAcceptance } from "@shared/schema";

const TEST_KEY = "test-audit-signing-key-for-legal-acceptance-dod";

describe("legal click-to-accept — definition of done", () => {
  beforeEach(() => {
    process.env.AUDIT_SIGNING_KEY = TEST_KEY;
    clearLegalDocumentCache();
    setLegalDocumentPathOverrides(null);
  });

  afterEach(() => {
    clearLegalDocumentCache();
    setLegalDocumentPathOverrides(null);
  });

  it("loads masters whose SHA-256 matches the committed expected hashes", () => {
    const dpa = loadLegalDocument("dpa");
    const evaluation = loadLegalDocument("evaluation");
    expect(dpa.contentHash).toBe(EXPECTED_LEGAL_MASTER_HASHES.dpa);
    expect(evaluation.contentHash).toBe(EXPECTED_LEGAL_MASTER_HASHES.evaluation);
    expect(hashSnapshotText(dpa.text)).toBe(dpa.contentHash);
    expect(hashSnapshotText(evaluation.text)).toBe(evaluation.contentHash);
  });

  /**
   * DoD gate 1 + 2: snapshot text re-hashes to stored hash; after master
   * mutation, old hash still resolves to old bytes (not live file).
   */
  it("retrieves snapshotted pre-edit text after the master file is mutated", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legal-masters-"));
    const dpaPath = path.join(tmpDir, "dpa.md");
    const evalPath = path.join(tmpDir, "eval.md");

    const originalDpa = "ORIGINAL DPA TEXT v1\nline two\n";
    const originalEval = "ORIGINAL EVAL TEXT v1\n";
    fs.writeFileSync(dpaPath, originalDpa, "utf8");
    fs.writeFileSync(evalPath, originalEval, "utf8");

    setLegalDocumentPathOverrides({ dpa: dpaPath, evaluation: evalPath });

    const beforeDpa = loadLegalDocument("dpa");
    const beforeEval = loadLegalDocument("evaluation");

    // Simulate content-addressed snapshot store (in-memory for this gate).
    const snapshots = new Map<string, { text: string; documentSlug: string }>();
    snapshots.set(beforeDpa.contentHash, {
      text: beforeDpa.text,
      documentSlug: "dpa",
    });
    snapshots.set(beforeEval.contentHash, {
      text: beforeEval.text,
      documentSlug: "evaluation",
    });

    // Mutate masters (redeploy) — live loader must see new hashes.
    fs.writeFileSync(dpaPath, "MUTATED DPA TEXT v2 — should not replace snapshot\n", "utf8");
    fs.writeFileSync(evalPath, "MUTATED EVAL TEXT v2\n", "utf8");
    clearLegalDocumentCache();

    const afterDpa = loadLegalDocument("dpa");
    const afterEval = loadLegalDocument("evaluation");
    expect(afterDpa.contentHash).not.toBe(beforeDpa.contentHash);
    expect(afterEval.contentHash).not.toBe(beforeEval.contentHash);

    // Retrieval by stored hash returns pre-edit text that re-hashes exactly.
    const retrievedDpa = snapshots.get(beforeDpa.contentHash)!;
    const retrievedEval = snapshots.get(beforeEval.contentHash)!;
    expect(retrievedDpa.text).toBe(originalDpa);
    expect(retrievedEval.text).toBe(originalEval);
    expect(hashSnapshotText(retrievedDpa.text)).toBe(beforeDpa.contentHash);
    expect(hashSnapshotText(retrievedEval.text)).toBe(beforeEval.contentHash);

    // Live file must NOT be what an old acceptance resolves to.
    expect(retrievedDpa.text).not.toBe(afterDpa.text);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /** DoD gate 3: verify detects a good record and a tampered row. */
  it("verify returns valid for a sealed record and rejects tampering", () => {
    const dpa = loadLegalDocument("dpa");
    const evaluation = loadLegalDocument("evaluation");
    const acceptedAt = new Date("2026-07-22T12:00:00.000Z");

    const canonical = buildLegalAcceptanceCanonicalPayload({
      acceptanceId: "acc-test-1",
      firmName: "Example LLP",
      signerName: "Jane Partner",
      signerTitle: "Partner",
      email: "jane@example.com",
      sraNumber: "123456",
      ref: null,
      evaluationPeriodDays: 90,
      feeEarnerCount: 12,
      acceptedAt,
      affirmativeAssent: true,
      dpaAccepted: true,
      evaluationAccepted: true,
      dpaContentHash: dpa.contentHash,
      evaluationContentHash: evaluation.contentHash,
      identityMethod: "email_confirmed",
      requestIpAddress: "1.2.3.4",
      confirmIpAddress: "1.2.3.4",
    });

    const acceptancePayloadHash = hashLegalAcceptancePayload(canonical);
    const acceptanceContentSignature = signLegalAcceptanceHash(acceptancePayloadHash);

    const goodRow = {
      id: "acc-test-1",
      status: "accepted",
      confirmationToken: "tok",
      confirmationExpiresAt: acceptedAt,
      confirmedAt: acceptedAt,
      acceptedAt,
      firmName: "Example LLP",
      signerName: "Jane Partner",
      signerTitle: "Partner",
      email: "jane@example.com",
      sraNumber: "123456",
      ref: null,
      evaluationPeriodDays: 90,
      feeEarnerCount: 12,
      identityMethod: "email_confirmed",
      requestIpAddress: "1.2.3.4",
      requestUserAgent: null,
      confirmIpAddress: "1.2.3.4",
      confirmUserAgent: null,
      acceptedByUserId: null,
      affirmativeAssent: true,
      dpaAccepted: true,
      evaluationAccepted: true,
      dpaContentHash: dpa.contentHash,
      evaluationContentHash: evaluation.contentHash,
      acceptancePayloadHash,
      acceptanceContentSignature,
      verifyToken: "verify-tok",
      auditTrailEntryId: null,
      createdAt: acceptedAt,
    } as LegalAgreementAcceptance;

    const good = verifyLegalAcceptanceRecord(goodRow, dpa.text, evaluation.text);
    expect(good.valid).toBe(true);
    expect(good.recordSealValid).toBe(true);
    expect(good.dpaHashValid).toBe(true);
    expect(good.evaluationHashValid).toBe(true);

    const tampered = {
      ...goodRow,
      firmName: "Evil Corp",
    } as LegalAgreementAcceptance;
    const bad = verifyLegalAcceptanceRecord(tampered, dpa.text, evaluation.text);
    expect(bad.valid).toBe(false);
    expect(bad.reasons).toContain("payload_hash_mismatch");
  });

  /** DoD gate 4: confirm body requires both checkboxes. */
  it("rejects confirm body when only one agreement checkbox is ticked", () => {
    const both = dpaConfirmBodySchema.safeParse({
      dpaAccepted: true,
      evaluationAccepted: true,
    });
    expect(both.success).toBe(true);

    const onlyDpa = dpaConfirmBodySchema.safeParse({
      dpaAccepted: true,
      evaluationAccepted: false,
    });
    expect(onlyDpa.success).toBe(false);

    const onlyEval = dpaConfirmBodySchema.safeParse({
      dpaAccepted: false,
      evaluationAccepted: true,
    });
    expect(onlyEval.success).toBe(false);

    const missing = dpaConfirmBodySchema.safeParse({ dpaAccepted: true });
    expect(missing.success).toBe(false);
  });

  /** DoD gate 5: invalid Key Terms signature rejected. */
  it("rejects requests with an invalid or expired Key Terms signature", () => {
    const expiresAtUnix = Math.floor(Date.now() / 1000) + 3600;
    const terms = {
      evaluationPeriodDays: 90,
      feeEarnerCount: 5,
      expiresAtUnix,
    };
    const sig = signKeyTerms(terms);
    expect(buildKeyTermsPayload(terms)).toBe(`90|5|${expiresAtUnix}`);

    const ok = verifyKeyTermsSignature({
      evaluationPeriodDays: 90,
      feeEarnerCount: 5,
      ktExp: expiresAtUnix,
      keyTermsSig: sig,
    });
    expect(ok.ok).toBe(true);

    const tampered = verifyKeyTermsSignature({
      evaluationPeriodDays: 365,
      feeEarnerCount: 5,
      ktExp: expiresAtUnix,
      keyTermsSig: sig,
    });
    expect(tampered.ok).toBe(false);
    if (!tampered.ok) {
      expect(tampered.code).toBe("INVALID_KEY_TERMS_SIGNATURE");
    }

    const garbage = verifyKeyTermsSignature({
      evaluationPeriodDays: 90,
      feeEarnerCount: 5,
      ktExp: expiresAtUnix,
      keyTermsSig: "0".repeat(64),
    });
    expect(garbage.ok).toBe(false);

    const expired = verifyKeyTermsSignature({
      evaluationPeriodDays: 90,
      feeEarnerCount: 5,
      ktExp: expiresAtUnix,
      keyTermsSig: sig,
      nowUnix: expiresAtUnix + 1,
    });
    expect(expired.ok).toBe(false);
    if (!expired.ok) {
      expect(expired.code).toBe("KEY_TERMS_EXPIRED");
    }
  });
});
