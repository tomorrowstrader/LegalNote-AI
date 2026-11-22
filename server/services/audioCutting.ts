import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";

/**
 * Audio trimming and joining for meeting recordings. Uses ffmpeg when the
 * server has it (FFMPEG_PATH, else `ffmpeg` on PATH). Every function says when it
 * could not do the job, so callers can fall back and record that it happened.
 */

export function ffmpegBinary(): string {
  return process.env.FFMPEG_PATH?.trim() || "ffmpeg";
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegBinary(), ["-hide_banner", "-loglevel", "error", "-y", ...args], {
      stdio: "ignore",
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

/**
 * Drop the first `startSeconds` of an MP3. Returns null if ffmpeg is unavailable
 * or the cut failed; the caller keeps the full recording in that case.
 */
export async function trimMp3Start(buffer: Buffer, startSeconds: number): Promise<Buffer | null> {
  if (!(startSeconds > 0)) return buffer;
  const inPath = join(tmpdir(), `trim-in-${randomUUID()}.mp3`);
  const outPath = join(tmpdir(), `trim-out-${randomUUID()}.mp3`);
  try {
    await fs.writeFile(inPath, buffer);
    await runFfmpeg(["-ss", String(startSeconds), "-i", inPath, "-c", "copy", outPath]);
    const out = await fs.readFile(outPath);
    return out.length > 0 ? out : null;
  } catch (error) {
    console.warn("[AudioCutting] Could not trim recording start:", error);
    return null;
  } finally {
    await Promise.allSettled([fs.unlink(inPath), fs.unlink(outPath)]);
  }
}

/**
 * Join MP3 recordings end to end. Prefers ffmpeg; without it, MP3 frames are
 * joined directly, which players and transcription services read as one file.
 */
export async function joinMp3s(buffers: Buffer[]): Promise<{ buffer: Buffer; method: "ffmpeg" | "frames" }> {
  if (buffers.length === 1) return { buffer: buffers[0], method: "frames" };
  const id = randomUUID();
  const inPaths = buffers.map((_, i) => join(tmpdir(), `join-${id}-${i}.mp3`));
  const listPath = join(tmpdir(), `join-${id}.txt`);
  const outPath = join(tmpdir(), `join-${id}-out.mp3`);
  try {
    await Promise.all(buffers.map((b, i) => fs.writeFile(inPaths[i], b)));
    await fs.writeFile(listPath, inPaths.map((p) => `file '${p}'`).join("\n"));
    await runFfmpeg(["-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath]);
    const out = await fs.readFile(outPath);
    if (out.length > 0) return { buffer: out, method: "ffmpeg" };
  } catch (error) {
    console.warn("[AudioCutting] ffmpeg join failed, joining MP3 frames directly:", error);
  } finally {
    await Promise.allSettled([...inPaths, listPath, outPath].map((p) => fs.unlink(p)));
  }
  return { buffer: Buffer.concat(buffers), method: "frames" };
}
