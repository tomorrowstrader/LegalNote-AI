/**
 * Throwaway verification: B2 accepts SigV4 with region derived from BACKBLAZE_S3_ENDPOINT.
 * Usage: npx tsx scripts/b2-derived-region-test.ts
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  deriveBackblazeRegionFromEndpoint,
  getBackblazeS3Endpoint,
} from '../server/backblazeConfig';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const envPath = join(scriptDir, '..', '.env');

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  const endpoint = getBackblazeS3Endpoint();
  const region = deriveBackblazeRegionFromEndpoint(endpoint);
  const bucket = process.env.BACKBLAZE_BUCKET_NAME;
  const keyId = process.env.BACKBLAZE_KEY_ID;
  const appKey = process.env.BACKBLAZE_APPLICATION_KEY;

  if (!bucket || !keyId || !appKey) {
    throw new Error('BACKBLAZE_BUCKET_NAME, BACKBLAZE_KEY_ID, and BACKBLAZE_APPLICATION_KEY are required');
  }

  console.log(`Endpoint: ${endpoint}`);
  console.log(`Derived region: ${region}`);
  console.log(`Bucket: ${bucket}`);

  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: keyId,
      secretAccessKey: appKey,
    },
  });

  const testKey = `.private/uploads/b2-region-test-${randomUUID()}`;
  const payload = Buffer.from(`b2-derived-region-test ${new Date().toISOString()}`);

  console.log('Uploading...');
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: testKey,
      Body: payload,
      ContentType: 'text/plain',
    }),
  );

  console.log('Presigning download URL...');
  const signedUrl = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: testKey }),
    { expiresIn: 60 },
  );
  if (!signedUrl.includes(bucket)) {
    throw new Error(`Presigned URL looks invalid: ${signedUrl}`);
  }

  console.log('Downloading...');
  const downloaded = await client.send(new GetObjectCommand({ Bucket: bucket, Key: testKey }));
  const body = await downloaded.Body?.transformToByteArray();
  if (!body || Buffer.from(body).compare(payload) !== 0) {
    throw new Error('Downloaded payload does not match uploaded payload');
  }

  console.log('Deleting...');
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: testKey }));

  console.log('PASS — upload, presign, download, delete succeeded with derived region');
}

main().catch((error) => {
  console.error('FAIL —', error instanceof Error ? error.message : error);
  process.exit(1);
});
