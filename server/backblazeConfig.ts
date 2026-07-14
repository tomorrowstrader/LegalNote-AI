/** Backblaze B2 S3-compatible endpoint and region resolution. */

export function getBackblazeS3Endpoint(): string {
  const endpoint = process.env.BACKBLAZE_S3_ENDPOINT?.trim();
  if (!endpoint) {
    throw new Error(
      'BACKBLAZE_S3_ENDPOINT environment variable is required (no default endpoint is permitted)',
    );
  }
  return endpoint.replace(/\/$/, '');
}

/** Derive SigV4 region from the B2 endpoint hostname: s3.{region}.backblazeb2.com */
export function deriveBackblazeRegionFromEndpoint(endpoint: string): string {
  let hostname: string;
  try {
    hostname = new URL(endpoint).hostname;
  } catch {
    throw new Error(`BACKBLAZE_S3_ENDPOINT is not a valid URL: ${endpoint}`);
  }

  const match = /^s3\.([a-z0-9-]+)\.backblazeb2\.com$/i.exec(hostname);
  if (!match) {
    throw new Error(
      `BACKBLAZE_S3_ENDPOINT hostname must match s3.{region}.backblazeb2.com; got "${hostname}"`,
    );
  }

  return match[1];
}

export function getResolvedBackblazeRegion(): string {
  return deriveBackblazeRegionFromEndpoint(getBackblazeS3Endpoint());
}
