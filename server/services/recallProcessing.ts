/**
 * Shared post-call processing for Recall.ai bot recordings.
 * Called by: webhook, cron poller, and manual trigger route.
 */
import { storage } from '../storage';
import { ObjectStorageService } from '../objectStorage';
import { applyObjectLegalHoldForNewRecording } from './litigationHoldObjectLockService';
import { preserveConsentSegmentFromFullAudio } from './consentSegmentService';
import { recallService } from './recallService';
import {
  isAbandonedMeetingSubCode,
  messageForAbandonedSubCode,
  USER_CANCELLED_LIVE_BOT_MESSAGE,
  CONSENT_DECLINED_LIVE_BOT_MESSAGE,
  isTerminalImportFailureMessage,
  isUserCancelledImportMessage,
  isConsentDeclinedImportMessage,
} from '@shared/liveBotLifecycle';
import type { MeetingImport } from '@shared/schema';

function isConsentDeclinedImport(imp: MeetingImport): boolean {
  return (
    imp.botStatus === 'left_consent_declined' ||
    isConsentDeclinedImportMessage(imp.errorMessage)
  );
}

function isUserCancelledImport(imp: MeetingImport): boolean {
  return (
    imp.botStatus === 'left_user_cancelled' ||
    isUserCancelledImportMessage(imp.errorMessage)
  );
}

/**
 * Ensure cancelled / declined / abandoned imports are not left in pending/live
 * (which makes the client show "producing documents" indefinitely).
 */
export async function reconcileTerminalMeetingImport(
  importRecord: MeetingImport,
): Promise<MeetingImport> {
  const declined = isConsentDeclinedImport(importRecord);
  const cancelled = isUserCancelledImport(importRecord);
  const terminalFailure =
    importRecord.status === 'failed' &&
    isTerminalImportFailureMessage(importRecord.errorMessage);

  if (!declined && !cancelled && !terminalFailure) {
    return importRecord;
  }

  if (importRecord.status === 'discarded' || importRecord.status === 'completed') {
    return importRecord;
  }

  if (importRecord.status === 'failed' && importRecord.errorMessage) {
    return importRecord;
  }

  const errorMessage =
    importRecord.errorMessage ||
    (cancelled
      ? USER_CANCELLED_LIVE_BOT_MESSAGE
      : declined
        ? CONSENT_DECLINED_LIVE_BOT_MESSAGE
        : 'The meeting was not captured.');

  await storage.updateMeetingImport(importRecord.id, {
    status: 'failed',
    errorMessage,
    ...(declined ? { botStatus: 'left_consent_declined' } : {}),
    ...(cancelled && importRecord.botStatus !== 'left_user_cancelled'
      ? { botStatus: importRecord.botStatus || 'left_user_cancelled' }
      : {}),
  });

  return (await storage.getMeetingImport(importRecord.id)) || importRecord;
}

/**
 * If the bot left without ever recording (waiting-room / no-one-joined timeout, etc.),
 * mark the import failed with a clear reason and skip Meeting-to-Matter.
 * Returns true when processing should stop.
 */
export async function markAbandonedIfNeverRecorded(
  importRecord: MeetingImport,
  opts?: { subCode?: string | null; botStatus?: string | null },
): Promise<{ abandoned: boolean; errorMessage?: string; subCode?: string }> {
  if (isConsentDeclinedImport(importRecord) || isUserCancelledImport(importRecord)) {
    return { abandoned: true, errorMessage: importRecord.errorMessage || undefined };
  }

  // Already failed with a never-started reason — do not re-enter processing
  if (
    importRecord.status === 'failed' &&
    typeof importRecord.errorMessage === 'string' &&
    /waiting room|nobody else joined|never started|not admitted|cancelled/i.test(
      importRecord.errorMessage,
    )
  ) {
    return { abandoned: true, errorMessage: importRecord.errorMessage };
  }

  const botId = importRecord.recallBotId;
  if (!botId) return { abandoned: false };

  let subCode = opts?.subCode || undefined;
  let neverRecorded = false;
  let statusCode = opts?.botStatus || importRecord.botStatus || undefined;

  try {
    const bot = await recallService.getBot(botId);
    subCode = subCode || recallService.getBotSubCode(bot);
    neverRecorded = recallService.botNeverRecorded(bot);
    statusCode = recallService.getBotStatusCode(bot) || statusCode;
  } catch (err: any) {
    console.warn(
      `[RecallProcessing] Could not fetch bot ${botId} for abandon check:`,
      err.message,
    );
  }

  const terminal =
    statusCode === 'done' ||
    statusCode === 'recording_done' ||
    statusCode === 'call_ended' ||
    statusCode === 'fatal';

  const abandonedBySubCode = isAbandonedMeetingSubCode(subCode);
  // Fail fast when the bot finished without ever entering recording — covers
  // timeouts whose sub_code is missing from the payload.
  const abandonedSilent = terminal && neverRecorded;

  if (!abandonedBySubCode && !abandonedSilent) {
    return { abandoned: false, subCode };
  }

  const errorMessage = messageForAbandonedSubCode(subCode);
  console.log(
    `[RecallProcessing] Import ${importRecord.id} abandoned (subCode=${subCode || 'none'}, neverRecorded=${neverRecorded}) — skipping processing`,
  );
  await storage.updateMeetingImport(importRecord.id, {
    status: 'failed',
    botStatus: statusCode || importRecord.botStatus || 'call_ended',
    errorMessage,
  });
  return { abandoned: true, errorMessage, subCode };
}

