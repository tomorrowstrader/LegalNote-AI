// Security constants
export const MAX_AUDIO_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
export const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/m4a',
  'audio/aac',
  'audio/x-m4a',
];

// Magic numbers (file signatures) for audio formats
const AUDIO_MAGIC_NUMBERS: Record<string, { offset: number; bytes: Buffer }[]> = {
  'audio/mpeg': [
    { offset: 0, bytes: Buffer.from([0xFF, 0xFB]) }, // MP3 frame sync
    { offset: 0, bytes: Buffer.from([0xFF, 0xF3]) }, // MP3 frame sync
    { offset: 0, bytes: Buffer.from([0xFF, 0xF2]) }, // MP3 frame sync
    { offset: 0, bytes: Buffer.from([0x49, 0x44, 0x33]) }, // ID3v2 tag
  ],
  'audio/wav': [
    { offset: 0, bytes: Buffer.from([0x52, 0x49, 0x46, 0x46]) }, // RIFF header
    { offset: 8, bytes: Buffer.from([0x57, 0x41, 0x56, 0x45]) }, // WAVE signature at offset 8
  ],
  'audio/wave': [
    { offset: 0, bytes: Buffer.from([0x52, 0x49, 0x46, 0x46]) }, // RIFF header
    { offset: 8, bytes: Buffer.from([0x57, 0x41, 0x56, 0x45]) }, // WAVE signature at offset 8
  ],
  'audio/x-wav': [
    { offset: 0, bytes: Buffer.from([0x52, 0x49, 0x46, 0x46]) }, // RIFF header
    { offset: 8, bytes: Buffer.from([0x57, 0x41, 0x56, 0x45]) }, // WAVE signature at offset 8
  ],
  'audio/webm': [
    { offset: 0, bytes: Buffer.from([0x1A, 0x45, 0xDF, 0xA3]) }, // WebM/EBML header
  ],
  'audio/ogg': [
    { offset: 0, bytes: Buffer.from([0x4F, 0x67, 0x67, 0x53]) }, // OggS header
  ],
  'audio/mp4': [
    { offset: 4, bytes: Buffer.from([0x66, 0x74, 0x79, 0x70]) }, // ftyp signature
  ],
  'audio/m4a': [
    { offset: 4, bytes: Buffer.from([0x66, 0x74, 0x79, 0x70]) }, // ftyp signature
  ],
  'audio/x-m4a': [
    { offset: 4, bytes: Buffer.from([0x66, 0x74, 0x79, 0x70]) }, // ftyp signature
  ],
  'audio/aac': [
    { offset: 0, bytes: Buffer.from([0xFF, 0xF1]) }, // ADTS header
    { offset: 0, bytes: Buffer.from([0xFF, 0xF9]) }, // ADTS header variant
  ],
};

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// MIME type normalization map (aliases → canonical)
const MIME_ALIASES: Record<string, string> = {
  'audio/mp3': 'audio/mpeg',
  'audio/wave': 'audio/wav',
  'audio/x-wav': 'audio/wav',
  'audio/m4a': 'audio/mp4',
  'audio/x-m4a': 'audio/mp4',
};

/**
 * Validates file size
 */
export function validateFileSize(sizeBytes: number): ValidationResult {
  if (sizeBytes > MAX_AUDIO_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${MAX_AUDIO_SIZE_BYTES / 1024 / 1024}MB`,
    };
  }
  return { valid: true };
}

/**
 * Validates MIME type against allowed audio types
 */
export function validateMimeType(mimeType: string): ValidationResult {
  const normalizedMime = mimeType.toLowerCase().split(';')[0].trim();
  
  if (!ALLOWED_AUDIO_MIME_TYPES.includes(normalizedMime)) {
    return {
      valid: false,
      error: `Invalid file type. Only audio files are allowed (${ALLOWED_AUDIO_MIME_TYPES.join(', ')})`,
    };
  }
  
  return { valid: true };
}

/**
 * Verifies file magic numbers match the claimed MIME type (Buffer version)
 */
export function verifyMagicNumbersFromBuffer(
  fileBuffer: Buffer,
  claimedMimeType: string
): ValidationResult {
  try {
    let normalizedMime = claimedMimeType.toLowerCase().split(';')[0].trim();
    
    // Normalize MIME aliases to canonical types
    normalizedMime = MIME_ALIASES[normalizedMime] || normalizedMime;
    
    // Get magic numbers for this MIME type
    const magicSignatures = AUDIO_MAGIC_NUMBERS[normalizedMime] || [];
    
    // Security: Fail if we don't have magic numbers for this type
    if (magicSignatures.length === 0) {
      console.error(`No magic number verification available for MIME type: ${normalizedMime}`);
      return {
        valid: false,
        error: `File type ${normalizedMime} cannot be verified for security`,
      };
    }
    
    // Use first 32 bytes for magic number verification
    const fileHeader = fileBuffer.slice(0, 32);
    
    // Group signatures by offset
    const signaturesByOffset = new Map<number, Buffer[]>();
    for (const sig of magicSignatures) {
      if (!signaturesByOffset.has(sig.offset)) {
        signaturesByOffset.set(sig.offset, []);
      }
      signaturesByOffset.get(sig.offset)!.push(sig.bytes);
    }
    
    // For each offset, at least ONE signature must match
    for (const [offset, possibleSignatures] of Array.from(signaturesByOffset.entries())) {
      const hasMatch = possibleSignatures.some((expectedBytes: Buffer) => {
        if (fileHeader.length < offset + expectedBytes.length) return false;
        const actualBytes = fileHeader.slice(offset, offset + expectedBytes.length);
        return actualBytes.equals(expectedBytes);
      });
      
      if (!hasMatch) {
        return {
          valid: false,
          error: 'File content does not match claimed file type (magic number mismatch)',
        };
      }
    }
    
    return { valid: true };
  } catch (error) {
    console.error('Error verifying magic numbers:', error);
    return {
      valid: false,
      error: 'Failed to verify file integrity',
    };
  }
}

/**
 * Comprehensive file validation for Buffer-based uploads
 */
export function validateAudioBuffer(
  buffer: Buffer,
  mimeType: string
): ValidationResult {
  // Validate file size
  const sizeValidation = validateFileSize(buffer.length);
  if (!sizeValidation.valid) {
    return sizeValidation;
  }
  
  // Validate MIME type
  const mimeValidation = validateMimeType(mimeType);
  if (!mimeValidation.valid) {
    return mimeValidation;
  }
  
  // Verify magic numbers
  const magicValidation = verifyMagicNumbersFromBuffer(buffer, mimeType);
  if (!magicValidation.valid) {
    return magicValidation;
  }
  
  return { valid: true };
}
