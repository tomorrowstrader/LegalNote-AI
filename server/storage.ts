import { 
  type User, type InsertUser, type UpsertUser,
  type AuthIdentity,
  type Client, type InsertClient,
  type Case, type InsertCase, 
  type AudioRecording, type InsertAudioRecording, 
  type ConsentLog, type InsertConsentLog,
  type Transcript, type InsertTranscript,
  type ActionItem, type InsertActionItem,
  type PreMeetingBriefing, type InsertPreMeetingBriefing,
  type QuickNote, type InsertQuickNote,
  type Document, type InsertDocument,
  type AuditTrail, type InsertAuditTrail,
  type FirmProfile, type InsertFirmProfile,
  type UserPreferences,
  type CalendarEvent, type InsertCalendarEvent,
  type CalendarIntegration, type InsertCalendarIntegration,
  type ShareLink, type InsertShareLink,
  type RecallConnection, type InsertRecallConnection,
  type MeetingImport, type InsertMeetingImport,
  type PreConsentEmail, type InsertPreConsentEmail,
  type ScheduledMeeting, type InsertScheduledMeeting,
  type SharePointConnection, type InsertSharePointConnection,
  type ClientVersionTracking, type InsertClientVersionTracking,
  type SearchHistory, type InsertSearchHistory,
  type Waitlist, type InsertWaitlist,
  type LinkedinPostPerformance, type InsertLinkedinPostPerformance,
  type LinkedinConnectionMilestone, type InsertLinkedinConnectionMilestone,
  type LinkedinInboundLead, type InsertLinkedinInboundLead,
  type LinkedinHookVariant, type InsertLinkedinHookVariant,
  type LinkedinPostChatMessage, type InsertLinkedinPostChatMessage,
  type DocumentComment, type InsertDocumentComment,
  type AmlMonitoringNote, type InsertAmlMonitoringNote,
  type AmlDecisionRecord, type InsertAmlDecisionRecord,
  type ExternalDocumentRef, type InsertExternalDocumentRef,
  type MeetingSession, type InsertMeetingSession,
  type TimeEntry, type InsertTimeEntry,
  type Undertaking, type InsertUndertaking,
  type Firm, type InsertFirm,
  type FirmInvitation, type InsertFirmInvitation,
  type RoleChangeLog, type InsertRoleChangeLog,
  type ConflictCheck, type InsertConflictCheck,
  type SupervisionSignoff, type InsertSupervisionSignoff,
  users,
  authIdentities,
  clients,
  cases,
  audioRecordings,
  consentLogs,
  transcripts,
  actionItems,
  preMeetingBriefings,
  quickNotes,
  documents,
  auditTrail,
  firmProfile,
  userPreferences,
  calendarEvents,
  calendarIntegrations,
  shareLinks,
  recallConnections,
  meetingImports,
  preConsentEmails,
  scheduledMeetings,
  sharePointConnections,
  clientVersionTracking,
  searchHistory,
  waitlist,
  linkedinPostPerformance,
  linkedinConnectionMilestones,
  linkedinInboundLeads,
  linkedinHookVariants,
  linkedinPostChatMessages,
  documentComments,
  amlMonitoringNotes,
  amlDecisionRecords,
  externalDocumentRefs,
  meetingSessions,
  timeEntries,
  undertakings,
  firms,
  firmInvitations,
  roleChangeLogs,
  conflictChecks,
  supervisionSignoffs,
} from "@shared/schema";
import crypto, { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, or, gte, lte, lt, desc, isNull, isNotNull, not, sql, count, inArray } from "drizzle-orm";
import { generateDocumentHash } from "./utils/documentHash";
import { expandSearchWithSynonyms } from "./services/legalSynonyms";
import {
  AUDIT_PAYLOAD_V2,
  buildAuditEntryContent,
  computeAuditChainHash,
  getAuditSigningKey,
} from "./services/auditChain";
import {
  coerceVerificationWarnings,
  type VerificationResolveDisposition,
  type VerificationWarning,
} from "@shared/verificationWarnings";

// Enhanced search result with granular match information
export interface SearchMatch {
  documentType: 'transcript' | 'attendance_note' | 'summary' | 'case_field';
  documentId?: string;
  fieldName?: string; // For case fields: 'title', 'clientName', etc.
  snippet: string; // Context around the match (50 chars before/after)
  matchPosition: number; // Character position of match
  createdAt?: Date;
  timestampMs?: number; // For transcript matches: timestamp in milliseconds
  speaker?: string; // For transcript matches: speaker identifier
}

export interface SearchResultWithMatches {
  case: Case;
  matches: SearchMatch[];
  score: number;
}

// Fuzzy search helper: Calculate trigram similarity between two strings
// Returns a value between 0 and 1, where 1 is an exact match
function trigramSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  
  const getTrigrams = (s: string): Set<string> => {
    const padded = `  ${s} `;
    const trigrams = new Set<string>();
    for (let i = 0; i < padded.length - 2; i++) {
      trigrams.add(padded.substring(i, i + 3));
    }
    return trigrams;
  };
  
  const trigrams1 = getTrigrams(str1);
  const trigrams2 = getTrigrams(str2);
  
  let intersection = 0;
  trigrams1.forEach(t => {
    if (trigrams2.has(t)) intersection++;
  });
  
  const union = trigrams1.size + trigrams2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

// Phonetic matching helper: Check if two strings sound similar
// Uses a simplified Soundex-like algorithm for common name variations
function soundsLike(query: string, target: string): boolean {
  if (!query || !target) return false;
  
  const soundex = (s: string): string => {
    const str = s.toUpperCase().replace(/[^A-Z]/g, '');
    if (!str) return '';
    
    const codes: Record<string, string> = {
      'B': '1', 'F': '1', 'P': '1', 'V': '1',
      'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
      'D': '3', 'T': '3',
      'L': '4',
      'M': '5', 'N': '5',
      'R': '6'
    };
    
    let result = str[0];
    let prevCode = codes[str[0]] || '';
    
    for (let i = 1; i < str.length && result.length < 4; i++) {
      const code = codes[str[i]] || '';
      if (code && code !== prevCode) {
        result += code;
      }
      prevCode = code || prevCode;
    }
    
    return (result + '000').substring(0, 4);
  };
  
  // Check if any word in target sounds like the query
  const queryWords = query.split(/\s+/).filter(w => w.length > 2);
  const targetWords = target.split(/\s+/).filter(w => w.length > 2);
  
  for (const qWord of queryWords) {
    const qSoundex = soundex(qWord);
    for (const tWord of targetWords) {
      if (soundex(tWord) === qSoundex) return true;
    }
  }
  
  return false;
}

// Phonetic word search in longer text
// Returns the position and matched word if any word in `text` phonetically matches any word in `query`
// Excludes exact matches (those are caught by substring search first)
function phoneticMatchInText(
  query: string,
  text: string
): { pos: number; matchWord: string; textWord: string } | null {
  if (!query || !text) return null;

  const soundex = (s: string): string => {
    const str = s.toUpperCase().replace(/[^A-Z]/g, '');
    if (!str) return '';
    const codes: Record<string, string> = {
      'B': '1', 'F': '1', 'P': '1', 'V': '1',
      'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
      'D': '3', 'T': '3',
      'L': '4',
      'M': '5', 'N': '5',
      'R': '6',
    };
    let result = str[0];
    let prevCode = codes[str[0]] || '';
    for (let i = 1; i < str.length && result.length < 4; i++) {
      const code = codes[str[i]] || '';
      if (code && code !== prevCode) result += code;
      prevCode = code || prevCode;
    }
    return (result + '000').substring(0, 4);
  };

  // Only phonetically expand short alphabetic words (names/terms, not stopwords)
  const queryWords = query
    .split(/\s+/)
    .filter(w => w.length > 2 && /^[a-z]+$/i.test(w));
  if (queryWords.length === 0) return null;

  const queryCodes = queryWords.map(w => ({
    word: w.toLowerCase(),
    code: soundex(w),
  }));

  const wordRegex = /\b([a-zA-Z]{3,})\b/g;
  let match: RegExpExecArray | null;
  while ((match = wordRegex.exec(text)) !== null) {
    const textWord = match[1];
    const textWordLower = textWord.toLowerCase();
    const textCode = soundex(textWord);
    for (const { word: qWord, code: qCode } of queryCodes) {
      // Same Soundex but not an exact substring match (exact is handled before this pass)
      if (textCode === qCode && textWordLower !== qWord) {
        return { pos: match.index, matchWord: qWord, textWord };
      }
    }
  }
  return null;
}

// Accent folding helper: Remove diacritics/accents from text
// e.g., "Café" -> "Cafe", "José" -> "Jose"
function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
  million: 1000000,
};

function wordsToNumber(text: string): number | null {
  const words = text.toLowerCase().replace(/[,-]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  let total = 0;
  let current = 0;
  let hasNumber = false;
  for (const w of words) {
    if (w === 'and') continue;
    const val = NUMBER_WORDS[w];
    if (val === undefined) return hasNumber ? total + current : null;
    hasNumber = true;
    if (val === 1000 || val === 1000000) {
      current = (current === 0 ? 1 : current) * val;
      total += current;
      current = 0;
    } else if (val === 100) {
      current = (current === 0 ? 1 : current) * 100;
    } else {
      current += val;
    }
  }
  return hasNumber ? total + current : null;
}

function numberToWords(n: number): string | null {
  if (n < 0 || !Number.isInteger(n) || n > 999999999) return null;
  if (n === 0) return 'zero';
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const convert = (num: number): string => {
    if (num === 0) return '';
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? '-' + ones[num % 10] : '');
    if (num < 1000) return ones[Math.floor(num / 100)] + ' hundred' + (num % 100 ? ' and ' + convert(num % 100) : '');
    if (num < 1000000) return convert(Math.floor(num / 1000)) + ' thousand' + (num % 1000 ? ' ' + convert(num % 1000) : '');
    return convert(Math.floor(num / 1000000)) + ' million' + (num % 1000000 ? ' ' + convert(num % 1000000) : '');
  };
  return convert(n);
}

function getNumberVariants(query: string): string[] {
  const variants: string[] = [];
  const cleaned = query.replace(/[£$€,]/g, '').trim();
  const asNum = parseInt(cleaned, 10);
  if (!isNaN(asNum) && asNum.toString() === cleaned) {
    const words = numberToWords(asNum);
    if (words) {
      variants.push(words);
      const parts = words.split(/[-\s]+/);
      if (parts.length > 1) {
        variants.push(...parts.filter(p => p !== 'and'));
      }
    }
  } else {
    const asNumber = wordsToNumber(query);
    if (asNumber !== null) {
      variants.push(asNumber.toString());
      variants.push(asNumber.toLocaleString('en-GB'));
    }
  }
  return variants;
}

// Server-side audio recording creation type (includes server-calculated expiresAt)
export type ServerAudioRecordingInsert = InsertAudioRecording & {
  expiresAt: Date;
};

export interface AdminStatistics {
  totalCases: number;
  totalUsers: number;
  totalTranscriptions: number;
  totalDocumentsGenerated: number;
  totalCostsUSD: number;
  transcriptionCostsUSD: number;
  documentGenerationCostsUSD: number;
  successfulProcessing: number;
  failedProcessing: number;
  successRate: number;
  averageProcessingTimeMinutes: number;
  casesLast30Days: number;
  casesLast7Days: number;
}

export interface UserStatistics {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  totalCases: number;
  successfulCases: number;
  failedCases: number;
  totalCostsUSD: number;
  lastActivity: Date | null;
  joinedDate: Date;
}

export interface FirmRiskDigest {
  generatedAt: Date;
  overdueUndertakings: Array<{ id: string; wording: string; caseTitle: string; deadline: Date; daysOverdue: number }>;
  upcomingUndertakings: Array<{ id: string; wording: string; caseTitle: string; deadline: Date; daysUntil: number }>;
  highAmlCases: Array<{ id: string; title: string; riskLevel: string; clientName: string | null }>;
  unacknowledgedLetters: Array<{ caseId: string; caseTitle: string; clientName: string | null; sentAt: Date }>;
  missingSessions: Array<{ caseId: string; caseTitle: string; completedSessions: number; documentedSessions: number }>;
  totalIssues: number;
}

export interface ComplianceScore {
  overall: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: {
    consentCompliance: { score: number; max: number; label: string; detail: string };
    amlCompletion: { score: number; max: number; label: string; detail: string };
    undertakingsOnTime: { score: number; max: number; label: string; detail: string };
    clientCareAcknowledgement: { score: number; max: number; label: string; detail: string };
    documentationCompletion: { score: number; max: number; label: string; detail: string };
  };
  lastUpdated: Date;
}

export interface MatterComplianceStatus {
  caseId: string;
  caseTitle: string;
  clientName: string;
  matterReference: string | null;
  practiceArea: string | null;
  createdAt: Date;
  feeEarnerName: string;
  feeEarnerId: string;
  supervisorId: string | null;
  supervisorName: string | null;
  ragStatus: 'red' | 'amber' | 'green';
  outstandingItems: number;
  outstandingUndertakings: number;
  lastSignoffDate: Date | null;
  daysSinceSignoff: number | null;
  issues: string[];
}

export interface ComplianceOverview {
  totalActiveMatters: number;
  redMatters: number;
  amberMatters: number;
  greenMatters: number;
  totalOutstandingUndertakings: number;
  matters: MatterComplianceStatus[];
  undertakings: Array<{
    id: string;
    caseId: string;
    caseTitle: string;
    matterReference: string | null;
    wording: string;
    feeEarnerName: string;
    dateGiven: Date;
    daysOutstanding: number;
  }>;
  supervisionByFeeEarner: Array<{
    feeEarnerId: string;
    feeEarnerName: string;
    supervisorName: string | null;
    matters: Array<{
      caseId: string;
      caseTitle: string;
      lastSignoffDate: Date | null;
      daysSinceSignoff: number | null;
      needsSignoff: boolean;
    }>;
  }>;
}

