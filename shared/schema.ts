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
  assignedToUserId: varchar("assigned_to_user_id").references(() => users.id), // Team member assignment
  createdAt: timestamp("created_at").notNull().defaultNow(),
  status: text("status").notNull().default("pending"), // pending, processing, review_required, completed
  priority: text("priority").notNull().default("normal"), // urgent, deadline-soon, normal
  sourceType: text("source_type").notNull(), // audio, text
  textNotes: text("text_notes"), // For text-based notes when consent declined
  reviewed: boolean("reviewed").notNull().default(false), // Marks case as reviewed by solicitor
  archived: boolean("archived").notNull().default(false), // Soft delete / archive functionality
  aiProcessingMetadata: jsonb("ai_processing_metadata").default({}), // Tracks tokens, costs, processing status, errors
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
  type: text("type").notNull(), // attendance_note, summary, legal_opinion
  content: text("content").notNull(),
  version: integer("version").notNull().default(1),
  versionType: text("version_type").notNull(), // ai_generated, manually_edited, ai_regenerated
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  isActive: boolean("is_active").notNull().default(true), // Current version flag
  parentVersionId: varchar("parent_version_id"), // Self-referential FK to previous version - set manually to avoid circular reference
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
  userId: varchar("user_id").notNull().unique().references(() => users.id),
  dismissedReviewBanner: boolean("dismissed_review_banner").notNull().default(false),
  completedOnboarding: boolean("completed_onboarding").notNull().default(false),
  consentWorkflowPreferences: jsonb("consent_workflow_preferences").default({}), // Future workflow settings
});

export const auditTrail = pgTable("audit_trail", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: text("event_type").notNull(), // Comprehensive event types:
  // Recording lifecycle: recording_started, consent_given, consent_declined, audio_uploaded
  // Audio playback: audio_playback_started, audio_playback_paused, audio_seeked, audio_deleted
  // AI operations: transcript_generated, document_generated, document_regenerated
  // Document modifications: document_edited, transcript_redacted
  // Exports: document_exported_pdf, document_exported_word, audit_exported_csv
  // Case actions: case_created, case_viewed, case_updated, case_priority_changed, case_assigned, case_email_sent
  // System events: user_login, user_logout, session_expired
  userId: varchar("user_id").notNull().references(() => users.id),
  caseId: varchar("case_id").references(() => cases.id),
  documentId: varchar("document_id").references(() => documents.id),
  transcriptId: varchar("transcript_id").references(() => transcripts.id),
  audioRecordingId: varchar("audio_recording_id").references(() => audioRecordings.id),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata").default({}), // Additional context like { documentType, oldValue, newValue, action, recordingDuration, playbackPosition, etc }
  severity: text("severity").notNull().default("info"), // info, warning, critical
});

export const firmProfile = pgTable("firm_profile", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firmName: text("firm_name").notNull(),
  logoUrl: text("logo_url"), // URL to logo in object storage
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  city: text("city"),
  postcode: text("postcode"),
  country: text("country").default("United Kingdom"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  sraNumber: text("sra_number"), // SRA firm registration number
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
});

// Input validation helpers
const sanitizeString = (str: string) => str.trim();

// Insert schemas with enhanced validation and length limits
export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
}).extend({
  email: z.string().email().max(255).transform(sanitizeString).optional(),
  firstName: z.string().max(100).transform(sanitizeString).optional(),
  lastName: z.string().max(100).transform(sanitizeString).optional(),
  profileImageUrl: z.string().url().max(500).optional(),
});

export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
}).extend({
  id: z.string().uuid(),
  email: z.string().email().max(255).transform(sanitizeString).optional(),
  firstName: z.string().max(100).transform(sanitizeString).optional(),
  lastName: z.string().max(100).transform(sanitizeString).optional(),
  profileImageUrl: z.string().url().max(500).optional(),
});

export const insertCaseSchema = createInsertSchema(cases).omit({
  id: true,
  createdAt: true,
  createdBy: true, // Security: Server assigns this from authenticated session
  aiProcessingMetadata: true, // Server manages this
}).extend({
  title: z.string().min(1).max(500).transform(sanitizeString),
  clientName: z.string().min(1).max(200).transform(sanitizeString),
  matterReference: z.string().max(100).transform(sanitizeString).optional(),
  status: z.enum(["pending", "processing", "review_required", "completed"]).default("pending"),
  priority: z.enum(["urgent", "deadline-soon", "normal"]).default("normal"),
  sourceType: z.enum(["audio", "text"]),
  textNotes: z.string().max(100000).optional(), // 100KB limit for text notes
});

