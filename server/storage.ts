import { type User, type InsertUser, type Case, type InsertCase, type AudioRecording, type InsertAudioRecording } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createCase(caseData: InsertCase): Promise<Case>;
  getCases(userId: string): Promise<Case[]>;
  getCase(id: string): Promise<Case | undefined>;
  
  createAudioRecording(audioData: InsertAudioRecording): Promise<AudioRecording>;
  getAudioRecording(id: string): Promise<AudioRecording | undefined>;
  getAudioRecordingByCase(caseId: string): Promise<AudioRecording | undefined>;
  updateAudioRecording(id: string, updates: Partial<AudioRecording>): Promise<AudioRecording | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private cases: Map<string, Case>;
  private audioRecordings: Map<string, AudioRecording>;

  constructor() {
    this.users = new Map();
    this.cases = new Map();
    this.audioRecordings = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createCase(insertCase: InsertCase): Promise<Case> {
    const id = randomUUID();
    const newCase: Case = {
      ...insertCase,
      id,
      createdAt: new Date(),
      status: insertCase.status || "pending",
      priority: insertCase.priority || "normal",
      matterReference: insertCase.matterReference || null,
      textNotes: insertCase.textNotes || null,
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

  async createAudioRecording(insertAudioRecording: InsertAudioRecording): Promise<AudioRecording> {
    const id = randomUUID();
    const audioRecording: AudioRecording = {
      ...insertAudioRecording,
      id,
      recordedAt: new Date(),
      filePath: insertAudioRecording.filePath || null,
      duration: insertAudioRecording.duration || null,
      deletedAt: insertAudioRecording.deletedAt || null,
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
}

export const storage = new MemStorage();
