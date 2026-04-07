import { storage } from '../storage';
import { ObjectStorageService } from '../objectStorage';
import { DateTime } from 'luxon';

/**
 * Data Retention Cleanup Service
 * 
 * GDPR Compliance: Automatically removes expired data
 * - Expired share links
 * - Old audio files (7-day retention)
 * - Expired consent logs
 * - Old session data
 */

const AUDIO_RETENTION_DAYS = 7;
const SHARE_LINK_GRACE_PERIOD_DAYS = 7; // Keep for 7 days after expiration
const CONSENT_LOG_RETENTION_YEARS = 7; // UK GDPR requirement for legal records

/**
 * Consent segment retention: INDEFINITE
 * 
 * Consent audio segments are preserved indefinitely because:
 * 1. They document the legal basis for processing client data (GDPR Article 7)
 * 2. They provide evidence of informed consent in case of disputes
 * 3. Solicitor professional liability cases can arise years after the meeting
 * 4. The storage cost is minimal (typically 20-60 seconds per recording)
 * 
 * Consent segments are identified by:
 * - Path containing 'consent/' directory
 * - Filename containing '_consent' suffix
 */
function isConsentSegment(filePath: string): boolean {
  if (!filePath) return false;
  return filePath.includes('consent/') || filePath.includes('_consent');
}

/**
 * Clean up expired share links
 */
export async function cleanupExpiredShareLinks(userId: string): Promise<{
  deleted: number;
  errors: number;
}> {
  try {
    const allLinks = await storage.getShareLinks(userId);
    const now = new Date();
    const gracePeriod = DateTime.now()
      .minus({ days: SHARE_LINK_GRACE_PERIOD_DAYS })
      .toJSDate();

    let deleted = 0;
    let errors = 0;

    for (const link of allLinks) {
      // Delete if expired AND past grace period
      if (link.expiresAt && link.expiresAt < gracePeriod) {
        try {
          await storage.deleteShareLink(link.id, userId);
          deleted++;
          
          console.log('[DATA-RETENTION] Deleted expired share link:', {
            linkId: link.id,
            caseId: link.caseId,
            expiresAt: link.expiresAt,
          });

          // Audit log
          await storage.createAuditLog({
            userId,
            action: 'cleanup.share_link_deleted',
            resourceType: 'share_link',
            resourceId: link.id,
            details: JSON.stringify({
              caseId: link.caseId,
              expiresAt: link.expiresAt,
              reason: 'automatic_retention_cleanup',
            }),
            ipAddress: 'server-process',
            userAgent: 'data-retention-service',
          });
        } catch (error) {
          console.error('[DATA-RETENTION] Error deleting share link:', error);
          errors++;
        }
      }
    }

    return { deleted, errors };
  } catch (error) {
    console.error('[DATA-RETENTION] Error in cleanupExpiredShareLinks:', error);
    return { deleted: 0, errors: 1 };
  }
}

/**
 * Clean up old audio files (7-day retention policy)
 * IMPORTANT: Respects litigation holds - cases under litigation hold are exempt from auto-deletion
 */
