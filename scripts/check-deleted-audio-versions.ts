/**
 * Read-only: does Backblaze still hold copies of a recording LegalNote marked as deleted?
 *
 * Lists stored versions of the recording's audio file (sizes and dates only). Downloads
 * nothing, changes nothing, prints no credentials. Uses the live storage settings via
 * `railway run`.
 *
 *   railway run npx tsx scripts/check-deleted-audio-versions.ts <caseId>
 */
import pg from "pg";
import { GetBucketVersioningCommand, ListObjectVersionsCommand, S3Client } from "@aws-sdk/client-s3";
import { getBackblazeS3Endpoint, getResolvedBackblazeRegion } from "../server/backblazeConfig";

pg.types.setTypeParser(1114, (value: string) => new Date(value.replace(" ", "T") + "Z"));

/** Same mapping as ObjectStorageService.resolveS3KeyFromPath. */
function keyFor(dbPath: string): string {
  if (dbPath.startsWith("consent//objects/")) return dbPath.replace("consent//objects/", "consent/.private/uploads/");
  if (dbPath.startsWith("recovered//objects/")) return dbPath.replace("recovered//objects/", "recovered/.private/uploads/");
  if (dbPath.startsWith("/objects/")) return `.private/uploads/${dbPath.replace("/objects/", "")}`;
  if (dbPath.startsWith(".private/uploads/")) return dbPath;
  return dbPath.startsWith("/") ? dbPath.substring(1) : dbPath;
}

async function main() {
  const caseId = process.argv[2];
  if (!caseId) throw new Error("Usage: npx tsx scripts/check-deleted-audio-versions.ts <caseId>");
  const bucket = process.env.BACKBLAZE_BUCKET_NAME;
  if (!bucket) throw new Error("Storage settings not found. Run this with `railway run`.");

  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  let recordings: Array<{ id: string; file_path: string | null; consent_segment_path: string | null; deleted_at: Date | null; duration: number | null }>;
  try {
    await db.query("BEGIN READ ONLY");
    recordings = (await db.query(
      `SELECT id, file_path, consent_segment_path, deleted_at, duration FROM audio_recordings WHERE case_id = $1`,
      [caseId],
    )).rows;
    await db.query("ROLLBACK");
  } finally {
    await db.end();
  }

  const s3 = new S3Client({
    region: getResolvedBackblazeRegion(),
    credentials: {
      accessKeyId: process.env.BACKBLAZE_KEY_ID || "",
      secretAccessKey: process.env.BACKBLAZE_APPLICATION_KEY || "",
    },
    endpoint: getBackblazeS3Endpoint(),
    forcePathStyle: true,
  });

  try {
    const versioning = await s3.send(new GetBucketVersioningCommand({ Bucket: bucket }));
    console.log("Bucket versioning:", versioning.Status ?? "not reported");
  } catch (error) {
    console.log("Bucket versioning: could not read", error instanceof Error ? `(${error.name})` : "");
  }

  for (const rec of recordings) {
    console.log(`\nRecording ${rec.id.slice(0, 8)}: ${rec.duration ? Math.round(rec.duration / 60) + " min" : "length unknown"}, marked deleted ${rec.deleted_at ? rec.deleted_at.toISOString() : "no"}`);
    for (const [label, path] of [["main audio", rec.file_path], ["consent clip", rec.consent_segment_path]] as const) {
      if (!path) continue;
      const key = keyFor(path);
      const listed = await s3.send(new ListObjectVersionsCommand({ Bucket: bucket, Prefix: key }));
      const versions = (listed.Versions ?? []).filter((v) => v.Key === key);
      const markers = (listed.DeleteMarkers ?? []).filter((m) => m.Key === key);
      console.log(`  ${label}: ${versions.length} stored version(s), ${markers.length} delete marker(s)`);
      for (const v of versions) {
        console.log(`    version saved ${v.LastModified?.toISOString()} size ${((v.Size ?? 0) / 1024 / 1024).toFixed(1)} MB${v.IsLatest ? " (current)" : ""}`);
      }
      for (const m of markers) {
        console.log(`    deleted ${m.LastModified?.toISOString()}${m.IsLatest ? " (current state: deleted)" : ""}`);
      }
    }
  }
}

main().catch((error) => {
  console.error("Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
