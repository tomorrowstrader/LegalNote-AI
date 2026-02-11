import { 
  type User, type InsertUser, type UpsertUser, 
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
  users,
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
  linkedinPostPerformance
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, gte, lte, desc, isNull, sql, count, inArray } from "drizzle-orm";
import { generateDocumentHash } from "./utils/documentHash";
import { expandSearchWithSynonyms } from "./services/legalSynonyms";

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

// Accent folding helper: Remove diacritics/accents from text
// e.g., "Café" -> "Cafe", "José" -> "Jose"
function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserStripeInfo(userId: string, stripeInfo: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus?: string;
    subscriptionPlan?: string;
    trialEndsAt?: Date | null;
  }): Promise<User | undefined>;
  
  createCase(caseData: InsertCase, userId: string): Promise<Case>;
  getCases(userId: string, includeArchived?: boolean): Promise<Case[]>;
  getCase(id: string, userId: string): Promise<Case | undefined>;
  updateCase(id: string, updates: Partial<Case>, userId: string): Promise<Case | undefined>;
  markCaseAsReviewed(id: string, reviewed: boolean, userId: string): Promise<Case | undefined>;
  archiveCase(id: string, archived: boolean, userId: string): Promise<Case | undefined>;
  assignCaseToUser(id: string, assignedToUserId: string | null, userId: string): Promise<Case | undefined>;
  
  createAudioRecording(audioData: ServerAudioRecordingInsert): Promise<AudioRecording>;
  getAudioRecording(id: string): Promise<AudioRecording | undefined>;
  getAudioRecordingByCase(caseId: string, userId: string): Promise<AudioRecording | undefined>;
  updateAudioRecording(id: string, updates: Partial<AudioRecording>): Promise<AudioRecording | undefined>;
  getExpiredAudioRecordings(): Promise<AudioRecording[]>;
  getExpiringAudioCount(userId: string, withinHours: number): Promise<number>;
  getProductivityStats(userId: string): Promise<{
    totalCases: number;
    awaitingReview: number;
    evidenceCompletePercent: number;
    documentationRate: number;
    thisMonthCases: number;
    monthlyTrend: "up" | "down" | "neutral";
    monthlyChange: number;
  }>;
  
  createConsentLog(consentData: InsertConsentLog, userId: string): Promise<ConsentLog>;
  getConsentLogsByCase(caseId: string, userId: string): Promise<ConsentLog[]>;
  
  createTranscript(transcriptData: InsertTranscript): Promise<Transcript>;
  getTranscript(id: string): Promise<Transcript | undefined>;
  getTranscriptByCase(caseId: string, userId: string): Promise<Transcript | undefined>;
  updateTranscript(id: string, updates: Partial<Transcript>, userId: string): Promise<Transcript | undefined>;
  
  // Action Items methods
  createActionItem(itemData: InsertActionItem): Promise<ActionItem>;
  createManualActionItem(itemData: { caseId: string; description: string; assignee?: string | null; dueDate?: Date; priority?: string; isManual?: boolean }): Promise<ActionItem>;
  getActionItem(id: string, userId: string): Promise<ActionItem | undefined>;
  getActionItemsByCase(caseId: string, userId: string): Promise<ActionItem[]>;
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
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsByCase(caseId: string, userId: string): Promise<Document[]>;
  getActiveDocumentsByCase(caseId: string, userId: string): Promise<Document[]>;
  updateDocument(id: string, updates: Partial<Document>, userId: string): Promise<Document | undefined>;
  approveDocument(id: string, userId: string, comment?: string): Promise<Document | undefined>;
  unlockDocument(id: string, userId: string): Promise<Document | undefined>;
  
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
  getFirmProfile(): Promise<FirmProfile | undefined>;
  upsertFirmProfile(profileData: InsertFirmProfile): Promise<FirmProfile>;
  
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
  getShareLinksByCase(caseId: string, userId: string): Promise<ShareLink[]>;
  updateShareLink(id: string, updates: Partial<ShareLink>): Promise<ShareLink | undefined>;
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
  getMeetingImportsByUser(userId: string): Promise<MeetingImport[]>;
  getMeetingImportsByCase(caseId: string, userId: string): Promise<MeetingImport[]>;
  updateMeetingImport(id: string, updates: Partial<MeetingImport>): Promise<MeetingImport | undefined>;
  
  // Pre-Consent Email methods
  createPreConsentEmail(emailData: InsertPreConsentEmail): Promise<PreConsentEmail>;
  getPreConsentEmail(id: string): Promise<PreConsentEmail | undefined>;
  getPreConsentEmailByToken(token: string): Promise<PreConsentEmail | undefined>;
  getPreConsentEmailsByUser(userId: string): Promise<PreConsentEmail[]>;
  updatePreConsentEmail(id: string, updates: Partial<PreConsentEmail>): Promise<PreConsentEmail | undefined>;
  acknowledgePreConsentEmail(id: string, ipAddress: string): Promise<PreConsentEmail | undefined>;
  
  // Scheduled Meeting methods
  createScheduledMeeting(meetingData: InsertScheduledMeeting): Promise<ScheduledMeeting>;
  getScheduledMeeting(id: string): Promise<ScheduledMeeting | undefined>;
  getScheduledMeetingByCalendarEvent(userId: string, calendarEventId: string, provider: string): Promise<ScheduledMeeting | undefined>;
  getScheduledMeetingsByUser(userId: string): Promise<ScheduledMeeting[]>;
  getUpcomingScheduledMeetings(userId: string, daysAhead?: number): Promise<ScheduledMeeting[]>;
  getMeetingsNeedingConsent(userId: string): Promise<ScheduledMeeting[]>;
  getMeetingsReadyForBot(userId: string): Promise<ScheduledMeeting[]>;
  getAllScheduledMeetingsWithAutoRecord(): Promise<ScheduledMeeting[]>;
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
  private searchHistoryRecords: Map<string, SearchHistory>;

  constructor() {
    this.users = new Map();
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
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existing = this.users.get(userData.id);
    const user: User = {
      id: userData.id,
      email: userData.email ?? null,
      firstName: userData.firstName ?? null,
      lastName: userData.lastName ?? null,
      profileImageUrl: userData.profileImageUrl ?? null,
      stripeCustomerId: existing?.stripeCustomerId ?? null,
      stripeSubscriptionId: existing?.stripeSubscriptionId ?? null,
      subscriptionStatus: existing?.subscriptionStatus ?? null,
      subscriptionPlan: existing?.subscriptionPlan ?? null,
      trialEndsAt: existing?.trialEndsAt ?? null,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    this.users.set(userData.id, user);
    return user;
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

  async createCase(insertCase: InsertCase, userId: string): Promise<Case> {
    const id = randomUUID();
    const newCase: Case = {
      ...insertCase,
      id,
      createdBy: userId, // Security: Enforce user isolation at storage layer
      assignedToUserId: insertCase.assignedToUserId || null,
      createdAt: new Date(),
      status: insertCase.status || "pending",
      priority: insertCase.priority || "normal",
      matterReference: insertCase.matterReference || null,
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

  async getCase(id: string, userId: string): Promise<Case | undefined> {
    const caseRecord = this.cases.get(id);
    if (!caseRecord || caseRecord.createdBy !== userId) return undefined;
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
      recordedAt: new Date(),
      expiresAt: insertAudioRecording.expiresAt,
      filePath: insertAudioRecording.filePath ?? null,
      mimeType: insertAudioRecording.mimeType ?? null,
      duration: insertAudioRecording.duration ?? null,
      deletedAt: null,
    };
    this.audioRecordings.set(id, audioRecording);
    return audioRecording;
  }

  async getAudioRecording(id: string): Promise<AudioRecording | undefined> {
    return this.audioRecordings.get(id);
  }

  async getAudioRecordingByCase(caseId: string, userId: string): Promise<AudioRecording | undefined> {
    const caseRecord = this.cases.get(caseId);
    if (!caseRecord || caseRecord.createdBy !== userId) return undefined;
    
    return Array.from(this.audioRecordings.values()).find(
      (recording) => recording.caseId === caseId
    );
  }

  async updateAudioRecording(id: string, updates: Partial<AudioRecording>): Promise<AudioRecording | undefined> {
    const existing = this.audioRecordings.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.audioRecordings.set(id, updated);
    return updated;
  }

  async getExpiredAudioRecordings(): Promise<AudioRecording[]> {
    const now = new Date();
    return Array.from(this.audioRecordings.values()).filter(
      (recording) => recording.expiresAt < now && !recording.deletedAt
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

  async getProductivityStats(userId: string): Promise<{
    totalCases: number;
    awaitingReview: number;
    evidenceCompletePercent: number;
    documentationRate: number;
    thisMonthCases: number;
    monthlyTrend: "up" | "down" | "neutral";
    monthlyChange: number;
  }> {
    const userCases = Array.from(this.cases.values()).filter(c => c.createdBy === userId && !c.archived);
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

  async createConsentLog(insertConsentLog: InsertConsentLog, userId: string): Promise<ConsentLog> {
    const caseRecord = this.cases.get(insertConsentLog.caseId);
    if (!caseRecord || caseRecord.createdBy !== userId) throw new Error('Case not found or unauthorized');
    
    const id = randomUUID();
    const consentLog: ConsentLog = {
      id,
      caseId: insertConsentLog.caseId,
      audioRecordingId: insertConsentLog.audioRecordingId ?? null,
      solicitorId: insertConsentLog.solicitorId,
      consentGiven: insertConsentLog.consentGiven,
      consentTimestamp: new Date(),
      disclaimerScriptVersion: insertConsentLog.disclaimerScriptVersion,
      consentModality: insertConsentLog.consentModality,
      ipAddress: insertConsentLog.ipAddress ?? null,
      deletionTimestamp: insertConsentLog.deletionTimestamp ?? null,
      deletionReason: insertConsentLog.deletionReason ?? null,
    };
    this.consentLogs.set(id, consentLog);
    return consentLog;
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
    const transcript: Transcript = {
      id,
      caseId: insertTranscript.caseId,
      content: insertTranscript.content,
      utterances: insertTranscript.utterances ?? [],
      speakerCount: insertTranscript.speakerCount ?? null,
      createdAt: new Date(),
      redactions: insertTranscript.redactions ?? [],
    };
    this.transcripts.set(id, transcript);
    return transcript;
  }

  async getTranscript(id: string): Promise<Transcript | undefined> {
    return this.transcripts.get(id);
  }

  async getTranscriptByCase(caseId: string, userId: string): Promise<Transcript | undefined> {
    const caseRecord = this.cases.get(caseId);
    if (!caseRecord || caseRecord.createdBy !== userId) return undefined;
    
    return Array.from(this.transcripts.values()).find(
      (transcript) => transcript.caseId === caseId
    );
  }

  async updateTranscript(id: string, updates: Partial<Transcript>, userId: string): Promise<Transcript | undefined> {
    const existing = this.transcripts.get(id);
    if (!existing) return undefined;
    
    const caseRecord = this.cases.get(existing.caseId);
    if (!caseRecord || caseRecord.createdBy !== userId) return undefined;
    
    const updated = { ...existing, ...updates };
    this.transcripts.set(id, updated);
    return updated;
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
    
    const caseRecord = this.cases.get(item.caseId);
    if (!caseRecord || caseRecord.createdBy !== userId) return undefined;
    
    return item;
  }

  async getActionItemsByCase(caseId: string, userId: string): Promise<ActionItem[]> {
    const caseRecord = this.cases.get(caseId);
    if (!caseRecord || caseRecord.createdBy !== userId) return [];
    
    return Array.from(this.actionItemsMap.values())
      .filter(item => item.caseId === caseId)
      .sort((a, b) => {
        // Sort by priority (high > medium > low) then by dueDate
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const aPriority = priorityOrder[item.priority as keyof typeof priorityOrder] ?? 1;
        const bPriority = priorityOrder[item.priority as keyof typeof priorityOrder] ?? 1;
        if (aPriority !== bPriority) return aPriority - bPriority;
        if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }

  async getActionItemsByTranscript(transcriptId: string, userId: string): Promise<ActionItem[]> {
    const transcript = this.transcripts.get(transcriptId);
    if (!transcript) return [];
    
    const caseRecord = this.cases.get(transcript.caseId);
    if (!caseRecord || caseRecord.createdBy !== userId) return [];
    
    return Array.from(this.actionItemsMap.values())
      .filter(item => item.transcriptId === transcriptId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateActionItem(id: string, updates: Partial<ActionItem>, userId: string): Promise<ActionItem | undefined> {
    const existing = this.actionItemsMap.get(id);
    if (!existing) return undefined;
    
    const caseRecord = this.cases.get(existing.caseId);
    if (!caseRecord || caseRecord.createdBy !== userId) return undefined;
    
    const updated = { ...existing, ...updates };
    this.actionItemsMap.set(id, updated);
    return updated;
  }

  async deleteActionItem(id: string, userId: string): Promise<boolean> {
    const existing = this.actionItemsMap.get(id);
    if (!existing) return false;
    
    const caseRecord = this.cases.get(existing.caseId);
    if (!caseRecord || caseRecord.createdBy !== userId) return false;
    
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
    const document: Document = {
      id,
      caseId: insertDocument.caseId,
      transcriptSnapshotId: insertDocument.transcriptSnapshotId ?? null,
      type: insertDocument.type,
      content: insertDocument.content,
      contentHash,
      version: insertDocument.version,
      versionType: insertDocument.versionType,
      createdAt: new Date(),
      createdBy: insertDocument.createdBy,
      isActive: insertDocument.isActive,
      parentVersionId: insertDocument.parentVersionId ?? null,
    };
    this.documents.set(id, document);
    return document;
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

  async getActiveDocumentsByCase(caseId: string, userId: string): Promise<Document[]> {
    const caseRecord = this.cases.get(caseId);
    if (!caseRecord || caseRecord.createdBy !== userId) return [];
    
    return Array.from(this.documents.values())
      .filter((doc) => doc.caseId === caseId && doc.isActive)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateDocument(id: string, updates: Partial<Document>, userId: string): Promise<Document | undefined> {
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

  async approveDocument(id: string, userId: string, comment?: string): Promise<Document | undefined> {
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
    };
    this.documents.set(id, updated);
    
    await this.createAuditLog({
      eventType: 'document_approved',
      userId,
      caseId: existing.caseId,
      documentId: id,
      metadata: {
        documentType: existing.type,
        comment: comment ?? null,
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
  
  async getFirmProfile(): Promise<FirmProfile | undefined> {
    // MemStorage: In-memory implementation returns undefined (not used in production)
    return undefined;
  }
  
  async upsertFirmProfile(profileData: InsertFirmProfile): Promise<FirmProfile> {
    // MemStorage: In-memory implementation - not used in production
    throw new Error('Firm profile operations require database storage');
  }
  
  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    // MemStorage: In-memory implementation - not used in production
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
  
  async getShareLinksByCase(_caseId: string, _userId: string): Promise<ShareLink[]> {
    throw new Error("MemStorage does not support share links - use DbStorage");
  }
  
  async updateShareLink(_id: string, _updates: Partial<ShareLink>): Promise<ShareLink | undefined> {
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
  
  async getMeetingImportsByUser(_userId: string): Promise<MeetingImport[]> {
    return [];
  }
  
  async getMeetingImportsByCase(_caseId: string, _userId: string): Promise<MeetingImport[]> {
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
  
  async acknowledgePreConsentEmail(_id: string, _ipAddress: string): Promise<PreConsentEmail | undefined> {
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
  
  async getScheduledMeetingsByUser(_userId: string): Promise<ScheduledMeeting[]> {
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
}

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const result = await db
      .insert(users)
      .values({
        id: userData.id,
        email: userData.email ?? null,
        firstName: userData.firstName ?? null,
        lastName: userData.lastName ?? null,
        profileImageUrl: userData.profileImageUrl ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email ?? null,
          firstName: userData.firstName ?? null,
          lastName: userData.lastName ?? null,
          profileImageUrl: userData.profileImageUrl ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
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

  async createCase(insertCase: InsertCase, userId: string): Promise<Case> {
    const result = await db
      .insert(cases)
      .values({
        title: insertCase.title,
        clientName: insertCase.clientName,
        matterReference: insertCase.matterReference ?? null,
        createdBy: userId,
        assignedToUserId: insertCase.assignedToUserId ?? null,
        status: insertCase.status || "pending",
        priority: insertCase.priority || "normal",
        sourceType: insertCase.sourceType,
        textNotes: insertCase.textNotes ?? null,
        reviewed: insertCase.reviewed ?? false,
        archived: insertCase.archived ?? false,
        aiProcessingMetadata: {},
      })
      .returning();
    return result[0];
  }

  async getCases(userId: string, includeArchived: boolean = false): Promise<Case[]> {
    const conditions = includeArchived 
      ? [eq(cases.createdBy, userId)]
      : [eq(cases.createdBy, userId), eq(cases.archived, false)];
      
    return await db
      .select()
      .from(cases)
      .where(and(...conditions))
      .orderBy(desc(cases.createdAt));
  }

  async getCase(id: string, userId: string): Promise<Case | undefined> {
    const result = await db.select().from(cases).where(and(eq(cases.id, id), eq(cases.createdBy, userId)));
    return result[0];
  }

  async updateCase(id: string, updates: Partial<Case>, userId: string): Promise<Case | undefined> {
    const result = await db
      .update(cases)
      .set(updates)
      .where(and(eq(cases.id, id), eq(cases.createdBy, userId)))
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

  async getAudioRecordingByCase(caseId: string, userId: string): Promise<AudioRecording | undefined> {
    const caseRecord = await db.select().from(cases).where(and(eq(cases.id, caseId), eq(cases.createdBy, userId)));
    if (!caseRecord[0]) return undefined;
    
    const result = await db.select().from(audioRecordings).where(eq(audioRecordings.caseId, caseId));
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

  async getExpiredAudioRecordings(): Promise<AudioRecording[]> {
    const now = new Date();
    return await db
      .select()
      .from(audioRecordings)
      .where(and(
        lte(audioRecordings.expiresAt, now),
        isNull(audioRecordings.deletedAt)
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

  async getProductivityStats(userId: string): Promise<{
    totalCases: number;
    awaitingReview: number;
    evidenceCompletePercent: number;
    documentationRate: number;
    thisMonthCases: number;
    monthlyTrend: "up" | "down" | "neutral";
    monthlyChange: number;
  }> {
    const userCases = await db.select().from(cases).where(and(
      eq(cases.createdBy, userId),
      eq(cases.archived, false)
    ));
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

  async createConsentLog(consentData: InsertConsentLog, userId: string): Promise<ConsentLog> {
    const caseRecord = await db.select().from(cases).where(and(eq(cases.id, consentData.caseId), eq(cases.createdBy, userId)));
    if (!caseRecord[0]) throw new Error('Case not found or unauthorized');
    
    const result = await db
      .insert(consentLogs)
      .values({
        caseId: consentData.caseId,
        audioRecordingId: consentData.audioRecordingId ?? null,
        solicitorId: consentData.solicitorId,
        consentGiven: consentData.consentGiven,
        disclaimerScriptVersion: consentData.disclaimerScriptVersion,
        consentModality: consentData.consentModality,
        ipAddress: consentData.ipAddress ?? null,
        deletionTimestamp: consentData.deletionTimestamp ?? null,
        deletionReason: consentData.deletionReason ?? null,
      })
      .returning();
    return result[0];
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
    const result = await db
      .insert(transcripts)
      .values({
        caseId: transcriptData.caseId,
        content: transcriptData.content,
        utterances: transcriptData.utterances ?? [],
        speakerCount: transcriptData.speakerCount ?? null,
        redactions: transcriptData.redactions ?? [],
      })
      .returning();
    return result[0];
  }

  async getTranscript(id: string): Promise<Transcript | undefined> {
    const result = await db.select().from(transcripts).where(eq(transcripts.id, id));
    return result[0];
  }

  async getTranscriptByCase(caseId: string, userId: string): Promise<Transcript | undefined> {
    const caseRecord = await db.select().from(cases).where(and(eq(cases.id, caseId), eq(cases.createdBy, userId)));
    if (!caseRecord[0]) return undefined;
    
    const result = await db.select().from(transcripts).where(eq(transcripts.caseId, caseId));
    return result[0];
  }

  async updateTranscript(id: string, updates: Partial<Transcript>, userId: string): Promise<Transcript | undefined> {
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
    
    const caseRecord = await db.select().from(cases).where(and(eq(cases.id, item[0].caseId), eq(cases.createdBy, userId)));
    if (!caseRecord[0]) return undefined;
    
    return item[0];
  }

  async getActionItemsByCase(caseId: string, userId: string): Promise<ActionItem[]> {
    const caseRecord = await db.select().from(cases).where(and(eq(cases.id, caseId), eq(cases.createdBy, userId)));
    if (!caseRecord[0]) return [];
    
    return await db
      .select()
      .from(actionItems)
      .where(eq(actionItems.caseId, caseId))
      .orderBy(actionItems.priority, actionItems.dueDate, desc(actionItems.createdAt));
  }

  async getActionItemsByTranscript(transcriptId: string, userId: string): Promise<ActionItem[]> {
    const transcript = await db.select().from(transcripts).where(eq(transcripts.id, transcriptId));
    if (!transcript[0]) return [];
    
    const caseRecord = await db.select().from(cases).where(and(eq(cases.id, transcript[0].caseId), eq(cases.createdBy, userId)));
    if (!caseRecord[0]) return [];
    
    return await db
      .select()
      .from(actionItems)
      .where(eq(actionItems.transcriptId, transcriptId))
      .orderBy(desc(actionItems.createdAt));
  }

  async updateActionItem(id: string, updates: Partial<ActionItem>, userId: string): Promise<ActionItem | undefined> {
    const existing = await db.select().from(actionItems).where(eq(actionItems.id, id));
    if (!existing[0]) return undefined;
    
    const caseRecord = await db.select().from(cases).where(and(eq(cases.id, existing[0].caseId), eq(cases.createdBy, userId)));
    if (!caseRecord[0]) return undefined;
    
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
    
    const caseRecord = await db.select().from(cases).where(and(eq(cases.id, existing[0].caseId), eq(cases.createdBy, userId)));
    if (!caseRecord[0]) return false;
    
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
    const result = await db
      .insert(documents)
      .values({
        caseId: documentData.caseId,
        transcriptSnapshotId: documentData.transcriptSnapshotId ?? null,
        type: documentData.type,
        content: documentData.content,
        contentHash,
        version: documentData.version,
        versionType: documentData.versionType,
        createdBy: documentData.createdBy,
        isActive: documentData.isActive,
        parentVersionId: documentData.parentVersionId ?? null,
      })
      .returning();
    return result[0];
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

  async getActiveDocumentsByCase(caseId: string, userId: string): Promise<Document[]> {
    const caseRecord = await db.select().from(cases).where(and(eq(cases.id, caseId), eq(cases.createdBy, userId)));
    if (!caseRecord[0]) return [];
    
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

  async approveDocument(id: string, userId: string, comment?: string): Promise<Document | undefined> {
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
      })
      .where(eq(documents.id, id))
      .returning();
    
    await this.createAuditLog({
      eventType: 'document_approved',
      userId,
      caseId: document[0].caseId,
      documentId: id,
      metadata: {
        documentType: document[0].type,
        comment: comment ?? null,
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
    const result = await db
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
      })
      .returning();
    return result[0];
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
  
  async getFirmProfile(): Promise<FirmProfile | undefined> {
    const result = await db.select().from(firmProfile).limit(1);
    return result[0];
  }
  
  async upsertFirmProfile(profileData: InsertFirmProfile): Promise<FirmProfile> {
    // First, check if a profile exists
    const existing = await this.getFirmProfile();
    
    if (existing) {
      // Update existing profile
      const updated = await db
        .update(firmProfile)
        .set({
          ...profileData,
          updatedAt: new Date(),
        })
        .where(eq(firmProfile.id, existing.id))
        .returning();
      return updated[0];
    } else {
      // Insert new profile
      const inserted = await db
        .insert(firmProfile)
        .values({
          ...profileData,
          updatedAt: new Date(),
        })
        .returning();
      return inserted[0];
    }
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
            break;
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
            
            if (foundInUtterances) continue; // Skip fallback content search
          }
          
          // Fallback: search plain content if no utterances or no match found
          if (!transcript.content) continue;
          const contentLower = removeAccents(transcript.content.toLowerCase());
          
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
              break;
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
              break;
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
  
  async acknowledgePreConsentEmail(id: string, ipAddress: string): Promise<PreConsentEmail | undefined> {
    const result = await db
      .update(preConsentEmails)
      .set({
        consentAcknowledged: true,
        consentAcknowledgedAt: new Date(),
        consentAcknowledgedIp: ipAddress,
      })
      .where(eq(preConsentEmails.id, id))
      .returning();
    return result[0];
  }
  
  // Scheduled Meeting methods
  async createScheduledMeeting(meetingData: InsertScheduledMeeting): Promise<ScheduledMeeting> {
    const result = await db
      .insert(scheduledMeetings)
      .values({
        userId: meetingData.userId,
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
  
  async getScheduledMeetingsByUser(userId: string): Promise<ScheduledMeeting[]> {
    return await db
      .select()
      .from(scheduledMeetings)
      .where(eq(scheduledMeetings.userId, userId))
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
          gte(scheduledMeetings.startTime, now),
          lte(scheduledMeetings.startTime, twoDaysAhead)
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
}

export const storage = new DbStorage();
