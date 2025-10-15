import { 
  type User, type InsertUser, type UpsertUser, 
  type Case, type InsertCase, 
  type AudioRecording, type InsertAudioRecording, 
  type ConsentLog, type InsertConsentLog,
  type Transcript, type InsertTranscript,
  type Document, type InsertDocument,
  type AuditTrail, type InsertAuditTrail 
} from "@shared/schema";
import { randomUUID } from "crypto";

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
  getCases(userId: string): Promise<Case[]>;
  getCase(id: string): Promise<Case | undefined>;
  updateCase(id: string, updates: Partial<Case>): Promise<Case | undefined>;
  
  createAudioRecording(audioData: ServerAudioRecordingInsert): Promise<AudioRecording>;
  getAudioRecording(id: string): Promise<AudioRecording | undefined>;
  getAudioRecordingByCase(caseId: string): Promise<AudioRecording | undefined>;
  updateAudioRecording(id: string, updates: Partial<AudioRecording>): Promise<AudioRecording | undefined>;
  getExpiredAudioRecordings(): Promise<AudioRecording[]>;
  
  createConsentLog(consentData: InsertConsentLog): Promise<ConsentLog>;
  getConsentLogsByCase(caseId: string): Promise<ConsentLog[]>;
  
  createTranscript(transcriptData: InsertTranscript): Promise<Transcript>;
  getTranscript(id: string): Promise<Transcript | undefined>;
  getTranscriptByCase(caseId: string): Promise<Transcript | undefined>;
  updateTranscript(id: string, updates: Partial<Transcript>): Promise<Transcript | undefined>;
  
  createDocument(documentData: InsertDocument): Promise<Document>;
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsByCase(caseId: string): Promise<Document[]>;
  getActiveDocumentsByCase(caseId: string): Promise<Document[]>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined>;
  
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private cases: Map<string, Case>;
  private audioRecordings: Map<string, AudioRecording>;
  private consentLogs: Map<string, ConsentLog>;
  private transcripts: Map<string, Transcript>;
  private documents: Map<string, Document>;
  private auditLogs: Map<string, AuditTrail>;

  constructor() {
    this.users = new Map();
    this.cases = new Map();
    this.audioRecordings = new Map();
    this.consentLogs = new Map();
    this.transcripts = new Map();
    this.documents = new Map();
    this.auditLogs = new Map();
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
      createdAt: new Date(),
      status: insertCase.status || "pending",
      priority: insertCase.priority || "normal",
      matterReference: insertCase.matterReference || null,
      textNotes: insertCase.textNotes || null,
      aiProcessingMetadata: {},
    };
    this.cases.set(id, newCase);
    return newCase;
  }

  async getCases(userId: string): Promise<Case[]> {
    return Array.from(this.cases.values())
      .filter(c => c.createdBy === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getCase(id: string): Promise<Case | undefined> {
    return this.cases.get(id);
  }

  async updateCase(id: string, updates: Partial<Case>): Promise<Case | undefined> {
    const existing = this.cases.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.cases.set(id, updated);
    return updated;
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

  async getAudioRecordingByCase(caseId: string): Promise<AudioRecording | undefined> {
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

  async createConsentLog(insertConsentLog: InsertConsentLog): Promise<ConsentLog> {
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

  async getConsentLogsByCase(caseId: string): Promise<ConsentLog[]> {
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

  async getTranscriptByCase(caseId: string): Promise<Transcript | undefined> {
    return Array.from(this.transcripts.values()).find(
      (transcript) => transcript.caseId === caseId
    );
  }

  async updateTranscript(id: string, updates: Partial<Transcript>): Promise<Transcript | undefined> {
    const existing = this.transcripts.get(id);
    if (!existing) return undefined;
    
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

  async getDocumentsByCase(caseId: string): Promise<Document[]> {
    return Array.from(this.documents.values())
      .filter((doc) => doc.caseId === caseId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getActiveDocumentsByCase(caseId: string): Promise<Document[]> {
    return Array.from(this.documents.values())
      .filter((doc) => doc.caseId === caseId && doc.isActive)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    const existing = this.documents.get(id);
    if (!existing) return undefined;
    
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
}

export const storage = new DbStorage();