/**
 * Download the recording media URL from Recall.ai's new API format.
 * Tries /recording/?bot_id=... endpoint, falls back to bot.recordings[].
 */
async function getRecordingUrl(botId: string): Promise<{ url: string; durationSeconds?: number; recordingId?: string } | null> {
  const key = (process.env.RECALL_API_KEY || '')
    .replace(/^(Token|Bearer)\s+/i, '')
    .replace(/[^\x21-\x7E]/g, '')
    .trim();
  const region = process.env.RECALL_REGION || 'us-west-2';
  const base = `https://${region}.recall.ai/api/v1`;

  try {
    // Try the dedicated recordings list endpoint first
    const r = await fetch(`${base}/recording/?bot_id=${botId}`, {
      headers: { 'Authorization': `Token ${key}` },
      signal: AbortSignal.timeout(15000),
    });
    if (r.ok) {
      const data = await r.json() as {
        results?: Array<{
          id: string;
          duration?: number;
          media_shortcuts?: {
            audio_only?: { data?: { download_url?: string } };
            audio_mixed?: { data?: { download_url?: string } };
          };
        }>;
      };
      const rec = data.results?.[0];
      if (rec) {
        // Audio only — never fall back to video_mixed (data minimisation).
        const url =
          rec.media_shortcuts?.audio_only?.data?.download_url
          || rec.media_shortcuts?.audio_mixed?.data?.download_url;
        if (url) {
          return { url, durationSeconds: rec.duration, recordingId: rec.id };
        }
      }
    }

    // Fallback: read recordings embedded on the bot object
    const botR = await fetch(`${base}/bot/${botId}/`, {
      headers: { 'Authorization': `Token ${key}` },
      signal: AbortSignal.timeout(15000),
    });
    if (botR.ok) {
      const bot = await botR.json() as {
        recordings?: Array<{
          id: string;
          media_shortcuts?: {
            audio_only?: { data?: { url?: string } };
            audio_mixed?: { data?: { url?: string } };
          };
        }>;
      };
      const rec = bot.recordings?.[0];
      if (rec) {
        const url =
          rec.media_shortcuts?.audio_only?.data?.url
          || rec.media_shortcuts?.audio_mixed?.data?.url;
        if (url) return { url, recordingId: rec.id };
      }
    }
  } catch (err) {
    console.error(`[RecallProcessing] Failed to get recording URL for bot ${botId}:`, err);
  }
  return null;
}

/**
 * Process a completed bot recording: download, store, and trigger transcription + doc generation.
 * Safe to call multiple times — guarded by import status check.
 */
