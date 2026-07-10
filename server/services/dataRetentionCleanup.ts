import { storage } from '../storage';
import { DateTime } from 'luxon';
import { deleteExpiredAudioRecording } from './expiredAudioRecordingDeletion';

/**
 * Data Retention Cleanup Service
 *
 * GDPR Compliance: Automatically removes expired data
 * - Expired share links
 * - Old audio files (7-day retention) — global, hold-aware
 * - Expired consent logs
 * - Old session data
 */

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

export type AudioRetentionCleanupResult = {
  deleted: number;
  expiryDeleted: number;
  graceDeleted: number;
  errors: number;
  skippedLitigationHold: number;
};

/**
 * Global hold-aware audio retention cleanup (daily cron backstop).
 * Processes expired recordings and lapsed COLP grace windows through deleteCaseAudioRecording.
 */
export async function cleanupExpiredAudioRecordings(): Promise<AudioRetentionCleanupResult> {
  const result: AudioRetentionCleanupResult = {
    deleted: 0,
    expiryDeleted: 0,
    graceDeleted: 0,
    errors: 0,
    skippedLitigationHold: 0,
  };

  try {
    const expiredRecordings = await storage.getExpiredAudioRecordings();
    const graceExpiredRecordings = await storage.getGraceExpiredAudioRecordings();
    const processedIds = new Set<string>();

    console.log('[DATA-RETENTION] Audio cleanup candidates:', {
      expired: expiredRecordings.length,
      graceExpired: graceExpiredRecordings.length,
    });

    for (const recording of expiredRecordings) {
      if (processedIds.has(recording.id)) continue;
      processedIds.add(recording.id);

      const deletion = await deleteExpiredAudioRecording({
        recording,
        trigger: 'cron_retention',
        auditReason: 'cron_retention_7day_retention_policy',
      });

      switch (deletion.outcome) {
        case 'deleted':
          result.deleted++;
          result.expiryDeleted++;
          console.log('[DATA-RETENTION] Deleted expired audio:', {
            audioRecordingId: recording.id,
            caseId: recording.caseId,
          });
          break;
        case 'skipped_hold':
          result.skippedLitigationHold++;
          console.log('[DATA-RETENTION] Skipped expired audio — litigation hold:', {
            audioRecordingId: recording.id,
            caseId: recording.caseId,
          });
          break;
        case 'error':
          result.errors++;
          console.error('[DATA-RETENTION] Error deleting expired audio:', {
            audioRecordingId: recording.id,
            error: deletion.error,
          });
          break;
        case 'skipped_no_path':
          break;
      }
    }

    for (const recording of graceExpiredRecordings) {
      if (processedIds.has(recording.id)) continue;
      processedIds.add(recording.id);

      const deletion = await deleteExpiredAudioRecording({
        recording,
        trigger: 'cron_grace_expiry',
        auditReason: 'cron_grace_expiry_colp_window_lapsed',
      });

      switch (deletion.outcome) {
        case 'deleted':
          result.deleted++;
          result.graceDeleted++;
          console.log('[DATA-RETENTION] Deleted grace-lapsed audio:', {
            audioRecordingId: recording.id,
            caseId: recording.caseId,
          });
          break;
        case 'skipped_hold':
          result.skippedLitigationHold++;
          console.log('[DATA-RETENTION] Skipped grace-lapsed audio — litigation hold:', {
            audioRecordingId: recording.id,
            caseId: recording.caseId,
          });
          break;
        case 'error':
          result.errors++;
          console.error('[DATA-RETENTION] Error deleting grace-lapsed audio:', {
            audioRecordingId: recording.id,
            error: deletion.error,
          });
          break;
        case 'skipped_no_path':
          break;
      }
    }

    return result;
  } catch (error) {
    console.error('[DATA-RETENTION] Error in cleanupExpiredAudioRecordings:', error);
    return { ...result, errors: result.errors + 1 };
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
 * Run per-user data retention cleanup (share links + consent logs only).
 * Audio cleanup runs globally via cleanupExpiredAudioRecordings().
 */
export async function runDataRetentionCleanup(userId: string): Promise<{
  shareLinks: { deleted: number; errors: number };
  consentLogs: { archived: number; errors: number };
  totalErrors: number;
}> {
  console.log('[DATA-RETENTION] Starting data retention cleanup for user:', userId);

  const shareLinks = await cleanupExpiredShareLinks(userId);
  const consentLogs = await archiveOldConsentLogs(userId);

  const totalErrors = shareLinks.errors + consentLogs.errors;

  console.log('[DATA-RETENTION] Per-user cleanup complete:', {
    userId,
    shareLinksDeleted: shareLinks.deleted,
    consentLogsArchived: consentLogs.archived,
    totalErrors,
  });

  return {
    shareLinks,
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

    const audioFiles = await cleanupExpiredAudioRecordings();

    const allUsers = await storage.getAllUsers();
    console.log(`[DATA-RETENTION] Processing ${allUsers.length} user(s) for share links and consent logs`);

    let totalShareLinksDeleted = 0;
    let totalConsentLogsArchived = 0;
    let totalErrors = audioFiles.errors;

    for (const user of allUsers) {
      try {
        const result = await runDataRetentionCleanup(user.id);
        totalShareLinksDeleted += result.shareLinks.deleted;
        totalConsentLogsArchived += result.consentLogs.archived;
        totalErrors += result.totalErrors;
      } catch (error) {
        console.error(`[DATA-RETENTION] Error processing user ${user.id}:`, error);
        totalErrors++;
      }
    }

    console.log('[DATA-RETENTION] Global cleanup complete:', {
      usersProcessed: allUsers.length,
      shareLinksDeleted: totalShareLinksDeleted,
      audioFilesDeleted: audioFiles.deleted,
      audioFilesExpiryDeleted: audioFiles.expiryDeleted,
      audioFilesGraceDeleted: audioFiles.graceDeleted,
      audioFilesSkippedLitigationHold: audioFiles.skippedLitigationHold,
      consentLogsArchived: totalConsentLogsArchived,
      totalErrors,
    });

    const auditUserId = process.env.ADMIN_USER_ID || allUsers[0]?.id || 'system';
    await storage.createAuditLog({
      userId: auditUserId,
      action: 'cleanup.retention_policy_executed',
      resourceType: 'system',
      resourceId: 'data-retention',
      details: JSON.stringify({
        shareLinksDeleted: totalShareLinksDeleted,
        audioFilesDeleted: audioFiles.deleted,
        audioFilesExpiryDeleted: audioFiles.expiryDeleted,
        audioFilesGraceDeleted: audioFiles.graceDeleted,
        audioFilesSkippedLitigationHold: audioFiles.skippedLitigationHold,
        consentLogsArchived: totalConsentLogsArchived,
        totalErrors,
      }),
      ipAddress: 'server-process',
      userAgent: 'data-retention-service',
    });

    // Also clean up expired session tracking from security monitor
    const { cleanupSessionTracking } = await import('./securityMonitor');
    cleanupSessionTracking();
  } catch (error) {
    console.error('[DATA-RETENTION] Error in global cleanup:', error);
    throw error; // Propagate errors so they're surfaced in cron job logs
  }
}
