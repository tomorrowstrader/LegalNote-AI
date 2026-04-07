import type { FirmProfile } from './schema';

// Shared letterhead data model — single source of truth for firm branding on documents.
// Consumed by client-side PDF/Word exports (documentExport.ts) and server-side PDF
// generators (signedAuditExport.ts) via the @shared alias.
export interface LetterheadData {
  firmName: string;
  logoUrl?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postcode?: string;
  phone?: string;
  email?: string;
  website?: string;
  sraNumber?: string;
}

// Extract letterhead data from a FirmProfile; returns null if no firm name set.
export function extractLetterhead(firmProfile?: FirmProfile | null): LetterheadData | null {
  if (!firmProfile?.firmName) return null;
  return {
    firmName: firmProfile.firmName,
    logoUrl: firmProfile.logoUrl || undefined,
    addressLine1: firmProfile.addressLine1 || undefined,
    addressLine2: firmProfile.addressLine2 || undefined,
    city: firmProfile.city || undefined,
    postcode: firmProfile.postcode || undefined,
    phone: firmProfile.phone || undefined,
    email: firmProfile.email || undefined,
    website: firmProfile.website || undefined,
    sraNumber: firmProfile.sraNumber || undefined,
  };
}

// Format the address lines for display (city + postcode on same line if both present).
export function formatLetterheadAddress(lh: LetterheadData): string[] {
  const lines: string[] = [];
  if (lh.addressLine1) lines.push(lh.addressLine1);
  if (lh.addressLine2) lines.push(lh.addressLine2);
  const cityPostcode = [lh.city, lh.postcode].filter(Boolean).join(' ');
  if (cityPostcode) lines.push(cityPostcode);
  return lines;
}

// Branding modes for document exports:
//   'full'         — logo + firm name + full address + contact details + SRA
//   'name_sra'     — firm name + SRA number only (used for audit exports, server-side)
//   'none'         — no firm branding at all
export type BrandingMode = 'full' | 'name_sra' | 'none';

// Document types that receive full letterhead (logo + name + address + contact + SRA)
const FULL_LETTERHEAD_TYPES = new Set([
  'attendance_note',
  'summary',
  'client_care_letter',
]);

// Document types that receive name + SRA only (no logo, no address, no contact)
const NAME_SRA_TYPES = new Set([
  'audit',        // signed audit PDF export (server-side)
  'audit_trail',  // any future audit trail variants
]);

// Document types that receive no branding
const NO_BRANDING_TYPES = new Set([
  'transcript',
  'time_entry',   // CSV time entry exports
  'quick_note',   // quick notes
]);

// Resolve branding mode based on document type and actual content present.
// For multi-doc exports ('selected', 'full_case'), checks whether any non-transcript
// content is included to avoid applying letterhead to a transcript-only export.
export function resolveBrandingMode(
  docType?: string,
  contentFlags?: { hasAttendance?: boolean; hasSummary?: boolean; hasCareLetter?: boolean; hasTranscript?: boolean }
): BrandingMode {
  if (!docType) return 'full';
  if (NO_BRANDING_TYPES.has(docType)) return 'none';
  if (NAME_SRA_TYPES.has(docType)) return 'name_sra';
  if (FULL_LETTERHEAD_TYPES.has(docType)) return 'full';
  if (contentFlags) {
    const hasNonTranscript = !!(contentFlags.hasAttendance || contentFlags.hasSummary || contentFlags.hasCareLetter);
    if (!hasNonTranscript && contentFlags.hasTranscript) return 'none';
  }
  return 'full';
}