export type CaseLitigationHoldStatus = {
  litigationHold: boolean;
  litigationHoldAppliedAt: Date | null;
  litigationHoldAppliedBy: string | null;
  litigationHoldReason: string | null;
};

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAuthIdentity(provider: string, providerUserId: string): Promise<AuthIdentity | undefined>;
  getAuthIdentitiesForUser(userId: string): Promise<AuthIdentity[]>;
  createAuthIdentity(data: {
    userId: string;
    provider: string;
    providerUserId: string;
    emailAtLink?: string | null;
  }): Promise<AuthIdentity>;
  resolveGoogleAuthUser(profile: {
    providerUserId: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  }): Promise<User>;
  resolveMicrosoftAuthUser(profile: {
    providerUserId: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  }): Promise<User>;
  /**
   * User-facing confirm of display name. Fails if already confirmed unless force (admin).
   * Sets firstName, lastName, and displayNameConfirmedAt.
   */
  confirmUserDisplayName(
    userId: string,
    names: { firstName: string; lastName: string },
    options?: { force?: boolean },
  ): Promise<User | undefined>;
  updateUserStripeInfo(userId: string, stripeInfo: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus?: string;
    subscriptionPlan?: string;
    trialEndsAt?: Date | null;
  }): Promise<User | undefined>;
  
  createClient(clientData: InsertClient, userId: string): Promise<Client>;
  getClient(id: string, userId: string): Promise<Client | undefined>;
  updateClient(id: string, updates: Partial<Client>, userId: string): Promise<Client | undefined>;
  searchClients(query: string, userId: string): Promise<Client[]>;
  getClientsByUser(userId: string): Promise<Client[]>;
  getCasesByClientId(clientId: string, userId: string): Promise<Case[]>;
  migrateExistingClientsFromCases(userId: string): Promise<number>;

  createCase(caseData: InsertCase, userId: string): Promise<Case>;
  getCases(userId: string, includeArchived?: boolean): Promise<Case[]>;
  getFirmCases(firmId: string, includeArchived?: boolean): Promise<Case[]>;
  getCasesAssignedToUser(assignedUserId: string, includeArchived?: boolean): Promise<Case[]>;
  getCase(id: string, userId: string): Promise<Case | undefined>;
  updateCase(id: string, updates: Partial<Case>, userId: string): Promise<Case | undefined>;
  markCaseAsReviewed(id: string, reviewed: boolean, userId: string): Promise<Case | undefined>;
  archiveCase(id: string, archived: boolean, userId: string): Promise<Case | undefined>;
  assignCaseToUser(id: string, assignedToUserId: string | null, userId: string): Promise<Case | undefined>;
  
  createAudioRecording(audioData: ServerAudioRecordingInsert): Promise<AudioRecording>;
  getAudioRecording(id: string): Promise<AudioRecording | undefined>;
  getAudioRecordingsByCaseId(caseId: string): Promise<AudioRecording[]>;
  getAudioRecordingByCase(caseId: string, userId: string): Promise<AudioRecording | undefined>;
  getAudioRecordingBySession(meetingSessionId: string): Promise<AudioRecording | undefined>;
  updateAudioRecording(id: string, updates: Partial<AudioRecording>): Promise<AudioRecording | undefined>;
  getExpiredAudioRecordings(): Promise<AudioRecording[]>;
  getGraceExpiredAudioRecordings(): Promise<AudioRecording[]>;
  getExpiringAudioCount(userId: string, withinHours: number): Promise<number>;
  getProductivityStats(userId: string, since?: Date): Promise<{
    totalCases: number;
    awaitingReview: number;
    evidenceCompletePercent: number;
    documentationRate: number;
    thisMonthCases: number;
    monthlyTrend: "up" | "down" | "neutral";
    monthlyChange: number;
  }>;
  
  getConsentLogsByCase(caseId: string, userId: string): Promise<ConsentLog[]>;
  
  createTranscript(transcriptData: InsertTranscript): Promise<Transcript>;
  getTranscript(id: string): Promise<Transcript | undefined>;
  getTranscriptByCase(caseId: string, userId: string): Promise<Transcript | undefined>;
  getTranscriptBySession(meetingSessionId: string): Promise<Transcript | undefined>;
  updateTranscript(id: string, updates: Partial<Transcript>, userId: string): Promise<Transcript | undefined>;
  commitTranscriptRedactions(transcriptId: string, userId: string, redactionIds?: string[]): Promise<Transcript | undefined>;
  getTranscriptsWithExpiredPendingRedactions(): Promise<(Transcript & { createdBy: string })[]>;
  
  // Action Items methods
  createActionItem(itemData: InsertActionItem): Promise<ActionItem>;
  createManualActionItem(itemData: { caseId: string; description: string; assignee?: string | null; dueDate?: Date; priority?: string; isManual?: boolean }): Promise<ActionItem>;
  getActionItem(id: string, userId: string): Promise<ActionItem | undefined>;
  getActionItemsByCase(caseId: string, userId: string): Promise<ActionItem[]>;
  getAllActionItemsForUser(userId: string): Promise<(ActionItem & { caseTitle?: string; clientName?: string })[]>;
  getActionItemsByTranscript(transcriptId: string, userId: string): Promise<ActionItem[]>;
  updateActionItem(id: string, updates: Partial<ActionItem>, userId: string): Promise<ActionItem | undefined>;
  deleteActionItem(id: string, userId: string): Promise<boolean>;
  
  // Pre-Meeting Briefing methods
  createPreMeetingBriefing(briefingData: InsertPreMeetingBriefing): Promise<PreMeetingBriefing>;
  getPreMeetingBriefingsByCase(caseId: string, userId: string): Promise<PreMeetingBriefing[]>;
  getLatestPreMeetingBriefing(caseId: string, userId: string): Promise<PreMeetingBriefing | undefined>;
  
  createQuickNote(noteData: InsertQuickNote, userId: string): Promise<QuickNote>;
  getQuickNotesByCase(caseId: string, userId: string): Promise<QuickNote[]>;
  
  createDocument(documentData: InsertDocument): Promise<Document>;
  createDocumentVersion(
    parentDocumentId: string,
    newContent: string,
    versionType: string,
    userId: string,
    options?: {
      approvalComment?: string;
      verificationWarnings?: VerificationWarning[];
    }
  ): Promise<Document | undefined>;
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsByCase(caseId: string, userId: string): Promise<Document[]>;
  getDocumentsBySession(meetingSessionId: string): Promise<Document[]>;
  getActiveDocumentsByCase(caseId: string, userId: string): Promise<Document[]>;
  updateDocument(id: string, updates: Partial<Document>, userId: string): Promise<Document | undefined>;
  approveDocument(id: string, userId: string, comment?: string, reasoningGapsReviewed?: boolean): Promise<Document | undefined>;
  unlockDocument(id: string, userId: string): Promise<Document | undefined>;
  updateReasoningNote(id: string, note: string | null, userId: string): Promise<Document | undefined>;
  resolveVerificationWarning(
    documentId: string,
    warningId: string,
    disposition: VerificationResolveDisposition,
    reason: string,
    userId: string,
  ): Promise<Document | undefined>;
  getDocumentByAcknowledgeToken(token: string): Promise<Document | undefined>;
  recordDocumentAcknowledgement(id: string, acknowledgedAt: Date, acknowledgedByEmail: string, acknowledgedIp: string): Promise<void>;
  
  // Client Version Tracking methods
  createClientVersionTracking(trackingData: InsertClientVersionTracking): Promise<ClientVersionTracking>;
  getClientVersionTrackingByDocument(documentId: string): Promise<ClientVersionTracking[]>;
  getClientVersionTrackingByCase(caseId: string, userId: string): Promise<Array<ClientVersionTracking & { document: Document }>>;
  getLatestClientVersion(documentId: string): Promise<ClientVersionTracking | undefined>;
  
  createAuditLog(auditData: InsertAuditTrail): Promise<AuditTrail>;
  getAuditLogs(filters?: {
    userId?: string;
    caseId?: string;
    documentId?: string;
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditTrail[]>;
  getAuditLogsByCase(caseId: string, limit?: number): Promise<AuditTrail[]>;
  
  // Admin methods
  getAllUsers(): Promise<User[]>;
  getAllCases(): Promise<Case[]>;
  getAdminStatistics(): Promise<AdminStatistics>;
  getUserStatistics(): Promise<UserStatistics[]>;
  
  // Firm Profile methods
  getFirmProfile(firmId?: string): Promise<FirmProfile | undefined>;
  setFirmComplianceCode(firmId: string, codeHash: string, userId: string): Promise<void>;
  verifyFirmComplianceCode(firmId: string, code: string): Promise<boolean>;
  upsertFirmProfile(profileData: InsertFirmProfile): Promise<FirmProfile>;
  patchFirmProfileLogoUrl(logoUrl: string, updatedBy: string): Promise<FirmProfile>;
  getFirmRiskDigest(): Promise<FirmRiskDigest>;
  getComplianceScore(): Promise<ComplianceScore>;

  // User Preferences methods
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  updateUserPreferences(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences>;
  
  // Search methods
  searchCases(query: string, userId: string): Promise<Case[]>;
  searchCasesWithMatches(query: string, userId: string, options?: {
    documentType?: 'transcript' | 'attendance_note' | 'summary' | 'all';
    dateRange?: 'today' | 'week' | 'month' | 'year' | 'all';
  }): Promise<SearchResultWithMatches[]>;
  
  // Search History methods
  createSearchHistory(historyData: InsertSearchHistory): Promise<SearchHistory>;
  getSearchHistory(userId: string, limit?: number): Promise<SearchHistory[]>;
  clearSearchHistory(userId: string): Promise<void>;
  
  // Object storage ownership verification
  findObjectByPath(objectPath: string, userId: string): Promise<{
    type: 'audio' | 'document' | 'transcript' | 'unknown';
    objectId: string;
    caseId: string;
    owned: boolean;
  } | null>;
  
  // Calendar Event methods
  createCalendarEvent(eventData: InsertCalendarEvent): Promise<CalendarEvent>;
  getCalendarEventsByCase(caseId: string, userId: string): Promise<CalendarEvent[]>;
  getCalendarEventByProvider(caseId: string, userId: string, provider: 'google' | 'outlook'): Promise<CalendarEvent | undefined>;
  updateCalendarEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent | undefined>;
  deleteCalendarEvent(id: string): Promise<void>;
  deleteCalendarEventsByCase(caseId: string, userId: string): Promise<void>;
  
  // Calendar Integration methods (per-user OAuth)
  getCalendarIntegration(userId: string, provider: 'google' | 'outlook'): Promise<CalendarIntegration | undefined>;
  getActiveCalendarIntegrations(provider: 'google' | 'outlook'): Promise<CalendarIntegration[]>;
  saveCalendarIntegration(integrationData: InsertCalendarIntegration): Promise<CalendarIntegration>;
  deleteCalendarIntegration(userId: string, provider: 'google' | 'outlook'): Promise<void>;
  getUserCalendarIntegrations(userId: string): Promise<CalendarIntegration[]>;
  
  // Share Link methods
  createShareLink(shareLinkData: InsertShareLink): Promise<ShareLink>;
  getShareLink(id: string): Promise<ShareLink | undefined>;
  getShareLinks(userId: string): Promise<ShareLink[]>;
  getShareLinksByCase(caseId: string, userId: string): Promise<ShareLink[]>;
  updateShareLink(id: string, updates: Partial<ShareLink>): Promise<ShareLink | undefined>;
  deleteShareLink(id: string, userId: string): Promise<boolean>;
  incrementShareLinkAccess(id: string): Promise<void>;
  updateShareLinkSmsCode(id: string, code: string, expiresAt: Date): Promise<ShareLink | undefined>;
  verifyShareLinkSmsCode(id: string, code: string): Promise<{ verified: boolean; expired?: boolean; invalid?: boolean }>;
  
  // Recall.ai Connection methods
  getRecallConnection(userId: string): Promise<RecallConnection | undefined>;
  createRecallConnection(connectionData: InsertRecallConnection): Promise<RecallConnection>;
  updateRecallConnection(userId: string, updates: Partial<RecallConnection>): Promise<RecallConnection | undefined>;
  deleteRecallConnection(userId: string): Promise<void>;
  
  // Meeting Import methods
  createMeetingImport(importData: InsertMeetingImport): Promise<MeetingImport>;
  getMeetingImport(id: string): Promise<MeetingImport | undefined>;
  getMeetingImportByBotId(botId: string): Promise<MeetingImport | undefined>;
  getMeetingImportsByUser(userId: string): Promise<MeetingImport[]>;
  getMeetingImportsByCase(caseId: string, userId: string): Promise<MeetingImport[]>;
  getLiveMeetingImports(): Promise<MeetingImport[]>;
  getUnassignedMeetingImports(userId: string): Promise<MeetingImport[]>;
  updateMeetingImport(id: string, updates: Partial<MeetingImport>): Promise<MeetingImport | undefined>;
  
  // Pre-Consent Email methods
  createPreConsentEmail(emailData: InsertPreConsentEmail): Promise<PreConsentEmail>;
  getPreConsentEmail(id: string): Promise<PreConsentEmail | undefined>;
  getPreConsentEmailByToken(token: string): Promise<PreConsentEmail | undefined>;
  getPreConsentEmailsByUser(userId: string): Promise<PreConsentEmail[]>;
  updatePreConsentEmail(id: string, updates: Partial<PreConsentEmail>): Promise<PreConsentEmail | undefined>;
  acknowledgePreConsentEmail(id: string, ipAddress: string, responseStatus?: string, rescheduleNote?: string): Promise<PreConsentEmail | undefined>;
  
  // Scheduled Meeting methods
  createScheduledMeeting(meetingData: InsertScheduledMeeting): Promise<ScheduledMeeting>;
  getScheduledMeeting(id: string): Promise<ScheduledMeeting | undefined>;
  getScheduledMeetingByCalendarEvent(userId: string, calendarEventId: string, provider: string): Promise<ScheduledMeeting | undefined>;
  getScheduledMeetingByBotId(botId: string): Promise<ScheduledMeeting | undefined>;
  getScheduledMeetingsByUser(userId: string): Promise<ScheduledMeeting[]>;
  getScheduledMeetingsByCase(caseId: string, userId: string): Promise<ScheduledMeeting[]>;
  getUpcomingScheduledMeetings(userId: string, daysAhead?: number): Promise<ScheduledMeeting[]>;
  getMeetingsNeedingConsent(userId: string): Promise<ScheduledMeeting[]>;
  getMeetingsReadyForBot(userId: string): Promise<ScheduledMeeting[]>;
  getAllScheduledMeetingsWithAutoRecord(): Promise<ScheduledMeeting[]>;
  getMeetingsNeedingReminders(minutesBefore: 30 | 10): Promise<ScheduledMeeting[]>;
  updateScheduledMeeting(id: string, updates: Partial<ScheduledMeeting>): Promise<ScheduledMeeting | undefined>;
  deleteScheduledMeeting(id: string): Promise<void>;
  
  // SharePoint/OneDrive Connection methods
  getSharePointConnection(userId: string, provider: 'sharepoint' | 'onedrive'): Promise<SharePointConnection | undefined>;
  getUserSharePointConnections(userId: string): Promise<SharePointConnection[]>;
  saveSharePointConnection(connectionData: InsertSharePointConnection): Promise<SharePointConnection>;
  updateSharePointConnection(userId: string, provider: 'sharepoint' | 'onedrive', updates: Partial<SharePointConnection>): Promise<SharePointConnection | undefined>;
  deleteSharePointConnection(userId: string, provider: 'sharepoint' | 'onedrive'): Promise<void>;
  
  // Waitlist methods
  createWaitlistEntry(entryData: InsertWaitlist): Promise<Waitlist>;
  getWaitlistEntry(id: string): Promise<Waitlist | undefined>;
  getWaitlistEntryByEmail(email: string): Promise<Waitlist | undefined>;
  getAllWaitlistEntries(): Promise<Waitlist[]>;
  updateWaitlistEntry(id: string, updates: Partial<Waitlist>): Promise<Waitlist | undefined>;
  deleteWaitlistEntry(id: string): Promise<void>;
  getWaitlistStats(): Promise<{ total: number; pending: number; invited: number; active: number }>;
  
  // LinkedIn post performance methods
  getLinkedinPostPerformance(postNumber: number): Promise<LinkedinPostPerformance | undefined>;
  getAllLinkedinPostPerformance(): Promise<LinkedinPostPerformance[]>;
  upsertLinkedinPostPerformance(data: InsertLinkedinPostPerformance): Promise<LinkedinPostPerformance>;
  
  // LinkedIn connection milestones
  getConnectionMilestones(): Promise<LinkedinConnectionMilestone[]>;
  addConnectionMilestone(data: InsertLinkedinConnectionMilestone): Promise<LinkedinConnectionMilestone>;
  deleteConnectionMilestone(id: string): Promise<void>;
  
  // LinkedIn inbound leads
  getInboundLeads(): Promise<LinkedinInboundLead[]>;
  addInboundLead(data: InsertLinkedinInboundLead): Promise<LinkedinInboundLead>;
  deleteInboundLead(id: string): Promise<void>;
  
  // LinkedIn hook variants
  getHookVariants(postNumber: number): Promise<LinkedinHookVariant[]>;
  addHookVariant(data: InsertLinkedinHookVariant): Promise<LinkedinHookVariant>;
  deleteHookVariant(id: string): Promise<void>;
  
  getChatMessages(postNumber: number): Promise<LinkedinPostChatMessage[]>;
  addChatMessage(data: InsertLinkedinPostChatMessage): Promise<LinkedinPostChatMessage>;
  clearChatMessages(postNumber: number): Promise<void>;
  
  getDocumentComments(documentId: string): Promise<DocumentComment[]>;
  createDocumentComment(data: InsertDocumentComment): Promise<DocumentComment>;
  updateDocumentComment(id: string, updates: Partial<DocumentComment>): Promise<DocumentComment | undefined>;
  deleteDocumentComment(id: string): Promise<void>;

  createMeetingSession(sessionData: InsertMeetingSession): Promise<MeetingSession>;
  getMeetingSession(id: string): Promise<MeetingSession | undefined>;
  getMeetingSessionsByCase(caseId: string, userId: string): Promise<MeetingSession[]>;
  updateMeetingSession(id: string, updates: Partial<MeetingSession>): Promise<MeetingSession | undefined>;

  getAmlMonitoringNotes(caseId: string): Promise<AmlMonitoringNote[]>;
  createAmlMonitoringNote(data: InsertAmlMonitoringNote): Promise<AmlMonitoringNote>;
  getAmlDecisionRecords(caseId: string): Promise<AmlDecisionRecord[]>;
  createAmlDecisionRecord(data: InsertAmlDecisionRecord): Promise<AmlDecisionRecord>;
  updateUserComplianceThread(userId: string, enabled: boolean): Promise<User | undefined>;
  getLastAmlActivityDates(caseIds: string[]): Promise<Record<string, Date>>;

  getCaseById(id: string): Promise<Case | undefined>;
  getCaseLitigationHoldStatus(caseId: string): Promise<CaseLitigationHoldStatus | undefined>;

  getExternalDocumentRefs(caseId: string): Promise<ExternalDocumentRef[]>;
  createExternalDocumentRef(data: InsertExternalDocumentRef, userId: string): Promise<ExternalDocumentRef>;

  createTimeEntry(data: InsertTimeEntry): Promise<TimeEntry>;
  getTimeEntry(id: string): Promise<TimeEntry | undefined>;
  getTimeEntriesByCase(caseId: string): Promise<TimeEntry[]>;
  getTimeEntriesByUser(userId: string, startDate?: Date, endDate?: Date): Promise<TimeEntry[]>;
  getAllTimeEntries(startDate?: Date, endDate?: Date): Promise<(TimeEntry & { caseTitle?: string; clientName?: string; userName?: string })[]>;
  updateTimeEntry(id: string, updates: Partial<TimeEntry>): Promise<TimeEntry | undefined>;
  deleteTimeEntry(id: string): Promise<void>;
  updateUserHourlyRate(userId: string, hourlyRate: string): Promise<User | undefined>;

  getUndertakingsByCase(caseId: string): Promise<Undertaking[]>;
  getUndertaking(id: string): Promise<Undertaking | undefined>;
  createUndertaking(data: InsertUndertaking): Promise<Undertaking>;
  updateUndertaking(id: string, updates: Partial<Undertaking>): Promise<Undertaking | undefined>;
  getAllOutstandingUndertakings(): Promise<(Undertaking & { caseTitle?: string; clientName?: string })[]>;

  // Firm methods
  createFirm(data: InsertFirm): Promise<Firm>;
  getFirm(id: string): Promise<Firm | undefined>;
  updateFirm(id: string, updates: Partial<Firm>): Promise<Firm | undefined>;
  ensureUserHasFirm(userId: string): Promise<Firm>;

  // Team member methods
  getFirmMembers(firmId: string): Promise<User[]>;
  updateUserFirmRole(userId: string, updates: {
    primaryRole?: string | null;
    customRoleLabel?: string | null;
    regulatoryDesignations?: string[];
    inviteStatus?: string;
    firmId?: string | null;
    invitedAt?: Date | null;
  }): Promise<User | undefined>;
  removeUserFromFirm(userId: string, removedAt: Date): Promise<User | undefined>;
  getFormerFirmMembers(firmId: string): Promise<User[]>;

  // Invitation methods
  createFirmInvitation(data: InsertFirmInvitation): Promise<FirmInvitation>;
  getFirmInvitation(id: string): Promise<FirmInvitation | undefined>;
  getFirmInvitationByToken(token: string): Promise<FirmInvitation | undefined>;
  getFirmInvitations(firmId: string): Promise<FirmInvitation[]>;
  updateFirmInvitation(id: string, updates: Partial<FirmInvitation>): Promise<FirmInvitation | undefined>;

  // Role change log methods
  createRoleChangeLog(data: InsertRoleChangeLog): Promise<RoleChangeLog>;
  getRoleChangeLogs(userId: string): Promise<RoleChangeLog[]>;
  getFirmRoleChangeLogs(firmId: string): Promise<RoleChangeLog[]>;
  getConflictChecksByCase(caseId: string): Promise<ConflictCheck[]>;
  createConflictCheck(data: InsertConflictCheck): Promise<ConflictCheck>;

  // Supervision sign-off methods
  getSupervisionSignoffsByCase(caseId: string): Promise<SupervisionSignoff[]>;
  createSupervisionSignoff(data: InsertSupervisionSignoff): Promise<SupervisionSignoff>;
  getComplianceOverview(): Promise<ComplianceOverview>;
  updateUserRole(userId: string, role: string): Promise<User | undefined>;
}

function generateContentSignature(contentHash: string): string {
  const signingKey = process.env.AUDIT_SIGNING_KEY;
  if (!signingKey) return '';
  return crypto.createHmac('sha256', signingKey).update(contentHash).digest('hex');
}

// colpReviewStatus = 'awaiting_review' is the internal grace-window marker. There is deliberately
// NO COLP review workflow (Option 2a); it simply marks audio as being in the 30-day post-release
// grace buffer before auto-deletion. The colp* field/function names are retained for forward-compatibility.
function isInActiveColpGraceWindow(recording: AudioRecording, now: Date = new Date()): boolean {
  return (
    recording.colpReviewStatus === "awaiting_review" &&
    recording.holdReleaseGraceUntil != null &&
    recording.holdReleaseGraceUntil >= now
  );
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private cases: Map<string, Case>;
  private audioRecordings: Map<string, AudioRecording>;
  private consentLogs: Map<string, ConsentLog>;
  private transcripts: Map<string, Transcript>;
  private actionItemsMap: Map<string, ActionItem>;
  private preMeetingBriefingsMap: Map<string, PreMeetingBriefing>;
  private quickNotes: Map<string, QuickNote>;
  private documents: Map<string, Document>;
  private auditLogs: Map<string, AuditTrail>;
  private calendarIntegrations: Map<string, CalendarIntegration>;
  private clientVersionTrackingRecords: Map<string, ClientVersionTracking>;
  private clientsMap: Map<string, Client>;
  private searchHistoryRecords: Map<string, SearchHistory>;
  private meetingSessionsMap: Map<string, MeetingSession>;
  private firmProfiles: Map<string, FirmProfile>;

  constructor() {
    this.users = new Map();
    this.clientsMap = new Map();
    this.cases = new Map();
    this.audioRecordings = new Map();
    this.consentLogs = new Map();
    this.transcripts = new Map();
    this.actionItemsMap = new Map();
    this.preMeetingBriefingsMap = new Map();
    this.quickNotes = new Map();
    this.documents = new Map();
    this.auditLogs = new Map();
    this.calendarIntegrations = new Map();
    this.clientVersionTrackingRecords = new Map();
    this.searchHistoryRecords = new Map();
    this.meetingSessionsMap = new Map();
    this.firmProfiles = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existing = this.users.get(userData.id);
    const nameLocked = !!existing?.displayNameConfirmedAt;
    const user: User = {
      id: userData.id,
      email: userData.email ?? existing?.email ?? null,
      // Never blank or overwrite confirmed names from OAuth; only fill gaps when unlocked.
      firstName: nameLocked
        ? (existing?.firstName ?? null)
        : (userData.firstName ?? existing?.firstName ?? null),
      lastName: nameLocked
        ? (existing?.lastName ?? null)
        : (userData.lastName ?? existing?.lastName ?? null),
      displayNameConfirmedAt: existing?.displayNameConfirmedAt ?? null,
      profileImageUrl: userData.profileImageUrl ?? existing?.profileImageUrl ?? null,
      stripeCustomerId: existing?.stripeCustomerId ?? null,
      stripeSubscriptionId: existing?.stripeSubscriptionId ?? null,
      subscriptionStatus: existing?.subscriptionStatus ?? null,
      subscriptionPlan: existing?.subscriptionPlan ?? null,
      trialEndsAt: existing?.trialEndsAt ?? null,
      complianceThread: existing?.complianceThread ?? false,
      hourlyRate: existing?.hourlyRate ?? null,
      firmId: existing?.firmId ?? null,
      primaryRole: existing?.primaryRole ?? null,
      customRoleLabel: existing?.customRoleLabel ?? null,
      regulatoryDesignations: existing?.regulatoryDesignations ?? [],
      inviteStatus: existing?.inviteStatus ?? "active",
      invitedBy: existing?.invitedBy ?? null,
      invitedAt: existing?.invitedAt ?? null,
      removedAt: existing?.removedAt ?? null,
      lastActiveAt: existing?.lastActiveAt ?? null,
      role: existing?.role ?? "solicitor",
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    this.users.set(userData.id, user);
    return user;
  }

  async confirmUserDisplayName(
    userId: string,
    names: { firstName: string; lastName: string },
    options?: { force?: boolean },
  ): Promise<User | undefined> {
    const existing = this.users.get(userId);
    if (!existing) return undefined;
    if (existing.displayNameConfirmedAt && !options?.force) {
      throw new DisplayNameAlreadyConfirmedError();
    }
    const updated: User = {
      ...existing,
      firstName: names.firstName,
      lastName: names.lastName,
      displayNameConfirmedAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(userId, updated);
    return updated;
  }

  async getAuthIdentity(_provider: string, _providerUserId: string): Promise<AuthIdentity | undefined> {
    return undefined;
  }

  async getAuthIdentitiesForUser(_userId: string): Promise<AuthIdentity[]> {
    return [];
  }

  async createAuthIdentity(_data: {
    userId: string;
    provider: string;
    providerUserId: string;
    emailAtLink?: string | null;
  }): Promise<AuthIdentity> {
    throw new Error("Not implemented");
  }

  async resolveGoogleAuthUser(profile: {
    providerUserId: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  }): Promise<User> {
    return this.upsertUser({
      id: profile.providerUserId,
      email: profile.email ?? undefined,
      firstName: profile.firstName ?? undefined,
      lastName: profile.lastName ?? undefined,
      profileImageUrl: profile.profileImageUrl ?? undefined,
    });
  }

  async resolveMicrosoftAuthUser(profile: {
    providerUserId: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  }): Promise<User> {
    throw new Error("Not implemented in MemStorage");
  }

  async updateUserStripeInfo(userId: string, stripeInfo: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus?: string;
    subscriptionPlan?: string;
    trialEndsAt?: Date | null;
  }): Promise<User | undefined> {
    const existing = this.users.get(userId);
    if (!existing) return undefined;
    const updated: User = {
      ...existing,
      stripeCustomerId: stripeInfo.stripeCustomerId ?? existing.stripeCustomerId,
      stripeSubscriptionId: stripeInfo.stripeSubscriptionId ?? existing.stripeSubscriptionId,
      subscriptionStatus: stripeInfo.subscriptionStatus ?? existing.subscriptionStatus,
      subscriptionPlan: stripeInfo.subscriptionPlan ?? existing.subscriptionPlan,
      trialEndsAt: stripeInfo.trialEndsAt !== undefined ? stripeInfo.trialEndsAt : existing.trialEndsAt,
      updatedAt: new Date(),
    };
    this.users.set(userId, updated);
    return updated;
  }

  async createClient(clientData: InsertClient, userId: string): Promise<Client> {
    const id = randomUUID();
    const client: Client = {
      id,
      name: clientData.name,
      email: clientData.email ?? null,
      phone: clientData.phone ?? null,
      address: clientData.address ?? null,
      dateOfBirth: clientData.dateOfBirth ?? null,
      companyName: clientData.companyName ?? null,
      amlRiskLevel: clientData.amlRiskLevel ?? null,
      amlRiskLastReviewed: clientData.amlRiskLastReviewed ?? null,
      clioClientId: clientData.clioClientId ?? null,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.clientsMap.set(id, client);
    return client;
  }

  async getClient(id: string, userId: string): Promise<Client | undefined> {
    const client = this.clientsMap.get(id);
    if (!client || client.createdBy !== userId) return undefined;
    return client;
  }

  async updateClient(id: string, updates: Partial<Client>, userId: string): Promise<Client | undefined> {
    const existing = this.clientsMap.get(id);
    if (!existing || existing.createdBy !== userId) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.clientsMap.set(id, updated);
    return updated;
  }

  async searchClients(query: string, userId: string): Promise<Client[]> {
    const lower = query.toLowerCase();
    return Array.from(this.clientsMap.values())
      .filter(c => c.createdBy === userId &&
        (c.name.toLowerCase().includes(lower) ||
         (c.email && c.email.toLowerCase().includes(lower))));
  }

  async getClientsByUser(userId: string): Promise<Client[]> {
    return Array.from(this.clientsMap.values())
      .filter(c => c.createdBy === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getCasesByClientId(clientId: string, userId: string): Promise<Case[]> {
    return Array.from(this.cases.values())
      .filter(c => c.clientId === clientId && c.createdBy === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async migrateExistingClientsFromCases(userId: string): Promise<number> {
    const userCases = Array.from(this.cases.values()).filter(c => c.createdBy === userId && !c.clientId);
    const clientsByName = new Map<string, Client>();
    let count = 0;
    for (const c of userCases) {
      const normalName = c.clientName.trim().toLowerCase();
      if (!clientsByName.has(normalName)) {
        const client = await this.createClient({ name: c.clientName.trim() }, userId);
        clientsByName.set(normalName, client);
        count++;
      }
      const client = clientsByName.get(normalName)!;
      c.clientId = client.id;
      this.cases.set(c.id, c);
    }
    return count;
  }

  async createCase(insertCase: InsertCase, userId: string): Promise<Case> {
    const id = randomUUID();
    const newCase: Case = {
      ...insertCase,
      id,
      createdBy: userId,
      clientId: insertCase.clientId || null,
      assignedToUserId: insertCase.assignedToUserId || null,
      createdAt: new Date(),
      status: insertCase.status || "pending",
      priority: insertCase.priority || "normal",
      matterReference: insertCase.matterReference || null,
      practiceArea: insertCase.practiceArea || null,
      conflictCheckCompleted: insertCase.conflictCheckCompleted || false,
      conflictCheckNote: insertCase.conflictCheckNote || null,
      clientCareLetterId: null,
      clientCareLetterSentAt: null,
      costsEstimate: insertCase.costsEstimate || null,
      textNotes: insertCase.textNotes || null,
      reviewed: insertCase.reviewed || false,
      archived: insertCase.archived || false,
      aiProcessingMetadata: {},
      deadline: null,
      syncToCalendar: false,
    };
    this.cases.set(id, newCase);
    return newCase;
  }

  async getCases(userId: string, includeArchived: boolean = false): Promise<Case[]> {
    return Array.from(this.cases.values())
      .filter(c => c.createdBy === userId && (includeArchived || !c.archived))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getFirmCases(firmId: string, includeArchived: boolean = false): Promise<Case[]> {
    return Array.from(this.cases.values())
      .filter(c => c.firmId === firmId && (includeArchived || !c.archived))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getCasesAssignedToUser(assignedUserId: string, includeArchived: boolean = false): Promise<Case[]> {
    return Array.from(this.cases.values())
      .filter(c => c.assignedToUserId === assignedUserId && (includeArchived || !c.archived))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getCase(id: string, userId: string): Promise<Case | undefined> {
    const caseRecord = this.cases.get(id);
    if (!caseRecord || (caseRecord.createdBy !== userId && caseRecord.assignedToUserId !== userId)) return undefined;
    return caseRecord;
  }

  async updateCase(id: string, updates: Partial<Case>, userId: string): Promise<Case | undefined> {
    const existing = this.cases.get(id);
    if (!existing || existing.createdBy !== userId) return undefined;
    
    const updated = { ...existing, ...updates };
    this.cases.set(id, updated);
    return updated;
  }

  async markCaseAsReviewed(id: string, reviewed: boolean, userId: string): Promise<Case | undefined> {
    return this.updateCase(id, { reviewed }, userId);
  }

  async archiveCase(id: string, archived: boolean, userId: string): Promise<Case | undefined> {
    return this.updateCase(id, { archived }, userId);
  }

  async assignCaseToUser(id: string, assignedToUserId: string | null, userId: string): Promise<Case | undefined> {
    return this.updateCase(id, { assignedToUserId }, userId);
  }

  async createAudioRecording(insertAudioRecording: ServerAudioRecordingInsert): Promise<AudioRecording> {
    const id = randomUUID();
    const audioRecording: AudioRecording = {
      id,
      caseId: insertAudioRecording.caseId,
      meetingSessionId: insertAudioRecording.meetingSessionId ?? null,
      recordedAt: new Date(),
      expiresAt: insertAudioRecording.expiresAt,
      filePath: insertAudioRecording.filePath ?? null,
      mimeType: insertAudioRecording.mimeType ?? null,
      duration: insertAudioRecording.duration ?? null,
      deletedAt: null,
      consentSegmentPath: null,
      consentDurationSeconds: null,
      holdReleaseGraceUntil: insertAudioRecording.holdReleaseGraceUntil ?? null,
      colpReviewStatus: insertAudioRecording.colpReviewStatus ?? null,
    };
    this.audioRecordings.set(id, audioRecording);
    return audioRecording;
  }

  async getAudioRecording(id: string): Promise<AudioRecording | undefined> {
    return this.audioRecordings.get(id);
  }

  async getAudioRecordingsByCaseId(caseId: string): Promise<AudioRecording[]> {
    return Array.from(this.audioRecordings.values())
      .filter((recording) => recording.caseId === caseId)
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
  }

  async getAudioRecordingByCase(caseId: string, userId: string): Promise<AudioRecording | undefined> {
    const caseRecord = this.cases.get(caseId);
    if (!caseRecord || caseRecord.createdBy !== userId) return undefined;
    
    const recordings = Array.from(this.audioRecordings.values())
      .filter((recording) => recording.caseId === caseId)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
    return recordings[0];
  }

  async getAudioRecordingBySession(meetingSessionId: string): Promise<AudioRecording | undefined> {
    const recordings = Array.from(this.audioRecordings.values())
      .filter((recording) => recording.meetingSessionId === meetingSessionId)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
    return recordings[0];
  }

  async updateAudioRecording(id: string, updates: Partial<AudioRecording>): Promise<AudioRecording | undefined> {
    const existing = this.audioRecordings.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.audioRecordings.set(id, updated);
    return updated;
  }

  // Stage 2: excludes active grace windows (Option 2a marker — see isInActiveColpGraceWindow).
  async getExpiredAudioRecordings(): Promise<AudioRecording[]> {
    const now = new Date();
    return Array.from(this.audioRecordings.values()).filter(
      (recording) =>
        recording.expiresAt < now &&
        !recording.deletedAt &&
        !isInActiveColpGraceWindow(recording, now),
    );
  }

  // Stage 2: returns lapsed grace-window recordings for auto-deletion (Option 2a marker).
  async getGraceExpiredAudioRecordings(): Promise<AudioRecording[]> {
    const now = new Date();
    return Array.from(this.audioRecordings.values()).filter(
      (recording) =>
        recording.holdReleaseGraceUntil != null &&
        recording.holdReleaseGraceUntil < now &&
        recording.colpReviewStatus === "awaiting_review" &&
        !recording.deletedAt &&
        recording.filePath != null,
    );
  }

  async getExpiringAudioCount(userId: string, withinHours: number): Promise<number> {
    const now = new Date();
    const threshold = new Date(now.getTime() + withinHours * 60 * 60 * 1000);
    
    const userCases = Array.from(this.cases.values()).filter(c => c.createdBy === userId);
    const userCaseIds = new Set(userCases.map(c => c.id));
    
    return Array.from(this.audioRecordings.values()).filter(
      (recording) => 
        userCaseIds.has(recording.caseId) &&
        recording.expiresAt > now &&
        recording.expiresAt <= threshold &&
        !recording.deletedAt
    ).length;
  }

  async getProductivityStats(userId: string, since?: Date): Promise<{
    totalCases: number;
    awaitingReview: number;
    evidenceCompletePercent: number;
    documentationRate: number;
    thisMonthCases: number;
    monthlyTrend: "up" | "down" | "neutral";
    monthlyChange: number;
  }> {
    let userCases = Array.from(this.cases.values()).filter(c => c.createdBy === userId && !c.archived);
    if (since) {
      userCases = userCases.filter(c => new Date(c.createdAt) >= since);
    }
    const userCaseIds = new Set(userCases.map(c => c.id));
    const totalCases = userCases.length;
    
    // Awaiting Review: cases completed but not yet reviewed by solicitor
    const awaitingReview = userCases.filter(c => c.status === "completed" && !c.reviewed).length;
    
    // Defensibility Ready: % of cases with full audit-ready bundle
    // (transcript + attendance note/document + consent log)
    // Note: Audio is excluded since it's deleted after 7 days per GDPR policy
    let evidenceCompleteCount = 0;
    for (const caseItem of userCases) {
      const hasTranscript = Array.from(this.transcripts.values())
        .some(t => t.caseId === caseItem.id);
      const hasDocument = Array.from(this.documents.values())
        .some(d => d.caseId === caseItem.id);
      const hasConsent = Array.from(this.consentLogs.values())
        .some(cl => cl.caseId === caseItem.id);
      
      if (hasTranscript && hasDocument && hasConsent) {
        evidenceCompleteCount++;
      }
    }
    const evidenceCompletePercent = totalCases > 0 ? Math.round((evidenceCompleteCount / totalCases) * 100) : 100;
    
    // Documentation Rate: % of cases with at least one document (attendance note or summary)
    const casesWithDocs = userCases.filter(c => 
      Array.from(this.documents.values()).some(d => d.caseId === c.id)
    ).length;
    const documentationRate = totalCases > 0 ? Math.round((casesWithDocs / totalCases) * 100) : 100;
    
    // Monthly stats
    const now = new Date();
    const thisMonthCases = userCases.filter(c => {
      const d = new Date(c.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    
    const lastMonthCases = userCases.filter(c => {
      const d = new Date(c.createdAt);
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
    }).length;
    
    let monthlyChange: number;
    let monthlyTrend: "up" | "down" | "neutral";
    
    if (lastMonthCases === 0 && thisMonthCases > 0) {
      monthlyChange = 100;
      monthlyTrend = "up";
    } else if (lastMonthCases > 0) {
      monthlyChange = Math.round(((thisMonthCases - lastMonthCases) / lastMonthCases) * 100);
      monthlyTrend = monthlyChange > 0 ? "up" : monthlyChange < 0 ? "down" : "neutral";
    } else {
      monthlyChange = 0;
      monthlyTrend = "neutral";
    }
    
    return {
      totalCases,
      awaitingReview,
      evidenceCompletePercent,
      documentationRate,
      thisMonthCases,
      monthlyTrend,
      monthlyChange: Math.abs(monthlyChange),
    };
  }

  async createAuditLog(insertAuditLog: InsertAuditTrail): Promise<AuditTrail> {
    const id = randomUUID();
    const auditLog: AuditTrail = {
      id,
      eventType: insertAuditLog.eventType,
      userId: insertAuditLog.userId,
      caseId: insertAuditLog.caseId ?? null,
      documentId: insertAuditLog.documentId ?? null,
      transcriptId: insertAuditLog.transcriptId ?? null,
      audioRecordingId: insertAuditLog.audioRecordingId ?? null,
      timestamp: new Date(),
      ipAddress: insertAuditLog.ipAddress ?? null,
      userAgent: insertAuditLog.userAgent ?? null,
      metadata: insertAuditLog.metadata ?? {},
      severity: insertAuditLog.severity ?? "info",
      previousEntryId: null,
      chainHash: "",
      payloadVersion: 2,
    };
    this.auditLogs.set(id, auditLog);
    return auditLog;
  }

  async getAuditLogs(filters?: {
    userId?: string;
    caseId?: string;
    documentId?: string;
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditTrail[]> {
    let logs = Array.from(this.auditLogs.values());

    if (filters?.userId) {
      logs = logs.filter(log => log.userId === filters.userId);
    }
    if (filters?.caseId) {
      logs = logs.filter(log => log.caseId === filters.caseId);
    }
    if (filters?.documentId) {
      logs = logs.filter(log => log.documentId === filters.documentId);
    }
    if (filters?.eventType) {
      logs = logs.filter(log => log.eventType === filters.eventType);
    }
    if (filters?.startDate) {
      logs = logs.filter(log => log.timestamp >= filters.startDate!);
    }
    if (filters?.endDate) {
      logs = logs.filter(log => log.timestamp <= filters.endDate!);
    }

    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filters?.limit) {
      logs = logs.slice(0, filters.limit);
    }

    return logs;
  }

  async getAuditLogsByCase(caseId: string, limit?: number): Promise<AuditTrail[]> {
    return this.getAuditLogs({ caseId, limit });
  }

  async getConsentLogsByCase(caseId: string, userId: string): Promise<ConsentLog[]> {
    const caseRecord = this.cases.get(caseId);
    if (!caseRecord || caseRecord.createdBy !== userId) return [];
    
    return Array.from(this.consentLogs.values())
      .filter((log) => log.caseId === caseId)
      .sort((a, b) => b.consentTimestamp.getTime() - a.consentTimestamp.getTime());
  }

  async createTranscript(insertTranscript: InsertTranscript): Promise<Transcript> {
    const id = randomUUID();
    const contentHash = generateDocumentHash(insertTranscript.content);
    const contentSignature = generateContentSignature(contentHash);
    const transcript: Transcript = {
      id,
      caseId: insertTranscript.caseId,
      content: insertTranscript.content,
      utterances: insertTranscript.utterances ?? [],
      speakerCount: insertTranscript.speakerCount ?? null,
      createdAt: new Date(),
      contentHash,
      contentSignature,
      redactions: insertTranscript.redactions ?? [],
    };
    this.transcripts.set(id, transcript);
    return transcript;
  }

  async getTranscript(id: string): Promise<Transcript | undefined> {
    return this.transcripts.get(id);
  }

  async getTranscriptByCase(caseId: string, userId: string): Promise<Transcript | undefined> {
    const caseRecord = await this.getCase(caseId, userId);
    if (!caseRecord) return undefined;

    // Prefer the longest capture, then the most recent — arbitrary first-row
    // selection was returning an incomplete earlier session transcript.
    return Array.from(this.transcripts.values())
      .filter((transcript) => transcript.caseId === caseId)
      .sort((a, b) => {
        const lenDiff = (b.content?.length ?? 0) - (a.content?.length ?? 0);
        if (lenDiff !== 0) return lenDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })[0];
  }

  async getTranscriptBySession(meetingSessionId: string): Promise<Transcript | undefined> {
    return Array.from(this.transcripts.values()).find(
      (transcript) => transcript.meetingSessionId === meetingSessionId
    );
  }

  async updateTranscript(id: string, updates: Partial<Transcript>, userId: string): Promise<Transcript | undefined> {
    // L1: Block updates if case is under litigation hold
    const transcriptRecord = this.transcripts.get(id);
    if (transcriptRecord) {
      const caseRecord = this.cases.get(transcriptRecord.caseId);
      if (caseRecord?.litigationHold) {
        console.warn(`[LITIGATION-HOLD] Blocked transcript update on ${id}`);
        return undefined;
      }
    }
    const existing = this.transcripts.get(id);
    if (!existing) return undefined;
    
    const caseRecord = this.cases.get(existing.caseId);
    if (!caseRecord || caseRecord.createdBy !== userId) return undefined;
    
    const updated = { ...existing, ...updates };
    this.transcripts.set(id, updated);
    return updated;
  }

  async commitTranscriptRedactions(transcriptId: string, userId: string, redactionIds?: string[]): Promise<Transcript | undefined> {
    throw new Error("commitTranscriptRedactions requires database storage");
  }

  async getTranscriptsWithExpiredPendingRedactions(): Promise<(Transcript & { createdBy: string })[]> {
    return [];
  }

  // Action Items methods
  async createActionItem(itemData: InsertActionItem): Promise<ActionItem> {
    const id = randomUUID();
    const actionItem: ActionItem = {
      id,
      caseId: itemData.caseId,
      transcriptId: itemData.transcriptId,
      description: itemData.description,
      originalDescription: (itemData as any).originalDescription ?? null,
      assignee: itemData.assignee ?? null,
      dueDate: itemData.dueDate ?? null,
      priority: itemData.priority ?? "medium",
      status: (itemData as any).status ?? "draft",
      approvedBy: null,
      approvedAt: null,
      completed: itemData.completed ?? false,
      completedAt: null,
      completedBy: null,
      sourceUtteranceIndex: itemData.sourceUtteranceIndex ?? null,
      isManual: (itemData as any).isManual ?? false,
      createdAt: new Date(),
    };
    this.actionItemsMap.set(id, actionItem);
    return actionItem;
  }

  async createManualActionItem(itemData: { caseId: string; description: string; assignee?: string | null; dueDate?: Date; priority?: string; isManual?: boolean }): Promise<ActionItem> {
    const id = randomUUID();
    const actionItem: ActionItem = {
      id,
      caseId: itemData.caseId,
      transcriptId: null,
      description: itemData.description,
      originalDescription: null,
      assignee: itemData.assignee ?? null,
      dueDate: itemData.dueDate ?? null,
      priority: itemData.priority ?? "medium",
      status: "draft",
      approvedBy: null,
      approvedAt: null,
      completed: false,
      completedAt: null,
      completedBy: null,
      sourceUtteranceIndex: null,
      isManual: true,
      createdAt: new Date(),
    };
    this.actionItemsMap.set(id, actionItem);
    return actionItem;
  }

  async getActionItem(id: string, userId: string): Promise<ActionItem | undefined> {
    const item = this.actionItemsMap.get(id);
    if (!item) return undefined;
    
    const caseRecord = await this.getCase(item.caseId, userId);
    if (!caseRecord) return undefined;
    
    return item;
  }

  async getActionItemsByCase(caseId: string, userId: string): Promise<ActionItem[]> {
    const caseRecord = await this.getCase(caseId, userId);
    if (!caseRecord) return [];
    
    return Array.from(this.actionItemsMap.values())
      .filter(item => item.caseId === caseId)
      .sort((a, b) => {
        // Sort by priority (high > medium > low) then by dueDate
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 1;
        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 1;
        if (aPriority !== bPriority) return aPriority - bPriority;
        if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }

  async getAllActionItemsForUser(userId: string): Promise<(ActionItem & { caseTitle?: string; clientName?: string })[]> {
    const userCases = Array.from(this.cases.values()).filter(c => c.createdBy === userId && !c.archived);
    const caseMap = new Map(userCases.map(c => [c.id, c]));
    return Array.from(this.actionItemsMap.values())
      .filter(item => caseMap.has(item.caseId))
      .map(item => {
        const c = caseMap.get(item.caseId);
        return { ...item, caseTitle: c?.title, clientName: c?.clientName };
      })
      .sort((a, b) => {
        if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }

  async getActionItemsByTranscript(transcriptId: string, userId: string): Promise<ActionItem[]> {
    const transcript = this.transcripts.get(transcriptId);
    if (!transcript) return [];
    
    const caseRecord = await this.getCase(transcript.caseId, userId);
    if (!caseRecord) return [];
    
    return Array.from(this.actionItemsMap.values())
      .filter(item => item.transcriptId === transcriptId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateActionItem(id: string, updates: Partial<ActionItem>, userId: string): Promise<ActionItem | undefined> {
    const existing = this.actionItemsMap.get(id);
    if (!existing) return undefined;
    
    const caseRecord = await this.getCase(existing.caseId, userId);
    if (!caseRecord) return undefined;
    
    const updated = { ...existing, ...updates };
    this.actionItemsMap.set(id, updated);
    return updated;
  }

  async deleteActionItem(id: string, userId: string): Promise<boolean> {
    const existing = this.actionItemsMap.get(id);
    if (!existing) return false;
    
    const caseRecord = await this.getCase(existing.caseId, userId);
    if (!caseRecord) return false;
    
    return this.actionItemsMap.delete(id);
  }

  async createPreMeetingBriefing(briefingData: InsertPreMeetingBriefing): Promise<PreMeetingBriefing> {
    const id = randomUUID();
    const briefing: PreMeetingBriefing = {
      id,
      caseId: briefingData.caseId,
      content: briefingData.content,
      generatedAt: new Date(),
      generatedBy: briefingData.generatedBy,
      sourceMeetingCount: briefingData.sourceMeetingCount ?? 0,
      inputTokens: briefingData.inputTokens ?? null,
      outputTokens: briefingData.outputTokens ?? null,
      cost: briefingData.cost ?? null,
    };
    this.preMeetingBriefingsMap.set(id, briefing);
    return briefing;
  }

  async getPreMeetingBriefingsByCase(caseId: string, userId: string): Promise<PreMeetingBriefing[]> {
    const caseRecord = this.cases.get(caseId);
    if (!caseRecord || caseRecord.createdBy !== userId) return [];
    
    return Array.from(this.preMeetingBriefingsMap.values())
      .filter(b => b.caseId === caseId)
      .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
  }

  async getLatestPreMeetingBriefing(caseId: string, userId: string): Promise<PreMeetingBriefing | undefined> {
    const briefings = await this.getPreMeetingBriefingsByCase(caseId, userId);
    return briefings[0];
  }

  async createQuickNote(noteData: InsertQuickNote, userId: string): Promise<QuickNote> {
    const id = randomUUID();
    const quickNote: QuickNote = {
      id,
      caseId: noteData.caseId,
      content: noteData.content,
      createdBy: userId,
      createdAt: new Date(),
    };
    this.quickNotes.set(id, quickNote);
    return quickNote;
  }

  async getQuickNotesByCase(caseId: string, userId: string): Promise<QuickNote[]> {
    const caseRecord = this.cases.get(caseId);
    if (!caseRecord || caseRecord.createdBy !== userId) return [];
    
    return Array.from(this.quickNotes.values())
      .filter((note) => note.caseId === caseId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const contentHash = generateDocumentHash(insertDocument.content);
    const contentSignature = generateContentSignature(contentHash);
    const document: Document = {
      id,
      caseId: insertDocument.caseId,
      transcriptSnapshotId: insertDocument.transcriptSnapshotId ?? null,
      type: insertDocument.type,
      content: insertDocument.content,
      contentHash,
      contentSignature,
      version: insertDocument.version,
      versionType: insertDocument.versionType,
      createdAt: new Date(),
      createdBy: insertDocument.createdBy,
      isActive: insertDocument.isActive,
      parentVersionId: insertDocument.parentVersionId ?? null,
      status: 'draft',
      approvedBy: null,
      approvedAt: null,
      approvalComment: null,
      verificationWarnings: insertDocument.verificationWarnings ?? null,
      isShortRecording: insertDocument.isShortRecording ?? false,
    };
    this.documents.set(id, document);
    return document;
  }

  async createDocumentVersion(
    parentDocumentId: string,
    newContent: string,
    versionType: string,
    userId: string,
    options?: { approvalComment?: string; verificationWarnings?: VerificationWarning[] }
  ): Promise<Document | undefined> {
    const parent = this.documents.get(parentDocumentId);
    if (!parent) return undefined;

    const caseRecord = this.cases.get(parent.caseId);
    // Match getCase: creator or assignee may produce a further version
    if (
      !caseRecord ||
      (caseRecord.createdBy !== userId && caseRecord.assignedToUserId !== userId)
    ) {
      return undefined;
    }

    if (caseRecord.litigationHold) {
      console.warn(`[LITIGATION-HOLD] Blocked document version creation on ${parentDocumentId}`);
      return undefined;
    }

    // Mark parent as inactive
    this.documents.set(parentDocumentId, { ...parent, isActive: false });

    // Create new version
    const newDoc = await this.createDocument({
      caseId: parent.caseId,
      meetingSessionId: parent.meetingSessionId ?? undefined,
      transcriptSnapshotId: parent.transcriptSnapshotId ?? undefined,
      type: parent.type as InsertDocument["type"],
      content: newContent,
      version: parent.version + 1,
      versionType: versionType as InsertDocument["versionType"],
      createdBy: userId,
      isActive: true,
      parentVersionId: parentDocumentId,
      verificationWarnings: options?.verificationWarnings ?? undefined,
      isShortRecording: parent.isShortRecording ?? false,
    });

    return newDoc;
  }

  async getDocument(id: string): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async getDocumentsByCase(caseId: string, userId: string): Promise<Document[]> {
    const caseRecord = this.cases.get(caseId);
    if (!caseRecord || caseRecord.createdBy !== userId) return [];
    
    return Array.from(this.documents.values())
      .filter((doc) => doc.caseId === caseId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getDocumentsBySession(meetingSessionId: string): Promise<Document[]> {
    return Array.from(this.documents.values())
      .filter((doc) => doc.meetingSessionId === meetingSessionId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getActiveDocumentsByCase(caseId: string, userId: string): Promise<Document[]> {
    const caseRecord = this.cases.get(caseId);
    if (
      !caseRecord ||
      (caseRecord.createdBy !== userId && caseRecord.assignedToUserId !== userId)
    ) {
      return [];
    }
    
    return Array.from(this.documents.values())
      .filter((doc) => doc.caseId === caseId && doc.isActive)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateDocument(id: string, updates: Partial<Document>, userId: string): Promise<Document | undefined> {
    // L1: Block updates if case is under litigation hold
    const documentRecord = this.documents.get(id);
    if (documentRecord) {
      const caseRecord = this.cases.get(documentRecord.caseId);
      if (caseRecord?.litigationHold) {
        console.warn(`[LITIGATION-HOLD] Blocked document update on ${id}`);
        return undefined;
      }
    }
    const existing = this.documents.get(id);
    if (!existing) return undefined;
    
    const caseRecord = this.cases.get(existing.caseId);
    if (!caseRecord || caseRecord.createdBy !== userId) return undefined;
    
    // Regenerate hash if content was updated
    if (updates.content) {
      updates.contentHash = generateDocumentHash(updates.content);
    }
    
    const updated = { ...existing, ...updates };
    this.documents.set(id, updated);
    return updated;
  }

  async getDocumentByAcknowledgeToken(_token: string): Promise<Document | undefined> {
    return undefined;
  }

  async recordDocumentAcknowledgement(_id: string, _acknowledgedAt: Date, _acknowledgedByEmail: string, _acknowledgedIp: string): Promise<void> {
    // MemStorage stub
  }

  async approveDocument(id: string, userId: string, comment?: string, reasoningGapsReviewed?: boolean): Promise<Document | undefined> {
    const existing = this.documents.get(id);
    if (!existing) return undefined;
    
    const caseRecord = this.cases.get(existing.caseId);
    if (!caseRecord || caseRecord.createdBy !== userId) return undefined;
    
    const updated = {
      ...existing,
      status: 'approved' as const,
      approvedBy: userId,
      approvedAt: new Date(),
      approvalComment: comment ?? null,
      reasoningGapsReviewed: reasoningGapsReviewed ?? false,
      reasoningGapsReviewedAt: reasoningGapsReviewed ? new Date() : null,
    };
    this.documents.set(id, updated);
    
    await this.createAuditLog({
      eventType: 'document_approved',
      userId,
      caseId: existing.caseId,
      documentId: id,
      ipAddress: 'server-process',
      metadata: {
        documentType: existing.type,
        comment: comment ?? null,
        reasoningGapsReviewed: reasoningGapsReviewed ?? false,
      },
    });
    
    return updated;
  }

  async updateReasoningNote(id: string, note: string | null, userId: string): Promise<Document | undefined> {
    const existing = this.documents.get(id);
    if (!existing) return undefined;

    const caseRecord = this.cases.get(existing.caseId);
    if (!caseRecord || caseRecord.createdBy !== userId) return undefined;

    const updated = {
      ...existing,
      solicitorReasoningNote: note,
    };
    this.documents.set(id, updated);

    await this.createAuditLog({
      eventType: 'document_reasoning_note_updated',
      userId,
      caseId: existing.caseId,
      documentId: id,
      ipAddress: 'server-process',
      metadata: { documentType: existing.type, hasNote: note !== null && note.trim().length > 0 },
    });

    return updated;
  }

  async resolveVerificationWarning(
    documentId: string,
    warningId: string,
    disposition: VerificationResolveDisposition,
    reason: string,
    userId: string,
  ): Promise<Document | undefined> {
    const existing = this.documents.get(documentId);
    if (!existing) return undefined;

    const caseRecord = this.cases.get(existing.caseId);
    if (!caseRecord || caseRecord.createdBy !== userId) return undefined;
    if (caseRecord.litigationHold) return undefined;
    if (existing.status === "approved") return undefined;

    const warnings = coerceVerificationWarnings(existing.verificationWarnings);
    const idx = warnings.findIndex((w) => w.id === warningId);
    if (idx < 0) return undefined;

    warnings[idx] = {
      ...warnings[idx],
      resolution: {
        disposition,
        reason: reason.trim(),
        resolvedAt: new Date().toISOString(),
        resolvedBy: userId,
      },
    };

    const updated = {
      ...existing,
      verificationWarnings: warnings,
    };
    this.documents.set(documentId, updated);

    await this.createAuditLog({
      eventType: "document_verification_warning_resolved",
      userId,
      caseId: existing.caseId,
      documentId,
      ipAddress: "server-process",
      metadata: {
        action: "resolve_verification_warning",
        warningId,
        disposition,
        category: warnings[idx].category,
        documentQuote: warnings[idx].documentQuote.slice(0, 500),
      },
    });

    return updated;
  }

  async unlockDocument(id: string, userId: string): Promise<Document | undefined> {
    const existing = this.documents.get(id);
    if (!existing) return undefined;
    
    const caseRecord = this.cases.get(existing.caseId);
    if (!caseRecord || caseRecord.createdBy !== userId) return undefined;
    
    const updated = {
      ...existing,
      status: 'draft' as const,
      approvedBy: null,
      approvedAt: null,
      approvalComment: null,
    };
    this.documents.set(id, updated);
    
    await this.createAuditLog({
      eventType: 'document_unlocked',
      userId,
      caseId: existing.caseId,
      documentId: id,
      ipAddress: 'server-process',
      metadata: {
        documentType: existing.type,
      },
    });
    
    return updated;
  }

  // Client Version Tracking methods
  async createClientVersionTracking(trackingData: InsertClientVersionTracking): Promise<ClientVersionTracking> {
    const id = randomUUID();
    const record: ClientVersionTracking = {
      id,
      documentId: trackingData.documentId,
      sentToClient: trackingData.sentToClient ?? false,
      sentAt: trackingData.sentAt ?? null,
      sentBy: trackingData.sentBy ?? null,
      sentMethod: trackingData.sentMethod ?? null,
      amendmentReason: trackingData.amendmentReason ?? null,
      versionChangeWarned: trackingData.versionChangeWarned ?? false,
    };
    this.clientVersionTrackingRecords.set(id, record);
    return record;
  }

  async getClientVersionTrackingByDocument(documentId: string): Promise<ClientVersionTracking[]> {
    return Array.from(this.clientVersionTrackingRecords.values())
      .filter(r => r.documentId === documentId)
      .sort((a, b) => (b.sentAt?.getTime() || 0) - (a.sentAt?.getTime() || 0));
  }

  async getClientVersionTrackingByCase(caseId: string, userId: string): Promise<Array<ClientVersionTracking & { document: Document }>> {
    const caseRecord = this.cases.get(caseId);
    if (!caseRecord || caseRecord.createdBy !== userId) return [];
    
    const caseDocuments = Array.from(this.documents.values()).filter(d => d.caseId === caseId);
    const documentIds = new Set(caseDocuments.map(d => d.id));
    
    const trackingRecords = Array.from(this.clientVersionTrackingRecords.values())
      .filter(r => documentIds.has(r.documentId) && r.sentToClient)
      .sort((a, b) => (b.sentAt?.getTime() || 0) - (a.sentAt?.getTime() || 0));
    
    return trackingRecords.map(record => {
      const document = caseDocuments.find(d => d.id === record.documentId)!;
      return { ...record, document };
    }).filter(r => r.document);
  }

  async getLatestClientVersion(documentId: string): Promise<ClientVersionTracking | undefined> {
    const records = await this.getClientVersionTrackingByDocument(documentId);
    const sentRecords = records.filter(r => r.sentToClient);
    return sentRecords[0];
  }

  // Admin methods
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values())
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getAllCases(): Promise<Case[]> {
    return Array.from(this.cases.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAdminStatistics(): Promise<AdminStatistics> {
    const allCases = Array.from(this.cases.values());
    const allTranscripts = Array.from(this.transcripts.values());
    const allDocuments = Array.from(this.documents.values());
    const allUsers = Array.from(this.users.values());

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Calculate costs from aiProcessingMetadata
    let totalTranscriptionCosts = 0;
    let totalDocumentCosts = 0;
    let successfulProcessing = 0;
    let failedProcessing = 0;
    let totalProcessingTimeMinutes = 0;
    let processedCasesWithTime = 0;

    allCases.forEach(c => {
      const metadata = c.aiProcessingMetadata as any || {};
      
      if (metadata.transcriptionCost) {
        totalTranscriptionCosts += metadata.transcriptionCost;
      }
      if (metadata.documentGenerationCost) {
        totalDocumentCosts += metadata.documentGenerationCost;
      }

      if (c.status === 'completed' || c.status === 'review_required') {
        successfulProcessing++;
      } else if (metadata.error || metadata.retryCount > 0) {
        failedProcessing++;
      }

      // Calculate average processing time
      if (metadata.processingStartTime && metadata.processingEndTime) {
        const startTime = new Date(metadata.processingStartTime).getTime();
        const endTime = new Date(metadata.processingEndTime).getTime();
        totalProcessingTimeMinutes += (endTime - startTime) / (1000 * 60);
        processedCasesWithTime++;
      }
    });

    return {
      totalCases: allCases.length,
      totalUsers: allUsers.length,
      totalTranscriptions: allTranscripts.length,
      totalDocumentsGenerated: allDocuments.length,
      totalCostsUSD: totalTranscriptionCosts + totalDocumentCosts,
      transcriptionCostsUSD: totalTranscriptionCosts,
      documentGenerationCostsUSD: totalDocumentCosts,
      successfulProcessing,
      failedProcessing,
      successRate: allCases.length > 0 ? (successfulProcessing / allCases.length) * 100 : 0,
      averageProcessingTimeMinutes: processedCasesWithTime > 0 ? totalProcessingTimeMinutes / processedCasesWithTime : 0,
      casesLast30Days: allCases.filter(c => c.createdAt >= thirtyDaysAgo).length,
      casesLast7Days: allCases.filter(c => c.createdAt >= sevenDaysAgo).length,
    };
  }

  async getUserStatistics(): Promise<UserStatistics[]> {
    const allCases = Array.from(this.cases.values());
    const allUsers = Array.from(this.users.values());
    const allAuditLogs = Array.from(this.auditLogs.values());

    return allUsers.map(user => {
      const userCases = allCases.filter(c => c.createdBy === user.id);
      const successfulCases = userCases.filter(c => c.status === 'completed' || c.status === 'review_required');
      const failedCases = userCases.filter(c => {
        const metadata = c.aiProcessingMetadata as any || {};
        return metadata.error || metadata.retryCount > 0;
      });

      // Calculate total costs for this user
      let totalCosts = 0;
      userCases.forEach(c => {
        const metadata = c.aiProcessingMetadata as any || {};
        if (metadata.transcriptionCost) {
          totalCosts += metadata.transcriptionCost;
        }
        if (metadata.documentGenerationCost) {
          totalCosts += metadata.documentGenerationCost;
        }
      });

      // Find last activity from audit logs
      const userAuditLogs = allAuditLogs
        .filter(log => log.userId === user.id)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      const lastActivity = userAuditLogs.length > 0 ? userAuditLogs[0].timestamp : null;

      return {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        totalCases: userCases.length,
        successfulCases: successfulCases.length,
        failedCases: failedCases.length,
        totalCostsUSD: totalCosts,
        lastActivity,
        joinedDate: user.createdAt || new Date(),
      };
    }).sort((a, b) => b.totalCases - a.totalCases);
  }
  
  async getFirmProfile(firmId?: string): Promise<FirmProfile | undefined> {
    if (!firmId) return undefined;
    return (
      this.firmProfiles.get(firmId) ??
      Array.from(this.firmProfiles.values()).find((p) => p.id === firmId)
    );
  }

  async setFirmComplianceCode(firmId: string, codeHash: string, userId: string): Promise<void> {
    const profile = Array.from(this.firmProfiles.values()).find((p) => p.id === firmId);
    if (profile) {
      this.firmProfiles.set(firmId, {
        ...profile,
        complianceCodeHash: codeHash,
        complianceCodeSetAt: new Date(),
        complianceCodeSetBy: userId,
      });
    }
  }

  async verifyFirmComplianceCode(firmId: string, code: string): Promise<boolean> {
    const profile = Array.from(this.firmProfiles.values()).find((p) => p.id === firmId);
    if (!profile?.complianceCodeHash) return false;
    const bcrypt = await import("bcrypt");
    return bcrypt.compare(code, profile.complianceCodeHash);
  }

  async upsertFirmProfile(profileData: InsertFirmProfile): Promise<FirmProfile> {
    throw new Error('Firm profile operations require database storage');
  }

  async patchFirmProfileLogoUrl(_logoUrl: string, _updatedBy: string): Promise<FirmProfile> {
    // MemStorage: In-memory implementation - not used in production
    throw new Error('Firm profile operations require database storage');
  }

  async getFirmRiskDigest(): Promise<FirmRiskDigest> {
    return {
      generatedAt: new Date(), overdueUndertakings: [], upcomingUndertakings: [],
      highAmlCases: [], unacknowledgedLetters: [], missingSessions: [], totalIssues: 0,
    };
  }

  async getComplianceScore(): Promise<ComplianceScore> {
    const empty = (label: string, max: number) => ({ score: max, max, label, detail: 'No data available' });
    return {
      overall: 100, grade: 'A',
      breakdown: {
        consentCompliance: empty('Consent Compliance', 25),
        amlCompletion: empty('AML Completion', 25),
        undertakingsOnTime: empty('Undertakings On Time', 20),
        clientCareAcknowledgement: empty('Client Care Acknowledged', 15),
        documentationCompletion: empty('Documentation Complete', 15),
      },
      lastUpdated: new Date(),
    };
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    return undefined;
  }
  
  async updateUserPreferences(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences> {
    // MemStorage: In-memory implementation - not used in production
    throw new Error('User preferences operations require database storage');
  }
  
  async searchCases(query: string, userId: string): Promise<Case[]> {
    // MemStorage: Simple in-memory search implementation
    const userCases = Array.from(this.cases.values()).filter(c => c.createdBy === userId);
    const lowerQuery = query.toLowerCase();
    
    return userCases.filter(c => 
      c.title.toLowerCase().includes(lowerQuery) ||
      c.clientName.toLowerCase().includes(lowerQuery) ||
      c.matterReference?.toLowerCase().includes(lowerQuery) ||
      c.textNotes?.toLowerCase().includes(lowerQuery)
    );
  }
  
  async searchCasesWithMatches(query: string, userId: string, options?: {
    documentType?: 'transcript' | 'attendance_note' | 'summary' | 'all';
    dateRange?: 'today' | 'week' | 'month' | 'year' | 'all';
  }): Promise<SearchResultWithMatches[]> {
    // MemStorage: Simplified implementation without detailed matches
    const cases = await this.searchCases(query, userId);
    return cases.map(c => ({
      case: c,
      matches: [],
      score: 100,
    }));
  }
  
  async createSearchHistory(historyData: InsertSearchHistory): Promise<SearchHistory> {
    const id = randomUUID();
    const entry: SearchHistory = {
      id,
      userId: historyData.userId,
      query: historyData.query,
      resultCount: historyData.resultCount ?? 0,
      searchedAt: new Date(),
    };
    this.searchHistoryRecords.set(id, entry);
    return entry;
  }
  
  async getSearchHistory(userId: string, limit: number = 10): Promise<SearchHistory[]> {
    const userHistory = Array.from(this.searchHistoryRecords.values())
      .filter(h => h.userId === userId)
      .sort((a, b) => new Date(b.searchedAt).getTime() - new Date(a.searchedAt).getTime());
    return userHistory.slice(0, limit);
  }
  
  async clearSearchHistory(userId: string): Promise<void> {
    for (const [id, entry] of this.searchHistoryRecords.entries()) {
      if (entry.userId === userId) {
        this.searchHistoryRecords.delete(id);
      }
    }
  }
  
  async findObjectByPath(objectPath: string, userId: string): Promise<{
    type: 'audio' | 'document' | 'transcript' | 'unknown';
    objectId: string;
    caseId: string;
    owned: boolean;
  } | null> {
    // MemStorage: Check audio recordings
    for (const audio of this.audioRecordings.values()) {
      if (audio.filePath === objectPath) {
        const caseData = await this.getCase(audio.caseId, userId);
        return {
          type: 'audio',
          objectId: audio.id,
          caseId: audio.caseId,
          owned: caseData !== undefined,
        };
      }
    }
    
    return null;
  }
  
  async createCalendarEvent(eventData: InsertCalendarEvent): Promise<CalendarEvent> {
    throw new Error("MemStorage does not support calendar events. Use DbStorage.");
  }
  
  async getCalendarEventsByCase(caseId: string, userId: string): Promise<CalendarEvent[]> {
    return [];
  }
  
  async getCalendarEventByProvider(caseId: string, userId: string, provider: 'google' | 'outlook'): Promise<CalendarEvent | undefined> {
    return undefined;
  }
  
  async updateCalendarEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent | undefined> {
    throw new Error("MemStorage does not support calendar events. Use DbStorage.");
  }
  
  async deleteCalendarEvent(id: string): Promise<void> {
    // No-op for MemStorage
  }
  
  async deleteCalendarEventsByCase(caseId: string, userId: string): Promise<void> {
    // No-op for MemStorage
  }
  
  async getCalendarIntegration(userId: string, provider: 'google' | 'outlook'): Promise<CalendarIntegration | undefined> {
    const key = `${userId}-${provider}`;
    return this.calendarIntegrations.get(key);
  }
  
  async getActiveCalendarIntegrations(provider: 'google' | 'outlook'): Promise<CalendarIntegration[]> {
    return Array.from(this.calendarIntegrations.values())
      .filter(integration => integration.provider === provider);
  }
  
  async saveCalendarIntegration(integrationData: InsertCalendarIntegration): Promise<CalendarIntegration> {
    const key = `${integrationData.userId}-${integrationData.provider}`;
    const existing = this.calendarIntegrations.get(key);
    
    const integration: CalendarIntegration = {
      id: existing?.id || randomUUID(),
      userId: integrationData.userId,
      provider: integrationData.provider,
      accessToken: integrationData.accessToken,
      refreshToken: integrationData.refreshToken ?? null,
      expiresAt: integrationData.expiresAt ?? null,
      calendarId: integrationData.calendarId ?? null,
      email: integrationData.email ?? null,
      connectedAt: existing?.connectedAt || new Date(),
      lastSyncAt: integrationData.lastSyncAt ?? null,
    };
    
    this.calendarIntegrations.set(key, integration);
    return integration;
  }
  
  async deleteCalendarIntegration(userId: string, provider: 'google' | 'outlook'): Promise<void> {
    const key = `${userId}-${provider}`;
    this.calendarIntegrations.delete(key);
  }
  
  async getUserCalendarIntegrations(userId: string): Promise<CalendarIntegration[]> {
    return Array.from(this.calendarIntegrations.values())
      .filter(integration => integration.userId === userId);
  }
  
  async createShareLink(_shareLinkData: InsertShareLink): Promise<ShareLink> {
    throw new Error("MemStorage does not support share links - use DbStorage");
  }
  
  async getShareLink(_id: string): Promise<ShareLink | undefined> {
    throw new Error("MemStorage does not support share links - use DbStorage");
  }

  async getShareLinks(_userId: string): Promise<ShareLink[]> {
    throw new Error("MemStorage does not support share links - use DbStorage");
  }
  
  async getShareLinksByCase(_caseId: string, _userId: string): Promise<ShareLink[]> {
    throw new Error("MemStorage does not support share links - use DbStorage");
  }
  
  async updateShareLink(_id: string, _updates: Partial<ShareLink>): Promise<ShareLink | undefined> {
    throw new Error("MemStorage does not support share links - use DbStorage");
  }

  async deleteShareLink(_id: string, _userId: string): Promise<boolean> {
    throw new Error("MemStorage does not support share links - use DbStorage");
  }
  
  async incrementShareLinkAccess(_id: string): Promise<void> {
    throw new Error("MemStorage does not support share links - use DbStorage");
  }

  async updateShareLinkSmsCode(_id: string, _code: string, _expiresAt: Date): Promise<ShareLink | undefined> {
    throw new Error("MemStorage does not support share links - use DbStorage");
  }

  async verifyShareLinkSmsCode(_id: string, _code: string): Promise<{ verified: boolean; expired?: boolean; invalid?: boolean }> {
    throw new Error("MemStorage does not support share links - use DbStorage");
  }
  
  // Recall.ai Connection methods (stubs for MemStorage)
  async getRecallConnection(_userId: string): Promise<RecallConnection | undefined> {
    return undefined;
  }
  
  async createRecallConnection(_connectionData: InsertRecallConnection): Promise<RecallConnection> {
    throw new Error("MemStorage does not support Recall connections - use DbStorage");
  }
  
  async updateRecallConnection(_userId: string, _updates: Partial<RecallConnection>): Promise<RecallConnection | undefined> {
    throw new Error("MemStorage does not support Recall connections - use DbStorage");
  }
  
  async deleteRecallConnection(_userId: string): Promise<void> {
    // No-op for MemStorage
  }
  
  // Meeting Import methods (stubs for MemStorage)
  async createMeetingImport(_importData: InsertMeetingImport): Promise<MeetingImport> {
    throw new Error("MemStorage does not support meeting imports - use DbStorage");
  }
  
  async getMeetingImport(_id: string): Promise<MeetingImport | undefined> {
    return undefined;
  }

  async getMeetingImportByBotId(_botId: string): Promise<MeetingImport | undefined> {
    return undefined;
  }
  
  async getMeetingImportsByUser(_userId: string): Promise<MeetingImport[]> {
    return [];
  }
  
  async getMeetingImportsByCase(_caseId: string, _userId: string): Promise<MeetingImport[]> {
    return [];
  }

  async getLiveMeetingImports(): Promise<MeetingImport[]> {
    return [];
  }

  async getUnassignedMeetingImports(_userId: string): Promise<MeetingImport[]> {
    return [];
  }
  
  async updateMeetingImport(_id: string, _updates: Partial<MeetingImport>): Promise<MeetingImport | undefined> {
    throw new Error("MemStorage does not support meeting imports - use DbStorage");
  }
  
  // Pre-Consent Email methods (stubs for MemStorage)
  async createPreConsentEmail(_emailData: InsertPreConsentEmail): Promise<PreConsentEmail> {
    throw new Error("MemStorage does not support pre-consent emails - use DbStorage");
  }
  
  async getPreConsentEmail(_id: string): Promise<PreConsentEmail | undefined> {
    return undefined;
  }
  
  async getPreConsentEmailByToken(_token: string): Promise<PreConsentEmail | undefined> {
    return undefined;
  }
  
  async getPreConsentEmailsByUser(_userId: string): Promise<PreConsentEmail[]> {
    return [];
  }
  
  async updatePreConsentEmail(_id: string, _updates: Partial<PreConsentEmail>): Promise<PreConsentEmail | undefined> {
    throw new Error("MemStorage does not support pre-consent emails - use DbStorage");
  }
  
  async acknowledgePreConsentEmail(_id: string, _ipAddress: string, _responseStatus?: string, _rescheduleNote?: string): Promise<PreConsentEmail | undefined> {
    throw new Error("MemStorage does not support pre-consent emails - use DbStorage");
  }
  
  // Scheduled Meeting methods (stubs for MemStorage)
  async createScheduledMeeting(_meetingData: InsertScheduledMeeting): Promise<ScheduledMeeting> {
    throw new Error("MemStorage does not support scheduled meetings - use DbStorage");
  }
  
  async getScheduledMeeting(_id: string): Promise<ScheduledMeeting | undefined> {
    return undefined;
  }
  
  async getScheduledMeetingByCalendarEvent(_userId: string, _calendarEventId: string, _provider: string): Promise<ScheduledMeeting | undefined> {
    return undefined;
  }
  
  async getScheduledMeetingByBotId(_botId: string): Promise<ScheduledMeeting | undefined> {
    return undefined;
  }
  
  async getScheduledMeetingsByUser(_userId: string): Promise<ScheduledMeeting[]> {
    return [];
  }
  
  async getScheduledMeetingsByCase(_caseId: string, _userId: string): Promise<ScheduledMeeting[]> {
    return [];
  }
  
  async getUpcomingScheduledMeetings(_userId: string, _daysAhead?: number): Promise<ScheduledMeeting[]> {
    return [];
  }
  
  async getMeetingsNeedingConsent(_userId: string): Promise<ScheduledMeeting[]> {
    return [];
  }
  
  async getMeetingsReadyForBot(_userId: string): Promise<ScheduledMeeting[]> {
    return [];
  }
  
  async getAllScheduledMeetingsWithAutoRecord(): Promise<ScheduledMeeting[]> {
    return [];
  }

  async getMeetingsNeedingReminders(_minutesBefore: 30 | 10): Promise<ScheduledMeeting[]> {
    return [];
  }
  
  async updateScheduledMeeting(_id: string, _updates: Partial<ScheduledMeeting>): Promise<ScheduledMeeting | undefined> {
    throw new Error("MemStorage does not support scheduled meetings - use DbStorage");
  }
  
  async deleteScheduledMeeting(_id: string): Promise<void> {
    // No-op for MemStorage
  }
  
  // SharePoint/OneDrive Connection methods (stubs)
  async getSharePointConnection(_userId: string, _provider: 'sharepoint' | 'onedrive'): Promise<SharePointConnection | undefined> {
    return undefined;
  }
  
  async getUserSharePointConnections(_userId: string): Promise<SharePointConnection[]> {
    return [];
  }
  
  async saveSharePointConnection(_connectionData: InsertSharePointConnection): Promise<SharePointConnection> {
    throw new Error("MemStorage does not support SharePoint connections - use DbStorage");
  }
  
  async updateSharePointConnection(_userId: string, _provider: 'sharepoint' | 'onedrive', _updates: Partial<SharePointConnection>): Promise<SharePointConnection | undefined> {
    throw new Error("MemStorage does not support SharePoint connections - use DbStorage");
  }
  
  async deleteSharePointConnection(_userId: string, _provider: 'sharepoint' | 'onedrive'): Promise<void> {
    // No-op for MemStorage
  }
  
  // Waitlist methods (MemStorage stubs)
  async createWaitlistEntry(_entryData: InsertWaitlist): Promise<Waitlist> {
    throw new Error("Not implemented in MemStorage");
  }
  
  async getWaitlistEntry(_id: string): Promise<Waitlist | undefined> {
    return undefined;
  }
  
  async getWaitlistEntryByEmail(_email: string): Promise<Waitlist | undefined> {
    return undefined;
  }
  
  async getAllWaitlistEntries(): Promise<Waitlist[]> {
    return [];
  }
  
  async updateWaitlistEntry(_id: string, _updates: Partial<Waitlist>): Promise<Waitlist | undefined> {
    return undefined;
  }
  
  async deleteWaitlistEntry(_id: string): Promise<void> {
    // No-op for MemStorage
  }
  
  async getWaitlistStats(): Promise<{ total: number; pending: number; invited: number; active: number }> {
    return { total: 0, pending: 0, invited: 0, active: 0 };
  }
  
  // LinkedIn post performance (MemStorage stubs)
  async getLinkedinPostPerformance(_postNumber: number): Promise<LinkedinPostPerformance | undefined> {
    throw new Error("Not implemented in MemStorage");
  }
  async getAllLinkedinPostPerformance(): Promise<LinkedinPostPerformance[]> {
    throw new Error("Not implemented in MemStorage");
  }
  async upsertLinkedinPostPerformance(_data: InsertLinkedinPostPerformance): Promise<LinkedinPostPerformance> {
    throw new Error("Not implemented in MemStorage");
  }
  async getConnectionMilestones(): Promise<LinkedinConnectionMilestone[]> {
    throw new Error("Not implemented in MemStorage");
  }
  async addConnectionMilestone(_data: InsertLinkedinConnectionMilestone): Promise<LinkedinConnectionMilestone> {
    throw new Error("Not implemented in MemStorage");
  }
  async deleteConnectionMilestone(_id: string): Promise<void> {
    throw new Error("Not implemented in MemStorage");
  }
  async getInboundLeads(): Promise<LinkedinInboundLead[]> {
    throw new Error("Not implemented in MemStorage");
  }
  async addInboundLead(_data: InsertLinkedinInboundLead): Promise<LinkedinInboundLead> {
    throw new Error("Not implemented in MemStorage");
  }
  async deleteInboundLead(_id: string): Promise<void> {
    throw new Error("Not implemented in MemStorage");
  }
  async getHookVariants(_postNumber: number): Promise<LinkedinHookVariant[]> {
    throw new Error("Not implemented in MemStorage");
  }
  async addHookVariant(_data: InsertLinkedinHookVariant): Promise<LinkedinHookVariant> {
    throw new Error("Not implemented in MemStorage");
  }
  async deleteHookVariant(_id: string): Promise<void> {
    throw new Error("Not implemented in MemStorage");
  }
  async getChatMessages(_postNumber: number): Promise<LinkedinPostChatMessage[]> {
    throw new Error("Not implemented in MemStorage");
  }
  async addChatMessage(_data: InsertLinkedinPostChatMessage): Promise<LinkedinPostChatMessage> {
    throw new Error("Not implemented in MemStorage");
  }
  async clearChatMessages(_postNumber: number): Promise<void> {
    throw new Error("Not implemented in MemStorage");
  }
  async getDocumentComments(_documentId: string): Promise<DocumentComment[]> {
    throw new Error("Not implemented in MemStorage");
  }
  async createDocumentComment(_data: InsertDocumentComment): Promise<DocumentComment> {
    throw new Error("Not implemented in MemStorage");
  }
  async updateDocumentComment(_id: string, _updates: Partial<DocumentComment>): Promise<DocumentComment | undefined> {
    throw new Error("Not implemented in MemStorage");
  }
  async deleteDocumentComment(_id: string): Promise<void> {
    throw new Error("Not implemented in MemStorage");
  }
  async getAmlMonitoringNotes(_caseId: string): Promise<AmlMonitoringNote[]> {
    throw new Error("Not implemented in MemStorage");
  }
  async createAmlMonitoringNote(_data: InsertAmlMonitoringNote): Promise<AmlMonitoringNote> {
    throw new Error("Not implemented in MemStorage");
  }
  async getAmlDecisionRecords(_caseId: string): Promise<AmlDecisionRecord[]> {
    throw new Error("Not implemented in MemStorage");
  }
  async createAmlDecisionRecord(_data: InsertAmlDecisionRecord): Promise<AmlDecisionRecord> {
    throw new Error("Not implemented in MemStorage");
  }
  async updateUserComplianceThread(_userId: string, _enabled: boolean): Promise<User | undefined> {
    throw new Error("Not implemented in MemStorage");
  }
  async getLastAmlActivityDates(_caseIds: string[]): Promise<Record<string, Date>> {
    return {};
  }

  async getCaseById(id: string): Promise<Case | undefined> {
    return this.cases.get(id);
  }

  async getCaseLitigationHoldStatus(caseId: string): Promise<CaseLitigationHoldStatus | undefined> {
    const caseRecord = this.cases.get(caseId);
    if (!caseRecord) return undefined;
    return {
      litigationHold: caseRecord.litigationHold,
      litigationHoldAppliedAt: caseRecord.litigationHoldAppliedAt,
      litigationHoldAppliedBy: caseRecord.litigationHoldAppliedBy,
      litigationHoldReason: caseRecord.litigationHoldReason,
    };
  }

  async getExternalDocumentRefs(_caseId: string): Promise<ExternalDocumentRef[]> {
    return [];
  }
  async createExternalDocumentRef(_data: InsertExternalDocumentRef, _userId: string): Promise<ExternalDocumentRef> {
    throw new Error("Not implemented in MemStorage");
  }

  async createMeetingSession(sessionData: InsertMeetingSession): Promise<MeetingSession> {
    const id = crypto.randomUUID();
    const session: MeetingSession = {
      id,
      caseId: sessionData.caseId,
      recordingType: sessionData.recordingType || "full_meeting",
      sessionTitle: sessionData.sessionTitle ?? null,
      startedAt: new Date(),
      durationSeconds: sessionData.durationSeconds ?? null,
      status: sessionData.status || "pending",
      notes: sessionData.notes ?? null,
      createdBy: sessionData.createdBy,
    };
    this.meetingSessionsMap.set(id, session);
    return session;
  }
  async getMeetingSession(id: string): Promise<MeetingSession | undefined> {
    return this.meetingSessionsMap.get(id);
  }
  async getMeetingSessionsByCase(caseId: string, userId: string): Promise<MeetingSession[]> {
    const caseRecord = this.cases.get(caseId);
    if (!caseRecord || caseRecord.createdBy !== userId) return [];
    return Array.from(this.meetingSessionsMap.values())
      .filter(s => s.caseId === caseId)
      .sort((a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0));
  }
  async updateMeetingSession(id: string, updates: Partial<MeetingSession>): Promise<MeetingSession | undefined> {
    const existing = this.meetingSessionsMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.meetingSessionsMap.set(id, updated);
    return updated;
  }
  async createTimeEntry(_data: InsertTimeEntry): Promise<TimeEntry> {
    throw new Error("Not implemented in MemStorage");
  }
  async getTimeEntry(_id: string): Promise<TimeEntry | undefined> {
    return undefined;
  }
  async getTimeEntriesByCase(_caseId: string): Promise<TimeEntry[]> {
    return [];
  }
  async getTimeEntriesByUser(_userId: string, _startDate?: Date, _endDate?: Date): Promise<TimeEntry[]> {
    return [];
  }
  async getAllTimeEntries(_startDate?: Date, _endDate?: Date): Promise<(TimeEntry & { caseTitle?: string; clientName?: string; userName?: string })[]> {
    return [];
  }
  async updateTimeEntry(_id: string, _updates: Partial<TimeEntry>): Promise<TimeEntry | undefined> {
    return undefined;
  }
  async deleteTimeEntry(_id: string): Promise<void> {}
  async updateUserHourlyRate(_userId: string, _hourlyRate: string): Promise<User | undefined> {
    return undefined;
  }
  async getUndertakingsByCase(_caseId: string): Promise<Undertaking[]> {
    return [];
  }
  async getUndertaking(_id: string): Promise<Undertaking | undefined> {
    return undefined;
  }
  async createUndertaking(_data: InsertUndertaking): Promise<Undertaking> {
    throw new Error("Not implemented in MemStorage");
  }
  async updateUndertaking(_id: string, _updates: Partial<Undertaking>): Promise<Undertaking | undefined> {
    throw new Error("Not implemented in MemStorage");
  }
  async getAllOutstandingUndertakings(): Promise<(Undertaking & { caseTitle?: string; clientName?: string })[]> {
    return [];
  }
  async createFirm(_data: InsertFirm): Promise<Firm> { throw new Error("Not implemented in MemStorage"); }
  async getFirm(_id: string): Promise<Firm | undefined> { return undefined; }
  async updateFirm(_id: string, _updates: Partial<Firm>): Promise<Firm | undefined> { throw new Error("Not implemented"); }
  async ensureUserHasFirm(_userId: string): Promise<Firm> { throw new Error("Not implemented"); }
  async getFirmMembers(_firmId: string): Promise<User[]> { return []; }
  async updateUserFirmRole(_userId: string, _updates: { primaryRole?: string | null; customRoleLabel?: string | null; regulatoryDesignations?: string[]; inviteStatus?: string; firmId?: string | null; invitedAt?: Date | null; }): Promise<User | undefined> { throw new Error("Not implemented"); }
  async removeUserFromFirm(_userId: string, _removedAt: Date): Promise<User | undefined> { throw new Error("Not implemented"); }
  async getFormerFirmMembers(_firmId: string): Promise<User[]> { return []; }
  async createFirmInvitation(_data: InsertFirmInvitation): Promise<FirmInvitation> { throw new Error("Not implemented"); }
  async getFirmInvitation(_id: string): Promise<FirmInvitation | undefined> { return undefined; }
  async getFirmInvitationByToken(_token: string): Promise<FirmInvitation | undefined> { return undefined; }
  async getFirmInvitations(_firmId: string): Promise<FirmInvitation[]> { return []; }
  async updateFirmInvitation(_id: string, _updates: Partial<FirmInvitation>): Promise<FirmInvitation | undefined> { throw new Error("Not implemented"); }
  async createRoleChangeLog(_data: InsertRoleChangeLog): Promise<RoleChangeLog> { throw new Error("Not implemented"); }
  async getRoleChangeLogs(_userId: string): Promise<RoleChangeLog[]> { return []; }
  async getFirmRoleChangeLogs(_firmId: string): Promise<RoleChangeLog[]> { return []; }
  async getConflictChecksByCase(_caseId: string): Promise<ConflictCheck[]> { return []; }
  async createConflictCheck(_data: InsertConflictCheck): Promise<ConflictCheck> {
    throw new Error("MemStorage: createConflictCheck not implemented");
  }
  async getSupervisionSignoffsByCase(_caseId: string): Promise<SupervisionSignoff[]> {
    return [];
  }
  async createSupervisionSignoff(_data: InsertSupervisionSignoff): Promise<SupervisionSignoff> {
    throw new Error("Not implemented in MemStorage");
  }
  async getComplianceOverview(): Promise<ComplianceOverview> {
    return { totalActiveMatters: 0, redMatters: 0, amberMatters: 0, greenMatters: 0, totalOutstandingUndertakings: 0, matters: [], undertakings: [], supervisionByFeeEarner: [] };
  }
  async updateUserRole(_userId: string, _role: string): Promise<User | undefined> {
    throw new Error("Not implemented in MemStorage");
  }
}

/** Thrown when a new IdP subject presents an email already registered to another user. */
export class AuthEmailCollisionError extends Error {
  constructor() {
    super(
      "This email address is already registered. Sign in using the method you used originally.",
    );
    this.name = "AuthEmailCollisionError";
  }
}

/** Thrown when a new Microsoft login presents no usable email claim. */
export class AuthEmailRequiredError extends Error {
  constructor() {
    super(
      "Your firm's Microsoft account did not release an email address. Contact your firm administrator or support.",
    );
    this.name = "AuthEmailRequiredError";
  }
}

/** Thrown when a user tries to change a display name that is already locked. */
export class DisplayNameAlreadyConfirmedError extends Error {
  constructor() {
    super(
      "Your display name is locked. Contact an administrator to change it.",
    );
    this.name = "DisplayNameAlreadyConfirmedError";
  }
}

/** Canonical form for users.email and collision checks. IdP casing is preserved in email_at_link. */
export function normalizeAuthEmail(email: string | null | undefined): string | null {
  if (email == null) return null;
  const trimmed = email.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existing = userData.id ? await this.getUser(userData.id) : undefined;
    const nameLocked = !!existing?.displayNameConfirmedAt;

    // OAuth must not wipe or overwrite names once confirmed; otherwise only fill when provided.
    const nextFirstName = nameLocked
      ? (existing?.firstName ?? null)
      : (userData.firstName !== undefined && userData.firstName !== null
          ? userData.firstName
          : (existing?.firstName ?? null));
    const nextLastName = nameLocked
      ? (existing?.lastName ?? null)
      : (userData.lastName !== undefined && userData.lastName !== null
          ? userData.lastName
          : (existing?.lastName ?? null));
    const nextProfileImage =
      userData.profileImageUrl !== undefined && userData.profileImageUrl !== null
        ? userData.profileImageUrl
        : (existing?.profileImageUrl ?? null);
    const nextEmail =
      userData.email !== undefined && userData.email !== null
        ? userData.email
        : (existing?.email ?? null);

    const result = await db
      .insert(users)
      .values({
        id: userData.id,
        email: nextEmail,
        firstName: nextFirstName,
        lastName: nextLastName,
        profileImageUrl: nextProfileImage,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: nextEmail,
          firstName: nextFirstName,
          lastName: nextLastName,
          profileImageUrl: nextProfileImage,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }

  async confirmUserDisplayName(
    userId: string,
    names: { firstName: string; lastName: string },
    options?: { force?: boolean },
  ): Promise<User | undefined> {
    const existing = await this.getUser(userId);
    if (!existing) return undefined;
    if (existing.displayNameConfirmedAt && !options?.force) {
      throw new DisplayNameAlreadyConfirmedError();
    }
    const result = await db
      .update(users)
      .set({
        firstName: names.firstName,
        lastName: names.lastName,
        displayNameConfirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async getAuthIdentity(provider: string, providerUserId: string): Promise<AuthIdentity | undefined> {
    const [row] = await db
      .select()
      .from(authIdentities)
      .where(and(eq(authIdentities.provider, provider), eq(authIdentities.providerUserId, providerUserId)))
      .limit(1);
    return row;
  }

  async getAuthIdentitiesForUser(userId: string): Promise<AuthIdentity[]> {
    return await db
      .select()
      .from(authIdentities)
      .where(eq(authIdentities.userId, userId));
  }

  async createAuthIdentity(data: {
    userId: string;
    provider: string;
    providerUserId: string;
    emailAtLink?: string | null;
  }): Promise<AuthIdentity> {
    const [row] = await db
      .insert(authIdentities)
      .values({
        userId: data.userId,
        provider: data.provider,
        providerUserId: data.providerUserId,
        emailAtLink: data.emailAtLink ?? null,
      })
      .returning();
    return row;
  }

  /**
   * Refuses when canonicalEmail belongs to another user and this provider subject
   * is not linked to them. Shared by resolveGoogleAuthUser and Phase 2 Microsoft login.
   */
  async assertNoEmailCollisionForNewIdentity(params: {
    provider: string;
    providerUserId: string;
    canonicalEmail: string | null;
  }): Promise<void> {
    const { provider, providerUserId, canonicalEmail } = params;
    if (!canonicalEmail) return;

    const [emailOwner] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          isNotNull(users.email),
          sql`lower(${users.email}) = ${canonicalEmail}`,
        ),
      )
      .limit(1);

    if (!emailOwner) return;

    const [linkedToOwner] = await db
      .select({ id: authIdentities.id })
      .from(authIdentities)
      .where(
        and(
          eq(authIdentities.userId, emailOwner.id),
          eq(authIdentities.provider, provider),
          eq(authIdentities.providerUserId, providerUserId),
        ),
      )
      .limit(1);

    if (linkedToOwner) return;

    throw new AuthEmailCollisionError();
  }

  async resolveGoogleAuthUser(profile: {
    providerUserId: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  }): Promise<User> {
    const emailAtLink = profile.email;
    const canonicalEmail = normalizeAuthEmail(profile.email);

    const identity = await this.getAuthIdentity("google", profile.providerUserId);
    if (identity) {
      return this.upsertUser({
        id: identity.userId,
        email: canonicalEmail ?? undefined,
        firstName: profile.firstName ?? undefined,
        lastName: profile.lastName ?? undefined,
        profileImageUrl: profile.profileImageUrl ?? undefined,
      });
    }

    await this.assertNoEmailCollisionForNewIdentity({
      provider: "google",
      providerUserId: profile.providerUserId,
      canonicalEmail,
    });

    const newUserId = randomUUID();
    const user = await this.upsertUser({
      id: newUserId,
      email: canonicalEmail ?? undefined,
      firstName: profile.firstName ?? undefined,
      lastName: profile.lastName ?? undefined,
      profileImageUrl: profile.profileImageUrl ?? undefined,
    });

    await this.createAuthIdentity({
      userId: user.id,
      provider: "google",
      providerUserId: profile.providerUserId,
      emailAtLink,
    });

    return user;
  }

  async resolveMicrosoftAuthUser(profile: {
    providerUserId: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  }): Promise<User> {
    const emailAtLink = profile.email;
    const canonicalEmail = normalizeAuthEmail(profile.email);

    const identity = await this.getAuthIdentity("microsoft", profile.providerUserId);
    if (identity) {
      return this.upsertUser({
        id: identity.userId,
        email: canonicalEmail ?? undefined,
        firstName: profile.firstName ?? undefined,
        lastName: profile.lastName ?? undefined,
        profileImageUrl: profile.profileImageUrl ?? undefined,
      });
    }

    if (!canonicalEmail) {
      throw new AuthEmailRequiredError();
    }

    await this.assertNoEmailCollisionForNewIdentity({
      provider: "microsoft",
      providerUserId: profile.providerUserId,
      canonicalEmail,
    });

    const newUserId = randomUUID();
    const user = await this.upsertUser({
      id: newUserId,
      email: canonicalEmail ?? undefined,
      firstName: profile.firstName ?? undefined,
      lastName: profile.lastName ?? undefined,
      profileImageUrl: profile.profileImageUrl ?? undefined,
    });

    await this.createAuthIdentity({
      userId: user.id,
      provider: "microsoft",
      providerUserId: profile.providerUserId,
      emailAtLink,
    });

    return user;
  }

  async updateUserStripeInfo(userId: string, stripeInfo: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus?: string;
    subscriptionPlan?: string;
    trialEndsAt?: Date | null;
  }): Promise<User | undefined> {
    const updates: Partial<User> = { updatedAt: new Date() };
    if (stripeInfo.stripeCustomerId !== undefined) updates.stripeCustomerId = stripeInfo.stripeCustomerId;
    if (stripeInfo.stripeSubscriptionId !== undefined) updates.stripeSubscriptionId = stripeInfo.stripeSubscriptionId;
    if (stripeInfo.subscriptionStatus !== undefined) updates.subscriptionStatus = stripeInfo.subscriptionStatus;
    if (stripeInfo.subscriptionPlan !== undefined) updates.subscriptionPlan = stripeInfo.subscriptionPlan;
    if (stripeInfo.trialEndsAt !== undefined) updates.trialEndsAt = stripeInfo.trialEndsAt;
    
    const result = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async createClient(clientData: InsertClient, userId: string): Promise<Client> {
    const creator = await this.getUser(userId);
    const result = await db
      .insert(clients)
      .values({
        name: clientData.name,
        email: clientData.email ?? null,
        phone: clientData.phone ?? null,
        address: clientData.address ?? null,
        dateOfBirth: clientData.dateOfBirth ?? null,
        companyName: clientData.companyName ?? null,
        amlRiskLevel: clientData.amlRiskLevel ?? null,
        amlRiskLastReviewed: clientData.amlRiskLastReviewed ?? null,
        clioClientId: clientData.clioClientId ?? null,
        createdBy: userId,
        firmId: creator?.firmId ?? null,
      })
      .returning();
    return result[0];
  }

  async getClient(id: string, userId: string): Promise<Client | undefined> {
    const user = await this.getUser(userId);
    if (user?.firmId) {
      const result = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.firmId, user.firmId)));
      if (result[0]) return result[0];
    }
    const result = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.createdBy, userId)));
    return result[0];
  }

  async updateClient(id: string, updates: Partial<Client>, userId: string): Promise<Client | undefined> {
    const user = await this.getUser(userId);
    const ownerFilter = user?.firmId
      ? eq(clients.firmId, user.firmId)
      : eq(clients.createdBy, userId);
    const result = await db
      .update(clients)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(clients.id, id), ownerFilter))
      .returning();
    return result[0];
  }

  async searchClients(query: string, userId: string): Promise<Client[]> {
    const user = await this.getUser(userId);
    const lower = `%${query.toLowerCase()}%`;
    const ownerFilter = user?.firmId
      ? eq(clients.firmId, user.firmId)
      : eq(clients.createdBy, userId);
    return await db.select().from(clients)
      .where(and(
        ownerFilter,
        sql`(LOWER(${clients.name}) LIKE ${lower} OR LOWER(${clients.email}) LIKE ${lower})`
      ))
      .orderBy(clients.name)
      .limit(20);
  }

  async getClientsByUser(userId: string): Promise<Client[]> {
    const user = await this.getUser(userId);
    if (user?.firmId) {
      return await db.select().from(clients)
        .where(eq(clients.firmId, user.firmId))
        .orderBy(desc(clients.createdAt));
    }
    return await db.select().from(clients)
      .where(eq(clients.createdBy, userId))
      .orderBy(desc(clients.createdAt));
  }

  async getCasesByClientId(clientId: string, userId: string): Promise<Case[]> {
    const user = await this.getUser(userId);
    if (user?.firmId) {
      return await db.select().from(cases)
        .where(and(eq(cases.clientId, clientId), eq(cases.firmId, user.firmId)))
        .orderBy(desc(cases.createdAt));
    }
    return await db.select().from(cases)
      .where(and(eq(cases.clientId, clientId), eq(cases.createdBy, userId)))
      .orderBy(desc(cases.createdAt));
  }

  async migrateExistingClientsFromCases(userId: string): Promise<number> {
    const unlinkedCases = await db.select().from(cases)
      .where(and(eq(cases.createdBy, userId), isNull(cases.clientId)));
    
    const clientsByName = new Map<string, string>();
    let count = 0;

    for (const c of unlinkedCases) {
      const normalName = c.clientName.trim().toLowerCase();
      if (!clientsByName.has(normalName)) {
        const existing = await db.select().from(clients)
          .where(and(eq(clients.createdBy, userId), sql`LOWER(${clients.name}) = ${normalName}`))
          .limit(1);
        
        if (existing.length > 0) {
          clientsByName.set(normalName, existing[0].id);
        } else {
          const [newClient] = await db.insert(clients)
            .values({ name: c.clientName.trim(), createdBy: userId })
            .returning();
          clientsByName.set(normalName, newClient.id);
          count++;
        }
      }
      
      await db.update(cases)
        .set({ clientId: clientsByName.get(normalName)! })
        .where(eq(cases.id, c.id));
    }
    return count;
  }

  async createCase(insertCase: InsertCase, userId: string): Promise<Case> {
    const creator = await this.getUser(userId);
    const result = await db
      .insert(cases)
      .values({
        title: insertCase.title,
        clientName: insertCase.clientName,
        clientId: insertCase.clientId ?? null,
        matterReference: insertCase.matterReference ?? null,
        createdBy: userId,
        assignedToUserId: insertCase.assignedToUserId ?? null,
        firmId: creator?.firmId ?? null,
        status: insertCase.status || "pending",
        priority: insertCase.priority || "normal",
        sourceType: insertCase.sourceType,
        practiceArea: insertCase.practiceArea ?? null,
        conflictCheckCompleted: insertCase.conflictCheckCompleted ?? false,
        conflictCheckNote: insertCase.conflictCheckNote ?? null,
        costsEstimate: insertCase.costsEstimate ?? null,
        textNotes: insertCase.textNotes ?? null,
        reviewed: insertCase.reviewed ?? false,
        archived: insertCase.archived ?? false,
        aiProcessingMetadata: {},
      })
      .returning();
    return result[0];
  }

  async getCases(userId: string, includeArchived: boolean = false): Promise<Case[]> {
    const userFilter = or(eq(cases.createdBy, userId), eq(cases.assignedToUserId, userId));
    const conditions = includeArchived 
      ? [userFilter]
      : [userFilter, eq(cases.archived, false)];
      
    return await db
      .select()
      .from(cases)
      .where(and(...conditions))
      .orderBy(desc(cases.createdAt));
  }

  async getFirmCases(firmId: string, includeArchived: boolean = false): Promise<Case[]> {
    const firmFilter = eq(cases.firmId, firmId);
    const conditions = includeArchived
      ? [firmFilter]
      : [firmFilter, eq(cases.archived, false)];
    return await db
      .select()
      .from(cases)
      .where(and(...conditions))
      .orderBy(desc(cases.createdAt));
  }

  async getCasesAssignedToUser(assignedUserId: string, includeArchived: boolean = false): Promise<Case[]> {
    const assignedFilter = eq(cases.assignedToUserId, assignedUserId);
    const conditions = includeArchived
      ? [assignedFilter]
      : [assignedFilter, eq(cases.archived, false)];
    return await db
      .select()
      .from(cases)
      .where(and(...conditions))
      .orderBy(desc(cases.createdAt));
  }

  async getCase(id: string, userId: string): Promise<Case | undefined> {
    const user = await this.getUser(userId);
    if (user?.firmId) {
      const result = await db.select().from(cases).where(
        and(eq(cases.id, id), eq(cases.firmId, user.firmId))
      );
      if (result[0]) return result[0];
    }
    const result = await db.select().from(cases).where(
      and(eq(cases.id, id), or(eq(cases.createdBy, userId), eq(cases.assignedToUserId, userId)))
    );
    return result[0];
  }

  async updateCase(id: string, updates: Partial<Case>, userId: string): Promise<Case | undefined> {
    const user = await this.getUser(userId);
    const ownerFilter = user?.firmId
      ? eq(cases.firmId, user.firmId)
      : or(eq(cases.createdBy, userId), eq(cases.assignedToUserId, userId));
    const result = await db
      .update(cases)
      .set(updates)
      .where(and(eq(cases.id, id), ownerFilter))
      .returning();
    return result[0];
  }

  async markCaseAsReviewed(id: string, reviewed: boolean, userId: string): Promise<Case | undefined> {
    return this.updateCase(id, { reviewed }, userId);
  }

  async archiveCase(id: string, archived: boolean, userId: string): Promise<Case | undefined> {
    return this.updateCase(id, { archived }, userId);
  }

  async assignCaseToUser(id: string, assignedToUserId: string | null, userId: string): Promise<Case | undefined> {
    return this.updateCase(id, { assignedToUserId }, userId);
  }

  async createAudioRecording(insertAudioRecording: ServerAudioRecordingInsert): Promise<AudioRecording> {
    const result = await db
      .insert(audioRecordings)
      .values({
        caseId: insertAudioRecording.caseId,
        meetingSessionId: insertAudioRecording.meetingSessionId ?? null,
        filePath: insertAudioRecording.filePath ?? null,
        mimeType: insertAudioRecording.mimeType ?? null,
        duration: insertAudioRecording.duration ?? null,
        expiresAt: insertAudioRecording.expiresAt,
      })
      .returning();
    return result[0];
  }

  async getAudioRecording(id: string): Promise<AudioRecording | undefined> {
    const result = await db.select().from(audioRecordings).where(eq(audioRecordings.id, id));
    return result[0];
  }

  async getAudioRecordingsByCaseId(caseId: string): Promise<AudioRecording[]> {
    return await db
      .select()
      .from(audioRecordings)
      .where(eq(audioRecordings.caseId, caseId))
      .orderBy(audioRecordings.recordedAt);
  }

  async getAudioRecordingByCase(caseId: string, userId: string): Promise<AudioRecording | undefined> {
    const caseRecord = await db.select().from(cases).where(and(eq(cases.id, caseId), eq(cases.createdBy, userId)));
    if (!caseRecord[0]) return undefined;
    
    const result = await db.select().from(audioRecordings)
      .where(eq(audioRecordings.caseId, caseId))
      .orderBy(desc(audioRecordings.recordedAt));
    return result[0];
  }

  async getAudioRecordingBySession(meetingSessionId: string): Promise<AudioRecording | undefined> {
    const result = await db.select().from(audioRecordings)
      .where(eq(audioRecordings.meetingSessionId, meetingSessionId))
      .orderBy(desc(audioRecordings.recordedAt));
    return result[0];
  }

  async updateAudioRecording(id: string, updates: Partial<AudioRecording>): Promise<AudioRecording | undefined> {
    const result = await db
      .update(audioRecordings)
      .set(updates)
      .where(eq(audioRecordings.id, id))
      .returning();
    return result[0];
  }

  // Stage 2: excludes active grace windows (Option 2a marker — see isInActiveColpGraceWindow).
  async getExpiredAudioRecordings(): Promise<AudioRecording[]> {
    const now = new Date();
    return await db
      .select()
      .from(audioRecordings)
      .where(and(
        lte(audioRecordings.expiresAt, now),
        isNull(audioRecordings.deletedAt),
        not(and(
          eq(audioRecordings.colpReviewStatus, "awaiting_review"),
          isNotNull(audioRecordings.holdReleaseGraceUntil),
          gte(audioRecordings.holdReleaseGraceUntil, now),
        )),
      ));
  }

  // Stage 2: returns lapsed grace-window recordings for auto-deletion (Option 2a marker).
  async getGraceExpiredAudioRecordings(): Promise<AudioRecording[]> {
    const now = new Date();
    return await db
      .select()
      .from(audioRecordings)
      .where(and(
        lt(audioRecordings.holdReleaseGraceUntil, now),
        eq(audioRecordings.colpReviewStatus, "awaiting_review"),
        isNull(audioRecordings.deletedAt),
        isNotNull(audioRecordings.filePath),
      ));
  }

  async getExpiringAudioCount(userId: string, withinHours: number): Promise<number> {
    const now = new Date();
    const threshold = new Date(now.getTime() + withinHours * 60 * 60 * 1000);
    
    const result = await db
      .select({ count: count() })
      .from(audioRecordings)
      .innerJoin(cases, eq(audioRecordings.caseId, cases.id))
      .where(and(
        eq(cases.createdBy, userId),
        gte(audioRecordings.expiresAt, now),
        lte(audioRecordings.expiresAt, threshold),
        isNull(audioRecordings.deletedAt)
      ));
    
    return result[0]?.count || 0;
  }

  async getProductivityStats(userId: string, since?: Date): Promise<{
    totalCases: number;
    awaitingReview: number;
    evidenceCompletePercent: number;
    documentationRate: number;
    thisMonthCases: number;
    monthlyTrend: "up" | "down" | "neutral";
    monthlyChange: number;
  }> {
    const conditions = [eq(cases.createdBy, userId), eq(cases.archived, false)];
    if (since) {
      conditions.push(gte(cases.createdAt, since));
    }
    const userCases = await db.select().from(cases).where(and(...conditions));
    const userCaseIds = userCases.map(c => c.id);
    const totalCases = userCases.length;
    
    // Awaiting Review: cases completed but not yet reviewed by solicitor
    const awaitingReview = userCases.filter(c => c.status === "completed" && !c.reviewed).length;
    
    // Defensibility Ready: % of cases with full audit-ready bundle
    // (transcript + attendance note/document + consent log)
    // Note: Audio is excluded since it's deleted after 7 days per GDPR policy
    let evidenceCompleteCount = 0;
    if (userCaseIds.length > 0) {
      const transcriptResults = await db.select({ caseId: transcripts.caseId })
        .from(transcripts)
        .where(inArray(transcripts.caseId, userCaseIds));
      const documentResults = await db.select({ caseId: documents.caseId })
        .from(documents)
        .where(inArray(documents.caseId, userCaseIds));
      const consentResults = await db.select({ caseId: consentLogs.caseId })
        .from(consentLogs)
        .where(inArray(consentLogs.caseId, userCaseIds));
      
      const casesWithTranscript = new Set(transcriptResults.map(r => r.caseId));
      const casesWithDoc = new Set(documentResults.map(r => r.caseId));
      const casesWithConsent = new Set(consentResults.map(r => r.caseId));
      
      for (const caseItem of userCases) {
        if (casesWithTranscript.has(caseItem.id) && 
            casesWithDoc.has(caseItem.id) && casesWithConsent.has(caseItem.id)) {
          evidenceCompleteCount++;
        }
      }
    }
    const evidenceCompletePercent = totalCases > 0 ? Math.round((evidenceCompleteCount / totalCases) * 100) : 100;
    
    // Documentation Rate: % of cases with at least one document
    let casesWithDocs = 0;
    if (userCaseIds.length > 0) {
      const docResults = await db.select({ caseId: documents.caseId })
        .from(documents)
        .where(inArray(documents.caseId, userCaseIds));
      casesWithDocs = new Set(docResults.map(r => r.caseId)).size;
    }
    const documentationRate = totalCases > 0 ? Math.round((casesWithDocs / totalCases) * 100) : 100;
    
    // Monthly stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    const thisMonthCases = userCases.filter(c => new Date(c.createdAt) >= startOfMonth).length;
    const lastMonthCases = userCases.filter(c => {
      const d = new Date(c.createdAt);
      return d >= startOfLastMonth && d < startOfMonth;
    }).length;
    
    let monthlyChange: number;
    let monthlyTrend: "up" | "down" | "neutral";
    
    if (lastMonthCases === 0 && thisMonthCases > 0) {
      monthlyChange = 100;
      monthlyTrend = "up";
    } else if (lastMonthCases > 0) {
      monthlyChange = Math.round(((thisMonthCases - lastMonthCases) / lastMonthCases) * 100);
      monthlyTrend = monthlyChange > 0 ? "up" : monthlyChange < 0 ? "down" : "neutral";
    } else {
      monthlyChange = 0;
      monthlyTrend = "neutral";
    }
    
    return {
      totalCases,
      awaitingReview,
      evidenceCompletePercent,
      documentationRate,
      thisMonthCases,
      monthlyTrend,
      monthlyChange: Math.abs(monthlyChange),
    };
  }

  async getConsentLogsByCase(caseId: string, userId: string): Promise<ConsentLog[]> {
    const caseRecord = await db.select().from(cases).where(and(eq(cases.id, caseId), eq(cases.createdBy, userId)));
    if (!caseRecord[0]) return [];
    
    return await db
      .select()
      .from(consentLogs)
      .where(eq(consentLogs.caseId, caseId))
      .orderBy(desc(consentLogs.consentTimestamp));
  }

  async createTranscript(transcriptData: InsertTranscript): Promise<Transcript> {
    const contentHash = generateDocumentHash(transcriptData.content);
    const contentSignature = generateContentSignature(contentHash);
    const result = await db
      .insert(transcripts)
      .values({
        caseId: transcriptData.caseId,
        content: transcriptData.content,
        utterances: transcriptData.utterances ?? [],
        speakerCount: transcriptData.speakerCount ?? null,
        redactions: transcriptData.redactions ?? [],
        meetingSessionId: transcriptData.meetingSessionId ?? null,
        contentHash,
        contentSignature,
      })
      .returning();
    return result[0];
  }

  async getTranscript(id: string): Promise<Transcript | undefined> {
    const result = await db.select().from(transcripts).where(eq(transcripts.id, id));
    return result[0];
  }

  async getTranscriptByCase(caseId: string, userId: string): Promise<Transcript | undefined> {
    // Align with getCase firm/assignee access — createdBy-only hid transcripts from firm colleagues
    // and returning an unordered first row could surface a short earlier session capture.
    const caseRecord = await this.getCase(caseId, userId);
    if (!caseRecord) return undefined;

    const result = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.caseId, caseId))
      .orderBy(desc(transcripts.createdAt));

    if (result.length === 0) return undefined;
    return result.reduce((best, row) =>
      (row.content?.length ?? 0) > (best.content?.length ?? 0) ? row : best,
    );
  }

  async getTranscriptBySession(meetingSessionId: string): Promise<Transcript | undefined> {
    const result = await db.select().from(transcripts).where(eq(transcripts.meetingSessionId, meetingSessionId));
    return result[0];
  }

  async updateTranscript(id: string, updates: Partial<Transcript>, userId: string): Promise<Transcript | undefined> {
    // L1: Block updates if case is under litigation hold
    const transcriptRecord = await db.select().from(transcripts).where(eq(transcripts.id, id)).limit(1);
    if (transcriptRecord[0]) {
      const caseRecord = await db.select().from(cases).where(eq(cases.id, transcriptRecord[0].caseId)).limit(1);
      if (caseRecord[0]?.litigationHold) {
        console.warn(`[LITIGATION-HOLD] Blocked transcript update on ${id} — case ${transcriptRecord[0].caseId} is under litigation hold`);
        return undefined;
      }
    }
    const transcript = await db.select().from(transcripts).where(eq(transcripts.id, id));
    if (!transcript[0]) return undefined;
    
    const caseRecord = await db.select().from(cases).where(and(eq(cases.id, transcript[0].caseId), eq(cases.createdBy, userId)));
    if (!caseRecord[0]) return undefined;
    
    const result = await db
      .update(transcripts)
      .set(updates)
      .where(eq(transcripts.id, id))
      .returning();
    return result[0];
  }

  async commitTranscriptRedactions(
    transcriptId: string,
    userId: string,
    redactionIds?: string[]
  ): Promise<Transcript | undefined> {
    // Fetch transcript and verify ownership via case
    const transcript = await db.select().from(transcripts).where(eq(transcripts.id, transcriptId));
    if (!transcript[0]) return undefined;

    const caseRecord = await db.select().from(cases).where(
      and(eq(cases.id, transcript[0].caseId), eq(cases.createdBy, userId))
    );
    if (!caseRecord[0]) return undefined;

    const now = new Date();
    const currentRedactions = (transcript[0].redactions || []) as any[];
    const currentPrivileged = (transcript[0].privilegedRedactions || []) as any[];

    // Determine which redactions to commit
    // If redactionIds provided, only commit those — otherwise commit all pending/expired
    const toCommit = currentRedactions.filter((r: any) => {
      if (r.status === 'committed') return false; // Already committed
      if (redactionIds) return redactionIds.includes(r.id); // Specific IDs requested
      // Auto-commit: pending and window expired, OR explicitly pending with no window
      return r.status === 'pending' && (!r.pendingUntil || new Date(r.pendingUntil) <= now);
    });

    if (toCommit.length === 0) return transcript[0];

    let updatedContent = transcript[0].content;
    const newPrivilegedEntries: any[] = [];

    // Process each redaction to commit
    // Sort by start position descending so we replace from end to start
    // This preserves character positions for earlier replacements
    const sortedToCommit = [...toCommit].sort((a, b) => b.start - a.start);

    for (const redaction of sortedToCommit) {
      const replacementText = `[REDACTED — ${redaction.reasonType.toUpperCase()}]`;

      if (redaction.reasonType === 'redaction_privilege') {
        // Privilege path: preserve original text in privilegedRedactions, replace in content
        newPrivilegedEntries.push({
          id: redaction.id,
          text: redaction.selectedText,
          start: redaction.start,
          end: redaction.end,
          reasonType: redaction.reasonType,
          reasonNotes: redaction.reasonNotes,
          redactedBy: redaction.redactedBy,
          committedAt: now.toISOString(),
        });
      }

      // For all reason types: replace content at position
      // Use character positions (start/end on the utterance block level)
      updatedContent = updatedContent.substring(0, redaction.start) +
        replacementText +
        updatedContent.substring(redaction.end);
    }

    // Update redaction markers: set status to committed, remove selectedText and pendingUntil
    const updatedRedactions = currentRedactions.map((r: any) => {
      const isBeingCommitted = toCommit.some((c: any) => c.id === r.id);
      if (!isBeingCommitted) return r;

      const { selectedText: _st, pendingUntil: _pu, ...committed } = r;
      return {
        ...committed,
        status: 'committed',
        committedAt: now.toISOString(),
      };
    });

    const updatedPrivileged = [...currentPrivileged, ...newPrivilegedEntries];

    const newContentHash = generateDocumentHash(updatedContent);
    const newContentSignature = generateContentSignature(newContentHash);

    // Persist changes
    const result = await db
      .update(transcripts)
      .set({
        content: updatedContent,
        redactions: updatedRedactions,
        privilegedRedactions: updatedPrivileged,
        contentHash: newContentHash,
        contentSignature: newContentSignature,
      })
      .where(eq(transcripts.id, transcriptId))
      .returning();

    return result[0];
  }

  async getTranscriptsWithExpiredPendingRedactions(): Promise<(Transcript & { createdBy: string })[]> {
    const now = new Date().toISOString();
    const expiredTranscripts = await db
      .select()
      .from(transcripts)
      .where(
        sql`EXISTS (
        SELECT 1 FROM jsonb_array_elements(${transcripts.redactions}) AS r
        WHERE r->>'status' = 'pending'
        AND r->>'pendingUntil' IS NOT NULL
        AND r->>'pendingUntil' < ${now}
      )`
      );

    if (expiredTranscripts.length === 0) return [];

    const results: (Transcript & { createdBy: string })[] = [];
    for (const transcript of expiredTranscripts) {
      const caseRecord = await db
        .select({ createdBy: cases.createdBy })
        .from(cases)
        .where(eq(cases.id, transcript.caseId))
        .limit(1);
      if (caseRecord[0]) {
        results.push({ ...transcript, createdBy: caseRecord[0].createdBy });
      }
    }
    return results;
  }

  // Action Items methods
  async createActionItem(itemData: InsertActionItem): Promise<ActionItem> {
    const result = await db
      .insert(actionItems)
      .values({
        caseId: itemData.caseId,
        transcriptId: itemData.transcriptId,
        description: itemData.description,
        originalDescription: (itemData as any).originalDescription ?? null,
        assignee: itemData.assignee ?? null,
        dueDate: itemData.dueDate ?? null,
        priority: itemData.priority ?? "medium",
        status: (itemData as any).status ?? "draft",
        completed: itemData.completed ?? false,
        sourceUtteranceIndex: itemData.sourceUtteranceIndex ?? null,
        isManual: (itemData as any).isManual ?? false,
      })
      .returning();
    return result[0];
  }

  async createManualActionItem(itemData: { caseId: string; description: string; assignee?: string | null; dueDate?: Date; priority?: string; isManual?: boolean }): Promise<ActionItem> {
    const result = await db
      .insert(actionItems)
      .values({
        caseId: itemData.caseId,
        transcriptId: null,
        description: itemData.description,
        assignee: itemData.assignee ?? null,
        dueDate: itemData.dueDate ?? null,
        priority: itemData.priority ?? "medium",
        status: "draft",
        completed: false,
        isManual: true,
      })
      .returning();
    return result[0];
  }

  async getActionItem(id: string, userId: string): Promise<ActionItem | undefined> {
    const item = await db.select().from(actionItems).where(eq(actionItems.id, id));
    if (!item[0]) return undefined;
    
    const caseRecord = await this.getCase(item[0].caseId, userId);
    if (!caseRecord) return undefined;
    
    return item[0];
  }

  async getActionItemsByCase(caseId: string, userId: string): Promise<ActionItem[]> {
    const caseRecord = await this.getCase(caseId, userId);
    if (!caseRecord) return [];
    
    return await db
      .select()
      .from(actionItems)
      .where(eq(actionItems.caseId, caseId))
      .orderBy(actionItems.priority, actionItems.dueDate, desc(actionItems.createdAt));
  }

  async getAllActionItemsForUser(userId: string): Promise<(ActionItem & { caseTitle?: string; clientName?: string })[]> {
    const userCases = await db.select().from(cases).where(and(eq(cases.createdBy, userId), eq(cases.archived, false)));
    const caseMap = new Map(userCases.map(c => [c.id, c]));
    const caseIds = userCases.map(c => c.id);
    if (caseIds.length === 0) return [];
    
    const items = await db
      .select()
      .from(actionItems)
      .where(inArray(actionItems.caseId, caseIds))
      .orderBy(actionItems.dueDate, desc(actionItems.createdAt));
    
    return items.map(item => ({
      ...item,
      caseTitle: caseMap.get(item.caseId)?.title,
      clientName: caseMap.get(item.caseId)?.clientName,
    }));
  }

  async getActionItemsByTranscript(transcriptId: string, userId: string): Promise<ActionItem[]> {
    const transcript = await db.select().from(transcripts).where(eq(transcripts.id, transcriptId));
    if (!transcript[0]) return [];
    
    const caseRecord = await this.getCase(transcript[0].caseId, userId);
    if (!caseRecord) return [];
    
    return await db
      .select()
      .from(actionItems)
      .where(eq(actionItems.transcriptId, transcriptId))
      .orderBy(desc(actionItems.createdAt));
  }

  async updateActionItem(id: string, updates: Partial<ActionItem>, userId: string): Promise<ActionItem | undefined> {
    const existing = await db.select().from(actionItems).where(eq(actionItems.id, id));
    if (!existing[0]) return undefined;
    
    const caseRecord = await this.getCase(existing[0].caseId, userId);
    if (!caseRecord) return undefined;
    
    const result = await db
      .update(actionItems)
      .set(updates)
      .where(eq(actionItems.id, id))
      .returning();
    return result[0];
  }

  async deleteActionItem(id: string, userId: string): Promise<boolean> {
    const existing = await db.select().from(actionItems).where(eq(actionItems.id, id));
    if (!existing[0]) return false;
    
    const caseRecord = await this.getCase(existing[0].caseId, userId);
    if (!caseRecord) return false;
    
    await db.delete(actionItems).where(eq(actionItems.id, id));
    return true;
  }

  async createPreMeetingBriefing(briefingData: InsertPreMeetingBriefing): Promise<PreMeetingBriefing> {
    const result = await db
      .insert(preMeetingBriefings)
      .values({
        caseId: briefingData.caseId,
        content: briefingData.content,
        generatedBy: briefingData.generatedBy,
        sourceMeetingCount: briefingData.sourceMeetingCount ?? 0,
        inputTokens: briefingData.inputTokens ?? null,
        outputTokens: briefingData.outputTokens ?? null,
        cost: briefingData.cost ?? null,
      })
      .returning();
    return result[0];
  }

  async getPreMeetingBriefingsByCase(caseId: string, userId: string): Promise<PreMeetingBriefing[]> {
    const caseRecord = await db.select().from(cases).where(and(eq(cases.id, caseId), eq(cases.createdBy, userId)));
    if (!caseRecord[0]) return [];
    
    return await db
      .select()
      .from(preMeetingBriefings)
      .where(eq(preMeetingBriefings.caseId, caseId))
      .orderBy(desc(preMeetingBriefings.generatedAt));
  }

  async getLatestPreMeetingBriefing(caseId: string, userId: string): Promise<PreMeetingBriefing | undefined> {
    const briefings = await this.getPreMeetingBriefingsByCase(caseId, userId);
    return briefings[0];
  }

  async createQuickNote(noteData: InsertQuickNote, userId: string): Promise<QuickNote> {
    const result = await db
      .insert(quickNotes)
      .values({
        caseId: noteData.caseId,
        content: noteData.content,
        createdBy: userId,
      })
      .returning();
    return result[0];
  }

  async getQuickNotesByCase(caseId: string, userId: string): Promise<QuickNote[]> {
    const caseRecord = await db.select().from(cases).where(and(eq(cases.id, caseId), eq(cases.createdBy, userId)));
    if (!caseRecord[0]) return [];
    
    return await db
      .select()
      .from(quickNotes)
      .where(eq(quickNotes.caseId, caseId))
      .orderBy(desc(quickNotes.createdAt));
  }

  async createDocument(documentData: InsertDocument): Promise<Document> {
    const contentHash = generateDocumentHash(documentData.content);
    const contentSignature = generateContentSignature(contentHash);
    const result = await db
      .insert(documents)
      .values({
        caseId: documentData.caseId,
        transcriptSnapshotId: documentData.transcriptSnapshotId ?? null,
        type: documentData.type,
        content: documentData.content,
        contentHash,
        contentSignature,
        version: documentData.version,
        versionType: documentData.versionType,
        createdBy: documentData.createdBy,
        isActive: documentData.isActive,
        parentVersionId: documentData.parentVersionId ?? null,
        verificationWarnings: documentData.verificationWarnings ?? null,
        isShortRecording: documentData.isShortRecording ?? false,
        meetingSessionId: documentData.meetingSessionId ?? null,
      })
      .returning();
    return result[0];
  }

  async createDocumentVersion(
    parentDocumentId: string,
    newContent: string,
    versionType: string,
    userId: string,
    options?: { approvalComment?: string; verificationWarnings?: VerificationWarning[] }
  ): Promise<Document | undefined> {
    const parentResult = await db
      .select()
      .from(documents)
      .where(eq(documents.id, parentDocumentId))
      .limit(1);
    const parent = parentResult[0];
    if (!parent) return undefined;

    const caseRecord = await this.getCase(parent.caseId, userId);
    if (!caseRecord) return undefined;

    if (caseRecord.litigationHold) {
      console.warn(`[LITIGATION-HOLD] Blocked document version creation on ${parentDocumentId}`);
      return undefined;
    }

    // Mark parent as inactive
    await db
      .update(documents)
      .set({ isActive: false })
      .where(eq(documents.id, parentDocumentId));

    // Create new version
    const newDoc = await this.createDocument({
      caseId: parent.caseId,
      meetingSessionId: parent.meetingSessionId ?? undefined,
      transcriptSnapshotId: parent.transcriptSnapshotId ?? undefined,
      type: parent.type as InsertDocument["type"],
      content: newContent,
      version: parent.version + 1,
      versionType: versionType as InsertDocument["versionType"],
      createdBy: userId,
      isActive: true,
      parentVersionId: parentDocumentId,
      verificationWarnings: options?.verificationWarnings ?? undefined,
      isShortRecording: parent.isShortRecording ?? false,
    });

    return newDoc;
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const result = await db.select().from(documents).where(eq(documents.id, id));
    return result[0];
  }

  async getDocumentsByCase(caseId: string, userId: string): Promise<Document[]> {
    const caseRecord = await db.select().from(cases).where(and(eq(cases.id, caseId), eq(cases.createdBy, userId)));
    if (!caseRecord[0]) return [];
    
    return await db
      .select()
      .from(documents)
      .where(eq(documents.caseId, caseId))
      .orderBy(desc(documents.createdAt));
  }

  async getDocumentsBySession(meetingSessionId: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.meetingSessionId, meetingSessionId))
      .orderBy(desc(documents.createdAt));
  }

  async getActiveDocumentsByCase(caseId: string, userId: string): Promise<Document[]> {
    const caseData = await this.getCase(caseId, userId);
    if (!caseData) return [];
    
    return await db
      .select()
      .from(documents)
      .where(and(
        eq(documents.caseId, caseId),
        eq(documents.isActive, true)
      ))
      .orderBy(desc(documents.createdAt));
  }

  async updateDocument(id: string, updates: Partial<Document>, userId: string): Promise<Document | undefined> {
    // L1: Block updates if case is under litigation hold
    const documentRecord = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    if (documentRecord[0]) {
      const caseRecord = await db.select().from(cases).where(eq(cases.id, documentRecord[0].caseId)).limit(1);
      if (caseRecord[0]?.litigationHold) {
        console.warn(`[LITIGATION-HOLD] Blocked document update on ${id} — case ${documentRecord[0].caseId} is under litigation hold`);
        return undefined;
      }
    }
    const document = await db.select().from(documents).where(eq(documents.id, id));
    if (!document[0]) return undefined;
    
    const caseRecord = await db.select().from(cases).where(and(eq(cases.id, document[0].caseId), eq(cases.createdBy, userId)));
    if (!caseRecord[0]) return undefined;
    
    // Regenerate hash if content was updated
    if (updates.content) {
      updates.contentHash = generateDocumentHash(updates.content);
    }
    
    const result = await db
      .update(documents)
      .set(updates)
      .where(eq(documents.id, id))
      .returning();
    return result[0];
  }

  async getDocumentByAcknowledgeToken(token: string): Promise<Document | undefined> {
    const result = await db
      .select()
      .from(documents)
      .where(eq(documents.acknowledgedToken, token))
      .limit(1);
    return result[0];
  }

  async recordDocumentAcknowledgement(id: string, acknowledgedAt: Date, acknowledgedByEmail: string, acknowledgedIp: string): Promise<void> {
    await db
      .update(documents)
      .set({ acknowledgedAt, acknowledgedByEmail, acknowledgedIp })
      .where(eq(documents.id, id));
  }

  async approveDocument(id: string, userId: string, comment?: string, reasoningGapsReviewed?: boolean): Promise<Document | undefined> {
    const document = await db.select().from(documents).where(eq(documents.id, id));
    if (!document[0]) return undefined;
    
    const caseRecord = await db.select().from(cases).where(and(eq(cases.id, document[0].caseId), eq(cases.createdBy, userId)));
    if (!caseRecord[0]) return undefined;
    
    const result = await db
      .update(documents)
      .set({
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
        approvalComment: comment ?? null,
        reasoningGapsReviewed: reasoningGapsReviewed ?? false,
        reasoningGapsReviewedAt: reasoningGapsReviewed ? new Date() : null,
      })
      .where(eq(documents.id, id))
      .returning();
    
    await this.createAuditLog({
      eventType: 'document_approved',
      userId,
      caseId: document[0].caseId,
      documentId: id,
      ipAddress: 'server-process',
      metadata: {
        documentType: document[0].type,
        comment: comment ?? null,
        reasoningGapsReviewed: reasoningGapsReviewed ?? false,
      },
    });
    
    return result[0];
  }

  async updateReasoningNote(id: string, note: string | null, userId: string): Promise<Document | undefined> {
    const document = await db.select().from(documents).where(eq(documents.id, id));
    if (!document[0]) return undefined;

    const caseRecord = await db.select().from(cases).where(and(eq(cases.id, document[0].caseId), eq(cases.createdBy, userId)));
    if (!caseRecord[0]) return undefined;

    const result = await db
      .update(documents)
      .set({ solicitorReasoningNote: note })
      .where(eq(documents.id, id))
      .returning();

    await this.createAuditLog({
      eventType: 'document_reasoning_note_updated',
      userId,
      caseId: document[0].caseId,
      documentId: id,
      ipAddress: 'server-process',
      metadata: { documentType: document[0].type, hasNote: note !== null && note.trim().length > 0 },
    });

    return result[0];
  }

  async resolveVerificationWarning(
    documentId: string,
    warningId: string,
    disposition: VerificationResolveDisposition,
    reason: string,
    userId: string,
  ): Promise<Document | undefined> {
    const document = await db.select().from(documents).where(eq(documents.id, documentId));
    if (!document[0]) return undefined;

    const caseRecord = await db
      .select()
      .from(cases)
      .where(and(eq(cases.id, document[0].caseId), eq(cases.createdBy, userId)));
    if (!caseRecord[0]) return undefined;
    if (caseRecord[0].litigationHold) return undefined;
    if (document[0].status === "approved") return undefined;

    const warnings = coerceVerificationWarnings(document[0].verificationWarnings);
    const idx = warnings.findIndex((w) => w.id === warningId);
    if (idx < 0) return undefined;

    warnings[idx] = {
      ...warnings[idx],
      resolution: {
        disposition,
        reason: reason.trim(),
        resolvedAt: new Date().toISOString(),
        resolvedBy: userId,
      },
    };

    const result = await db
      .update(documents)
      .set({ verificationWarnings: warnings })
      .where(eq(documents.id, documentId))
      .returning();

    await this.createAuditLog({
      eventType: "document_verification_warning_resolved",
      userId,
      caseId: document[0].caseId,
      documentId,
      ipAddress: "server-process",
      metadata: {
        action: "resolve_verification_warning",
        warningId,
        disposition,
        category: warnings[idx].category,
        documentQuote: warnings[idx].documentQuote.slice(0, 500),
      },
    });

    return result[0];
  }

  async unlockDocument(id: string, userId: string): Promise<Document | undefined> {
    const document = await db.select().from(documents).where(eq(documents.id, id));
    if (!document[0]) return undefined;
    
    const caseRecord = await db.select().from(cases).where(and(eq(cases.id, document[0].caseId), eq(cases.createdBy, userId)));
    if (!caseRecord[0]) return undefined;
    
    const result = await db
      .update(documents)
      .set({
        status: 'draft',
        approvedBy: null,
        approvedAt: null,
        approvalComment: null,
      })
      .where(eq(documents.id, id))
      .returning();
    
    await this.createAuditLog({
      eventType: 'document_unlocked',
      userId,
      caseId: document[0].caseId,
      documentId: id,
      ipAddress: 'server-process',
      metadata: {
        documentType: document[0].type,
      },
    });
    
    return result[0];
  }

  // Client Version Tracking methods
  async createClientVersionTracking(trackingData: InsertClientVersionTracking): Promise<ClientVersionTracking> {
    const result = await db
      .insert(clientVersionTracking)
      .values({
        documentId: trackingData.documentId,
        sentToClient: trackingData.sentToClient ?? false,
        sentAt: trackingData.sentAt ?? null,
        sentBy: trackingData.sentBy ?? null,
        sentMethod: trackingData.sentMethod ?? null,
        amendmentReason: trackingData.amendmentReason ?? null,
        versionChangeWarned: trackingData.versionChangeWarned ?? false,
      })
      .returning();
    return result[0];
  }

  async getClientVersionTrackingByDocument(documentId: string): Promise<ClientVersionTracking[]> {
    return await db
      .select()
      .from(clientVersionTracking)
      .where(eq(clientVersionTracking.documentId, documentId))
      .orderBy(desc(clientVersionTracking.sentAt));
  }

  async getClientVersionTrackingByCase(caseId: string, userId: string): Promise<Array<ClientVersionTracking & { document: Document }>> {
    const caseRecord = await db.select().from(cases).where(and(eq(cases.id, caseId), eq(cases.createdBy, userId)));
    if (!caseRecord[0]) return [];
    
    const caseDocuments = await db.select().from(documents).where(eq(documents.caseId, caseId));
    const documentIds = caseDocuments.map(d => d.id);
    
    if (documentIds.length === 0) return [];
    
    const trackingRecords = await db
      .select()
      .from(clientVersionTracking)
      .where(eq(clientVersionTracking.sentToClient, true))
      .orderBy(desc(clientVersionTracking.sentAt));
    
    const relevantRecords = trackingRecords.filter(r => documentIds.includes(r.documentId));
    
    return relevantRecords.map(record => {
      const document = caseDocuments.find(d => d.id === record.documentId)!;
      return { ...record, document };
    }).filter(r => r.document);
  }

  async getLatestClientVersion(documentId: string): Promise<ClientVersionTracking | undefined> {
    const result = await db
      .select()
      .from(clientVersionTracking)
      .where(and(
        eq(clientVersionTracking.documentId, documentId),
        eq(clientVersionTracking.sentToClient, true)
      ))
      .orderBy(desc(clientVersionTracking.sentAt))
      .limit(1);
    return result[0];
  }

  async createAuditLog(auditData: InsertAuditTrail): Promise<AuditTrail> {
    const signingKey = getAuditSigningKey();
    const payloadVersion = AUDIT_PAYLOAD_V2;
    const auditTimestamp = new Date().toISOString();

    const insertWithChain = async (tx: typeof db): Promise<AuditTrail> => {
      if (auditData.caseId) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${auditData.caseId}))`);
      }

      const query = auditData.caseId
        ? tx
            .select()
            .from(auditTrail)
            .where(eq(auditTrail.caseId, auditData.caseId))
            .orderBy(desc(auditTrail.timestamp))
            .limit(1)
        : tx.select().from(auditTrail).orderBy(desc(auditTrail.timestamp)).limit(1);
      const prev = await query;
      const previousEntry = prev[0] ?? null;

      const entryContent = buildAuditEntryContent(payloadVersion, {
        eventType: auditData.eventType,
        userId: auditData.userId,
        caseId: auditData.caseId ?? null,
        documentId: auditData.documentId ?? null,
        transcriptId: auditData.transcriptId ?? null,
        audioRecordingId: auditData.audioRecordingId ?? null,
        metadata: (auditData.metadata ?? {}) as Record<string, unknown>,
        severity: auditData.severity ?? "info",
        timestamp: auditTimestamp,
      });

      const previousChainHash = previousEntry?.chainHash ?? "GENESIS";
      const chainHash = computeAuditChainHash(entryContent, previousChainHash, signingKey);

      const result = await tx
        .insert(auditTrail)
        .values({
          eventType: auditData.eventType,
          userId: auditData.userId,
          caseId: auditData.caseId ?? null,
          documentId: auditData.documentId ?? null,
          transcriptId: auditData.transcriptId ?? null,
          audioRecordingId: auditData.audioRecordingId ?? null,
          ipAddress: auditData.ipAddress ?? null,
          userAgent: auditData.userAgent ?? null,
          metadata: auditData.metadata ?? {},
          severity: auditData.severity ?? "info",
          previousEntryId: previousEntry?.id ?? null,
          chainHash,
          payloadVersion,
        })
        .returning();
      return result[0];
    };

    if (auditData.caseId) {
      return db.transaction(insertWithChain);
    }
    return insertWithChain(db);
  }

  async getAuditLogs(filters?: {
    userId?: string;
    caseId?: string;
    documentId?: string;
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditTrail[]> {
    const conditions = [];

    if (filters?.userId) {
      conditions.push(eq(auditTrail.userId, filters.userId));
    }
    if (filters?.caseId) {
      conditions.push(eq(auditTrail.caseId, filters.caseId));
    }
    if (filters?.documentId) {
      conditions.push(eq(auditTrail.documentId, filters.documentId));
    }
    if (filters?.eventType) {
      conditions.push(eq(auditTrail.eventType, filters.eventType));
    }
    if (filters?.startDate) {
      conditions.push(gte(auditTrail.timestamp, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(auditTrail.timestamp, filters.endDate));
    }

    let query = db.select().from(auditTrail);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    query = query.orderBy(desc(auditTrail.timestamp)) as any;

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }

    return await query;
  }

  async getAuditLogsByCase(caseId: string, limit?: number): Promise<AuditTrail[]> {
    return this.getAuditLogs({ caseId, limit });
  }

  async getAllUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
  }

  async getAllCases(): Promise<Case[]> {
    return await db
      .select()
      .from(cases)
      .orderBy(desc(cases.createdAt));
  }

  async getAdminStatistics(): Promise<AdminStatistics> {
    const allCases = await db.select().from(cases);
    const allTranscripts = await db.select().from(transcripts);
    const allDocuments = await db.select().from(documents);
    const totalUsersResult = await db.select({ count: count() }).from(users);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let totalTranscriptionCosts = 0;
    let totalDocumentCosts = 0;
    let successfulProcessing = 0;
    let failedProcessing = 0;
    let totalProcessingTimeMinutes = 0;
    let processedCasesWithTime = 0;

    allCases.forEach(c => {
      const metadata = c.aiProcessingMetadata as any || {};
      
      if (metadata.transcriptionCost) {
        totalTranscriptionCosts += metadata.transcriptionCost;
      }
      if (metadata.documentGenerationCost) {
        totalDocumentCosts += metadata.documentGenerationCost;
      }

      if (c.status === 'completed' || c.status === 'review_required') {
        successfulProcessing++;
      } else if (metadata.error || metadata.retryCount > 0) {
        failedProcessing++;
      }

      if (metadata.processingStartTime && metadata.processingEndTime) {
        const startTime = new Date(metadata.processingStartTime).getTime();
        const endTime = new Date(metadata.processingEndTime).getTime();
        totalProcessingTimeMinutes += (endTime - startTime) / (1000 * 60);
        processedCasesWithTime++;
      }
    });

    const casesLast30Days = allCases.filter(c => c.createdAt >= thirtyDaysAgo).length;
    const casesLast7Days = allCases.filter(c => c.createdAt >= sevenDaysAgo).length;

    return {
      totalCases: allCases.length,
      totalUsers: totalUsersResult[0].count,
      totalTranscriptions: allTranscripts.length,
      totalDocumentsGenerated: allDocuments.length,
      totalCostsUSD: totalTranscriptionCosts + totalDocumentCosts,
      transcriptionCostsUSD: totalTranscriptionCosts,
      documentGenerationCostsUSD: totalDocumentCosts,
      successfulProcessing,
      failedProcessing,
      successRate: allCases.length > 0 ? (successfulProcessing / allCases.length) * 100 : 0,
      averageProcessingTimeMinutes: processedCasesWithTime > 0 ? totalProcessingTimeMinutes / processedCasesWithTime : 0,
      casesLast30Days,
      casesLast7Days,
    };
  }

  async getUserStatistics(): Promise<UserStatistics[]> {
    const allUsers = await db.select().from(users);
    const allCases = await db.select().from(cases);
    
    const userStats: UserStatistics[] = [];

    for (const user of allUsers) {
      const userCases = allCases.filter(c => c.createdBy === user.id);
      const successfulCases = userCases.filter(c => c.status === 'completed' || c.status === 'review_required');
      const failedCases = userCases.filter(c => {
        const metadata = c.aiProcessingMetadata as any || {};
        return metadata.error || metadata.retryCount > 0;
      });

      let totalCosts = 0;
      userCases.forEach(c => {
        const metadata = c.aiProcessingMetadata as any || {};
        if (metadata.transcriptionCost) {
          totalCosts += metadata.transcriptionCost;
        }
        if (metadata.documentGenerationCost) {
          totalCosts += metadata.documentGenerationCost;
        }
      });

      const userAuditLogs = await db
        .select()
        .from(auditTrail)
        .where(eq(auditTrail.userId, user.id))
        .orderBy(desc(auditTrail.timestamp))
        .limit(1);

      const lastActivity = userAuditLogs.length > 0 ? userAuditLogs[0].timestamp : null;

      userStats.push({
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        totalCases: userCases.length,
        successfulCases: successfulCases.length,
        failedCases: failedCases.length,
        totalCostsUSD: totalCosts,
        lastActivity,
        joinedDate: user.createdAt || new Date(),
      });
    }

    return userStats.sort((a, b) => b.totalCases - a.totalCases);
  }
  
  async getFirmProfile(firmId?: string): Promise<FirmProfile | undefined> {
    if (firmId) {
      const result = await db.select().from(firmProfile).where(eq(firmProfile.id, firmId)).limit(1);
      return result[0];
    }
    const result = await db.select().from(firmProfile).limit(1);
    return result[0];
  }

  async setFirmComplianceCode(firmId: string, codeHash: string, userId: string): Promise<void> {
    await db
      .update(firmProfile)
      .set({
        complianceCodeHash: codeHash,
        complianceCodeSetAt: new Date(),
        complianceCodeSetBy: userId,
      })
      .where(eq(firmProfile.id, firmId));
  }

  async verifyFirmComplianceCode(firmId: string, code: string): Promise<boolean> {
    const result = await db
      .select({ complianceCodeHash: firmProfile.complianceCodeHash })
      .from(firmProfile)
      .where(eq(firmProfile.id, firmId))
      .limit(1);
    if (!result[0]?.complianceCodeHash) return false;
    const bcrypt = await import("bcrypt");
    return bcrypt.compare(code, result[0].complianceCodeHash);
  }

  async upsertFirmProfile(profileData: InsertFirmProfile): Promise<FirmProfile> {
    const existing = await this.getFirmProfile();
    if (existing) {
      const updated = await db.update(firmProfile).set({ ...profileData, updatedAt: new Date() }).where(eq(firmProfile.id, existing.id)).returning();
      return updated[0];
    } else {
      const inserted = await db.insert(firmProfile).values({ ...profileData, updatedAt: new Date() }).returning();
      return inserted[0];
    }
  }

  async patchFirmProfileLogoUrl(logoUrl: string, updatedBy: string): Promise<FirmProfile> {
    const existing = await this.getFirmProfile();
    if (existing) {
      const updated = await db
        .update(firmProfile)
        .set({ logoUrl, updatedBy, updatedAt: new Date() })
        .where(eq(firmProfile.id, existing.id))
        .returning();
      return updated[0];
    } else {
      // No profile yet — create a minimal one with just the logo URL
      const inserted = await db
        .insert(firmProfile)
        .values({ firmName: '', logoUrl, updatedBy, updatedAt: new Date() })
        .returning();
      return inserted[0];
    }
  }

  async getFirmRiskDigest(): Promise<FirmRiskDigest> {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. Overdue undertakings
    const overdueRows = await db
      .select({ id: undertakings.id, wording: undertakings.wording, deadline: undertakings.deadline, caseTitle: cases.title })
      .from(undertakings).leftJoin(cases, eq(undertakings.caseId, cases.id))
      .where(and(eq(undertakings.status, 'outstanding'), lte(undertakings.deadline, now)));

    const overdueUndertakings = overdueRows.filter(r => r.deadline).map(r => ({
      id: r.id, wording: r.wording ?? '', caseTitle: r.caseTitle ?? 'Unknown matter',
      deadline: r.deadline!, daysOverdue: Math.floor((now.getTime() - r.deadline!.getTime()) / 86400000),
    }));

    // 2. Upcoming undertakings (next 7 days)
    const upcomingRows = await db
      .select({ id: undertakings.id, wording: undertakings.wording, deadline: undertakings.deadline, caseTitle: cases.title })
      .from(undertakings).leftJoin(cases, eq(undertakings.caseId, cases.id))
      .where(and(eq(undertakings.status, 'outstanding'), gte(undertakings.deadline, now), lte(undertakings.deadline, sevenDaysLater)));

    const upcomingUndertakings = upcomingRows.filter(r => r.deadline).map(r => ({
      id: r.id, wording: r.wording ?? '', caseTitle: r.caseTitle ?? 'Unknown matter',
      deadline: r.deadline!, daysUntil: Math.ceil((r.deadline!.getTime() - now.getTime()) / 86400000),
    }));

    // 3. High/medium AML risk cases with no decision record in last 30 days
    const allHighRisk = await db
      .select({ id: cases.id, title: cases.title, riskLevel: cases.riskLevel, clientName: clients.name })
      .from(cases).leftJoin(clients, eq(cases.clientId, clients.id))
      .where(sql`${cases.riskLevel} IN ('high', 'medium')`);

    const recentDecisions = await db
      .select({ caseId: amlDecisionRecords.caseId })
      .from(amlDecisionRecords)
      .where(gte(amlDecisionRecords.createdAt, thirtyDaysAgo));
    const caseIdsWithRecentDecision = new Set(recentDecisions.map(r => r.caseId));

    const highAmlCases = allHighRisk.filter(c => !caseIdsWithRecentDecision.has(c.id)).map(c => ({
      id: c.id, title: c.title, riskLevel: c.riskLevel ?? 'medium', clientName: c.clientName ?? null,
    }));

    // 4. Unacknowledged client care letters
    const sentLetterCases = await db
      .select({ id: cases.id, title: cases.title, clientCareLetterSentAt: cases.clientCareLetterSentAt, clientName: clients.name })
      .from(cases).leftJoin(clients, eq(cases.clientId, clients.id))
      .where(sql`${cases.clientCareLetterSentAt} IS NOT NULL`);

    const acknowledgedDocs = await db
      .select({ caseId: documents.caseId })
      .from(documents)
      .where(and(eq(documents.type, 'client_care_letter'), sql`${documents.acknowledgedAt} IS NOT NULL`));
    const acknowledgedCaseIds = new Set(acknowledgedDocs.map(d => d.caseId));

    const unacknowledgedLetters = sentLetterCases.filter(c => !acknowledgedCaseIds.has(c.id)).map(c => ({
      caseId: c.id, caseTitle: c.title, clientName: c.clientName ?? null, sentAt: c.clientCareLetterSentAt!,
    }));

    // 5. Completed sessions missing attendance notes
    const completedSessions = await db
      .select({ id: meetingSessions.id, caseId: meetingSessions.caseId, caseTitle: cases.title })
      .from(meetingSessions).leftJoin(cases, eq(meetingSessions.caseId, cases.id))
      .where(eq(meetingSessions.status, 'completed'));

    const sessionIds = completedSessions.map(s => s.id);
    const documentedSessionIds = sessionIds.length > 0 ? new Set(
      (await db.select({ sid: documents.meetingSessionId }).from(documents)
        .where(and(eq(documents.type, 'attendance_note'), eq(documents.isActive, true), inArray(documents.meetingSessionId as any, sessionIds)))
      ).map(d => d.sid)
    ) : new Set();

    // Group by case
    const caseSessionMap = new Map<string, { caseTitle: string; total: number; documented: number }>();
    for (const s of completedSessions) {
      if (!s.caseId) continue;
      const entry = caseSessionMap.get(s.caseId) ?? { caseTitle: s.caseTitle ?? 'Unknown matter', total: 0, documented: 0 };
      entry.total++;
      if (documentedSessionIds.has(s.id)) entry.documented++;
      caseSessionMap.set(s.caseId, entry);
    }
    const missingSessions = Array.from(caseSessionMap.entries())
      .filter(([, v]) => v.documented < v.total)
      .map(([caseId, v]) => ({ caseId, caseTitle: v.caseTitle, completedSessions: v.total, documentedSessions: v.documented }));

    const totalIssues = overdueUndertakings.length + highAmlCases.length + unacknowledgedLetters.length + missingSessions.length;

    return { generatedAt: now, overdueUndertakings, upcomingUndertakings, highAmlCases, unacknowledgedLetters, missingSessions, totalIssues };
  }

  async getComplianceScore(): Promise<ComplianceScore> {
    const now = new Date();

    // 1. Consent compliance (25 pts): audio cases with valid consent / total audio cases
    const audioCases = await db.select({ id: cases.id }).from(cases).where(eq(cases.sourceType, 'audio'));
    const consentedCaseIds = audioCases.length > 0 ? new Set(
      (await db.select({ caseId: consentLogs.caseId }).from(consentLogs).where(and(eq(consentLogs.consentGiven, true), inArray(consentLogs.caseId, audioCases.map(c => c.id))))).map(r => r.caseId)
    ) : new Set();
    const consentPct = audioCases.length === 0 ? 1 : consentedCaseIds.size / audioCases.length;
    const consentScore = Math.round(consentPct * 25);

    // 2. AML completion (25 pts): high/medium risk cases with AML decision record / total high/medium risk
    const amlCases = await db.select({ id: cases.id }).from(cases).where(sql`${cases.riskLevel} IN ('high', 'medium')`);
    const amlDecided = amlCases.length > 0 ? new Set(
      (await db.select({ caseId: amlDecisionRecords.caseId }).from(amlDecisionRecords).where(inArray(amlDecisionRecords.caseId, amlCases.map(c => c.id)))).map(r => r.caseId)
    ) : new Set();
    const amlPct = amlCases.length === 0 ? 1 : amlDecided.size / amlCases.length;
    const amlScore = Math.round(amlPct * 25);

    // 3. Undertakings on time (20 pts): discharged by deadline / total discharged
    const dischargedRows = await db.select({ dischargedAt: undertakings.dischargedAt, deadline: undertakings.deadline }).from(undertakings).where(eq(undertakings.status, 'discharged'));
    const onTime = dischargedRows.filter(r => r.dischargedAt && r.deadline && r.dischargedAt <= r.deadline).length;
    const undertakingsPct = dischargedRows.length === 0 ? 1 : onTime / dischargedRows.length;
    const undertakingsScore = Math.round(undertakingsPct * 20);

    // 4. Client care acknowledgement (15 pts): acknowledged CCLs / sent CCLs
    const sentCCL = await db.select({ id: cases.id }).from(cases).where(sql`${cases.clientCareLetterSentAt} IS NOT NULL`);
    const ackCCL = sentCCL.length > 0 ? (await db.select({ caseId: documents.caseId }).from(documents).where(and(eq(documents.type, 'client_care_letter'), sql`${documents.acknowledgedAt} IS NOT NULL`, inArray(documents.caseId, sentCCL.map(c => c.id))))).length : 0;
    const cclPct = sentCCL.length === 0 ? 1 : ackCCL / sentCCL.length;
    const cclScore = Math.round(cclPct * 15);

    // 5. Documentation completion (15 pts): completed sessions with attendance note / total completed sessions
    const completedSess = await db.select({ id: meetingSessions.id }).from(meetingSessions).where(eq(meetingSessions.status, 'completed'));
    const documentedCount = completedSess.length > 0 ? (await db.select({ sid: documents.meetingSessionId }).from(documents).where(and(eq(documents.type, 'attendance_note'), eq(documents.isActive, true), inArray(documents.meetingSessionId as any, completedSess.map(s => s.id))))).length : 0;
    const docPct = completedSess.length === 0 ? 1 : documentedCount / completedSess.length;
    const docScore = Math.round(docPct * 15);

    const overall = consentScore + amlScore + undertakingsScore + cclScore + docScore;
    const grade: ComplianceScore['grade'] = overall >= 90 ? 'A' : overall >= 75 ? 'B' : overall >= 60 ? 'C' : overall >= 45 ? 'D' : 'F';

    return {
      overall, grade,
      breakdown: {
        consentCompliance: { score: consentScore, max: 25, label: 'Consent Compliance', detail: `${consentedCaseIds.size} of ${audioCases.length} audio matters have valid consent` },
        amlCompletion: { score: amlScore, max: 25, label: 'AML Completion', detail: `${amlDecided.size} of ${amlCases.length} high/medium risk matters have an AML decision` },
        undertakingsOnTime: { score: undertakingsScore, max: 20, label: 'Undertakings On Time', detail: `${onTime} of ${dischargedRows.length} discharged undertakings completed by deadline` },
        clientCareAcknowledgement: { score: cclScore, max: 15, label: 'Client Care Acknowledged', detail: `${ackCCL} of ${sentCCL.length} client care letters acknowledged` },
        documentationCompletion: { score: docScore, max: 15, label: 'Documentation Complete', detail: `${documentedCount} of ${completedSess.length} completed sessions have an attendance note` },
      },
      lastUpdated: now,
    };
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    const result = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
    return result[0];
  }
  
  async updateUserPreferences(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences> {
    const existing = await this.getUserPreferences(userId);
    
    if (existing) {
      const updated = await db
        .update(userPreferences)
        .set(updates)
        .where(eq(userPreferences.userId, userId))
        .returning();
      return updated[0];
    } else {
      const inserted = await db
        .insert(userPreferences)
        .values({
          userId,
          dismissedReviewBanner: false,
          completedOnboarding: false,
          completedIntegrationsOnboarding: false,
          ...updates,
        })
        .returning();
      return inserted[0];
    }
  }
  
  async searchCases(query: string, userId: string): Promise<Case[]> {
    // Normalize query: collapse whitespace, trim, lowercase, remove accents
    const originalQuery = removeAccents(query.toLowerCase().trim());
    const normalizedQuery = originalQuery.replace(/\s+/g, '');
    const likeQuery = `%${originalQuery}%`;
    
    // Get all cases for the user
    const userCases = await db
      .select()
      .from(cases)
      .where(eq(cases.createdBy, userId))
      .orderBy(desc(cases.createdAt));
    
    // Find cases with matching transcripts or documents using fuzzy search
    const casesWithTranscripts = await db
      .select({ caseId: transcripts.caseId })
      .from(transcripts)
      .innerJoin(cases, eq(transcripts.caseId, cases.id))
      .where(
        and(
          eq(cases.createdBy, userId),
          sql`LOWER(${transcripts.content}) LIKE ${likeQuery}`
        )
      );
    
    const casesWithDocuments = await db
      .select({ caseId: documents.caseId })
      .from(documents)
      .innerJoin(cases, eq(documents.caseId, cases.id))
      .where(
        and(
          eq(cases.createdBy, userId),
          sql`LOWER(${documents.content}) LIKE ${likeQuery}`
        )
      );
    
    // Create a set of case IDs that have matching content
    const matchingCaseIds = new Set([
      ...casesWithTranscripts.map(c => c.caseId),
      ...casesWithDocuments.map(c => c.caseId)
    ]);

    // Phonetic pass: for queries that look like names (short alphabetic words), scan
    // transcript and document content for words that sound alike but are spelled differently
    const isNameLikeQuery = originalQuery.split(/\s+/).every(w => /^[a-z]+$/i.test(w));
    if (isNameLikeQuery) {
      const allTranscriptContent = await db
        .select({ caseId: transcripts.caseId, content: transcripts.content })
        .from(transcripts)
        .innerJoin(cases, eq(transcripts.caseId, cases.id))
        .where(eq(cases.createdBy, userId));

      for (const t of allTranscriptContent) {
        if (!matchingCaseIds.has(t.caseId) && t.content) {
          if (phoneticMatchInText(originalQuery, t.content.toLowerCase())) {
            matchingCaseIds.add(t.caseId);
          }
        }
      }

      const allDocumentContent = await db
        .select({ caseId: documents.caseId, content: documents.content })
        .from(documents)
        .innerJoin(cases, eq(documents.caseId, cases.id))
        .where(eq(cases.createdBy, userId));

      for (const d of allDocumentContent) {
        if (!matchingCaseIds.has(d.caseId) && d.content) {
          if (phoneticMatchInText(originalQuery, d.content.toLowerCase())) {
            matchingCaseIds.add(d.caseId);
          }
        }
      }
    }
    
    // Calculate similarity scores for each case using tiered priority matching
    // Priority tiers ensure exact matches always rank above fuzzy matches
    const scoredCases = userCases.map(c => {
      // Normalize case fields: lowercase and remove accents
      const titleLower = removeAccents(c.title.toLowerCase());
      const clientLower = removeAccents(c.clientName.toLowerCase());
      const matterLower = removeAccents(c.matterReference?.toLowerCase() || '');
      const notesLower = removeAccents(c.textNotes?.toLowerCase() || '');
      
      // Further normalize for spacing comparison (remove spaces)
      const titleNormalized = titleLower.replace(/\s+/g, '');
      const clientNormalized = clientLower.replace(/\s+/g, '');
      
      // Tier 1: Exact substring matches (score 1000+)
      let tier1Score = 0;
      if (titleLower.includes(originalQuery)) tier1Score = 1000;
      else if (clientLower.includes(originalQuery)) tier1Score = 900;
      else if (matterLower.includes(originalQuery)) tier1Score = 800;
      else if (notesLower.includes(originalQuery)) tier1Score = 700;
      
      // Tier 2: Normalized matches - handles spacing differences (score 500+)
      let tier2Score = 0;
      if (tier1Score === 0) {
        if (titleNormalized.includes(normalizedQuery)) tier2Score = 600;
        else if (clientNormalized.includes(normalizedQuery)) tier2Score = 550;
      }
      
      // Tier 3: Content matches from transcripts/documents (score 400+)
      let tier3Score = 0;
      if (tier1Score === 0 && tier2Score === 0) {
        if (matchingCaseIds.has(c.id)) tier3Score = 400;
      }
      
      // Tier 4: Fuzzy trigram similarity (score 200+)
      let tier4Score = 0;
      if (tier1Score === 0 && tier2Score === 0 && tier3Score === 0) {
        const titleSimilarity = trigramSimilarity(originalQuery, titleLower);
        const clientSimilarity = trigramSimilarity(originalQuery, clientLower);
        const maxSimilarity = Math.max(titleSimilarity, clientSimilarity);
        if (maxSimilarity > 0.3) {
          tier4Score = 200 + (maxSimilarity * 100);
        }
      }
      
      // Tier 5: Phonetic matching for names (score 100+)
      let tier5Score = 0;
      if (tier1Score === 0 && tier2Score === 0 && tier3Score === 0 && tier4Score === 0) {
        if (soundsLike(originalQuery, clientLower)) tier5Score = 100;
      }
      
      // Final score is the highest tier that matched (ensures priority ordering)
      const score = tier1Score || tier2Score || tier3Score || tier4Score || tier5Score;
      
      // Add bonus points for additional matches within the same tier
      let bonus = 0;
      if (tier1Score > 0) {
        if (clientLower.includes(originalQuery)) bonus += 50;
        if (matterLower.includes(originalQuery)) bonus += 30;
        if (matchingCaseIds.has(c.id)) bonus += 20;
      }
      
      return { case: c, score: score + bonus };
    });
    
    // Filter cases with any match and sort by score
    const matchedCases = scoredCases
      .filter(sc => sc.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(sc => sc.case);
    
    return matchedCases;
  }
  
  async searchCasesWithMatches(query: string, userId: string, options?: {
    documentType?: 'transcript' | 'attendance_note' | 'summary' | 'all';
    dateRange?: 'today' | 'week' | 'month' | 'year' | 'all';
  }): Promise<SearchResultWithMatches[]> {
    const originalQuery = removeAccents(query.toLowerCase().trim());
    const likeQuery = `%${originalQuery}%`;
    const documentTypeFilter = options?.documentType || 'all';
    
    // Expand query with synonyms
    const expandedTerms = expandSearchWithSynonyms(originalQuery);
    
    // Expand with number-word variants (e.g., "5000" -> "five thousand", "forty-seven" -> "47")
    const numberVariants = getNumberVariants(originalQuery);
    for (const variant of numberVariants) {
      if (!expandedTerms.includes(variant)) {
        expandedTerms.push(variant);
      }
    }
    
    // Get all user cases
    const userCases = await db
      .select()
      .from(cases)
      .where(eq(cases.createdBy, userId))
      .orderBy(desc(cases.createdAt));
    
    const results: SearchResultWithMatches[] = [];
    
    for (const caseItem of userCases) {
      const matches: SearchMatch[] = [];
      let score = 0;
      
      // Check case fields
      const caseFields = [
        { name: 'title', value: caseItem.title },
        { name: 'clientName', value: caseItem.clientName },
        { name: 'matterReference', value: caseItem.matterReference },
        { name: 'textNotes', value: caseItem.textNotes },
      ];
      
      for (const field of caseFields) {
        if (!field.value) continue;
        const fieldLower = removeAccents(field.value.toLowerCase());
        
        let foundInField = false;
        for (const term of expandedTerms) {
          const pos = fieldLower.indexOf(term);
          if (pos !== -1) {
            const start = Math.max(0, pos - 50);
            const end = Math.min(field.value.length, pos + term.length + 50);
            const snippet = (start > 0 ? '...' : '') + 
              field.value.substring(start, end) + 
              (end < field.value.length ? '...' : '');
            
            matches.push({
              documentType: 'case_field',
              fieldName: field.name,
              snippet,
              matchPosition: pos,
            });
            score += 100;
            foundInField = true;
            break;
          }
        }

        // Phonetic fallback for case fields (catches name misspellings in client name / title)
        if (!foundInField) {
          const phoneticHit = phoneticMatchInText(originalQuery, fieldLower);
          if (phoneticHit) {
            const { pos } = phoneticHit;
            const start = Math.max(0, pos - 50);
            const end = Math.min(field.value.length, pos + 50);
            const snippet = (start > 0 ? '...' : '') +
              field.value.substring(start, end) +
              (end < field.value.length ? '...' : '');
            matches.push({
              documentType: 'case_field',
              fieldName: field.name,
              snippet,
              matchPosition: pos,
            });
            score += 50; // Lower than exact (100) but still meaningful for direct case fields
          }
        }
      }
      
      // Check transcripts - search utterances for timestamp-level matches
      if (documentTypeFilter === 'all' || documentTypeFilter === 'transcript') {
        const caseTranscripts = await db
          .select()
          .from(transcripts)
          .where(eq(transcripts.caseId, caseItem.id));
        
        for (const transcript of caseTranscripts) {
          // First, try to search through utterances for timestamp-level matches
          if (transcript.utterances && Array.isArray(transcript.utterances)) {
            const utterances = transcript.utterances as Array<{
              speaker: string;
              text: string;
              start: number;
              end: number;
            }>;
            
            let foundInUtterances = false;
            for (const utterance of utterances) {
              if (!utterance.text) continue;
              const textLower = removeAccents(utterance.text.toLowerCase());
              
              for (const term of expandedTerms) {
                const pos = textLower.indexOf(term);
                if (pos !== -1) {
                  // Found match in utterance - include timestamp
                  const start = Math.max(0, pos - 30);
                  const end = Math.min(utterance.text.length, pos + term.length + 30);
                  const snippet = (start > 0 ? '...' : '') + 
                    utterance.text.substring(start, end) + 
                    (end < utterance.text.length ? '...' : '');
                  
                  matches.push({
                    documentType: 'transcript',
                    documentId: transcript.id,
                    snippet,
                    matchPosition: pos,
                    createdAt: transcript.createdAt,
                    timestampMs: utterance.start,
                    speaker: utterance.speaker,
                  });
                  score += 80;
                  foundInUtterances = true;
                  break; // Only one match per utterance
                }
              }
              // Limit to first 3 utterance matches per transcript
              if (matches.filter(m => m.documentId === transcript.id && m.timestampMs !== undefined).length >= 3) {
                break;
              }
            }
            
            // Phonetic fallback over utterances (catches misspelled names like Paterson→Patterson)
            if (!foundInUtterances) {
              for (const utterance of utterances) {
                if (!utterance.text) continue;
                const textLower = removeAccents(utterance.text.toLowerCase());
                const phoneticHit = phoneticMatchInText(originalQuery, textLower);
                if (phoneticHit) {
                  const { pos } = phoneticHit;
                  const start = Math.max(0, pos - 30);
                  const end = Math.min(utterance.text.length, pos + 30);
                  const snippet = (start > 0 ? '...' : '') +
                    utterance.text.substring(start, end) +
                    (end < utterance.text.length ? '...' : '');
                  matches.push({
                    documentType: 'transcript',
                    documentId: transcript.id,
                    snippet,
                    matchPosition: pos,
                    createdAt: transcript.createdAt,
                    timestampMs: utterance.start,
                    speaker: utterance.speaker,
                  });
                  score += 40; // Lower than exact (80) to rank below exact matches
                  foundInUtterances = true;
                  break;
                }
                if (matches.filter(m => m.documentId === transcript.id && m.timestampMs !== undefined).length >= 3) break;
              }
            }

            if (foundInUtterances) continue; // Skip fallback content search
          }
          
          // Fallback: search plain content if no utterances or no match found
          if (!transcript.content) continue;
          const contentLower = removeAccents(transcript.content.toLowerCase());
          
          let foundInContent = false;
          for (const term of expandedTerms) {
            const pos = contentLower.indexOf(term);
            if (pos !== -1) {
              const start = Math.max(0, pos - 50);
              const end = Math.min(transcript.content.length, pos + term.length + 50);
              const snippet = (start > 0 ? '...' : '') + 
                transcript.content.substring(start, end) + 
                (end < transcript.content.length ? '...' : '');
              
              matches.push({
                documentType: 'transcript',
                documentId: transcript.id,
                snippet,
                matchPosition: pos,
                createdAt: transcript.createdAt,
              });
              score += 80;
              foundInContent = true;
              break;
            }
          }

          // Phonetic fallback on plain content
          if (!foundInContent) {
            const phoneticHit = phoneticMatchInText(originalQuery, contentLower);
            if (phoneticHit) {
              const { pos } = phoneticHit;
              const start = Math.max(0, pos - 50);
              const end = Math.min(transcript.content.length, pos + 50);
              const snippet = (start > 0 ? '...' : '') +
                transcript.content.substring(start, end) +
                (end < transcript.content.length ? '...' : '');
              matches.push({
                documentType: 'transcript',
                documentId: transcript.id,
                snippet,
                matchPosition: pos,
                createdAt: transcript.createdAt,
              });
              score += 40;
            }
          }
        }
      }
      
      // Check documents (attendance notes and summaries)
      if (documentTypeFilter === 'all' || documentTypeFilter === 'attendance_note' || documentTypeFilter === 'summary') {
        const docTypeFilter = documentTypeFilter === 'all' 
          ? undefined 
          : documentTypeFilter;
        
        let caseDocumentsQuery = db
          .select()
          .from(documents)
          .where(eq(documents.caseId, caseItem.id));
        
        const caseDocuments = await caseDocumentsQuery;
        
        for (const doc of caseDocuments) {
          if (docTypeFilter && doc.type !== docTypeFilter) continue;
          if (!doc.content) continue;
          
          const contentLower = removeAccents(doc.content.toLowerCase());
          
          let foundInDoc = false;
          for (const term of expandedTerms) {
            const pos = contentLower.indexOf(term);
            if (pos !== -1) {
              const start = Math.max(0, pos - 50);
              const end = Math.min(doc.content.length, pos + term.length + 50);
              const snippet = (start > 0 ? '...' : '') + 
                doc.content.substring(start, end) + 
                (end < doc.content.length ? '...' : '');
              
              matches.push({
                documentType: doc.type === 'attendance_note' ? 'attendance_note' : 'summary',
                documentId: doc.id,
                snippet,
                matchPosition: pos,
                createdAt: doc.createdAt,
              });
              score += 90;
              foundInDoc = true;
              break;
            }
          }

          // Phonetic fallback for document content (catches name misspellings)
          if (!foundInDoc) {
            const phoneticHit = phoneticMatchInText(originalQuery, contentLower);
            if (phoneticHit) {
              const { pos } = phoneticHit;
              const start = Math.max(0, pos - 50);
              const end = Math.min(doc.content.length, pos + 50);
              const snippet = (start > 0 ? '...' : '') +
                doc.content.substring(start, end) +
                (end < doc.content.length ? '...' : '');
              matches.push({
                documentType: doc.type === 'attendance_note' ? 'attendance_note' : 'summary',
                documentId: doc.id,
                snippet,
                matchPosition: pos,
                createdAt: doc.createdAt,
              });
              score += 45;
            }
          }
        }
      }
      
      if (matches.length > 0) {
        results.push({
          case: caseItem,
          matches,
          score,
        });
      }
    }
    
    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    
    return results;
  }
  
  async createSearchHistory(historyData: InsertSearchHistory): Promise<SearchHistory> {
    const result = await db
      .insert(searchHistory)
      .values(historyData)
      .returning();
    return result[0];
  }
  
  async getSearchHistory(userId: string, limit: number = 10): Promise<SearchHistory[]> {
    return await db
      .select()
      .from(searchHistory)
      .where(eq(searchHistory.userId, userId))
      .orderBy(desc(searchHistory.searchedAt))
      .limit(limit);
  }
  
  async clearSearchHistory(userId: string): Promise<void> {
    await db
      .delete(searchHistory)
      .where(eq(searchHistory.userId, userId));
  }
  
  async findObjectByPath(objectPath: string, userId: string): Promise<{
    type: 'audio' | 'document' | 'transcript' | 'unknown';
    objectId: string;
    caseId: string;
    owned: boolean;
  } | null> {
    // Check if this is an audio recording
    const audioRecording = await db
      .select()
      .from(audioRecordings)
      .where(eq(audioRecordings.filePath, objectPath))
      .limit(1);
    
    if (audioRecording.length > 0) {
      const audio = audioRecording[0];
      // Verify ownership through case
      const caseData = await this.getCase(audio.caseId, userId);
      return {
        type: 'audio',
        objectId: audio.id,
        caseId: audio.caseId,
        owned: caseData !== undefined,
      };
    }
    
    // Future: Add checks for other object types (documents, transcripts, etc.)
    // when they start storing files in object storage
    
    return null;
  }
  
  async createCalendarEvent(eventData: InsertCalendarEvent): Promise<CalendarEvent> {
    const inserted = await db
      .insert(calendarEvents)
      .values(eventData)
      .returning();
    return inserted[0];
  }
  
  async getCalendarEventsByCase(caseId: string, userId: string): Promise<CalendarEvent[]> {
    return await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.caseId, caseId),
          eq(calendarEvents.userId, userId)
        )
      );
  }
  
  async getCalendarEventByProvider(caseId: string, userId: string, provider: 'google' | 'outlook'): Promise<CalendarEvent | undefined> {
    const result = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.caseId, caseId),
          eq(calendarEvents.userId, userId),
          eq(calendarEvents.provider, provider)
        )
      )
      .limit(1);
    return result[0];
  }
  
  async updateCalendarEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent | undefined> {
    const updated = await db
      .update(calendarEvents)
      .set(updates)
      .where(eq(calendarEvents.id, id))
      .returning();
    return updated[0];
  }
  
  async deleteCalendarEvent(id: string): Promise<void> {
    await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
  }
  
  async deleteCalendarEventsByCase(caseId: string, userId: string): Promise<void> {
    await db.delete(calendarEvents).where(
      and(
        eq(calendarEvents.caseId, caseId),
        eq(calendarEvents.userId, userId)
      )
    );
  }
  
  async getCalendarIntegration(userId: string, provider: 'google' | 'outlook'): Promise<CalendarIntegration | undefined> {
    const result = await db
      .select()
      .from(calendarIntegrations)
      .where(
        and(
          eq(calendarIntegrations.userId, userId),
          eq(calendarIntegrations.provider, provider)
        )
      )
      .limit(1);
    return result[0];
  }
  
  async getActiveCalendarIntegrations(provider: 'google' | 'outlook'): Promise<CalendarIntegration[]> {
    return await db
      .select()
      .from(calendarIntegrations)
      .where(eq(calendarIntegrations.provider, provider));
  }
  
  async saveCalendarIntegration(integrationData: InsertCalendarIntegration): Promise<CalendarIntegration> {
    const result = await db
      .insert(calendarIntegrations)
      .values({
        userId: integrationData.userId,
        provider: integrationData.provider,
        accessToken: integrationData.accessToken,
        refreshToken: integrationData.refreshToken ?? null,
        expiresAt: integrationData.expiresAt ?? null,
        calendarId: integrationData.calendarId ?? null,
        email: integrationData.email ?? null,
        lastSyncAt: integrationData.lastSyncAt ?? null,
      })
      .onConflictDoUpdate({
        target: [calendarIntegrations.userId, calendarIntegrations.provider],
        set: {
          accessToken: integrationData.accessToken,
          refreshToken: integrationData.refreshToken ?? null,
          expiresAt: integrationData.expiresAt ?? null,
          calendarId: integrationData.calendarId ?? null,
          email: integrationData.email ?? null,
          lastSyncAt: integrationData.lastSyncAt ?? null,
        },
      })
      .returning();
    return result[0];
  }
  
  async deleteCalendarIntegration(userId: string, provider: 'google' | 'outlook'): Promise<void> {
    await db.delete(calendarIntegrations).where(
      and(
        eq(calendarIntegrations.userId, userId),
        eq(calendarIntegrations.provider, provider)
      )
    );
  }
  
  async getUserCalendarIntegrations(userId: string): Promise<CalendarIntegration[]> {
    return await db
      .select()
      .from(calendarIntegrations)
      .where(eq(calendarIntegrations.userId, userId));
  }
  
  async createShareLink(shareLinkData: InsertShareLink): Promise<ShareLink> {
    const result = await db
      .insert(shareLinks)
      .values({
        ...shareLinkData,
        expiresAt: shareLinkData.expiresAt,
      })
      .returning();
    return result[0];
  }
  
  async getShareLink(id: string): Promise<ShareLink | undefined> {
    const result = await db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.id, id));
    return result[0];
  }

  async getShareLinks(userId: string): Promise<ShareLink[]> {
    return await db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.createdBy, userId))
      .orderBy(desc(shareLinks.createdAt));
  }
  
  async getShareLinksByCase(caseId: string, userId: string): Promise<ShareLink[]> {
    const result = await db
      .select()
      .from(shareLinks)
      .where(
        and(
          eq(shareLinks.caseId, caseId),
          eq(shareLinks.createdBy, userId)
        )
      )
      .orderBy(desc(shareLinks.createdAt));
    return result;
  }
  
  async updateShareLink(id: string, updates: Partial<ShareLink>): Promise<ShareLink | undefined> {
    const result = await db
      .update(shareLinks)
      .set(updates)
      .where(eq(shareLinks.id, id))
      .returning();
    return result[0];
  }

  async deleteShareLink(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(shareLinks)
      .where(
        and(
          eq(shareLinks.id, id),
          eq(shareLinks.createdBy, userId),
        )
      )
      .returning({ id: shareLinks.id });
    return result.length > 0;
  }
  
  async incrementShareLinkAccess(id: string): Promise<void> {
    await db
      .update(shareLinks)
      .set({
        accessCount: sql`${shareLinks.accessCount} + 1`,
        lastAccessedAt: new Date(),
      })
      .where(eq(shareLinks.id, id));
  }

  async updateShareLinkSmsCode(id: string, code: string, expiresAt: Date): Promise<ShareLink | undefined> {
    const result = await db
      .update(shareLinks)
      .set({
        smsVerificationCode: code,
        smsCodeExpiresAt: expiresAt,
        smsVerified: false, // Reset verification status when sending new code
        smsVerifiedAt: null,
        smsCodeSentCount: sql`${shareLinks.smsCodeSentCount} + 1`, // Increment send counter for rate limiting
      })
      .where(eq(shareLinks.id, id))
      .returning();
    return result[0];
  }

  async verifyShareLinkSmsCode(id: string, code: string): Promise<{ verified: boolean; expired?: boolean; invalid?: boolean }> {
    const shareLink = await this.getShareLink(id);
    
    if (!shareLink) {
      return { verified: false, invalid: true };
    }

    // Increment verification attempts counter (for rate limiting)
    await db
      .update(shareLinks)
      .set({
        smsVerificationAttempts: sql`${shareLinks.smsVerificationAttempts} + 1`,
      })
      .where(eq(shareLinks.id, id));

    // Check if code matches
    if (shareLink.smsVerificationCode !== code) {
      return { verified: false, invalid: true };
    }

    // Check if code has expired
    if (shareLink.smsCodeExpiresAt && shareLink.smsCodeExpiresAt < new Date()) {
      return { verified: false, expired: true };
    }

    // Mark as verified
    await db
      .update(shareLinks)
      .set({
        smsVerified: true,
        smsVerifiedAt: new Date(),
      })
      .where(eq(shareLinks.id, id));

    return { verified: true };
  }
  
  // Recall.ai Connection methods
  async getRecallConnection(userId: string): Promise<RecallConnection | undefined> {
    const result = await db
      .select()
      .from(recallConnections)
      .where(eq(recallConnections.userId, userId))
      .limit(1);
    return result[0];
  }
  
  async createRecallConnection(connectionData: InsertRecallConnection): Promise<RecallConnection> {
    const result = await db
      .insert(recallConnections)
      .values({
        userId: connectionData.userId,
        status: connectionData.status || 'active',
        metadata: connectionData.metadata || {},
      })
      .onConflictDoUpdate({
        target: [recallConnections.userId],
        set: {
          status: connectionData.status || 'active',
          metadata: connectionData.metadata || {},
          connectedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }
  
  async updateRecallConnection(userId: string, updates: Partial<RecallConnection>): Promise<RecallConnection | undefined> {
    const result = await db
      .update(recallConnections)
      .set(updates)
      .where(eq(recallConnections.userId, userId))
      .returning();
    return result[0];
  }
  
  async deleteRecallConnection(userId: string): Promise<void> {
    await db.delete(recallConnections).where(eq(recallConnections.userId, userId));
  }
  
  // Meeting Import methods
  async createMeetingImport(importData: InsertMeetingImport): Promise<MeetingImport> {
    const result = await db
      .insert(meetingImports)
      .values({
        userId: importData.userId,
        caseId: importData.caseId || null,
        recallBotId: importData.recallBotId,
        recallRecordingId: importData.recallRecordingId || null,
        meetingPlatform: importData.meetingPlatform,
        meetingUrl: importData.meetingUrl || null,
        meetingTitle: importData.meetingTitle || null,
        meetingStartTime: importData.meetingStartTime || null,
        meetingEndTime: importData.meetingEndTime || null,
        durationSeconds: importData.durationSeconds || null,
        participants: importData.participants || [],
        status: importData.status || 'pending',
        botStatus: importData.botStatus || null,
        consentMode: importData.consentMode || 'pre_confirmed',
        consentConfirmed: importData.consentConfirmed || false,
        preConsentEmailId: importData.preConsentEmailId || null,
      })
      .returning();
    return result[0];
  }
  
  async getMeetingImport(id: string): Promise<MeetingImport | undefined> {
    const result = await db
      .select()
      .from(meetingImports)
      .where(eq(meetingImports.id, id));
    return result[0];
  }

  async getMeetingImportByBotId(botId: string): Promise<MeetingImport | undefined> {
    const result = await db
      .select()
      .from(meetingImports)
      .where(eq(meetingImports.recallBotId, botId))
      .orderBy(desc(meetingImports.createdAt))
      .limit(1);
    return result[0];
  }
  
  async getMeetingImportsByUser(userId: string): Promise<MeetingImport[]> {
    return await db
      .select()
      .from(meetingImports)
      .where(eq(meetingImports.userId, userId))
      .orderBy(desc(meetingImports.createdAt));
  }
  
  async getMeetingImportsByCase(caseId: string, userId: string): Promise<MeetingImport[]> {
    return await db
      .select()
      .from(meetingImports)
      .where(
        and(
          eq(meetingImports.caseId, caseId),
          eq(meetingImports.userId, userId)
        )
      )
      .orderBy(desc(meetingImports.createdAt));
  }

  async getLiveMeetingImports(): Promise<MeetingImport[]> {
    return await db
      .select()
      .from(meetingImports)
      .where(
        and(
          inArray(meetingImports.status, ['live', 'pending']),
          sql`${meetingImports.recallBotId} IS NOT NULL`
        )
      )
      .orderBy(desc(meetingImports.createdAt));
  }

  async getUnassignedMeetingImports(userId: string): Promise<MeetingImport[]> {
    return await db
      .select()
      .from(meetingImports)
      .where(
        and(
          eq(meetingImports.userId, userId),
          eq(meetingImports.status, 'awaiting_assignment')
        )
      )
      .orderBy(desc(meetingImports.createdAt));
  }
  
  async updateMeetingImport(id: string, updates: Partial<MeetingImport>): Promise<MeetingImport | undefined> {
    const result = await db
      .update(meetingImports)
      .set(updates)
      .where(eq(meetingImports.id, id))
      .returning();
    return result[0];
  }
  
  // Pre-Consent Email methods
  async createPreConsentEmail(emailData: InsertPreConsentEmail): Promise<PreConsentEmail> {
    const result = await db
      .insert(preConsentEmails)
      .values({
        userId: emailData.userId,
        caseId: emailData.caseId || null,
        recipientEmail: emailData.recipientEmail,
        recipientName: emailData.recipientName,
        meetingPlatform: emailData.meetingPlatform || null,
        scheduledMeetingTime: emailData.scheduledMeetingTime || null,
        meetingUrl: emailData.meetingUrl || null,
        emailSubject: emailData.emailSubject,
        emailBody: emailData.emailBody,
        consentToken: emailData.consentToken,
        emailStatus: emailData.emailStatus || 'pending',
        expiresAt: emailData.expiresAt || null,
      })
      .returning();
    return result[0];
  }
  
  async getPreConsentEmail(id: string): Promise<PreConsentEmail | undefined> {
    const result = await db
      .select()
      .from(preConsentEmails)
      .where(eq(preConsentEmails.id, id));
    return result[0];
  }
  
  async getPreConsentEmailByToken(token: string): Promise<PreConsentEmail | undefined> {
    const result = await db
      .select()
      .from(preConsentEmails)
      .where(eq(preConsentEmails.consentToken, token));
    return result[0];
  }
  
  async getPreConsentEmailsByUser(userId: string): Promise<PreConsentEmail[]> {
    return await db
      .select()
      .from(preConsentEmails)
      .where(eq(preConsentEmails.userId, userId))
      .orderBy(desc(preConsentEmails.createdAt));
  }
  
  async updatePreConsentEmail(id: string, updates: Partial<PreConsentEmail>): Promise<PreConsentEmail | undefined> {
    const result = await db
      .update(preConsentEmails)
      .set(updates)
      .where(eq(preConsentEmails.id, id))
      .returning();
    return result[0];
  }
  
  async acknowledgePreConsentEmail(id: string, ipAddress: string, responseStatus?: string, rescheduleNote?: string): Promise<PreConsentEmail | undefined> {
    const status = responseStatus || 'granted';
    const updates: any = {
      consentAcknowledged: status === 'granted',
      consentAcknowledgedAt: new Date(),
      consentAcknowledgedIp: ipAddress,
      consentResponseStatus: status,
      consentRespondedAt: new Date(),
    };
    if (rescheduleNote) {
      updates.rescheduleRequestNote = rescheduleNote;
    }
    const result = await db
      .update(preConsentEmails)
      .set(updates)
      .where(and(eq(preConsentEmails.id, id), eq(preConsentEmails.consentResponseStatus, 'awaiting')))
      .returning();
    return result[0];
  }
  
  // Scheduled Meeting methods
  async createScheduledMeeting(meetingData: InsertScheduledMeeting): Promise<ScheduledMeeting> {
    const result = await db
      .insert(scheduledMeetings)
      .values({
        userId: meetingData.userId,
        caseId: meetingData.caseId || null,
        calendarEventId: meetingData.calendarEventId,
        calendarProvider: meetingData.calendarProvider || 'google',
        title: meetingData.title,
        description: meetingData.description || null,
        meetingUrl: meetingData.meetingUrl || null,
        meetingPlatform: meetingData.meetingPlatform || null,
        startTime: meetingData.startTime,
        endTime: meetingData.endTime || null,
        attendees: meetingData.attendees || [],
        clientEmail: meetingData.clientEmail || null,
        clientName: meetingData.clientName || null,
        autoRecordEnabled: meetingData.autoRecordEnabled || false,
        consentStatus: meetingData.consentStatus || 'pending',
        preConsentEmailId: meetingData.preConsentEmailId || null,
        recallBotId: meetingData.recallBotId || null,
        botStatus: meetingData.botStatus || null,
        meetingImportId: meetingData.meetingImportId || null,
        status: meetingData.status || 'scheduled',
        replacedByMeetingId: meetingData.replacedByMeetingId || null,
        cancellationReason: meetingData.cancellationReason || null,
        lastPolledAt: meetingData.lastPolledAt || null,
      })
      .onConflictDoUpdate({
        target: [scheduledMeetings.userId, scheduledMeetings.calendarEventId, scheduledMeetings.calendarProvider],
        set: {
          title: meetingData.title,
          description: meetingData.description || null,
          meetingUrl: meetingData.meetingUrl || null,
          meetingPlatform: meetingData.meetingPlatform || null,
          startTime: meetingData.startTime,
          endTime: meetingData.endTime || null,
          attendees: meetingData.attendees || [],
          // If the event is rescheduled, re-arm reminders
          reminder30mSentAt: sql`CASE WHEN ${scheduledMeetings.startTime} IS DISTINCT FROM ${meetingData.startTime} THEN NULL ELSE ${scheduledMeetings.reminder30mSentAt} END`,
          reminder10mSentAt: sql`CASE WHEN ${scheduledMeetings.startTime} IS DISTINCT FROM ${meetingData.startTime} THEN NULL ELSE ${scheduledMeetings.reminder10mSentAt} END`,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }
  
  async getScheduledMeeting(id: string): Promise<ScheduledMeeting | undefined> {
    const result = await db
      .select()
      .from(scheduledMeetings)
      .where(eq(scheduledMeetings.id, id));
    return result[0];
  }
  
  async getScheduledMeetingByCalendarEvent(userId: string, calendarEventId: string, provider: string): Promise<ScheduledMeeting | undefined> {
    const result = await db
      .select()
      .from(scheduledMeetings)
      .where(
        and(
          eq(scheduledMeetings.userId, userId),
          eq(scheduledMeetings.calendarEventId, calendarEventId),
          eq(scheduledMeetings.calendarProvider, provider)
        )
      );
    return result[0];
  }
  
  async getScheduledMeetingByBotId(botId: string): Promise<ScheduledMeeting | undefined> {
    const result = await db
      .select()
      .from(scheduledMeetings)
      .where(eq(scheduledMeetings.recallBotId, botId));
    return result[0];
  }
  
  async getScheduledMeetingsByUser(userId: string): Promise<ScheduledMeeting[]> {
    return await db
      .select()
      .from(scheduledMeetings)
      .where(eq(scheduledMeetings.userId, userId))
      .orderBy(desc(scheduledMeetings.startTime));
  }
  
  async getScheduledMeetingsByCase(caseId: string, userId: string): Promise<ScheduledMeeting[]> {
    return await db
      .select()
      .from(scheduledMeetings)
      .where(
        and(
          eq(scheduledMeetings.caseId, caseId),
          eq(scheduledMeetings.userId, userId)
        )
      )
      .orderBy(desc(scheduledMeetings.startTime));
  }
  
  async getUpcomingScheduledMeetings(userId: string, daysAhead: number = 7): Promise<ScheduledMeeting[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    
    return await db
      .select()
      .from(scheduledMeetings)
      .where(
        and(
          eq(scheduledMeetings.userId, userId),
          eq(scheduledMeetings.status, 'scheduled'),
          gte(scheduledMeetings.startTime, now),
          lte(scheduledMeetings.startTime, futureDate)
        )
      )
      .orderBy(scheduledMeetings.startTime);
  }
  
  async getMeetingsNeedingConsent(userId: string): Promise<ScheduledMeeting[]> {
    const now = new Date();
    const twoDaysAhead = new Date();
    twoDaysAhead.setDate(twoDaysAhead.getDate() + 2);
    
    return await db
      .select()
      .from(scheduledMeetings)
      .where(
        and(
          eq(scheduledMeetings.userId, userId),
          eq(scheduledMeetings.autoRecordEnabled, true),
          eq(scheduledMeetings.consentStatus, 'pending'),
          eq(scheduledMeetings.status, 'scheduled'),
          gte(scheduledMeetings.startTime, now),
          lte(scheduledMeetings.startTime, twoDaysAhead)
        )
      )
      .orderBy(scheduledMeetings.startTime);
  }
  
  async getMeetingsReadyForBot(userId: string): Promise<ScheduledMeeting[]> {
    const now = new Date();
    const tenMinutesAhead = new Date();
    tenMinutesAhead.setMinutes(tenMinutesAhead.getMinutes() + 10);
    
    return await db
      .select()
      .from(scheduledMeetings)
      .where(
        and(
          eq(scheduledMeetings.userId, userId),
          eq(scheduledMeetings.autoRecordEnabled, true),
          eq(scheduledMeetings.consentStatus, 'approved'),
          eq(scheduledMeetings.status, 'scheduled'),
          isNull(scheduledMeetings.recallBotId),
          gte(scheduledMeetings.startTime, now),
          lte(scheduledMeetings.startTime, tenMinutesAhead)
        )
      )
      .orderBy(scheduledMeetings.startTime);
  }
  
  async getAllScheduledMeetingsWithAutoRecord(): Promise<ScheduledMeeting[]> {
    const now = new Date();
    const twoDaysAhead = new Date();
    twoDaysAhead.setDate(twoDaysAhead.getDate() + 2);
    
    return await db
      .select()
      .from(scheduledMeetings)
      .where(
        and(
          eq(scheduledMeetings.autoRecordEnabled, true),
          eq(scheduledMeetings.status, 'scheduled'),
          gte(scheduledMeetings.startTime, now),
          lte(scheduledMeetings.startTime, twoDaysAhead)
        )
      )
      .orderBy(scheduledMeetings.startTime);
  }

  /**
   * Meetings due for a solicitor reminder. Window is sized for the 5-minute cron:
   * e.g. 30m → start in 25–35 minutes; 10m → start in 5–15 minutes.
   */
  async getMeetingsNeedingReminders(minutesBefore: 30 | 10): Promise<ScheduledMeeting[]> {
    const now = new Date();
    const windowHalfMinutes = 5;
    const windowStart = new Date(now.getTime() + (minutesBefore - windowHalfMinutes) * 60 * 1000);
    const windowEnd = new Date(now.getTime() + (minutesBefore + windowHalfMinutes) * 60 * 1000);
    const sentColumn = minutesBefore === 30
      ? scheduledMeetings.reminder30mSentAt
      : scheduledMeetings.reminder10mSentAt;

    return await db
      .select()
      .from(scheduledMeetings)
      .where(
        and(
          eq(scheduledMeetings.status, 'scheduled'),
          isNull(sentColumn),
          gte(scheduledMeetings.startTime, windowStart),
          lte(scheduledMeetings.startTime, windowEnd)
        )
      )
      .orderBy(scheduledMeetings.startTime);
  }
  
  async updateScheduledMeeting(id: string, updates: Partial<ScheduledMeeting>): Promise<ScheduledMeeting | undefined> {
    const result = await db
      .update(scheduledMeetings)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(scheduledMeetings.id, id))
      .returning();
    return result[0];
  }
  
  async deleteScheduledMeeting(id: string): Promise<void> {
    await db.delete(scheduledMeetings).where(eq(scheduledMeetings.id, id));
  }
  
  // SharePoint/OneDrive Connection methods
  async getSharePointConnection(userId: string, provider: 'sharepoint' | 'onedrive'): Promise<SharePointConnection | undefined> {
    const result = await db
      .select()
      .from(sharePointConnections)
      .where(
        and(
          eq(sharePointConnections.userId, userId),
          eq(sharePointConnections.provider, provider)
        )
      );
    return result[0];
  }
  
  async getUserSharePointConnections(userId: string): Promise<SharePointConnection[]> {
    return await db
      .select()
      .from(sharePointConnections)
      .where(eq(sharePointConnections.userId, userId));
  }
  
  async saveSharePointConnection(connectionData: InsertSharePointConnection): Promise<SharePointConnection> {
    const result = await db
      .insert(sharePointConnections)
      .values({
        userId: connectionData.userId,
        provider: connectionData.provider,
        driveId: connectionData.driveId,
        driveName: connectionData.driveName ?? null,
        email: connectionData.email ?? null,
        status: connectionData.status || 'active',
        autoSyncEnabled: connectionData.autoSyncEnabled ?? true,
      })
      .onConflictDoUpdate({
        target: [sharePointConnections.userId, sharePointConnections.provider],
        set: {
          driveId: connectionData.driveId,
          driveName: connectionData.driveName ?? null,
          email: connectionData.email ?? null,
          status: connectionData.status || 'active',
          autoSyncEnabled: connectionData.autoSyncEnabled ?? true,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }
  
  async updateSharePointConnection(userId: string, provider: 'sharepoint' | 'onedrive', updates: Partial<SharePointConnection>): Promise<SharePointConnection | undefined> {
    const result = await db
      .update(sharePointConnections)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sharePointConnections.userId, userId),
          eq(sharePointConnections.provider, provider)
        )
      )
      .returning();
    return result[0];
  }
  
  async deleteSharePointConnection(userId: string, provider: 'sharepoint' | 'onedrive'): Promise<void> {
    await db
      .delete(sharePointConnections)
      .where(
        and(
          eq(sharePointConnections.userId, userId),
          eq(sharePointConnections.provider, provider)
        )
      );
  }
  
  // Waitlist methods
  async createWaitlistEntry(entryData: InsertWaitlist): Promise<Waitlist> {
    const result = await db.insert(waitlist).values(entryData).returning();
    return result[0];
  }
  
  async getWaitlistEntry(id: string): Promise<Waitlist | undefined> {
    const result = await db.select().from(waitlist).where(eq(waitlist.id, id));
    return result[0];
  }
  
  async getWaitlistEntryByEmail(email: string): Promise<Waitlist | undefined> {
    const result = await db.select().from(waitlist).where(eq(waitlist.email, email.toLowerCase()));
    return result[0];
  }
  
  async getAllWaitlistEntries(): Promise<Waitlist[]> {
    return await db.select().from(waitlist).orderBy(desc(waitlist.signupAt));
  }
  
  async updateWaitlistEntry(id: string, updates: Partial<Waitlist>): Promise<Waitlist | undefined> {
    const result = await db.update(waitlist).set(updates).where(eq(waitlist.id, id)).returning();
    return result[0];
  }
  
  async deleteWaitlistEntry(id: string): Promise<void> {
    await db.delete(waitlist).where(eq(waitlist.id, id));
  }
  
  async getWaitlistStats(): Promise<{ total: number; pending: number; invited: number; active: number }> {
    const allEntries = await db.select().from(waitlist);
    return {
      total: allEntries.length,
      pending: allEntries.filter(e => e.status === 'pending').length,
      invited: allEntries.filter(e => e.status === 'invited').length,
      active: allEntries.filter(e => e.status === 'active').length,
    };
  }
  
  // LinkedIn post performance methods
  async getLinkedinPostPerformance(postNumber: number): Promise<LinkedinPostPerformance | undefined> {
    const [result] = await db.select().from(linkedinPostPerformance).where(eq(linkedinPostPerformance.postNumber, postNumber));
    return result;
  }

  async getAllLinkedinPostPerformance(): Promise<LinkedinPostPerformance[]> {
    return await db.select().from(linkedinPostPerformance).orderBy(linkedinPostPerformance.postNumber);
  }

  async upsertLinkedinPostPerformance(data: InsertLinkedinPostPerformance): Promise<LinkedinPostPerformance> {
    const existing = await this.getLinkedinPostPerformance(data.postNumber);
    if (existing) {
      const [updated] = await db.update(linkedinPostPerformance)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(linkedinPostPerformance.postNumber, data.postNumber))
        .returning();
      return updated;
    }
    const [created] = await db.insert(linkedinPostPerformance).values(data).returning();
    return created;
  }

  async getConnectionMilestones(): Promise<LinkedinConnectionMilestone[]> {
    return await db.select().from(linkedinConnectionMilestones).orderBy(desc(linkedinConnectionMilestones.date));
  }

  async addConnectionMilestone(data: InsertLinkedinConnectionMilestone): Promise<LinkedinConnectionMilestone> {
    const [created] = await db.insert(linkedinConnectionMilestones).values(data).returning();
    return created;
  }

  async deleteConnectionMilestone(id: string): Promise<void> {
    await db.delete(linkedinConnectionMilestones).where(eq(linkedinConnectionMilestones.id, id));
  }

  async getInboundLeads(): Promise<LinkedinInboundLead[]> {
    return await db.select().from(linkedinInboundLeads).orderBy(desc(linkedinInboundLeads.createdAt));
  }

  async addInboundLead(data: InsertLinkedinInboundLead): Promise<LinkedinInboundLead> {
    const [created] = await db.insert(linkedinInboundLeads).values(data).returning();
    return created;
  }

  async deleteInboundLead(id: string): Promise<void> {
    await db.delete(linkedinInboundLeads).where(eq(linkedinInboundLeads.id, id));
  }

  async getHookVariants(postNumber: number): Promise<LinkedinHookVariant[]> {
    return await db.select().from(linkedinHookVariants).where(eq(linkedinHookVariants.postNumber, postNumber));
  }

  async addHookVariant(data: InsertLinkedinHookVariant): Promise<LinkedinHookVariant> {
    const [created] = await db.insert(linkedinHookVariants).values(data).returning();
    return created;
  }

  async deleteHookVariant(id: string): Promise<void> {
    await db.delete(linkedinHookVariants).where(eq(linkedinHookVariants.id, id));
  }

  async getChatMessages(postNumber: number): Promise<LinkedinPostChatMessage[]> {
    return await db.select().from(linkedinPostChatMessages)
      .where(eq(linkedinPostChatMessages.postNumber, postNumber))
      .orderBy(linkedinPostChatMessages.createdAt);
  }

  async addChatMessage(data: InsertLinkedinPostChatMessage): Promise<LinkedinPostChatMessage> {
    const [created] = await db.insert(linkedinPostChatMessages).values(data).returning();
    return created;
  }

  async clearChatMessages(postNumber: number): Promise<void> {
    await db.delete(linkedinPostChatMessages).where(eq(linkedinPostChatMessages.postNumber, postNumber));
  }

  async getDocumentComments(documentId: string): Promise<DocumentComment[]> {
    return await db.select().from(documentComments)
      .where(eq(documentComments.documentId, documentId))
      .orderBy(desc(documentComments.createdAt));
  }

  async createDocumentComment(data: InsertDocumentComment): Promise<DocumentComment> {
    const [created] = await db.insert(documentComments).values(data).returning();
    return created;
  }

  async updateDocumentComment(id: string, updates: Partial<DocumentComment>): Promise<DocumentComment | undefined> {
    const [updated] = await db.update(documentComments)
      .set(updates)
      .where(eq(documentComments.id, id))
      .returning();
    return updated;
  }

  async deleteDocumentComment(id: string): Promise<void> {
    await db.delete(documentComments).where(eq(documentComments.id, id));
  }

  async getAmlMonitoringNotes(caseId: string): Promise<AmlMonitoringNote[]> {
    return await db.select().from(amlMonitoringNotes)
      .where(eq(amlMonitoringNotes.caseId, caseId))
      .orderBy(desc(amlMonitoringNotes.createdAt));
  }

  async createAmlMonitoringNote(data: InsertAmlMonitoringNote): Promise<AmlMonitoringNote> {
    const [created] = await db.insert(amlMonitoringNotes).values(data).returning();
    return created;
  }

  async getAmlDecisionRecords(caseId: string): Promise<AmlDecisionRecord[]> {
    return await db.select().from(amlDecisionRecords)
      .where(eq(amlDecisionRecords.caseId, caseId))
      .orderBy(desc(amlDecisionRecords.createdAt));
  }

  async createAmlDecisionRecord(data: InsertAmlDecisionRecord): Promise<AmlDecisionRecord> {
    const [created] = await db.insert(amlDecisionRecords).values(data).returning();
    return created;
  }

  async updateUserComplianceThread(userId: string, enabled: boolean): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ complianceThread: enabled, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async getLastAmlActivityDates(caseIds: string[]): Promise<Record<string, Date>> {
    if (caseIds.length === 0) return {};
    const result: Record<string, Date> = {};
    const noteResults = await db.select({
      caseId: amlMonitoringNotes.caseId,
      lastDate: sql<Date>`MAX(${amlMonitoringNotes.createdAt})`,
    }).from(amlMonitoringNotes)
      .where(inArray(amlMonitoringNotes.caseId, caseIds))
      .groupBy(amlMonitoringNotes.caseId);
    const decisionResults = await db.select({
      caseId: amlDecisionRecords.caseId,
      lastDate: sql<Date>`MAX(${amlDecisionRecords.createdAt})`,
    }).from(amlDecisionRecords)
      .where(inArray(amlDecisionRecords.caseId, caseIds))
      .groupBy(amlDecisionRecords.caseId);
    for (const row of noteResults) {
      result[row.caseId] = new Date(row.lastDate);
    }
    for (const row of decisionResults) {
      const existing = result[row.caseId];
      const decDate = new Date(row.lastDate);
      if (!existing || decDate > existing) {
        result[row.caseId] = decDate;
      }
    }
    return result;
  }

  async getCaseById(id: string): Promise<Case | undefined> {
    const result = await db.select().from(cases).where(eq(cases.id, id));
    return result[0];
  }

  async getCaseLitigationHoldStatus(caseId: string): Promise<CaseLitigationHoldStatus | undefined> {
    const result = await db
      .select({
        litigationHold: cases.litigationHold,
        litigationHoldAppliedAt: cases.litigationHoldAppliedAt,
        litigationHoldAppliedBy: cases.litigationHoldAppliedBy,
        litigationHoldReason: cases.litigationHoldReason,
      })
      .from(cases)
      .where(eq(cases.id, caseId))
      .limit(1);
    return result[0];
  }

  async getExternalDocumentRefs(caseId: string): Promise<ExternalDocumentRef[]> {
    return await db.select().from(externalDocumentRefs)
      .where(eq(externalDocumentRefs.caseId, caseId))
      .orderBy(desc(externalDocumentRefs.createdAt));
  }

  async createExternalDocumentRef(data: InsertExternalDocumentRef, userId: string): Promise<ExternalDocumentRef> {
    const result = await db.insert(externalDocumentRefs).values({
      caseId: data.caseId,
      createdBy: userId,
      description: data.description,
      documentType: data.documentType,
      documentDate: data.documentDate ?? null,
      providedBy: data.providedBy,
    }).returning();
    return result[0];
  }

  async createMeetingSession(sessionData: InsertMeetingSession): Promise<MeetingSession> {
    const [created] = await db.insert(meetingSessions).values(sessionData).returning();
    return created;
  }

  async getMeetingSession(id: string): Promise<MeetingSession | undefined> {
    const [result] = await db.select().from(meetingSessions).where(eq(meetingSessions.id, id));
    return result;
  }

  async getMeetingSessionsByCase(caseId: string, userId: string): Promise<MeetingSession[]> {
    const caseData = await this.getCase(caseId, userId);
    if (!caseData) return [];
    return await db.select().from(meetingSessions)
      .where(eq(meetingSessions.caseId, caseId))
      .orderBy(desc(meetingSessions.startedAt));
  }

  async updateMeetingSession(id: string, updates: Partial<MeetingSession>): Promise<MeetingSession | undefined> {
    const [updated] = await db.update(meetingSessions)
      .set(updates)
      .where(eq(meetingSessions.id, id))
      .returning();
    return updated;
  }

  async createTimeEntry(data: InsertTimeEntry): Promise<TimeEntry> {
    const result = await db.insert(timeEntries).values({
      meetingSessionId: data.meetingSessionId ?? null,
      caseId: data.caseId,
      userId: data.userId,
      durationMinutes: data.durationMinutes,
      description: data.description,
      hourlyRate: data.hourlyRate,
      status: data.status ?? "draft",
      clioTimeEntryId: data.clioTimeEntryId ?? null,
    }).returning();
    return result[0];
  }

  async getTimeEntry(id: string): Promise<TimeEntry | undefined> {
    const result = await db.select().from(timeEntries).where(eq(timeEntries.id, id));
    return result[0];
  }

  async getTimeEntriesByCase(caseId: string): Promise<TimeEntry[]> {
    return await db.select().from(timeEntries)
      .where(eq(timeEntries.caseId, caseId))
      .orderBy(desc(timeEntries.createdAt));
  }

  async getTimeEntriesByUser(userId: string, startDate?: Date, endDate?: Date): Promise<TimeEntry[]> {
    const conditions = [eq(timeEntries.userId, userId)];
    if (startDate) conditions.push(gte(timeEntries.createdAt, startDate));
    if (endDate) conditions.push(lte(timeEntries.createdAt, endDate));
    return await db.select().from(timeEntries)
      .where(and(...conditions))
      .orderBy(desc(timeEntries.createdAt));
  }

  async getAllTimeEntries(startDate?: Date, endDate?: Date): Promise<(TimeEntry & { caseTitle?: string; clientName?: string; userName?: string })[]> {
    const conditions: any[] = [];
    if (startDate) conditions.push(gte(timeEntries.createdAt, startDate));
    if (endDate) conditions.push(lte(timeEntries.createdAt, endDate));

    const results = await db.select({
      timeEntry: timeEntries,
      caseTitle: cases.title,
      clientName: cases.clientName,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
    })
      .from(timeEntries)
      .leftJoin(cases, eq(timeEntries.caseId, cases.id))
      .leftJoin(users, eq(timeEntries.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(timeEntries.createdAt));

    return results.map(r => ({
      ...r.timeEntry,
      caseTitle: r.caseTitle ?? undefined,
      clientName: r.clientName ?? undefined,
      userName: r.userFirstName && r.userLastName
        ? `${r.userFirstName} ${r.userLastName}`
        : r.userEmail ?? undefined,
    }));
  }

  async updateTimeEntry(id: string, updates: Partial<TimeEntry>): Promise<TimeEntry | undefined> {
    const result = await db.update(timeEntries)
      .set(updates)
      .where(eq(timeEntries.id, id))
      .returning();
    return result[0];
  }

  async deleteTimeEntry(id: string): Promise<void> {
    await db.delete(timeEntries).where(eq(timeEntries.id, id));
  }

  async updateUserHourlyRate(userId: string, hourlyRate: string): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ hourlyRate, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async getUndertakingsByCase(caseId: string): Promise<Undertaking[]> {
    return await db.select().from(undertakings)
      .where(eq(undertakings.caseId, caseId))
      .orderBy(desc(undertakings.createdAt));
  }

  async getUndertaking(id: string): Promise<Undertaking | undefined> {
    const result = await db.select().from(undertakings).where(eq(undertakings.id, id));
    return result[0];
  }

  async createUndertaking(data: InsertUndertaking): Promise<Undertaking> {
    const result = await db.insert(undertakings).values({
      caseId: data.caseId,
      meetingSessionId: data.meetingSessionId ?? null,
      wording: data.wording,
      speaker: data.speaker ?? null,
      sourceQuote: data.sourceQuote ?? null,
      deadline: data.deadline ?? null,
      status: data.status ?? "outstanding",
      confirmedBy: data.confirmedBy ?? null,
      confirmedAt: data.confirmedAt ?? null,
      dischargedAt: data.dischargedAt ?? null,
      dischargedBy: data.dischargedBy ?? null,
      dischargeNote: data.dischargeNote ?? null,
      dateGiven: data.dateGiven ?? new Date(),
    }).returning();
    return result[0];
  }

  async updateUndertaking(id: string, updates: Partial<Undertaking>): Promise<Undertaking | undefined> {
    const result = await db.update(undertakings)
      .set(updates)
      .where(eq(undertakings.id, id))
      .returning();
    return result[0];
  }

  async getAllOutstandingUndertakings(): Promise<(Undertaking & { caseTitle?: string; clientName?: string })[]> {
    const results = await db.select({
      undertaking: undertakings,
      caseTitle: cases.title,
      clientName: cases.clientName,
    }).from(undertakings)
      .leftJoin(cases, eq(undertakings.caseId, cases.id))
      .where(eq(undertakings.status, "outstanding"))
      .orderBy(undertakings.deadline, desc(undertakings.createdAt));
    return results.map(r => ({
      ...r.undertaking,
      caseTitle: r.caseTitle ?? undefined,
      clientName: r.clientName ?? undefined,
    }));
  }

  // Firm methods
  async createFirm(data: InsertFirm): Promise<Firm> {
    const result = await db.insert(firms).values({
      name: data.name,
      sraNumber: data.sraNumber ?? null,
      addressLine1: data.addressLine1 ?? null,
      addressLine2: data.addressLine2 ?? null,
      city: data.city ?? null,
      postcode: data.postcode ?? null,
      country: data.country ?? "United Kingdom",
      phone: data.phone ?? null,
      email: data.email ?? null,
      website: data.website ?? null,
      logoUrl: data.logoUrl ?? null,
    }).returning();
    return result[0];
  }

  async getFirm(id: string): Promise<Firm | undefined> {
    const result = await db.select().from(firms).where(eq(firms.id, id));
    return result[0];
  }

  async updateFirm(id: string, updates: Partial<Firm>): Promise<Firm | undefined> {
    const result = await db.update(firms).set(updates).where(eq(firms.id, id)).returning();
    return result[0];
  }

  async ensureUserHasFirm(userId: string): Promise<Firm> {
    const user = await db.select().from(users).where(eq(users.id, userId));
    const u = user[0];
    if (!u) throw new Error("User not found");
    if (u.firmId) {
      const firm = await this.getFirm(u.firmId);
      if (firm) return firm;
    }
    const displayName = u.firstName && u.lastName
      ? `${u.firstName} ${u.lastName}'s Firm`
      : u.email
        ? `${u.email.split('@')[0]}'s Firm`
        : "My Firm";
    const firm = await this.createFirm({ name: displayName });
    await db.update(users).set({
      firmId: firm.id,
      inviteStatus: "active",
      regulatoryDesignations: ["is_firm_admin"],
      primaryRole: u.primaryRole ?? "solicitor",
      updatedAt: new Date(),
    }).where(eq(users.id, userId));
    return firm;
  }

  // Team member methods
  async getFirmMembers(firmId: string): Promise<User[]> {
    return await db.select().from(users)
      .where(and(eq(users.firmId, firmId), isNull(users.removedAt)))
      .orderBy(users.createdAt);
  }

  async updateUserFirmRole(userId: string, updates: {
    primaryRole?: string | null;
    customRoleLabel?: string | null;
    regulatoryDesignations?: string[];
    inviteStatus?: string;
    firmId?: string | null;
    invitedAt?: Date | null;
  }): Promise<User | undefined> {
    const setData: Partial<typeof users.$inferInsert> & { updatedAt: Date } = { updatedAt: new Date() };
    if (updates.primaryRole !== undefined) setData.primaryRole = updates.primaryRole;
    if (updates.customRoleLabel !== undefined) setData.customRoleLabel = updates.customRoleLabel;
    if (updates.regulatoryDesignations !== undefined) setData.regulatoryDesignations = updates.regulatoryDesignations;
    if (updates.inviteStatus !== undefined) setData.inviteStatus = updates.inviteStatus;
    if (updates.firmId !== undefined) setData.firmId = updates.firmId;
    if (updates.invitedAt !== undefined) setData.invitedAt = updates.invitedAt;
    const result = await db.update(users).set(setData).where(eq(users.id, userId)).returning();
    return result[0];
  }

  async removeUserFromFirm(userId: string, removedAt: Date): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ removedAt, inviteStatus: "suspended", updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async updateUserRole(userId: string, role: string): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async getFormerFirmMembers(firmId: string): Promise<User[]> {
    return await db.select().from(users)
      .where(and(eq(users.firmId, firmId), sql`${users.removedAt} IS NOT NULL`))
      .orderBy(desc(users.removedAt));
  }

  // Invitation methods
  async createFirmInvitation(data: InsertFirmInvitation): Promise<FirmInvitation> {
    const result = await db.insert(firmInvitations).values({
      firmId: data.firmId,
      invitingUserId: data.invitingUserId,
      email: data.email,
      suggestedRole: data.suggestedRole ?? null,
      suggestedCustomRoleLabel: data.suggestedCustomRoleLabel ?? null,
      token: data.token,
      authProvider: data.authProvider ?? "google",
      status: data.status ?? "pending",
      expiresAt: data.expiresAt,
    }).returning();
    return result[0];
  }

  async getFirmInvitation(id: string): Promise<FirmInvitation | undefined> {
    const result = await db.select().from(firmInvitations).where(eq(firmInvitations.id, id));
    return result[0];
  }

  async getSupervisionSignoffsByCase(caseId: string): Promise<SupervisionSignoff[]> {
    return await db.select().from(supervisionSignoffs)
      .where(eq(supervisionSignoffs.caseId, caseId))
      .orderBy(desc(supervisionSignoffs.signoffDate));
  }

  async createSupervisionSignoff(data: InsertSupervisionSignoff): Promise<SupervisionSignoff> {
    const result = await db.insert(supervisionSignoffs).values({
      caseId: data.caseId,
      supervisorUserId: data.supervisorUserId,
      supervisorName: data.supervisorName,
      supervisorRole: data.supervisorRole,
      signoffDate: data.signoffDate,
      reviewNotes: data.reviewNotes,
    }).returning();
    return result[0];
  }

  async getFirmInvitationByToken(token: string): Promise<FirmInvitation | undefined> {
    const result = await db.select().from(firmInvitations).where(eq(firmInvitations.token, token));
    return result[0];
  }

  async getFirmInvitations(firmId: string): Promise<FirmInvitation[]> {
    return await db.select().from(firmInvitations)
      .where(eq(firmInvitations.firmId, firmId))
      .orderBy(desc(firmInvitations.createdAt));
  }

  async updateFirmInvitation(id: string, updates: Partial<FirmInvitation>): Promise<FirmInvitation | undefined> {
    const result = await db.update(firmInvitations).set(updates).where(eq(firmInvitations.id, id)).returning();
    return result[0];
  }

  // Role change log methods
  async createRoleChangeLog(data: InsertRoleChangeLog): Promise<RoleChangeLog> {
    const result = await db.insert(roleChangeLogs).values({
      userId: data.userId,
      firmId: data.firmId,
      changedByUserId: data.changedByUserId,
      previousRole: data.previousRole ?? null,
      newRole: data.newRole ?? null,
      previousDesignations: data.previousDesignations ?? [],
      newDesignations: data.newDesignations ?? [],
      previousCustomRoleLabel: data.previousCustomRoleLabel ?? null,
      newCustomRoleLabel: data.newCustomRoleLabel ?? null,
      reason: data.reason ?? null,
    }).returning();
    return result[0];
  }

  async getRoleChangeLogs(userId: string): Promise<RoleChangeLog[]> {
    return await db.select().from(roleChangeLogs)
      .where(eq(roleChangeLogs.userId, userId))
      .orderBy(desc(roleChangeLogs.changedAt));
  }

  async getFirmRoleChangeLogs(firmId: string): Promise<RoleChangeLog[]> {
    return await db.select().from(roleChangeLogs)
      .where(eq(roleChangeLogs.firmId, firmId))
      .orderBy(desc(roleChangeLogs.changedAt));
  }

  async getConflictChecksByCase(caseId: string): Promise<ConflictCheck[]> {
    return await db.select().from(conflictChecks)
      .where(eq(conflictChecks.caseId, caseId))
      .orderBy(desc(conflictChecks.datePerformed));
  }

  async createConflictCheck(data: InsertConflictCheck): Promise<ConflictCheck> {
    const [created] = await db.insert(conflictChecks).values(data).returning();
    return created;
  }

  async getComplianceOverview(): Promise<ComplianceOverview> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get all active (non-archived) cases with user info
    const activeCases = await db.select({
      case: cases,
      feeEarner: users,
    }).from(cases)
      .leftJoin(users, eq(cases.createdBy, users.id))
      .where(eq(cases.archived, false))
      .orderBy(desc(cases.createdAt));

    // Get all outstanding undertakings
    const outstandingUnds = await db.select({
      undertaking: undertakings,
      caseTitle: cases.title,
      matterReference: cases.matterReference,
      caseCreatedBy: cases.createdBy,
      feeEarner: users,
    }).from(undertakings)
      .leftJoin(cases, eq(undertakings.caseId, cases.id))
      .leftJoin(users, eq(cases.createdBy, users.id))
      .where(eq(undertakings.status, "outstanding"));

    // Get latest signoff per case
    const signoffRows = await db.select({
      caseId: supervisionSignoffs.caseId,
      signoffDate: supervisionSignoffs.signoffDate,
    }).from(supervisionSignoffs)
      .orderBy(desc(supervisionSignoffs.signoffDate));

    // Build latest signoff map
    const latestSignoffMap = new Map<string, Date>();
    for (const row of signoffRows) {
      if (!latestSignoffMap.has(row.caseId)) {
        latestSignoffMap.set(row.caseId, row.signoffDate);
      }
    }

    // Get outstanding count per case
    const undertakingCountMap = new Map<string, number>();
    for (const r of outstandingUnds) {
      const caseId = r.undertaking.caseId;
      undertakingCountMap.set(caseId, (undertakingCountMap.get(caseId) ?? 0) + 1);
    }

    // Build matter statuses
    const matters: MatterComplianceStatus[] = activeCases.map(({ case: c, feeEarner }) => {
      const lastSignoff = latestSignoffMap.get(c.id) ?? null;
      const daysSinceSignoff = lastSignoff
        ? Math.floor((now.getTime() - lastSignoff.getTime()) / (24 * 60 * 60 * 1000))
        : null;
      const outstandingUndsCount = undertakingCountMap.get(c.id) ?? 0;
      const issues: string[] = [];

      // RAG logic
      let ragStatus: 'red' | 'amber' | 'green' = 'green';

      // Red flags
      if (!c.conflictCheckCompleted) { issues.push("Conflict check not completed"); ragStatus = 'red'; }
      if (!c.clientCareLetterId) { issues.push("Client care letter not sent"); ragStatus = 'red'; }

      // Amber flags (only if not already red)
      if (ragStatus !== 'red') {
        if (outstandingUndsCount > 0) { issues.push(`${outstandingUndsCount} outstanding undertaking${outstandingUndsCount > 1 ? 's' : ''}`); ragStatus = 'amber'; }
        if (daysSinceSignoff === null || daysSinceSignoff > 30) { issues.push("No supervision sign-off in 30 days"); ragStatus = 'amber'; }
      }

      const feeEarnerName = feeEarner
        ? [feeEarner.firstName, feeEarner.lastName].filter(Boolean).join(' ') || feeEarner.email || 'Unknown'
        : 'Unknown';

      return {
        caseId: c.id,
        caseTitle: c.title,
        clientName: c.clientName,
        matterReference: c.matterReference ?? null,
        practiceArea: c.practiceArea ?? null,
        createdAt: c.createdAt,
        feeEarnerName,
        feeEarnerId: c.createdBy,
        supervisorId: c.supervisorId ?? null,
        supervisorName: c.supervisorName ?? null,
        ragStatus,
        outstandingItems: issues.length,
        outstandingUndertakings: outstandingUndsCount,
        lastSignoffDate: lastSignoff,
        daysSinceSignoff,
        issues,
      };
    });

    const outstandingUndertakingsList = outstandingUnds.map(r => {
      const feeEarnerName = r.feeEarner
        ? [r.feeEarner.firstName, r.feeEarner.lastName].filter(Boolean).join(' ') || r.feeEarner.email || 'Unknown'
        : 'Unknown';
      const daysOutstanding = Math.floor((now.getTime() - r.undertaking.dateGiven.getTime()) / (24 * 60 * 60 * 1000));
      return {
        id: r.undertaking.id,
        caseId: r.undertaking.caseId,
        caseTitle: r.caseTitle ?? '',
        matterReference: r.matterReference ?? null,
        wording: r.undertaking.wording,
        feeEarnerName,
        dateGiven: r.undertaking.dateGiven,
        daysOutstanding,
      };
    });

    // Group by fee earner for supervision tab
    const feeEarnerMap = new Map<string, { name: string; supervisorName: string | null; matters: typeof matters }>();
    for (const m of matters) {
      if (!feeEarnerMap.has(m.feeEarnerId)) {
        feeEarnerMap.set(m.feeEarnerId, { name: m.feeEarnerName, supervisorName: m.supervisorName, matters: [] });
      }
      feeEarnerMap.get(m.feeEarnerId)!.matters.push(m);
    }

    const supervisionByFeeEarner = Array.from(feeEarnerMap.entries()).map(([feeEarnerId, data]) => ({
      feeEarnerId,
      feeEarnerName: data.name,
      supervisorName: data.supervisorName,
      matters: data.matters.map(m => ({
        caseId: m.caseId,
        caseTitle: m.caseTitle,
        lastSignoffDate: m.lastSignoffDate,
        daysSinceSignoff: m.daysSinceSignoff,
        needsSignoff: m.daysSinceSignoff === null || m.daysSinceSignoff > 30,
      })),
    }));

    return {
      totalActiveMatters: matters.length,
      redMatters: matters.filter(m => m.ragStatus === 'red').length,
      amberMatters: matters.filter(m => m.ragStatus === 'amber').length,
      greenMatters: matters.filter(m => m.ragStatus === 'green').length,
      totalOutstandingUndertakings: outstandingUndertakingsList.length,
      matters,
      undertakings: outstandingUndertakingsList,
      supervisionByFeeEarner,
    };
  }
}

export const storage = new DbStorage();
