import cron from 'node-cron';
import { jobQueue } from './services/jobQueue';
import { AIProcessingPipeline } from './services/aiProcessingPipeline';
import { storage } from './storage';
import { runGlobalDataRetentionCleanup } from './services/dataRetentionCleanup';
import { cleanupSessionTracking } from './services/securityMonitor';
import { meetingSchedulerService } from './services/meetingSchedulerService';
import { checkLiveImports } from './services/recallProcessing';
import { logAuditEvent } from './auditMiddleware';

/**
 * Initialize job queue workers on server startup
 */
export function initializeWorkers() {
  console.log('[WORKERS] Initializing job queue workers...');

  // Register AI processing job handler
  jobQueue.registerHandler('ai-processing', async (data: { caseId: string; userId: string; sessionId?: string }) => {
    console.log(`[AI-WORKER] Starting AI processing for case ${data.caseId}${data.sessionId ? ` session ${data.sessionId}` : ''}`);

    const { assertSealedConsent, SealedConsentError } = await import('./services/assertSealedConsent');
    const { requiresSealedConsentForProcessing } = await import('@shared/schema');
    let audioRecordingId: string | undefined;
    if (data.sessionId) {
      const sessionAudio = await storage.getAudioRecordingBySession(data.sessionId);
      audioRecordingId = sessionAudio?.id;
    }
    if (!audioRecordingId) {
      const caseAudio = await storage.getAudioRecordingByCase(data.caseId, data.userId);
      audioRecordingId = caseAudio?.id;
    }

    const caseForConsent = await storage.getCase(data.caseId, data.userId);
    if (requiresSealedConsentForProcessing(
      (caseForConsent as { matterKind?: string } | undefined)?.matterKind,
      (caseForConsent as { hasExternalAttendees?: boolean } | undefined)?.hasExternalAttendees,
    )) {
      try {
        await assertSealedConsent(data.caseId, data.userId, audioRecordingId);
      } catch (error: any) {
        if (error instanceof SealedConsentError) {
          console.error(`[AI-WORKER] Sealed consent gate failed for case ${data.caseId}:`, error.message);
          throw new Error(error.message);
        }
        throw error;
      }
    }
    
    const pipeline = new AIProcessingPipeline(storage);
    
    try {
      const result = await pipeline.processCase(data.caseId, data.userId, data.sessionId);
      
      if (result.success) {
        console.log(`[AI-WORKER] Successfully processed case ${data.caseId}. Cost: $${result.totalCost.toFixed(4)}`);
      } else {
        console.error(`[AI-WORKER] Failed to process case ${data.caseId}:`, result.error);
        throw new Error(result.error || 'AI processing failed');
      }
    } catch (error: any) {
      console.error(`[AI-WORKER] Error processing case ${data.caseId}:`, error);
      throw error; // Re-throw to trigger job retry
    }
  });

  // Further version production — same derivation doc-gen path as meeting-end pipeline
  jobQueue.registerHandler(
    'produce-document-version',
    async (data: { caseId: string; documentId: string; userId: string; reason?: string }) => {
      console.log(
        `[PRODUCE-VERSION-WORKER] Starting further version for document ${data.documentId} on case ${data.caseId}`,
      );
      const { produceDocumentVersion } = await import('./services/produceDocumentVersion');
      try {
        const newVersion = await produceDocumentVersion({
          storage,
          caseId: data.caseId,
          documentId: data.documentId,
          userId: data.userId,
          reason: data.reason,
          trackProgress: true,
        });
        console.log(
          `[PRODUCE-VERSION-WORKER] Produced version ${newVersion.version} (${newVersion.id}) for case ${data.caseId}`,
        );

        const doc = await storage.getDocument(newVersion.id);
        if (doc?.meetingSessionId) {
          await storage.updateMeetingSession(doc.meetingSessionId, { status: 'completed' });
        }
      } catch (error: any) {
        console.error(`[PRODUCE-VERSION-WORKER] Error for case ${data.caseId}:`, error);
        throw error;
      }
    },
  );

  // Derive documents from an uploaded/pasted transcript (no audio / AssemblyAI)
  jobQueue.registerHandler(
    'derive-transcript',
    async (data: {
      caseId: string;
      userId: string;
      transcriptId: string;
      sessionId: string;
      importId: string;
      recordingType?: string;
      meetingTimestamp?: string;
      durationSeconds?: number | null;
      generateClientLetter?: boolean;
    }) => {
      console.log(
        `[DERIVE-TRANSCRIPT-WORKER] Starting derivation for import ${data.importId} case ${data.caseId}`,
      );
      const { deriveDocumentsFromTranscript } = await import('./services/transcriptDerivationService');
      const { updateTranscriptImportStatus } = await import('./services/transcriptImportService');

      try {
        const result = await deriveDocumentsFromTranscript({
          storage,
          caseId: data.caseId,
          userId: data.userId,
          transcriptId: data.transcriptId,
          sessionId: data.sessionId,
          recordingType: data.recordingType,
          meetingTimestamp: data.meetingTimestamp ? new Date(data.meetingTimestamp) : undefined,
          durationSeconds: data.durationSeconds,
          generateClientLetter: data.generateClientLetter ?? true,
          transcriptionCost: 0,
        });

        if (!result.success) {
          await updateTranscriptImportStatus(data.importId, {
            status: 'failed',
            errorMessage: result.error || 'Derivation failed',
            completedAt: new Date(),
          });
          throw new Error(result.error || 'Transcript derivation failed');
        }

        await updateTranscriptImportStatus(data.importId, {
          status: 'completed',
          errorMessage: null,
          completedAt: new Date(),
        });
        console.log(
          `[DERIVE-TRANSCRIPT-WORKER] Completed import ${data.importId}. Cost: $${result.totalCost.toFixed(4)}`,
        );
      } catch (error: any) {
        console.error(`[DERIVE-TRANSCRIPT-WORKER] Error for case ${data.caseId}:`, error);
        try {
          await updateTranscriptImportStatus(data.importId, {
            status: 'failed',
            errorMessage: error.message || 'Derivation failed',
            completedAt: new Date(),
          });
        } catch {
          /* ignore */
        }
        throw error;
      }
    },
  );

  // Schedule periodic security and maintenance tasks
  scheduleMaintenanceTasks();

  // Register handler for auto-committing expired redactions
  jobQueue.registerHandler('commit-expired-redactions', async () => {
    console.log('[REDACTION-JOB] Starting expired redaction commit sweep...');
    try {
      const { storage } = await import('./storage');
      const transcriptsWithExpired = await storage.getTranscriptsWithExpiredPendingRedactions();
      if (transcriptsWithExpired.length === 0) {
        console.log('[REDACTION-JOB] No expired pending redactions found.');
        return;
      }
      console.log(`[REDACTION-JOB] Found ${transcriptsWithExpired.length} transcript(s) with expired pending redactions.`);
      let totalCommitted = 0;
      for (const transcript of transcriptsWithExpired) {
        try {
          const updated = await storage.commitTranscriptRedactions(
            transcript.id,
            transcript.createdBy,
          );
          if (updated) {
            totalCommitted++;
            console.log(`[REDACTION-JOB] Committed expired redactions on transcript ${transcript.id}`);
            await logAuditEvent("system", "transcript_redactions_auto_committed", {
              caseId: transcript.caseId,
              transcriptId: transcript.id,
              metadata: {
                action: 'auto_commit_expired_redactions',
                actorSubtype: 'auto-commit',
                triggeredBy: 'system',
                caseOwner: transcript.createdBy,
                committedAt: new Date().toISOString(),
              },
              severity: "critical",
            });
          }
        } catch (err) {
          console.error(`[REDACTION-JOB] Failed to commit transcript ${transcript.id}:`, err);
          try {
            const { sendInternalSystemAlertEmail } = await import('./email');
            await sendInternalSystemAlertEmail({
              to: ['jazz.dennis@legalnote.ai'],
              subject: `[LegalNote Alert] Auto-commit failed: transcript ${transcript.id}`,
              bodyText: `Auto-commit sweep failed to commit redactions.\n\nTranscript ID: ${transcript.id}\nCase ID: ${transcript.caseId}\nCase owner: ${transcript.createdBy}\n\nManual intervention may be required — this transcript has pending redactions that could not be auto-committed.\n\nError: ${err instanceof Error ? err.message : String(err)}\nTime: ${new Date().toISOString()}`,
            });
          } catch (alertErr) {
            console.error('[REDACTION-JOB] Failed to send auto-commit failure alert:', alertErr);
          }
        }
      }
      console.log(`[REDACTION-JOB] Sweep complete. Processed ${totalCommitted} transcript(s).`);
    } catch (err) {
      console.error('[REDACTION-JOB] Sweep failed:', err);
      throw err;
    }
  });

  setInterval(() => {
    jobQueue.addJob('commit-expired-redactions', {});
  }, 15 * 60 * 1000);

  jobQueue.addJob('commit-expired-redactions', {});
  console.log('[REDACTION-JOB] Auto-commit job registered and scheduled (15-minute interval).');

  // Recover further-version jobs orphaned when the in-memory queue is lost on restart
  jobQueue.registerHandler('recover-stuck-produce-versions', async () => {
    const { recoverStuckProduceVersionCases } = await import('./services/stuckProduceVersionRecovery');
    await recoverStuckProduceVersionCases(storage);
  });
  setInterval(() => {
    jobQueue.addJob('recover-stuck-produce-versions', {});
  }, 5 * 60 * 1000);
  jobQueue.addJob('recover-stuck-produce-versions', {});
  console.log('[PRODUCE-VERSION-RECOVERY] Sweep registered (5-minute interval).');

  console.log('[WORKERS] Job queue workers initialized successfully');
}