export async function cleanupOldAudioFiles(userId: string): Promise<{
  deleted: number;
  errors: number;
  skippedLitigationHold: number;
}> {
  try {
    const cases = await storage.getCases(userId);
    const cutoffDate = DateTime.now()
      .minus({ days: AUDIO_RETENTION_DAYS })
      .toJSDate();

    let deleted = 0;
    let errors = 0;
    let skippedLitigationHold = 0;

    for (const caseRecord of cases) {
      if (caseRecord.audioUrl && caseRecord.recordedAt) {
        // Check if audio is older than retention period
        if (caseRecord.recordedAt < cutoffDate) {
          // CRITICAL: Respect litigation holds - never auto-delete data under hold
          if ((caseRecord as any).litigationHold === true) {
            skippedLitigationHold++;
            console.log('[DATA-RETENTION] Skipped audio deletion - case under litigation hold:', {
              caseId: caseRecord.id,
              litigationHoldAppliedAt: (caseRecord as any).litigationHoldAppliedAt,
              litigationHoldReason: (caseRecord as any).litigationHoldReason,
            });
            
            // Audit the skip for compliance trail - attribute properly for defensibility
            // Priority: 1) Hold applier (known actor), 2) Case owner (matter owner), 3) "legacy_hold" for unknown
            const holdAppliedBy = (caseRecord as any).litigationHoldAppliedBy;
            const auditUserId = holdAppliedBy || userId; // Fallback to matter owner if applier unknown
            const isLegacyHold = !holdAppliedBy; // Track if this is a legacy hold without proper attribution
            
            await storage.createAuditLog({
              userId: auditUserId,
              action: 'cleanup.audio_skipped_litigation_hold',
              resourceType: 'case',
              resourceId: caseRecord.id,
              details: JSON.stringify({
                recordedAt: caseRecord.recordedAt,
                retentionDays: AUDIO_RETENTION_DAYS,
                litigationHold: true,
                litigationHoldAppliedAt: (caseRecord as any).litigationHoldAppliedAt || 'unknown',
                litigationHoldAppliedBy: holdAppliedBy || 'unknown_legacy',
                isLegacyHold, // Flag for cases without proper hold attribution
                reason: 'litigation_hold_prevents_deletion',
                matterOwner: userId, // Always record the matter owner for reference
              }),
              ipAddress: 'server-process',
              userAgent: 'data-retention-service',
            });
            continue;
          }
          
          try {
            // Delete from Backblaze B2
            const objectStorage = new ObjectStorageService();
            const urlParts = caseRecord.audioUrl.split('/');
            const objectKey = urlParts[urlParts.length - 1];
            
            // Actually delete the audio file from Backblaze B2
            await objectStorage.deleteObjectEntity(objectKey);

            // Update case to remove audio URL
            await storage.updateCase(caseRecord.id, userId, {
              audioUrl: null,
            });

            deleted++;

            console.log('[DATA-RETENTION] Deleted old audio file from Backblaze B2:', {
              caseId: caseRecord.id,
              recordedAt: caseRecord.recordedAt,
              objectKey,
              daysOld: Math.floor(
                (Date.now() - caseRecord.recordedAt.getTime()) / (1000 * 60 * 60 * 24)
              ),
            });

            // Audit log
            await storage.createAuditLog({
              userId,
              action: 'cleanup.audio_deleted',
              resourceType: 'case',
              resourceId: caseRecord.id,
              details: JSON.stringify({
                recordedAt: caseRecord.recordedAt,
                objectKey,
                retentionDays: AUDIO_RETENTION_DAYS,
                reason: 'automatic_retention_cleanup',
                storage: 'backblaze_b2',
              }),
              ipAddress: 'server-process',
              userAgent: 'data-retention-service',
            });

            let audioDurationSeconds: number | null = null;
            try {
              const audioRec = await storage.getAudioRecordingByCase(caseRecord.id, userId);
              if (audioRec?.duration) {
                audioDurationSeconds = audioRec.duration;
              }
            } catch (err) {
              console.warn('[DATA-RETENTION] Could not retrieve audio duration for GDPR audit entry:', {
                caseId: caseRecord.id,
                error: err instanceof Error ? err.message : String(err),
              });
            }

            const { logAuditEvent } = await import('../auditMiddleware');
            await logAuditEvent(userId, "audio_permanently_deleted", {
              caseId: caseRecord.id,
              ipAddress: "server-process",
              metadata: {
                matterReference: caseRecord.matterReference || "N/A",
                deletionTimestamp: new Date().toISOString(),
                audioDurationSeconds,
                gdprBasis: "retention_period_expired",
                retentionDays: AUDIO_RETENTION_DAYS,
              },
              severity: "warning",
            });
          } catch (error) {
            console.error('[DATA-RETENTION] Error deleting audio file from Backblaze B2:', error);
            errors++;
          }
        }
      }
    }

    return { deleted, errors, skippedLitigationHold };
  } catch (error) {
    console.error('[DATA-RETENTION] Error in cleanupOldAudioFiles:', error);
    return { deleted: 0, errors: 1, skippedLitigationHold: 0 };
  }
}

/**
 * Archive old consent logs (keep for 7 years, then archive)
 * Note: For UK legal practice, consent logs must be retained for 7 years
 */
