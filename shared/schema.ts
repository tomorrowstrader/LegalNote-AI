import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (Required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
);

// Users table (Updated for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cases = pgTable("cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  clientName: text("client_name").notNull(),
  matterReference: text("matter_reference"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  status: text("status").notNull().default("pending"), // pending, processing, completed
  priority: text("priority").notNull().default("normal"), // urgent, deadline-soon, normal
  sourceType: text("source_type").notNull(), // audio, text
  textNotes: text("text_notes"), // For text-based notes when consent declined
});

export const audioRecordings = pgTable("audio_recordings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id),
  filePath: text("file_path"), // Storage path for audio file
  duration: integer("duration"), // Duration in seconds
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // 24hr from recording
  deletedAt: timestamp("deleted_at"), // Actual deletion timestamp
});

export const consentLogs = pgTable("consent_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id),
  audioRecordingId: varchar("audio_recording_id").references(() => audioRecordings.id),
  solicitorId: varchar("solicitor_id").notNull().references(() => users.id),
  consentGiven: boolean("consent_given").notNull(),
  consentTimestamp: timestamp("consent_timestamp").notNull().defaultNow(),
  disclaimerScriptVersion: text("disclaimer_script_version").notNull(), // Track which disclaimer was used
  consentModality: text("consent_modality").notNull(), // verbal_recorded, verbal_attested, electronic
  ipAddress: text("ip_address"),
  deletionTimestamp: timestamp("deletion_timestamp"), // If consent declined
  deletionReason: text("deletion_reason"), // consent_declined, client_request, retention_expired
});

export const transcripts = pgTable("transcripts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  redactions: jsonb("redactions").default([]), // Array of {start, end, reason, redactedBy, timestamp}
});

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id),
  transcriptSnapshotId: varchar("transcript_snapshot_id").references(() => transcripts.id), // Links to redaction state at generation time
  type: text("type").notNull(), // attendance_note, legal_opinion
  content: text("content").notNull(),
  version: integer("version").notNull().default(1),
  versionType: text("version_type").notNull(), // ai_generated, manually_edited, ai_regenerated
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  isActive: boolean("is_active").notNull().default(true), // Current version flag
  parentVersionId: varchar("parent_version_id").references(() => documents.id), // Self-referential FK to previous version
});

export const clientVersionTracking = pgTable("client_version_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id),
  sentToClient: boolean("sent_to_client").notNull().default(false),
  sentAt: timestamp("sent_at"),
  sentBy: varchar("sent_by").references(() => users.id),
  sentMethod: text("sent_method"), // email, download, etc
  amendmentReason: text("amendment_reason"), // Why document was amended after sending
  versionChangeWarned: boolean("version_change_warned").notNull().default(false), // Warned solicitor about sending different version
});

export const userPreferences = pgTable("user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  dismissedReviewBanner: boolean("dismissed_review_banner").notNull().default(false),
  consentWorkflowPreferences: jsonb("consent_workflow_preferences").default({}), // Future workflow settings
});

// Insert schemas  
export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export const insertCaseSchema = createInsertSchema(cases).omit({
  id: true,
  createdAt: true,
  createdBy: true, // Security: Server assigns this from authenticated session
});

export const insertAudioRecordingSchema = createInsertSchema(audioRecordings).omit({
  id: true,
  recordedAt: true,
});

export const insertConsentLogSchema = createInsertSchema(consentLogs).omit({
  id: true,
  consentTimestamp: true,
});

export const insertTranscriptSchema = createInsertSchema(transcripts).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export const insertClientVersionTrackingSchema = createInsertSchema(clientVersionTracking).omit({
  id: true,
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCase = z.infer<typeof insertCaseSchema>;
export type Case = typeof cases.$inferSelect;

export type InsertAudioRecording = z.infer<typeof insertAudioRecordingSchema>;
export type AudioRecording = typeof audioRecordings.$inferSelect;

export type InsertConsentLog = z.infer<typeof insertConsentLogSchema>;
export type ConsentLog = typeof consentLogs.$inferSelect;

export type InsertTranscript = z.infer<typeof insertTranscriptSchema>;
export type Transcript = typeof transcripts.$inferSelect;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export type InsertClientVersionTracking = z.infer<typeof insertClientVersionTrackingSchema>;
export type ClientVersionTracking = typeof clientVersionTracking.$inferSelect;

export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;
