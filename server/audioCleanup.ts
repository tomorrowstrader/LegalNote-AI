import { storage } from "./storage";
import { ObjectStorageService } from "./objectStorage";
import { logAuditEvent } from "./auditMiddleware";

/**
 * GDPR Compliance: Clean up expired audio recordings
 * This runs on server startup to ensure any already-expired audio is deleted
 */
export async function cleanupExpiredAudio(): Promise<void> {
  try {
    const expiredRecordings = await storage.getExpiredAudioRecordings();
    
    if (expiredRecordings.length === 0) {
      console.log('[GDPR] No expired audio recordings to clean up');
      return;
    }
    
    console.log(`[GDPR] Found ${expiredRecordings.length} expired audio recording(s) to clean up`);
    
    const objectStorageService = new ObjectStorageService();
    
    for (const recording of expiredRecordings) {
      try {
        if (recording.filePath) {
          // Delete from object storage
          await objectStorageService.deleteObjectEntity(recording.filePath);
          
          // Mark as deleted in database
          await storage.updateAudioRecording(recording.id, { deletedAt: new Date() });
          
          // Log audit event (system-initiated deletion)
          await logAuditEvent("system", "audio_deleted", {
            caseId: recording.caseId,
            audioRecordingId: recording.id,
            metadata: {
              reason: "startup_cleanup_7day_retention_policy",
              filePath: recording.filePath,
              expiresAt: recording.expiresAt.toISOString(),
              deletedAt: new Date().toISOString(),
            },
            severity: "warning",
          });
          
          console.log(`[GDPR] Deleted expired audio: ${recording.id} (case: ${recording.caseId})`);
        }
      } catch (error) {
        console.error(`[GDPR] Failed to delete expired audio ${recording.id}:`, error);
      }
    }
    
    console.log(`[GDPR] Cleanup complete: ${expiredRecordings.length} recording(s) processed`);
  } catch (error) {
    console.error('[GDPR] Error during audio cleanup:', error);
  }
}
