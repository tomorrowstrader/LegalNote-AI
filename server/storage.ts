import { type User, type InsertUser, type Case, type InsertCase } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Case management
  createCase(caseData: InsertCase): Promise<Case>;
  getCases(userId: string): Promise<Case[]>;
  getCase(id: string): Promise<Case | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private cases: Map<string, Case>;

  constructor() {
    this.users = new Map();
    this.cases = new Map();
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
}

export const storage = new MemStorage();
