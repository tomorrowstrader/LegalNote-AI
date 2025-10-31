import { 
  type User, type InsertUser, type UpsertUser, 
  type Case, type InsertCase, 
  type AudioRecording, type InsertAudioRecording, 
  type ConsentLog, type InsertConsentLog,
  type Transcript, type InsertTranscript,
  type Document, type InsertDocument,
  type AuditTrail, type InsertAuditTrail,
  type FirmProfile, type InsertFirmProfile,
  type UserPreferences,
  type CalendarEvent, type InsertCalendarEvent,
  type CalendarIntegration, type InsertCalendarIntegration,
  type ShareLink, type InsertShareLink,
  users,
  cases,
  audioRecordings,
  consentLogs,
  transcripts,
  documents,
  auditTrail,
  firmProfile,
  userPreferences,
  calendarEvents,
  calendarIntegrations,
  shareLinks
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, gte, lte, desc, isNull, sql, count } from "drizzle-orm";

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
  
  createConsentLog(consentData: InsertConsentLog, userId: string): Promise<ConsentLog>;
  getConsentLogsByCase(caseId: string, userId: string): Promise<ConsentLog[]>;
  
  createTranscript(transcriptData: InsertTranscript): Promise<Transcript>;
  getTranscript(id: string): Promise<Transcript | undefined>;
  getTranscriptByCase(caseId: string, userId: string): Promise<Transcript | undefined>;
  updateTranscript(id: string, updates: Partial<Transcript>, userId: string): Promise<Transcript | undefined>;
  
  createDocument(documentData: InsertDocument): Promise<Document>;
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsByCase(caseId: string, userId: string): Promise<Document[]>;
  getActiveDocumentsByCase(caseId: string, userId: string): Promise<Document[]>;
  updateDocument(id: string, updates: Partial<Document>, userId: string): Promise<Document | undefined>;
  
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
  
  // Calendar Event methods
  createCalendarEvent(eventData: InsertCalendarEvent): Promise<CalendarEvent>;
  getCalendarEventsByCase(caseId: string, userId: string): Promise<CalendarEvent[]>;
  getCalendarEventByProvider(caseId: string, userId: string, provider: 'google' | 'outlook'): Promise<CalendarEvent | undefined>;
  updateCalendarEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent | undefined>;
  deleteCalendarEvent(id: string): Promise<void>;
  deleteCalendarEventsByCase(caseId: string, userId: string): Promise<void>;
  
  // Calendar Integration methods (per-user OAuth)
  getCalendarIntegration(userId: string, provider: 'google' | 'outlook'): Promise<CalendarIntegration | undefined>;
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private cases: Map<string, Case>;
  private audioRecordings: Map<string, AudioRecording>;
  private consentLogs: Map<string, ConsentLog>;
  private transcripts: Map<string, Transcript>;
  private documents: Map<string, Document>;
  private auditLogs: Map<string, AuditTrail>;
  private calendarIntegrations: Map<string, CalendarIntegration>;

  constructor() {
    this.users = new Map();
    this.cases = new Map();
    this.audioRecordings = new Map();
    this.consentLogs = new Map();
    this.transcripts = new Map();
    this.documents = new Map();
    this.auditLogs = new Map();
    this.calendarIntegrations = new Map();
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
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    this.users.set(userData.id, user);
    return user;
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

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const document: Document = {
      id,
      caseId: insertDocument.caseId,
      transcriptSnapshotId: insertDocument.transcriptSnapshotId ?? null,
      type: insertDocument.type,
      content: insertDocument.content,
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
    
    const updated = { ...existing, ...updates };
    this.documents.set(id, updated);
    return updated;
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

  async createDocument(documentData: InsertDocument): Promise<Document> {
    const result = await db
      .insert(documents)
      .values({
        caseId: documentData.caseId,
        transcriptSnapshotId: documentData.transcriptSnapshotId ?? null,
        type: documentData.type,
        content: documentData.content,
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
    
    const result = await db
      .update(documents)
      .set(updates)
      .where(eq(documents.id, id))
      .returning();
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
    const lowerQuery = `%${query.toLowerCase()}%`;
    
    // Get all cases for the user
    const userCases = await db
      .select()
      .from(cases)
      .where(eq(cases.createdBy, userId))
      .orderBy(desc(cases.createdAt));
    
    // Find cases with matching transcripts or documents
    const casesWithTranscripts = await db
      .select({ caseId: transcripts.caseId })
      .from(transcripts)
      .innerJoin(cases, eq(transcripts.caseId, cases.id))
      .where(
        and(
          eq(cases.createdBy, userId),
          sql`LOWER(${transcripts.content}) LIKE ${lowerQuery}`
        )
      );
    
    const casesWithDocuments = await db
      .select({ caseId: documents.caseId })
      .from(documents)
      .innerJoin(cases, eq(documents.caseId, cases.id))
      .where(
        and(
          eq(cases.createdBy, userId),
          sql`LOWER(${documents.content}) LIKE ${lowerQuery}`
        )
      );
    
    // Create a set of case IDs that have matching content
    const matchingCaseIds = new Set([
      ...casesWithTranscripts.map(c => c.caseId),
      ...casesWithDocuments.map(c => c.caseId)
    ]);
    
    // Filter cases based on query
    const filteredCases = userCases.filter(c => {
      // Direct field matches
      const titleMatch = c.title.toLowerCase().includes(query.toLowerCase());
      const clientMatch = c.clientName.toLowerCase().includes(query.toLowerCase());
      const matterMatch = c.matterReference?.toLowerCase().includes(query.toLowerCase());
      const notesMatch = c.textNotes?.toLowerCase().includes(query.toLowerCase());
      
      // Content matches from transcripts/documents
      const contentMatch = matchingCaseIds.has(c.id);
      
      return titleMatch || clientMatch || matterMatch || notesMatch || contentMatch;
    });
    
    return filteredCases;
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
}

export const storage = new DbStorage();
