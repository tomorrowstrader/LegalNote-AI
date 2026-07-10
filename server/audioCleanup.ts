import { storage } from "./storage";
import { deleteExpiredAudioRecording } from "./services/expiredAudioRecordingDeletion";

/**
 * GDPR Compliance: Clean up expired audio recordings
 * This runs on server startup to ensure any already-expired audio is deleted
 *
 * IMPORTANT: Consent segment audio files are NEVER deleted
 * - Consent segments document the legal basis for processing (GDPR Article 7)
 * - They are preserved indefinitely for solicitor professional protection
 * - Only the main recording is subject to the 7-day retention policy
 */
export async function cleanupExpiredAudio(): Promise<void> {
  try {
    const expiredRecordings = await storage.getExpiredAudioRecordings();

    if (expiredRecordings.length === 0) {
      console.log("[GDPR] No expired audio recordings to clean up");
      return;
    }

    console.log(`[GDPR] Found ${expiredRecordings.length} expired audio recording(s) to clean up`);

    let deleted = 0;
    let skippedHold = 0;
    let errors = 0;

    for (const recording of expiredRecordings) {
      const result = await deleteExpiredAudioRecording({
        recording,
        trigger: "startup_cleanup",
        auditReason: "startup_cleanup_7day_retention_policy",
      });

      switch (result.outcome) {
        case "deleted":
          deleted++;
          console.log(
            `[GDPR] Deleted expired audio: ${recording.id} (case: ${recording.caseId})${recording.consentSegmentPath ? " [consent segment preserved]" : ""}`,
          );
          break;
        case "skipped_hold":
          skippedHold++;
          console.log(`[GDPR] Skipped expired audio ${recording.id} — case under litigation hold`);
          break;
        case "skipped_no_path":
          break;
        case "error":
          errors++;
          console.error(`[GDPR] Failed to delete expired audio ${recording.id}:`, result.error);
          break;
      }
    }

    console.log(
      `[GDPR] Cleanup complete: ${expiredRecordings.length} recording(s) processed (${deleted} deleted, ${skippedHold} held, ${errors} errors)`,
    );
  } catch (error) {
    console.error("[GDPR] Error during audio cleanup:", error);
  }
}
