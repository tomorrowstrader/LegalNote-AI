// Re-export from the shared module so client code can import from either path.
// The canonical implementation lives in shared/letterhead.ts (server + client).
export type { LetterheadData, BrandingMode } from '@shared/letterhead';
export { extractLetterhead, formatLetterheadAddress, resolveBrandingMode } from '@shared/letterhead';