/**
 * Schedule periodic maintenance tasks using cron
 */
function scheduleMaintenanceTasks() {
  // Run data retention cleanup daily at 2:00 AM (Europe/London timezone)
  // Cron expression: '0 2 * * *' = At minute 0 of hour 2 every day
  cron.schedule('0 2 * * *', () => {
    console.log('[CRON] Running daily data retention cleanup at 2 AM');
    runGlobalDataRetentionCleanup().catch(error => {
      console.error('[CRON] Data retention cleanup failed:', error);
    });
  }, {
    scheduled: true,
    timezone: 'Europe/London'
  });

  // Clean up session tracking every hour at minute 0
  // Cron expression: '0 * * * *' = At minute 0 of every hour
  cron.schedule('0 * * * *', () => {
    console.log('[CRON] Running hourly session tracking cleanup');
    cleanupSessionTracking();
  }, {
    scheduled: true,
    timezone: 'Europe/London'
  });

  // Run meeting scheduler tasks every 5 minutes
  // Sends consent emails, deploys bots for approved meetings, checks bot status
  cron.schedule('*/5 * * * *', async () => {
    console.log('[CRON] Running meeting scheduler tasks');
    await runMeetingSchedulerTasks();
  }, {
    scheduled: true,
    timezone: 'Europe/London'
  });

  // Check live Recall.ai bot imports every 2 minutes — triggers processing when bot reaches 'done'
  cron.schedule('*/2 * * * *', async () => {
    await checkLiveImports().catch(err => {
      console.error('[CRON] Live import check failed:', err.message);
    });
  }, {
    scheduled: true,
    timezone: 'Europe/London'
  });

  // Weekly risk digest cron — DISABLED pending firm-scoped isolation fix
  // (was: Mondays 7:00 AM Europe/London → getFirmRiskDigest + sendRiskDigestEmail)

  console.log('[WORKERS] Scheduled maintenance tasks with cron:');
  console.log('  - Data retention cleanup: Daily at 2:00 AM (Europe/London)');
  console.log('  - Session tracking cleanup: Hourly at minute :00 (Europe/London)');
  console.log('  - Meeting scheduler: Every 5 minutes (Europe/London)');
  console.log('  - Live bot import check: Every 2 minutes (Europe/London)');
  console.log('  - Weekly risk digest: DISABLED');
}