export async function archiveOldConsentLogs(userId: string): Promise<{
  archived: number;
  errors: number;
}> {
  try {
    const logs = await storage.getConsentLogs(userId);
    const archiveCutoff = DateTime.now()
      .minus({ years: CONSENT_LOG_RETENTION_YEARS })
      .toJSDate();

    let archived = 0;
    let errors = 0;

    // Note: We don't actually delete consent logs due to legal requirements
    // Instead, we could mark them as "archived" in a production system
    // For now, just log what would be archived

    const oldLogs = logs.filter(log => log.timestamp < archiveCutoff);

    if (oldLogs.length > 0) {
      console.log('[DATA-RETENTION] Consent logs eligible for archiving:', {
        count: oldLogs.length,
        oldestLog: oldLogs[0]?.timestamp,
        retentionYears: CONSENT_LOG_RETENTION_YEARS,
      });
    }

    return { archived: 0, errors: 0 };
  } catch (error) {
    console.error('[DATA-RETENTION] Error in archiveOldConsentLogs:', error);
    return { archived: 0, errors: 1 };
  }
}

/**
 * Run full data retention cleanup for a user
 */
export async function runDataRetentionCleanup(userId: string): Promise<{
  shareLinks: { deleted: number; errors: number };
  audioFiles: { deleted: number; errors: number; skippedLitigationHold: number };
  consentLogs: { archived: number; errors: number };
  totalErrors: number;
}> {
  console.log('[DATA-RETENTION] Starting data retention cleanup for user:', userId);

  const shareLinks = await cleanupExpiredShareLinks(userId);
  const audioFiles = await cleanupOldAudioFiles(userId);
  const consentLogs = await archiveOldConsentLogs(userId);

  const totalErrors = shareLinks.errors + audioFiles.errors + consentLogs.errors;

  console.log('[DATA-RETENTION] Cleanup complete:', {
    userId,
    shareLinksDeleted: shareLinks.deleted,
    audioFilesDeleted: audioFiles.deleted,
    audioFilesSkippedLitigationHold: audioFiles.skippedLitigationHold,
    consentLogsArchived: consentLogs.archived,
    totalErrors,
  });

  // Audit log for cleanup execution
  await storage.createAuditLog({
    userId,
    action: 'cleanup.retention_policy_executed',
    resourceType: 'system',
    resourceId: 'data-retention',
    details: JSON.stringify({
      shareLinksDeleted: shareLinks.deleted,
      audioFilesDeleted: audioFiles.deleted,
      audioFilesSkippedLitigationHold: audioFiles.skippedLitigationHold,
      consentLogsArchived: consentLogs.archived,
      totalErrors,
    }),
    ipAddress: 'server-process',
    userAgent: 'data-retention-service',
  });

  return {
    shareLinks,
    audioFiles,
    consentLogs,
    totalErrors,
  };
}

/**
 * Run data retention cleanup for all users (scheduled job)
 */
export async function runGlobalDataRetentionCleanup(): Promise<void> {
  try {
    console.log('[DATA-RETENTION] Starting global data retention cleanup...');

    // Get all users and run cleanup for each
    const allUsers = await storage.getAllUsers();
    console.log(`[DATA-RETENTION] Processing ${allUsers.length} user(s)`);

    let totalShareLinksDeleted = 0;
    let totalAudioFilesDeleted = 0;
    let totalErrors = 0;

    for (const user of allUsers) {
      try {
        const result = await runDataRetentionCleanup(user.id);
        totalShareLinksDeleted += result.shareLinks.deleted;
        totalAudioFilesDeleted += result.audioFiles.deleted;
        totalErrors += result.totalErrors;
      } catch (error) {
        console.error(`[DATA-RETENTION] Error processing user ${user.id}:`, error);
        totalErrors++;
      }
    }

    console.log('[DATA-RETENTION] Global cleanup complete:', {
      usersProcessed: allUsers.length,
      shareLinksDeleted: totalShareLinksDeleted,
      audioFilesDeleted: totalAudioFilesDeleted,
      totalErrors,
    });

    // Also clean up expired session tracking from security monitor
    const { cleanupSessionTracking } = await import('./securityMonitor');
    cleanupSessionTracking();
  } catch (error) {
    console.error('[DATA-RETENTION] Error in global cleanup:', error);
    throw error; // Propagate errors so they're surfaced in cron job logs
  }
}
