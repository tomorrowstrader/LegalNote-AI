import crypto from "crypto";
import fs from "fs";
import path from "path";

export type LegalDocumentSlug = "dpa" | "evaluation";

export type LoadedLegalDocument = {
  slug: LegalDocumentSlug;
  path: string;
  text: string;
  contentHash: string;
  /** Raw file bytes — same Buffer that was hashed. Use for snapshot inserts. */
  bytes: Buffer;
};

/** Expected SHA-256 (hex) of master file raw UTF-8 bytes. Boot fails if mismatched. */
export const EXPECTED_LEGAL_MASTER_HASHES: Record<LegalDocumentSlug, string> = {
  dpa: "4395fe00a6f056fe24591a43c7b9370d327350792949cd6e3aece1c2fa2ddcc2",
  evaluation: "0eb5eb8cc21558c3cbdb83ac7bab0698599a26565088c1b6a0cf44f3d7d3e017",
};

const MASTER_RELATIVE_PATHS: Record<LegalDocumentSlug, string> = {
  dpa: "docs/legal/masters/DATA_PROCESSING_AGREEMENT.md",
  evaluation: "docs/legal/masters/GOVERNED_EVALUATION_AGREEMENT.md",
};

const cacheByHash = new Map<string, LoadedLegalDocument>();

/** Test-only: point a slug at a temp file (DoD master-mutation gate). */
let pathOverrides: Partial<Record<LegalDocumentSlug, string>> | null = null;

export function setLegalDocumentPathOverrides(
  overrides: Partial<Record<LegalDocumentSlug, string>> | null,
): void {
  pathOverrides = overrides;
  cacheByHash.clear();
}

function resolveMasterPath(slug: LegalDocumentSlug): string {
  if (pathOverrides?.[slug]) {
    const override = pathOverrides[slug]!;
    if (!fs.existsSync(override)) {
      throw new Error(`Legal master override not found for slug "${slug}": ${override}`);
    }
    return override;
  }
  const relative = MASTER_RELATIVE_PATHS[slug];
  const candidates = [
    path.resolve(process.cwd(), relative),
    path.resolve(process.cwd(), ...relative.split("/")),
  ];
  const resolved = candidates.find((p) => fs.existsSync(p));
  if (!resolved) {
    throw new Error(
      `Legal master document not found for slug "${slug}". Expected ${relative}`,
    );
  }
  return resolved;
}

/**
 * Load a canonical legal master. Hash and text come from one read of one Buffer.
 * contentHash = SHA-256 over the raw Buffer bytes (not a re-serialised string).
 */
export function loadLegalDocument(slug: LegalDocumentSlug): LoadedLegalDocument {
  const docPath = resolveMasterPath(slug);
  const bytes = fs.readFileSync(docPath);
  const contentHash = crypto.createHash("sha256").update(bytes).digest("hex");

  const cached = cacheByHash.get(contentHash);
  if (cached && cached.slug === slug && cached.path === docPath) {
    return cached;
  }

  const loaded: LoadedLegalDocument = {
    slug,
    path: docPath,
    text: bytes.toString("utf8"),
    contentHash,
    bytes,
  };
  cacheByHash.set(contentHash, loaded);
  return loaded;
}

/** Clear in-memory cache (tests / after intentional master mutation). */
export function clearLegalDocumentCache(): void {
  cacheByHash.clear();
}

/**
 * Boot gate: load both masters, log hashes, refuse to start if they diverge
 * from the committed expected values.
 */
export function assertLegalMasterHashes(): void {
  const mismatches: string[] = [];

  for (const slug of Object.keys(EXPECTED_LEGAL_MASTER_HASHES) as LegalDocumentSlug[]) {
    const expected = EXPECTED_LEGAL_MASTER_HASHES[slug];
    let actual: string;
    let docPath: string;
    try {
      const loaded = loadLegalDocument(slug);
      actual = loaded.contentHash;
      docPath = loaded.path;
    } catch (err) {
      mismatches.push(
        `${slug}: missing or unreadable (${err instanceof Error ? err.message : String(err)})`,
      );
      continue;
    }

    console.log(`[LEGAL] Master ${slug} hash=${actual} path=${docPath}`);

    if (actual !== expected) {
      mismatches.push(
        `${slug}: expected ${expected}, got ${actual}`,
      );
    }
  }

  if (mismatches.length > 0) {
    throw new Error(
      `Legal master document hash mismatch — refusing to boot. ${mismatches.join("; ")}. ` +
        `Acceptance binds to exact committed bytes; fix masters or update EXPECTED_LEGAL_MASTER_HASHES after counsel sign-off.`,
    );
  }

  console.log("[LEGAL] Master document hashes verified ✓");
}
