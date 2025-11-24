import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
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

  async downloadObject(fileKey: string, res: Response, cacheTtlSec: number = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
      });

      const data = await s3Client.send(command);
      const contentType = data.ContentType || "application/octet-stream";
      const contentLength = data.ContentLength || 0;
      const rangeHeader = res.req?.headers.range;

      // Support Range requests for audio/video playback
      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1;
        const chunkSize = end - start + 1;

        res.status(206);
        res.set({
          "Content-Type": contentType,
          "Content-Length": chunkSize.toString(),
          "Content-Range": `bytes ${start}-${end}/${contentLength}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": `private, max-age=${cacheTtlSec}`,
        });

        // For range requests, we need to read and slice the stream
        if (data.Body instanceof Readable) {
          data.Body.pipe(res);
        } else {
          res.end(data.Body);
        }
      } else {
        // Full file download
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
      // Normalize path - accept both with and without leading slash
      let key = objectPath;
      if (key.startsWith("/")) {
        key = key.substring(1);
      }

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
      let key = objectPath;
      if (key.startsWith("/")) {
        key = key.substring(1);
      }

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
}
