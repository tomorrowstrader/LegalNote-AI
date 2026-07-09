import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Response } from "express";
import { randomUUID } from "crypto";
import { Readable } from "stream";

// Initialize S3 client for Backblaze B2 (S3-compatible)
const s3Client = new S3Client({
  region: "us-west-004", // Backblaze region (can vary based on endpoint)
  credentials: {
    accessKeyId: process.env.BACKBLAZE_KEY_ID || "",
    secretAccessKey: process.env.BACKBLAZE_APPLICATION_KEY || "",
  },
  endpoint: process.env.BACKBLAZE_S3_ENDPOINT || "https://s3.us-west-004.backblazeb2.com",
  forcePathStyle: true, // Backblaze B2 requires path-style URLs
});

const BUCKET_NAME = process.env.BACKBLAZE_BUCKET_NAME || "";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {
    if (!BUCKET_NAME) {
      throw new Error("BACKBLAZE_BUCKET_NAME environment variable not set");
    }
  }

  getPublicObjectSearchPaths(): Array<string> {
    return ["public"];
  }

  getPrivateObjectDir(): string {
    return ".private";
  }

  /** Parse a single `bytes=start-end` range header; returns null if unparseable. */
  private parseByteRange(rangeHeader: string): { start: number; end?: number; openEnded: boolean } | null {
    const match = /^bytes=(\d+)-(\d*)$/i.exec(rangeHeader.trim());
    if (!match) return null;

    const start = parseInt(match[1], 10);
    if (isNaN(start) || start < 0) return null;

    const endStr = match[2];
    if (endStr === "") {
      return { start, openEnded: true };
    }

    const end = parseInt(endStr, 10);
    if (isNaN(end) || end < start) return null;

    return { start, end, openEnded: false };
  }

  async downloadObject(fileKey: string | Buffer, res: Response, cacheTtlSec: number = 3600) {
    try {
      // If fileKey is a Buffer, it's already been fetched, just stream it
      if (Buffer.isBuffer(fileKey)) {
        res.status(200);
        res.set({
          "Content-Type": "application/octet-stream",
          "Content-Length": fileKey.length.toString(),
          "Cache-Control": `private, max-age=${cacheTtlSec}`,
        });
        res.end(fileKey);
        return;
      }

      // Convert database path to S3 key
      const key = this.resolveS3KeyFromPath(fileKey);
      const rangeHeader = res.req?.headers.range;
      const parsedRange = typeof rangeHeader === "string" ? this.parseByteRange(rangeHeader) : null;

      if (parsedRange) {
        let { start, end } = parsedRange;
        let totalSize: number | undefined;

        if (parsedRange.openEnded) {
          const head = await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
          totalSize = head.ContentLength ?? 0;
          if (start >= totalSize) {
            res.status(416);
            res.set({ "Content-Range": `bytes */${totalSize}` });
            res.end();
            return;
          }
          end = totalSize - 1;
        }

        const rangeSpec = `bytes=${start}-${end}`;
        let data;
        try {
          data = await s3Client.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Range: rangeSpec,
          }));
        } catch (rangeError: any) {
          if (rangeError?.$metadata?.httpStatusCode === 416 || rangeError?.name === "InvalidRange") {
            const head = await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
            const totalSize = head.ContentLength ?? 0;
            res.status(416);
            res.set({ "Content-Range": `bytes */${totalSize}` });
            res.end();
            return;
          }
          throw rangeError;
        }

        let contentRange = data.ContentRange;
        if (!contentRange) {
          if (totalSize === undefined) {
            const head = await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
            totalSize = head.ContentLength ?? 0;
          }
          const servedEnd = end ?? start + (data.ContentLength ?? 0) - 1;
          contentRange = `bytes ${start}-${servedEnd}/${totalSize}`;
        }

        const contentType = data.ContentType || "application/octet-stream";
        res.status(206);
        res.set({
          "Content-Type": contentType,
          "Content-Length": (data.ContentLength ?? 0).toString(),
          "Content-Range": contentRange,
          "Accept-Ranges": "bytes",
          "Cache-Control": `private, max-age=${cacheTtlSec}`,
        });

        if (data.Body instanceof Readable) {
          data.Body.pipe(res);
        } else {
          res.end(data.Body);
        }
        return;
      }

      // Full file download (no range header, or unparseable range)
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      const data = await s3Client.send(command);
      const contentType = data.ContentType || "application/octet-stream";
      const contentLength = data.ContentLength || 0;

      res.status(200);
      res.set({
        "Content-Type": contentType,
        "Content-Length": contentLength.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": `private, max-age=${cacheTtlSec}`,
      });

      if (data.Body instanceof Readable) {
        data.Body.pipe(res);
      } else {
        res.end(data.Body);
      }
    } catch (error) {
      console.error("Error downloading file from Backblaze B2:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error streaming file" });
      }
    }
  }

  async getObjectEntityUploadURL(maxSizeBytes?: number): Promise<string> {
    const objectId = randomUUID();
    const fullPath = `.private/uploads/${objectId}`;

    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fullPath,
        ...(maxSizeBytes && { ContentLength: maxSizeBytes }),
      });

      // Generate presigned URL valid for 15 minutes
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
      return signedUrl;
    } catch (error) {
      console.error("Error generating presigned URL:", error);
      throw new Error("Failed to generate upload URL");
    }
  }

  async deleteObjectEntity(objectPath: string): Promise<void> {
    try {
      // Convert database path to S3 key
      const key = this.resolveS3KeyFromPath(objectPath);

      console.log(`[S3] Deleting object: ${key} from bucket: ${BUCKET_NAME}`);

      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      const response = await s3Client.send(command);
      console.log(`[S3] Delete response:`, response.$metadata?.httpStatusCode);
    } catch (error) {
      console.error(`[S3] Error deleting object ${objectPath}:`, error);
      throw new Error(`Failed to delete object from Backblaze B2: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async uploadFile(fileKey: string, fileContent: Buffer, contentType: string): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
        Body: fileContent,
        ContentType: contentType,
      });

      await s3Client.send(command);
      console.log(`[S3] Successfully uploaded ${fileKey}`);
    } catch (error) {
      console.error(`[S3] Error uploading file:`, error);
      throw new Error(`Failed to upload file to Backblaze B2: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getObjectEntityFile(objectPath: string): Promise<Buffer> {
    try {
      // Convert database path to S3 key
      const key = this.resolveS3KeyFromPath(objectPath);

      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      const data = await s3Client.send(command);
      
      if (!data.Body) {
        throw new ObjectNotFoundError();
      }

      // Convert stream to buffer
      if (data.Body instanceof Readable) {
        return new Promise((resolve, reject) => {
          const chunks: any[] = [];
          data.Body!.on("data", (chunk) => chunks.push(chunk));
          data.Body!.on("end", () => resolve(Buffer.concat(chunks)));
          data.Body!.on("error", reject);
        });
      } else {
        return Buffer.from(data.Body as any);
      }
    } catch (error) {
      if (error instanceof ObjectNotFoundError) throw error;
      console.error(`[S3] Error getting file:`, error);
      throw new ObjectNotFoundError();
    }
  }

  normalizeObjectEntityPath(rawPath: string): string {
    // Normalize S3 URLs to local format
    if (rawPath.includes("backblazeb2.com") || rawPath.includes("amazonaws.com")) {
      const url = new URL(rawPath);
      const key = url.pathname.split("/").pop();
      if (key) {
        return `/objects/${key}`;
      }
    }
    return rawPath;
  }

  // Path translation helpers: Database format <-> S3 key format
  createPrivateObjectId(): { id: string; key: string; dbPath: string } {
    const id = randomUUID();
    return {
      id,
      key: `.private/uploads/${id}`,
      dbPath: `/objects/${id}`,
    };
  }

  resolveS3KeyFromPath(dbPath: string): string {
    // Legacy-compatibility shims for pre-fix stored paths.
    // The consent branch can be retired once the Jazz-001 backfill (B5) is confirmed.
    if (dbPath.startsWith("consent//objects/")) {
      return dbPath.replace("consent//objects/", "consent/.private/uploads/");
    }
    // Forward-compat for recovered-audio paths (not used by consent segments; see Phase D deletion work).
    if (dbPath.startsWith("recovered//objects/")) {
      return dbPath.replace("recovered//objects/", "recovered/.private/uploads/");
    }
    // Convert database path format (/objects/{uuid}) to S3 key (.private/uploads/{uuid})
    if (dbPath.startsWith("/objects/")) {
      const id = dbPath.replace("/objects/", "");
      return `.private/uploads/${id}`;
    }
    // If it's already in S3 key format, return as-is
    if (dbPath.startsWith(".private/uploads/")) {
      return dbPath;
    }
    // Fallback: remove leading slash and use as-is
    return dbPath.startsWith("/") ? dbPath.substring(1) : dbPath;
  }

  // Get file contents as Buffer (for recovery operations)
  async getFile(fileKey: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
      });

      const data = await s3Client.send(command);
      
      if (!data.Body) {
        throw new ObjectNotFoundError();
      }

      // Convert stream to buffer
      if (data.Body instanceof Readable) {
        return new Promise((resolve, reject) => {
          const chunks: Buffer[] = [];
          (data.Body as Readable).on("data", (chunk) => chunks.push(chunk));
          (data.Body as Readable).on("end", () => resolve(Buffer.concat(chunks)));
          (data.Body as Readable).on("error", reject);
        });
      } else {
        return Buffer.from(data.Body as any);
      }
    } catch (error) {
      console.error(`[S3] Error getting file ${fileKey}:`, error);
      throw new ObjectNotFoundError();
    }
  }

  // List all chunk keys for a session from durable storage
  async listChunks(sessionId: string): Promise<{ key: string; index: number; size: number }[]> {
    const prefix = `chunks/${sessionId}/`;
    const chunks: { key: string; index: number; size: number }[] = [];
    
    try {
      let continuationToken: string | undefined;
      
      do {
        const command = new ListObjectsV2Command({
          Bucket: BUCKET_NAME,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        });
        
        const response = await s3Client.send(command);
        
        if (response.Contents) {
          for (const obj of response.Contents) {
            if (obj.Key) {
              // Extract chunk number from key: chunks/{sessionId}/chunk_000001.webm -> 1
              const match = obj.Key.match(/chunk_(\d{6})\.\w+$/);
              if (match) {
                const index = parseInt(match[1], 10);
                chunks.push({
                  key: obj.Key,
                  index,
                  size: obj.Size || 0,
                });
              }
            }
          }
        }
        
        continuationToken = response.NextContinuationToken;
      } while (continuationToken);
      
      // Sort by index
      chunks.sort((a, b) => a.index - b.index);
      console.log(`[S3] Listed ${chunks.length} chunks for session ${sessionId}`);
      return chunks;
    } catch (error) {
      console.error(`[S3] Error listing chunks for session ${sessionId}:`, error);
      return [];
    }
  }

  // Delete multiple chunks for a session (cleanup) - uses raw S3 key directly
  async deleteChunks(sessionId: string, extension: string, chunkCount: number): Promise<void> {
    for (let i = 0; i < chunkCount; i++) {
      const chunkKey = `chunks/${sessionId}/chunk_${i.toString().padStart(6, '0')}${extension}`;
      try {
        const command = new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: chunkKey,
        });
        await s3Client.send(command);
      } catch (e) {
        // Continue with other chunks even if one fails
      }
    }
    console.log(`[S3] Cleaned up ${chunkCount} chunks for session ${sessionId}`);
  }
}