export const insertAudioRecordingSchema = createInsertSchema(audioRecordings).omit({
  id: true,
  recordedAt: true,
  expiresAt: true, // Server calculates this (24 hours from creation)
  deletedAt: true,
}).extend({
  caseId: z.string().uuid(),
  filePath: z.string().max(500)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9\-_\.\/]*[a-zA-Z0-9]$/) // Must start/end with alphanumeric
    .refine((path) => !path.includes('..'), { message: 'Path traversal detected: .. not allowed' })
    .refine((path) => !path.startsWith('/'), { message: 'Absolute paths not allowed' })
    .refine((path) => !path.includes('//'), { message: 'Consecutive slashes not allowed' })
    .refine((path) => !path.includes('\\'), { message: 'Backslashes not allowed' })
    .optional(),
  duration: z.number().int().min(0).max(14400).optional(), // Max 4 hours
});

export const insertConsentLogSchema = createInsertSchema(consentLogs).omit({
  id: true,
  consentTimestamp: true,
}).extend({
  caseId: z.string().uuid(),
  audioRecordingId: z.string().uuid().optional(),
  solicitorId: z.string().min(1), // Replit Auth IDs are not UUIDs, just require non-empty string
  consentGiven: z.boolean(),
  disclaimerScriptVersion: z.string().max(50),
  consentModality: z.enum(["verbal_recorded", "verbal_attested", "electronic"]),
  ipAddress: z.string().ip().optional(),
  deletionReason: z.enum(["consent_declined", "client_request", "retention_expired"]).optional(),
});

export const insertTranscriptSchema = createInsertSchema(transcripts).omit({
  id: true,
  createdAt: true,
}).extend({
  caseId: z.string().uuid(),
  content: z.string().max(1000000), // 1MB max for transcript
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
}).extend({
  caseId: z.string().uuid(),
  transcriptSnapshotId: z.string().uuid().optional(),
  type: z.enum(["attendance_note", "summary", "legal_opinion"]),
  content: z.string().max(1000000), // 1MB max for documents
  version: z.number().int().min(1).default(1),
  versionType: z.enum(["ai_generated", "manually_edited", "ai_regenerated"]),
  createdBy: z.string().uuid(),
  isActive: z.boolean().default(true),
  parentVersionId: z.string().uuid().optional(),
});

export const insertClientVersionTrackingSchema = createInsertSchema(clientVersionTracking).omit({
  id: true,
}).extend({
  documentId: z.string().uuid(),
  sentToClient: z.boolean().default(false),
  sentBy: z.string().uuid().optional(),
  sentMethod: z.enum(["email", "download", "portal"]).optional(),
  amendmentReason: z.string().max(1000).transform(sanitizeString).optional(),
  versionChangeWarned: z.boolean().default(false),
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
}).extend({
  userId: z.string().min(1), // Replit Auth IDs are not UUIDs
  dismissedReviewBanner: z.boolean().default(false),
  completedOnboarding: z.boolean().default(false),
});

export const insertAuditTrailSchema = createInsertSchema(auditTrail).omit({
  id: true,
  timestamp: true,
}).extend({
  eventType: z.enum([
    "case_viewed", "case_created", "case_updated", 
    "document_viewed", "document_created", "document_updated", "document_deleted", "document_downloaded", "document_sent",
    "transcript_viewed", "transcript_redacted",
    "audio_accessed", "audio_deleted",
    "ai_processing_started", "ai_transcription_completed", "ai_document_generated", "ai_processing_failed"
  ]),
  userId: z.string().uuid(),
  caseId: z.string().uuid().optional(),
  documentId: z.string().uuid().optional(),
  transcriptId: z.string().uuid().optional(),
  audioRecordingId: z.string().uuid().optional(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().max(500).optional(),
  metadata: z.record(z.any()).optional(),
  severity: z.enum(["info", "warning", "critical"]).default("info"),
});

export const insertFirmProfileSchema = createInsertSchema(firmProfile).omit({
  id: true,
  updatedAt: true,
}).extend({
  firmName: z.string().min(1).max(200).transform(sanitizeString),
  logoUrl: z.string().url().max(500).optional(),
  addressLine1: z.string().max(200).transform(sanitizeString).optional(),
  addressLine2: z.string().max(200).transform(sanitizeString).optional(),
  city: z.string().max(100).transform(sanitizeString).optional(),
  postcode: z.string().max(20).transform(sanitizeString).optional(),
  country: z.string().max(100).transform(sanitizeString).default("United Kingdom"),
  phone: z.string().max(50).transform(sanitizeString).optional(),
  email: z.string().email().max(255).transform(sanitizeString).optional(),
  website: z.string().url().max(500).optional(),
  sraNumber: z.string().max(50).transform(sanitizeString).optional(),
  updatedBy: z.string().min(1).optional(), // Replit Auth IDs are not UUIDs
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

export type InsertAuditTrail = z.infer<typeof insertAuditTrailSchema>;
export type AuditTrail = typeof auditTrail.$inferSelect;

export type InsertFirmProfile = z.infer<typeof insertFirmProfileSchema>;
export type FirmProfile = typeof firmProfile.$inferSelect;