export async function processBotRecording(importRecord: MeetingImport): Promise<void> {
  const { id: importId, recallBotId: botId, caseId, userId } = importRecord;

  if (isConsentDeclinedImport(importRecord) || isUserCancelledImport(importRecord)) {
    console.log(`[RecallProcessing] Import ${importId} declined/cancelled — skipping processing`);
    await reconcileTerminalMeetingImport(importRecord);
    return;
  }

  const abandon = await markAbandonedIfNeverRecorded(importRecord);
  if (abandon.abandoned) {
    return;
  }

  if (!botId) {
    console.warn(`[RecallProcessing] Import ${importId} has no botId — skipping`);
    return;
  }
  if (!caseId) {
    // No case linked yet — store the recording and await assignment
    console.log(`[RecallProcessing] Import ${importId} has no caseId — storing recording and awaiting assignment`);
    await storage.updateMeetingImport(importId, { status: 'pending' });

    const recording = await getRecordingUrl(botId);
    if (!recording?.url) {
      console.error(`[RecallProcessing] No recording URL for bot ${botId} (unlinked import)`);
      const abandon = await markAbandonedIfNeverRecorded(importRecord);
      await storage.updateMeetingImport(importId, {
        status: 'failed',
        errorMessage:
          abandon.errorMessage ||
          'Recording not available — the call may have been too short or the bot was not admitted',
      });
      return;
    }

    // Update metadata
    const metaUpdate: Partial<MeetingImport> = { recallRecordingId: recording.recordingId, importedAt: new Date() };
    if (recording.durationSeconds) {
      metaUpdate.durationSeconds = recording.durationSeconds;
      const hours = recording.durationSeconds / 3600;
      metaUpdate.recallCostUSD = ((0.70 + 0.15) * hours).toFixed(4);
    }
    await storage.updateMeetingImport(importId, metaUpdate);

    // Download and store the recording
    let audioBuffer: Buffer;
    try {
      const resp = await fetch(recording.url, { signal: AbortSignal.timeout(120000) });
      if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
      audioBuffer = Buffer.from(await resp.arrayBuffer());
    } catch (err: any) {
      console.error(`[RecallProcessing] Download error for unlinked import ${importId}:`, err.message);
      await storage.updateMeetingImport(importId, { status: 'failed', errorMessage: `Recording download failed: ${err.message}` });
      return;
    }

    const audioPath = `.private/imports/${importId}/recording.mp3`;
    const mimeType = 'audio/mpeg';
    try {
      const storageService = new ObjectStorageService();
      await storageService.uploadFile(audioPath, audioBuffer, mimeType);
      console.log(`[RecallProcessing] Uploaded audio to ${audioPath} (awaiting assignment)`);
    } catch (err: any) {
      console.error(`[RecallProcessing] Upload failed for unlinked import ${importId}:`, err.message);
      await storage.updateMeetingImport(importId, { status: 'failed', errorMessage: `Upload failed: ${err.message}` });
      return;
    }

    await storage.updateMeetingImport(importId, {
      status: 'awaiting_assignment',
      audioStoragePath: audioPath,
    });

    await storage.createAuditLog({
      eventType: 'meeting_import_awaiting_assignment',
      userId,
      caseId: undefined,
      ipAddress: 'server-process',
      metadata: { importId, botId, source: 'recall_bot' },
      severity: 'info',
    });

    console.log(`[RecallProcessing] Import ${importId} stored — awaiting matter assignment`);
    return;
  }

  // Prevent double-processing — allow retrying failed imports and newly assigned ones
  const fresh = await storage.getMeetingImport(importId);
  if (!fresh || !['live', 'pending', 'failed'].includes(fresh.status)) {
    console.log(`[RecallProcessing] Import ${importId} already in status "${fresh?.status}" — skipping`);
    return;
  }
  if (isConsentDeclinedImport(fresh) || isUserCancelledImport(fresh)) {
    console.log(`[RecallProcessing] Import ${importId} declined/cancelled — skipping processing`);
    await reconcileTerminalMeetingImport(fresh);
    return;
  }

  console.log(`[RecallProcessing] Starting processing for import ${importId} (bot ${botId})`);
  await storage.updateMeetingImport(importId, { status: 'pending' });

  let audioPath: string;
  let mimeType: string;
  let audioBufferForConsent: Buffer | null = null;

  // If the recording was previously stored (e.g. was awaiting_assignment), use that file
  // rather than trying to re-fetch from Recall (the URL may have expired)
  if (fresh.audioStoragePath) {
    console.log(`[RecallProcessing] Using pre-stored recording at ${fresh.audioStoragePath} for import ${importId}`);
    audioPath = fresh.audioStoragePath;
    mimeType = audioPath.endsWith('.mp4') ? 'video/mp4' : 'audio/mpeg';
    if (fresh.consentConfirmed && fresh.consentElapsedSeconds != null && fresh.consentElapsedSeconds >= 0) {
      try {
        const storageService = new ObjectStorageService();
        audioBufferForConsent = await storageService.getFile(audioPath);
      } catch (err: any) {
        console.warn(`[RecallProcessing] Could not load stored audio for consent segment:`, err.message);
      }
    }
  } else {
    // Fresh import — download from Recall
    const recording = await getRecordingUrl(botId);
    if (!recording?.url) {
      console.error(`[RecallProcessing] No recording URL for bot ${botId}`);
      const abandon = await markAbandonedIfNeverRecorded(fresh);
      await storage.updateMeetingImport(importId, {
        status: 'failed',
        errorMessage:
          abandon.errorMessage ||
          'Recording not available — the call may have been too short or the bot was not admitted',
      });
      return;
    }

    // Update import with recording metadata
    const metaUpdate: Partial<MeetingImport> = {
      recallRecordingId: recording.recordingId,
      importedAt: new Date(),
    };
    if (recording.durationSeconds) {
      metaUpdate.durationSeconds = recording.durationSeconds;
      const hours = recording.durationSeconds / 3600;
      metaUpdate.recallCostUSD = ((0.70 + 0.15) * hours).toFixed(4);
    }
    await storage.updateMeetingImport(importId, metaUpdate);

    // Download the recording
    console.log(`[RecallProcessing] Downloading recording for import ${importId}`);
    let audioBuffer: Buffer;
    try {
      const resp = await fetch(recording.url, { signal: AbortSignal.timeout(120000) });
      if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
      audioBuffer = Buffer.from(await resp.arrayBuffer());
    } catch (err: any) {
      console.error(`[RecallProcessing] Download error for import ${importId}:`, err.message);
      await storage.updateMeetingImport(importId, { status: 'failed', errorMessage: `Recording download failed: ${err.message}` });
      return;
    }

    // Store in object storage (audio-only)
    mimeType = 'audio/mpeg';
    audioPath = `.private/imports/${importId}/recording.mp3`;
    try {
      const storageService = new ObjectStorageService();
      await storageService.uploadFile(audioPath, audioBuffer, mimeType);
      console.log(`[RecallProcessing] Uploaded audio to ${audioPath}`);
    } catch (err: any) {
      console.error(`[RecallProcessing] Upload failed for import ${importId}:`, err.message);
      await storage.updateMeetingImport(importId, { status: 'failed', errorMessage: `Upload failed: ${err.message}` });
      return;
    }

    await storage.updateMeetingImport(importId, { audioStoragePath: audioPath });
    audioBufferForConsent = audioBuffer;
  }

  // Create audio recording linked to the case
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  const audioRecord = await storage.createAudioRecording({
    caseId,
    filePath: audioPath,
    mimeType,
    duration: fresh.durationSeconds || undefined,
    expiresAt,
  });

  let consentSegmentPath: string | undefined;
  let consentDurationSeconds: number | undefined;
  if (
    fresh.consentConfirmed &&
    fresh.consentElapsedSeconds != null &&
    fresh.consentElapsedSeconds >= 0 &&
    audioBufferForConsent
  ) {
    try {
      const preserved = await preserveConsentSegmentFromFullAudio({
        audioBuffer: audioBufferForConsent,
        mimeType,
        consentDurationSeconds: fresh.consentElapsedSeconds,
      });
      if (preserved) {
        consentSegmentPath = preserved.consentSegmentPath;
        consentDurationSeconds = preserved.consentDurationSeconds;
        await storage.updateAudioRecording(audioRecord.id, {
          consentSegmentPath,
          consentDurationSeconds,
        });
        console.log(`[RecallProcessing] Preserved consent segment for import ${importId}: ${consentSegmentPath}`);
      }
    } catch (err: any) {
      console.error(`[RecallProcessing] Failed to preserve consent segment for import ${importId}:`, err.message);
    }
  }

  await applyObjectLegalHoldForNewRecording({
    caseId,
    audioRecordingId: audioRecord.id,
    filePath: audioPath,
    consentSegmentPath,
    userId,
  });

  const { assertSealedConsent, SealedConsentError } = await import('./assertSealedConsent');
  const { requiresSealedConsentForProcessing } = await import('@shared/schema');
  const caseForConsent = await storage.getCase(caseId, userId);
  if (requiresSealedConsentForProcessing(
    (caseForConsent as { matterKind?: string } | undefined)?.matterKind,
    (caseForConsent as { hasExternalAttendees?: boolean } | undefined)?.hasExternalAttendees,
  )) {
    try {
      await assertSealedConsent(caseId, userId, audioRecord.id);
    } catch (error: any) {
      if (error instanceof SealedConsentError) {
        console.error(`[RecallProcessing] Sealed consent gate failed for case ${caseId}:`, error.message);
        await storage.updateMeetingImport(importId, {
          status: 'failed',
          errorMessage: error.message,
        });
        return;
      }
      throw error;
    }
  }

  await storage.updateMeetingImport(importId, {
    status: 'transcribing',
    audioStoragePath: audioPath,
  });

  await storage.updateCase(caseId, { status: 'processing' }, userId);

  // Enqueue the AI processing job (transcription + document generation)
  const { jobQueue } = await import('./jobQueue');
  const jobId = await jobQueue.addJob('ai-processing', { caseId, userId });
  console.log(`[RecallProcessing] Enqueued AI processing job ${jobId} for import ${importId}`);

  // Listen for job completion/failure to update import status
  const onCompleted = async (job: { id: string }) => {
    if (job.id !== jobId) return;
    jobQueue.off('job:completed', onCompleted);
    jobQueue.off('job:failed', onFailed);
    await storage.updateMeetingImport(importId, { status: 'completed' });
    await storage.createAuditLog({
      eventType: 'meeting_import_completed',
      userId,
      caseId,
      ipAddress: 'server-process',
      metadata: { importId, botId, source: 'recall_bot' },
      severity: 'info',
    });
    console.log(`[RecallProcessing] Import ${importId} completed successfully`);
  };
  const onFailed = async (job: { id: string; error?: string }) => {
    if (job.id !== jobId) return;
    jobQueue.off('job:completed', onCompleted);
    jobQueue.off('job:failed', onFailed);
    console.error(`[RecallProcessing] Processing pipeline failed for import ${importId}:`, job.error);
    await storage.updateMeetingImport(importId, { status: 'failed', errorMessage: job.error || 'Processing failed' });
    try {
      await storage.createAuditLog({
        eventType: 'meeting_recording_failed',
        userId,
        caseId,
        ipAddress: 'server-process',
        metadata: {
          importId,
          botId,
          reason: job.error || 'Processing failed',
          source: 'recall_bot',
        },
        severity: 'warning',
      });
    } catch (auditErr) {
      console.warn('[RecallProcessing] Failed to write recording failure audit:', auditErr);
    }
  };
  jobQueue.on('job:completed', onCompleted);
  jobQueue.on('job:failed', onFailed);
}

