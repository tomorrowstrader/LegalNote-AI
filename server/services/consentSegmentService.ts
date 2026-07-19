import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { ObjectStorageService } from "../objectStorage";

const objectStorage = new ObjectStorageService();

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("webm")) return ".webm";
  if (mimeType.includes("mp4")) return ".mp4";
  if (mimeType.includes("ogg")) return ".ogg";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return ".mp3";
  if (mimeType.includes("wav")) return ".wav";
  return ".webm";
}

/**
 * Upload a consent-segment buffer to durable private storage.
 * These objects are intentionally excluded from the 7-day main-audio cleanup.
 */
export async function preserveConsentSegmentFromBuffer(params: {
  audioBuffer: Buffer;
  mimeType: string;
  consentDurationSeconds: number;
}): Promise<{ consentSegmentPath: string; consentDurationSeconds: number }> {
  const extension = extensionForMime(params.mimeType);
  const objectInfo = objectStorage.createPrivateObjectId();
  const consentFileKey = `consent/${objectInfo.key}_consent${extension}`;

  await objectStorage.uploadFile(consentFileKey, params.audioBuffer, params.mimeType);

  return {
    consentSegmentPath: consentFileKey,
    consentDurationSeconds: Math.max(1, Math.round(params.consentDurationSeconds)),
  };
}

/**
 * Extract the opening prefix of a full recording for consent evidence.
 * Prefers ffmpeg when available; returns null if extraction is not possible.
 */
export async function extractConsentAudioPrefix(params: {
  audioBuffer: Buffer;
  mimeType: string;
  durationSeconds: number;
}): Promise<Buffer | null> {
  const seconds = Math.max(1, Math.ceil(params.durationSeconds));
  const extension = extensionForMime(params.mimeType);
  const inPath = join(tmpdir(), `consent-in-${randomUUID()}${extension}`);
  const outPath = join(tmpdir(), `consent-out-${randomUUID()}${extension}`);

  try {
    await fs.writeFile(inPath, params.audioBuffer);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        "ffmpeg",
        ["-hide_banner", "-loglevel", "error", "-y", "-i", inPath, "-t", String(seconds), "-c", "copy", outPath],
        { stdio: "ignore" },
      );
      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
    });

    const extracted = await fs.readFile(outPath);
    return extracted.length > 0 ? extracted : null;
  } catch (error) {
    console.warn("[ConsentSegment] Unable to extract audio prefix with ffmpeg:", error);
    return null;
  } finally {
    await Promise.allSettled([fs.unlink(inPath), fs.unlink(outPath)]);
  }
}

/**
 * Preserve a consent segment carved from a complete recording buffer.
 */
export async function preserveConsentSegmentFromFullAudio(params: {
  audioBuffer: Buffer;
  mimeType: string;
  consentDurationSeconds: number;
}): Promise<{ consentSegmentPath: string; consentDurationSeconds: number } | null> {
  const prefix = await extractConsentAudioPrefix({
    audioBuffer: params.audioBuffer,
    mimeType: params.mimeType,
    durationSeconds: params.consentDurationSeconds,
  });
  if (!prefix) return null;

  return preserveConsentSegmentFromBuffer({
    audioBuffer: prefix,
    mimeType: params.mimeType,
    consentDurationSeconds: params.consentDurationSeconds,
  });
}