/**
 * Run meeting scheduler tasks for all users with connected calendars
 * This includes polling calendars and processing meetings
 */
async function runMeetingSchedulerTasks() {
  try {
    // First, poll calendars for all users with connected Google or Outlook Calendar
    const googleIntegrations = await storage.getActiveCalendarIntegrations('google');
    const outlookIntegrations = await storage.getActiveCalendarIntegrations('outlook');
    const calendarUserIds = [...new Set(
      [...googleIntegrations, ...outlookIntegrations].map((integration) => integration.userId),
    )];
    
    for (const userId of calendarUserIds) {
      try {
        console.log(`[MEETING_SCHEDULER] Polling calendar for user ${userId}`);
        await meetingSchedulerService.pollCalendarMeetings(userId);
      } catch (error) {
        console.error(`[MEETING_SCHEDULER] Error polling calendar for user ${userId}:`, error);
      }
    }

    // Solicitor reminders (~30m and ~10m before upcoming synced meetings)
    try {
      await meetingSchedulerService.sendDueMeetingReminders();
    } catch (error) {
      console.error('[MEETING_SCHEDULER] Error sending meeting reminders:', error);
    }

    // Then process meetings: deploy bots, check bot status
    const allMeetings = await storage.getAllScheduledMeetingsWithAutoRecord();
    const meetingUserIds = [...new Set(allMeetings.map(m => m.userId))];

    for (const userId of meetingUserIds) {
      try {
        await meetingSchedulerService.runScheduledTasks(userId);
      } catch (error) {
        console.error(`[MEETING_SCHEDULER] Error running tasks for user ${userId}:`, error);
      }
    }
  } catch (error) {
    console.error('[MEETING_SCHEDULER] Error in cron job:', error);
  }
}
