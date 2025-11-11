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
            ipAddress: 'system',
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
 */
export async function cleanupOldAudioFiles(userId: string): Promise<{
  deleted: number;
  errors: number;
}> {
  try {
    const cases = await storage.getCases(userId);
    const cutoffDate = DateTime.now()
      .minus({ days: AUDIO_RETENTION_DAYS })
      .toJSDate();

    let deleted = 0;
    let errors = 0;

    for (const caseRecord of cases) {
      if (caseRecord.audioUrl && caseRecord.recordedAt) {
        // Check if audio is older than retention period
        if (caseRecord.recordedAt < cutoffDate) {
          try {
            // Delete from object storage
            const objectStorage = new ObjectStorageService();
            const urlParts = caseRecord.audioUrl.split('/');
            const objectKey = urlParts[urlParts.length - 1];
            
            // Actually delete the audio file from object storage
            await objectStorage.deleteObjectEntity(objectKey);

            // Update case to remove audio URL
            await storage.updateCase(caseRecord.id, userId, {
              audioUrl: null,
            });

            deleted++;

            console.log('[DATA-RETENTION] Deleted old audio file:', {
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
              }),
              ipAddress: 'system',
              userAgent: 'data-retention-service',
            });
          } catch (error) {
            console.error('[DATA-RETENTION] Error deleting audio file:', error);
            errors++;
          }
        }
      }
    }

    return { deleted, errors };
  } catch (error) {
    console.error('[DATA-RETENTION] Error in cleanupOldAudioFiles:', error);
    return { deleted: 0, errors: 1 };
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
  audioFiles: { deleted: number; errors: number };
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
      consentLogsArchived: consentLogs.archived,
      totalErrors,
    }),
    ipAddress: 'system',
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
