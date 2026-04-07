import { storage } from "./storage";
import { ObjectStorageService } from "./objectStorage";
import { logAuditEvent } from "./auditMiddleware";

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
      console.log('[GDPR] No expired audio recordings to clean up');
      return;
    }
    
    console.log(`[GDPR] Found ${expiredRecordings.length} expired audio recording(s) to clean up`);
    
    const objectStorageService = new ObjectStorageService();
    
    for (const recording of expiredRecordings) {
      try {
        if (recording.filePath) {
          // Delete main audio file from Backblaze B2
          await objectStorageService.deleteObjectEntity(recording.filePath);
          
          const deletionTimestamp = new Date();
          
          // Mark as deleted in database (consent segment path preserved)
          await storage.updateAudioRecording(recording.id, { deletedAt: deletionTimestamp });

          // Look up the case to get matter reference for the audit entry
          const caseRecord = await storage.getCaseById(recording.caseId);
          
          // Log audit event (system-initiated deletion)
          await logAuditEvent("system", "audio_deleted", {
            caseId: recording.caseId,
            audioRecordingId: recording.id,
            ipAddress: "server-process",
            metadata: {
              reason: "startup_cleanup_7day_retention_policy",
              filePath: recording.filePath,
              expiresAt: recording.expiresAt.toISOString(),
              deletedAt: deletionTimestamp.toISOString(),
              storage: "backblaze_b2",
              consentSegmentPreserved: !!(recording as any).consentSegmentPath,
            },
            severity: "warning",
          });

          // Write structured GDPR compliance audit entry for permanent deletion
          await logAuditEvent("system", "audio_permanently_deleted", {
            caseId: recording.caseId,
            audioRecordingId: recording.id,
            ipAddress: "server-process",
            metadata: {
              matterReference: caseRecord?.matterReference || "N/A",
              deletionTimestamp: deletionTimestamp.toISOString(),
              audioDurationSeconds: recording.duration || null,
              gdprBasis: "retention_period_expired",
              retentionDays: 7,
              consentSegmentPreserved: !!(recording as any).consentSegmentPath,
            },
            severity: "warning",
          });
          
          console.log(`[GDPR] Deleted expired audio: ${recording.id} (case: ${recording.caseId})${(recording as any).consentSegmentPath ? ' [consent segment preserved]' : ''}`);
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