/**
 * Scan all live imports, poll Recall.ai, and trigger processing for completed ones.
 * Runs on the 5-minute cron.
 */
export async function checkLiveImports(): Promise<void> {
  const liveImports = await storage.getLiveMeetingImports();
  if (!liveImports.length) return;

  console.log(`[RecallProcessing] Checking ${liveImports.length} live import(s)`);

  for (const imp of liveImports) {
    if (!imp.recallBotId) continue;
    try {
      const bot = await recallService.getBot(imp.recallBotId);
      const statusCode = recallService.getBotStatusCode(bot) || null;
      const subCode = recallService.getBotSubCode(bot);
      console.log(
        `[RecallProcessing] Import ${imp.id} bot ${imp.recallBotId}: ${statusCode}${subCode ? ` (${subCode})` : ''}`,
      );

      if (statusCode === 'done' || statusCode === 'recording_done' || statusCode === 'call_ended') {
        await storage.updateMeetingImport(imp.id, { botStatus: statusCode });
        const refreshed = (await storage.getMeetingImport(imp.id)) || imp;
        const abandon = await markAbandonedIfNeverRecorded(
          { ...refreshed, botStatus: statusCode },
          { subCode, botStatus: statusCode },
        );
        if (abandon.abandoned) {
          await reconcileTerminalMeetingImport(
            (await storage.getMeetingImport(imp.id)) || refreshed,
          );
          continue;
        }
        if (statusCode === 'done' || statusCode === 'recording_done') {
          await processBotRecording({ ...refreshed, botStatus: statusCode });
        }
      } else if (statusCode === 'fatal') {
        const abandon = await markAbandonedIfNeverRecorded(
          { ...imp, botStatus: 'fatal' },
          { subCode, botStatus: 'fatal' },
        );
        if (!abandon.abandoned) {
          await storage.updateMeetingImport(imp.id, {
            botStatus: 'fatal',
            status: 'failed',
            errorMessage: 'Bot encountered an unrecoverable error',
          });
          try {
            await storage.createAuditLog({
              eventType: 'meeting_recording_failed',
              userId: imp.userId,
              caseId: imp.caseId || undefined,
              ipAddress: 'server-process',
              metadata: {
                importId: imp.id,
                botId: imp.recallBotId,
                reason: subCode
                  ? `Bot fatal error (${subCode})`
                  : 'Bot encountered an unrecoverable error',
                source: 'recall_bot',
              },
              severity: 'warning',
            });
          } catch (auditErr) {
            console.warn('[RecallProcessing] Failed to write fatal-bot audit:', auditErr);
          }
        }
      } else if (statusCode) {
        await storage.updateMeetingImport(imp.id, { botStatus: statusCode });
      }
    } catch (err: any) {
      console.error(`[RecallProcessing] Error checking import ${imp.id}:`, err.message);
    }
  }
}
