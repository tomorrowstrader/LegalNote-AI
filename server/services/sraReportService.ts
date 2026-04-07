import { db } from "../db";
import { eq, desc, sql } from "drizzle-orm";
import {
  cases,
  clients,
  consentLogs,
  meetingSessions,
  audioRecordings,
  dsarRequests,
  documents,
  actionItems,
  undertakings,
  timeEntries,
  auditTrail,
  quickNotes,
  amlMonitoringNotes,
  amlDecisionRecords,
  conflictChecks,
  firmProfile,
  users,
} from "@shared/schema";
import type {
  Case,
  Client,
  ConsentLog,
  MeetingSession,
  AudioRecording,
  Document,
  ActionItem,
  Undertaking,
  TimeEntry,
  AuditTrail,
  DsarRequest,
  QuickNote,
  AmlMonitoringNote,
  AmlDecisionRecord,
  ConflictCheck,
  FirmProfile,
} from "@shared/schema";
import crypto from "crypto";

export interface SraReportData {
  compiledAt: string;
  caseData: Case | null;
  clientData: Client | null;
  firmProfileData: FirmProfile | null;
  feeEarnerName: string | null;
  supervisorName: string | null;
  dateRange: { earliest: string | null; latest: string | null };
  consentLogs: ConsentLog[];
  meetingSessions: MeetingSession[];
  audioRecordings: AudioRecording[];
  documents: Document[];
  actionItems: ActionItem[];
  undertakings: Undertaking[];
  timeEntries: TimeEntry[];
  auditTrailEntries: AuditTrail[];
  dsarRequests: DsarRequest[];
  quickNotes: QuickNote[];
  amlNotes: AmlMonitoringNote[];
  amlDecisions: AmlDecisionRecord[];
  conflictChecks: ConflictCheck[];
  dataHash: string;
}

export interface SraReportPreview {
  sections: {
    matterOverview: { clientName: string | null; matterRef: string | null; practiceArea: string | null };
    aml: { riskLevel: string | null; notesCount: number; decisionsCount: number };
    clientCare: { hasCareLetter: boolean; hasConsent: boolean; consentCount: number };
    communications: { sessionCount: number; noteCount: number; totalDurationSeconds: number };
    obligationsAndUndertakings: { obligationCount: number; undertakingCount: number; outstandingCount: number };
    documents: { documentCount: number };
    timeRecording: { entryCount: number; totalMinutes: number };
    dataProtection: { consentCount: number; dsarCount: number };
    supervision: { supervisor: string | null };
    auditTrail: { entryCount: number };
  };
}

