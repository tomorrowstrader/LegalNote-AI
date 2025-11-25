import { createHash } from "crypto";

export function generateDocumentHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function verifyDocumentHash(content: string, expectedHash: string): boolean {
  const actualHash = generateDocumentHash(content);
  return actualHash === expectedHash;
}

export function generateDocumentMetadata(content: string, documentType: string) {
  const hash = generateDocumentHash(content);
  const timestamp = new Date().toISOString();
  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
  const charCount = content.length;
  
  return {
    contentHash: hash,
    generatedAt: timestamp,
    wordCount,
    charCount,
    algorithm: "SHA-256",
  };
}
