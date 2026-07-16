import { storage } from "../storage";
import { DocumentService } from "./documentService";
import { logAuditEvent } from "../auditMiddleware";
import type { PreMeetingBriefing } from "@shared/schema";

export class PreMeetingBriefingError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "PreMeetingBriefingError";
  }
}

/**
 * Generate a pre-meeting briefing and persist it on the case.
 * Shared by the HTTP route and the T-30 reminder cron (no HTTP-as-user).
 */
export async function generateAndPersistPreMeetingBriefing(
  caseId: string,
  userId: string,
): Promise<{ briefing: PreMeetingBriefing; generationCost: number }> {
  const caseData = await storage.getCase(caseId, userId);
  if (!caseData) {
    throw new PreMeetingBriefingError("Not authorized", 403);
  }

  const transcript = await storage.getTranscriptByCase(caseId, userId);
  if (!transcript) {
    throw new PreMeetingBriefingError("No transcript found for this case", 400);
  }

  const documents = await storage.getActiveDocumentsByCase(caseId, userId);
  const documentService = new DocumentService();

  const metadata = {
    title: caseData.title,
    clientName: caseData.clientName,
    matterReference: caseData.matterReference || undefined,
    recordingDate: new Date().toISOString().split("T")[0],
  };

  const attendanceNote = documents.find((d) => d.type === "attendance_note");
  const summary = documents.find((d) => d.type === "summary");

  const meetings: Array<{
    date: string;
    transcript: string;
    attendanceNote?: string;
    summary?: string;
  }> = [];

  const priorImports = await storage.getMeetingImportsByCase(caseId, userId);
  const completedImports = priorImports.filter((i) => i.status === "completed");
  if (completedImports.length > 0) {
    let priorSessionContext = "PRIOR SESSION SUMMARIES:\n";
    for (const imp of completedImports) {
      const sessionDate = imp.meetingStartTime
        ? new Date(imp.meetingStartTime).toISOString().split("T")[0]
        : "Prior session";
      const platformLabel = imp.meetingPlatform ? ` (${imp.meetingPlatform})` : "";
      priorSessionContext += `\n--- Session: ${sessionDate}${platformLabel} ---\n`;
      priorSessionContext += `Title: ${imp.meetingTitle || "Untitled"}\n`;
      if (imp.participants && Array.isArray(imp.participants)) {
        priorSessionContext += `Participants: ${(imp.participants as string[]).join(", ")}\n`;
      }
      if (imp.durationSeconds) {
        priorSessionContext += `Duration: ${Math.round(imp.durationSeconds / 60)} minutes\n`;
      }
    }
    meetings.push({
      date: "Prior sessions",
      transcript: priorSessionContext,
    });
  }

  meetings.push({
    date: caseData.createdAt
      ? new Date(caseData.createdAt).toISOString().split("T")[0]
      : "Unknown",
    transcript: transcript.content,
    attendanceNote: attendanceNote?.content,
    summary: summary?.content,
  });

  let caseContextSuffix = "";

  const actionItems = await storage.getActionItemsByCase(caseId, userId);
  const outstandingItems = actionItems.filter(
    (item) => !item.completed && item.status === "approved",
  );
  if (outstandingItems.length > 0) {
    caseContextSuffix += "\n\nOUTSTANDING ACTION ITEMS:\n";
    outstandingItems.forEach((item) => {
      caseContextSuffix += `- ${item.description}${item.assignee ? ` (Assigned to: ${item.assignee})` : ""}${item.dueDate ? ` (Due: ${new Date(item.dueDate).toISOString().split("T")[0]})` : ""}\n`;
    });
  }

  if (caseData.clientId) {
    const client = await storage.getClient(caseData.clientId, userId);
    if (client?.amlRiskLevel) {
      caseContextSuffix += `\n\nCLIENT AML STATUS:\n- Risk Level: ${client.amlRiskLevel.toUpperCase()}`;
      if (client.amlRiskLastReviewed) {
        caseContextSuffix += ` (Last reviewed: ${new Date(client.amlRiskLastReviewed).toISOString().split("T")[0]})`;
      }
      caseContextSuffix += "\n";
    }
  }

  if (caseData.deadline) {
    caseContextSuffix += `\n\nUPCOMING CASE DEADLINE:\n- ${new Date(caseData.deadline).toISOString().split("T")[0]}${caseData.deadlineIsAllDay ? " (all day)" : ""}\n`;
  }

  if (caseContextSuffix && meetings.length > 0) {
    meetings[meetings.length - 1].transcript += caseContextSuffix;
  }

  const caseUndertakings = await storage.getUndertakingsByCase(caseId);
  const outstandingUndertakings = caseUndertakings.filter((u) => u.status === "outstanding");

  const result = await documentService.generatePreMeetingBriefing(
    meetings,
    metadata,
    outstandingUndertakings,
  );

  const briefing = await storage.createPreMeetingBriefing({
    caseId,
    content: result.content,
    generatedBy: userId,
    sourceMeetingCount: meetings.length,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    cost: result.cost.toString(),
  });

  await logAuditEvent(userId, "pre_meeting_briefing_generated", {
    caseId,
    metadata: {
      briefingId: briefing.id,
      sourceMeetingCount: meetings.length,
      cost: result.cost,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    },
  });

  return { briefing, generationCost: result.cost };
}

/**
 * Fire-and-forget pre-gen for a linked meeting that has a transcript.
 * Skips quietly when preconditions are not met; logs failures.
 */
export function schedulePreMeetingBriefingPreGen(
  caseId: string,
  userId: string,
  meetingId: string,
): void {
  void (async () => {
    try {
      const transcript = await storage.getTranscriptByCase(caseId, userId);
      if (!transcript) {
        console.log(
          `[MEETING_SCHEDULER] Skip brief pre-gen for meeting ${meetingId}: no transcript on case ${caseId}`,
        );
        return;
      }

      // Belt-and-braces: skip if a brief was already generated in the last 45 minutes
      const latest = await storage.getLatestPreMeetingBriefing(caseId, userId);
      if (latest?.generatedAt) {
        const ageMs = Date.now() - new Date(latest.generatedAt).getTime();
        if (ageMs < 45 * 60 * 1000) {
          console.log(
            `[MEETING_SCHEDULER] Skip brief pre-gen for meeting ${meetingId}: recent brief already exists`,
          );
          return;
        }
      }

      console.log(
        `[MEETING_SCHEDULER] Pre-generating brief for meeting ${meetingId} (case ${caseId})`,
      );
      await generateAndPersistPreMeetingBriefing(caseId, userId);
      console.log(`[MEETING_SCHEDULER] Brief pre-gen complete for meeting ${meetingId}`);
    } catch (error) {
      console.error(
        `[MEETING_SCHEDULER] Brief pre-gen failed for meeting ${meetingId}:`,
        error,
      );
    }
  })();
}
