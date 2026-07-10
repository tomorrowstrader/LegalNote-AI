/**
 * Shared post-call processing for Recall.ai bot recordings.
 * Called by: webhook, cron poller, and manual trigger route.
 */
import { storage } from '../storage';
import { ObjectStorageService } from '../objectStorage';
import { applyObjectLegalHoldForNewRecording } from './litigationHoldObjectLockService';
import type { MeetingImport } from '@shared/schema';

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
      const data = await r.json() as { results?: Array<{ id: string; duration?: number; media_shortcuts?: { audio_only?: { data?: { download_url?: string } }; video_mixed?: { data?: { download_url?: string } } } }> };
      const rec = data.results?.[0];
      if (rec) {
        const url = rec.media_shortcuts?.audio_only?.data?.download_url
          || rec.media_shortcuts?.video_mixed?.data?.download_url;
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
      const bot = await botR.json() as { recordings?: Array<{ id: string; media_shortcuts?: { audio_only?: { data?: { url?: string } }; video_mixed?: { data?: { url?: string } } } }> };
      const rec = bot.recordings?.[0];
      if (rec) {
        const url = rec.media_shortcuts?.audio_only?.data?.url
          || rec.media_shortcuts?.video_mixed?.data?.url;
        if (url) return { url, recordingId: rec.id };
      }
    }
  } catch (err) {
    console.error(`[RecallProcessing] Failed to get recording URL for bot ${botId}:`, err);
  }
  return null;
}

/**
 * Get the current status code of a bot from Recall.ai.
 */
async function getBotStatusCode(botId: string): Promise<string | null> {
  const key = (process.env.RECALL_API_KEY || '')
    .replace(/^(Token|Bearer)\s+/i, '')
    .replace(/[^\x21-\x7E]/g, '')
    .trim();
  const region = process.env.RECALL_REGION || 'us-west-2';
  try {
    const r = await fetch(`https://${region}.recall.ai/api/v1/bot/${botId}/`, {
      headers: { 'Authorization': `Token ${key}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    const bot = await r.json() as { status_changes?: Array<{ code: string }>; status?: { code: string } };
    if (bot.status_changes?.length) {
      return bot.status_changes[bot.status_changes.length - 1].code;
    }
    return bot.status?.code || null;
  } catch {
    return null;
  }
}

/**
 * Process a completed bot recording: download, store, and trigger transcription + doc generation.
 * Safe to call multiple times — guarded by import status check.
 */
export async function processBotRecording(importRecord: MeetingImport): Promise<void> {
  const { id: importId, recallBotId: botId, caseId, userId } = importRecord;

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
      await storage.updateMeetingImport(importId, { status: 'failed', errorMessage: 'Recording not available — the call may have been too short or the bot was not admitted' });
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

    const isVideo = recording.url.includes('.mp4') || !recording.url.includes('.mp3');
    const ext = isVideo ? 'mp4' : 'mp3';
    const mimeType = isVideo ? 'video/mp4' : 'audio/mpeg';
    const audioPath = `.private/imports/${importId}/recording.${ext}`;
    try {
      const storageService = new ObjectStorageService();
      await storageService.uploadFile(audioPath, audioBuffer, mimeType);
      console.log(`[RecallProcessing] Uploaded recording to ${audioPath} (awaiting assignment)`);
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

  console.log(`[RecallProcessing] Starting processing for import ${importId} (bot ${botId})`);
  await storage.updateMeetingImport(importId, { status: 'pending' });

  let audioPath: string;
  let mimeType: string;

  // If the recording was previously stored (e.g. was awaiting_assignment), use that file
  // rather than trying to re-fetch from Recall (the URL may have expired)
  if (fresh.audioStoragePath) {
    console.log(`[RecallProcessing] Using pre-stored recording at ${fresh.audioStoragePath} for import ${importId}`);
    audioPath = fresh.audioStoragePath;
    mimeType = audioPath.endsWith('.mp4') ? 'video/mp4' : 'audio/mpeg';
  } else {
    // Fresh import — download from Recall
    const recording = await getRecordingUrl(botId);
    if (!recording?.url) {
      console.error(`[RecallProcessing] No recording URL for bot ${botId}`);
      await storage.updateMeetingImport(importId, { status: 'failed', errorMessage: 'Recording not available — the call may have been too short or the bot was not admitted' });
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

    // Store in object storage
    const isVideo = recording.url.includes('.mp4') || !recording.url.includes('.mp3');
    const ext = isVideo ? 'mp4' : 'mp3';
    mimeType = isVideo ? 'video/mp4' : 'audio/mpeg';
    audioPath = `.private/imports/${importId}/recording.${ext}`;
    try {
      const storageService = new ObjectStorageService();
      await storageService.uploadFile(audioPath, audioBuffer, mimeType);
      console.log(`[RecallProcessing] Uploaded recording to ${audioPath}`);
    } catch (err: any) {
      console.error(`[RecallProcessing] Upload failed for import ${importId}:`, err.message);
      await storage.updateMeetingImport(importId, { status: 'failed', errorMessage: `Upload failed: ${err.message}` });
      return;
    }

    await storage.updateMeetingImport(importId, { audioStoragePath: audioPath });
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

  await applyObjectLegalHoldForNewRecording({
    caseId,
    audioRecordingId: audioRecord.id,
    filePath: audioPath,
    userId,
  });

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
      const statusCode = await getBotStatusCode(imp.recallBotId);
      console.log(`[RecallProcessing] Import ${imp.id} bot ${imp.recallBotId}: ${statusCode}`);

      if (statusCode === 'done' || statusCode === 'recording_done') {
        // Update botStatus on the record and trigger processing
        await storage.updateMeetingImport(imp.id, { botStatus: statusCode });
        await processBotRecording(imp);
      } else if (statusCode === 'fatal') {
        await storage.updateMeetingImport(imp.id, {
          botStatus: 'fatal',
          status: 'failed',
          errorMessage: 'Bot encountered an unrecoverable error',
        });
      } else if (statusCode) {
        // Just keep botStatus current
        await storage.updateMeetingImport(imp.id, { botStatus: statusCode });
      }
    } catch (err: any) {
      console.error(`[RecallProcessing] Error checking import ${imp.id}:`, err.message);
    }
  }
}
