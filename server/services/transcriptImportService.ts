import crypto from "crypto";
import { eq } from "drizzle-orm";
import {
  transcriptImports,
  type TranscriptImport,
  type CreateTranscriptImportRequest,
} from "@shared/schema";
import { db } from "../db";
import type { IStorage } from "../storage";
import { normalizeUploadedTranscript } from "./normalizeUploadedTranscript";
import { jobQueue } from "./jobQueue";
import { logAuditEvent } from "../auditMiddleware";

export class TranscriptImportError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
  ) {
    super(message);
    this.name = "TranscriptImportError";
  }
}

function parseMeetingDate(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new TranscriptImportError("Invalid meeting date", 400, "invalid_meeting_date");
  }
  return parsed;
}

export async function createTranscriptImport(params: {
  storage: IStorage;
  caseId: string;
  userId: string;
  body: CreateTranscriptImportRequest;
}): Promise<{ importRecord: TranscriptImport; jobId: string }> {
  const { storage, caseId, userId, body } = params;

  const caseData = await storage.getCase(caseId, userId);
  if (!caseData) {
    throw new TranscriptImportError("Case not found", 404, "case_not_found");
  }

  if (caseData.litigationHold) {
    throw new TranscriptImportError(
      "Cannot upload a transcript while this matter is under litigation hold",
      423,
      "litigation_hold",
    );
  }

  if (caseData.status === "processing") {
    throw new TranscriptImportError(
      "This matter is already being processed. Wait for the current job to finish.",
      400,
      "already_processing",
    );
  }

  if (!body.authorityAttested) {
    throw new TranscriptImportError(
      "You must confirm you are authorised to upload and process this transcript",
      400,
      "authority_required",
    );
  }

  let normalized;
  try {
    normalized = normalizeUploadedTranscript(body.content);
  } catch (error: any) {
    throw new TranscriptImportError(error.message || "Invalid transcript", 400, "invalid_transcript");
  }

  const meetingAt = parseMeetingDate(body.meetingDate);
  const durationSeconds =
    body.durationMinutes != null && body.durationMinutes > 0
      ? body.durationMinutes * 60
      : undefined;

  const sourceHash = crypto.createHash("sha256").update(body.content, "utf8").digest("hex");
  const byteSize = Buffer.byteLength(body.content, "utf8");

  const sessionTitle =
    body.sessionTitle?.trim() ||
    `Uploaded transcript — ${meetingAt.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`;

  const session = await storage.createMeetingSession({
    caseId,
    recordingType: body.recordingType,
    sessionTitle,
    status: "processing",
    durationSeconds,
    createdBy: userId,
    notes: `Uploaded transcript (${body.source})`,
  });

  // startedAt defaults to now — update via raw if we need meetingAt reflected.
  // Meeting session startedAt is used for document metadata when no audio exists.
  try {
    const { meetingSessions } = await import("@shared/schema");
    await db
      .update(meetingSessions)
      .set({ startedAt: meetingAt })
      .where(eq(meetingSessions.id, session.id));
  } catch (e) {
    console.warn("[TranscriptImport] Could not set session startedAt:", e);
  }

  const transcript = await storage.createTranscript({
    caseId,
    meetingSessionId: session.id,
    content: normalized.content,
    utterances: normalized.utterances,
    speakerCount: normalized.speakerCount,
  });

  const [importRecord] = await db
    .insert(transcriptImports)
    .values({
      userId,
      caseId,
      meetingSessionId: session.id,
      transcriptId: transcript.id,
      source: body.source,
      originalFilename: body.originalFilename,
      mimeType: body.source === "file" ? "text/plain" : "text/plain",
      byteSize,
      sourceContentHash: sourceHash,
      characterCount: normalized.characterCount,
      speakerCount: normalized.speakerCount ?? null,
      recordingType: body.recordingType,
      sessionTitle,
      meetingAt,
      durationSeconds: durationSeconds ?? null,
      generateClientLetter: body.generateClientLetter ?? true,
      authorityAttested: true,
      authorityAttestedAt: new Date(),
      status: "processing",
    })
    .returning();

  await storage.updateCase(
    caseId,
    {
      status: "processing",
      aiProcessingMetadata: {
        status: "processing",
        progress: 5,
        currentStep: "Validating uploaded transcript...",
        transcriptImportId: importRecord.id,
      },
    },
    userId,
  );

  const jobId = await jobQueue.addJob("derive-transcript", {
    caseId,
    userId,
    transcriptId: transcript.id,
    sessionId: session.id,
    importId: importRecord.id,
    recordingType: body.recordingType,
    meetingTimestamp: meetingAt.toISOString(),
    durationSeconds: durationSeconds ?? null,
    generateClientLetter: body.generateClientLetter ?? true,
  });

  await db
    .update(transcriptImports)
    .set({ jobId })
    .where(eq(transcriptImports.id, importRecord.id));

  await logAuditEvent(userId, "transcript_imported", {
    caseId,
    transcriptId: transcript.id,
    metadata: {
      importId: importRecord.id,
      sessionId: session.id,
      source: body.source,
      originalFilename: body.originalFilename,
      characterCount: normalized.characterCount,
      speakerCount: normalized.speakerCount,
      sourceContentHash: sourceHash,
      recordingType: body.recordingType,
      generateClientLetter: body.generateClientLetter ?? true,
      jobId,
    },
  });

  return {
    importRecord: { ...importRecord, jobId },
    jobId,
  };
}

export async function updateTranscriptImportStatus(
  importId: string,
  updates: Partial<{
    status: string;
    errorMessage: string | null;
    completedAt: Date | null;
  }>,
): Promise<void> {
  await db
    .update(transcriptImports)
    .set({
      ...(updates.status != null ? { status: updates.status } : {}),
      ...(updates.errorMessage !== undefined ? { errorMessage: updates.errorMessage } : {}),
      ...(updates.completedAt !== undefined ? { completedAt: updates.completedAt } : {}),
    })
    .where(eq(transcriptImports.id, importId));
}

export async function getTranscriptImport(
  importId: string,
): Promise<TranscriptImport | undefined> {
  const rows = await db
    .select()
    .from(transcriptImports)
    .where(eq(transcriptImports.id, importId))
    .limit(1);
  return rows[0];
}