export async function assembleSraReportData(caseId: string, userId: string): Promise<SraReportData> {
  const compiledAt = new Date().toISOString();

  const [
    caseRows,
    firmProfileRows,
    consentRows,
    sessionsRows,
    audioRecordingsRows,
    documentsRows,
    actionItemsRows,
    undertakingsRows,
    timeEntriesRows,
    auditRows,
    dsarRows,
    quickNotesRows,
    amlNotesRows,
    amlDecisionsRows,
    conflictChecksRows,
  ] = await Promise.all([
    db.select().from(cases).where(eq(cases.id, caseId)).limit(1),
    db.select().from(firmProfile).limit(1),
    db.select().from(consentLogs).where(eq(consentLogs.caseId, caseId)).orderBy(consentLogs.consentTimestamp),
    db.select().from(meetingSessions).where(eq(meetingSessions.caseId, caseId)).orderBy(meetingSessions.startedAt),
    db.select().from(audioRecordings).where(eq(audioRecordings.caseId, caseId)).orderBy(audioRecordings.recordedAt),
    db.select().from(documents).where(eq(documents.caseId, caseId)).orderBy(desc(documents.createdAt)),
    db.select().from(actionItems).where(eq(actionItems.caseId, caseId)).orderBy(actionItems.createdAt),
    db.select().from(undertakings).where(eq(undertakings.caseId, caseId)).orderBy(undertakings.dateGiven),
    db.select().from(timeEntries).where(eq(timeEntries.caseId, caseId)).orderBy(timeEntries.createdAt),
    db.select().from(auditTrail).where(eq(auditTrail.caseId, caseId)).orderBy(auditTrail.timestamp),
    db.select().from(dsarRequests).where(sql`${dsarRequests.dataLocated}::jsonb @> ${JSON.stringify([{ caseId }])}::jsonb`).catch(() => [] as DsarRequest[]),
    db.select().from(quickNotes).where(eq(quickNotes.caseId, caseId)).orderBy(quickNotes.createdAt),
    db.select().from(amlMonitoringNotes).where(eq(amlMonitoringNotes.caseId, caseId)).orderBy(amlMonitoringNotes.createdAt),
    db.select().from(amlDecisionRecords).where(eq(amlDecisionRecords.caseId, caseId)).orderBy(amlDecisionRecords.createdAt),
    db.select().from(conflictChecks).where(eq(conflictChecks.caseId, caseId)).orderBy(conflictChecks.datePerformed),
  ]);

  const caseData = caseRows[0] || null;
  const firmProfileData = firmProfileRows[0] || null;

  let clientData: Client | null = null;
  if (caseData?.clientId) {
    const clientRows = await db.select().from(clients).where(eq(clients.id, caseData.clientId)).limit(1);
    clientData = clientRows[0] || null;
  }

  let feeEarnerName: string | null = null;
  let supervisorName: string | null = null;

  const feeEarnerUserId = caseData?.assignedToUserId || caseData?.createdBy;
  if (feeEarnerUserId) {
    const earnerRows = await db.select().from(users).where(eq(users.id, feeEarnerUserId)).limit(1);
    if (earnerRows[0]) {
      feeEarnerName = [earnerRows[0].firstName, earnerRows[0].lastName].filter(Boolean).join(" ") || earnerRows[0].email || null;
    }
  }

  // Supervisor: use the case creator if different from fee earner, otherwise mark as sole practitioner
  if (caseData?.createdBy && caseData.createdBy !== feeEarnerUserId) {
    const supervisorRows = await db.select().from(users).where(eq(users.id, caseData.createdBy)).limit(1);
    if (supervisorRows[0]) {
      supervisorName = [supervisorRows[0].firstName, supervisorRows[0].lastName].filter(Boolean).join(" ") || supervisorRows[0].email || null;
    }
  } else if (feeEarnerName) {
    supervisorName = `${feeEarnerName} (Sole practitioner / self-supervising)`;
  }

  const allTimestamps = [
    ...sessionsRows.map(s => s.startedAt?.toISOString()),
    caseData?.createdAt?.toISOString(),
  ].filter(Boolean) as string[];

  const dateRange = {
    earliest: allTimestamps.length > 0 ? allTimestamps.sort()[0] : null,
    latest: allTimestamps.length > 0 ? allTimestamps.sort().reverse()[0] : null,
  };

  const dataString = JSON.stringify({
    caseId,
    compiledAt,
    caseData,
    clientData,
    consentLogs: consentRows,
    sessions: sessionsRows,
    audioRecordings: audioRecordingsRows,
    documents: documentsRows,
    actionItems: actionItemsRows,
    undertakings: undertakingsRows,
    timeEntries: timeEntriesRows,
    auditTrail: auditRows,
    quickNotes: quickNotesRows,
    amlNotes: amlNotesRows,
    amlDecisions: amlDecisionsRows,
    conflictChecks: conflictChecksRows,
  });
  const dataHash = crypto.createHash("sha256").update(dataString).digest("hex");

  return {
    compiledAt,
    caseData,
    clientData,
    firmProfileData,
    feeEarnerName,
    supervisorName,
    dateRange,
    consentLogs: consentRows,
    meetingSessions: sessionsRows,
    audioRecordings: audioRecordingsRows,
    documents: documentsRows,
    actionItems: actionItemsRows,
    undertakings: undertakingsRows,
    timeEntries: timeEntriesRows,
    auditTrailEntries: auditRows,
    dsarRequests: dsarRows,
    quickNotes: quickNotesRows,
    amlNotes: amlNotesRows,
    amlDecisions: amlDecisionsRows,
    conflictChecks: conflictChecksRows,
    dataHash,
  };
}

export function buildSraReportPreview(data: SraReportData): SraReportPreview {
  const totalMinutes = data.timeEntries.reduce((sum, t) => sum + (t.durationMinutes || 0), 0);
  const totalDurationSeconds = data.meetingSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
  const outstandingCount =
    data.undertakings.filter(u => u.status === "outstanding").length +
    data.actionItems.filter(a => !a.completed && a.status !== "rejected").length;

  return {
    sections: {
      matterOverview: {
        clientName: data.caseData?.clientName || null,
        matterRef: data.caseData?.matterReference || null,
        practiceArea: data.caseData?.practiceArea || null,
      },
      aml: {
        riskLevel: data.clientData?.amlRiskLevel || data.caseData?.riskLevel || null,
        notesCount: data.amlNotes.length,
        decisionsCount: data.amlDecisions.length,
      },
      clientCare: {
        hasCareLetter: data.documents.some(d => d.type === "client_care_letter" && d.isActive),
        hasConsent: data.consentLogs.some(c => c.consentGiven),
        consentCount: data.consentLogs.length,
      },
      communications: {
        sessionCount: data.meetingSessions.length,
        noteCount: data.quickNotes.length,
        totalDurationSeconds,
      },
      obligationsAndUndertakings: {
        obligationCount: data.actionItems.length,
        undertakingCount: data.undertakings.length,
        outstandingCount,
      },
      documents: {
        documentCount: data.documents.filter(d => d.isActive).length,
      },
      timeRecording: {
        entryCount: data.timeEntries.length,
        totalMinutes,
      },
      dataProtection: {
        consentCount: data.consentLogs.length,
        dsarCount: data.dsarRequests.length,
      },
      supervision: {
        supervisor: data.supervisorName,
      },
      auditTrail: {
        entryCount: data.auditTrailEntries.length,
      },
    },
  };
}
