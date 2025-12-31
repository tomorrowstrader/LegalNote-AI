import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, unique } from "drizzle-orm/pg-core";
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

// Users table (Updated for Replit Auth + Stripe)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionStatus: varchar("subscription_status"), // active, trialing, past_due, canceled, unpaid
  subscriptionPlan: varchar("subscription_plan"), // solo, team
  trialEndsAt: timestamp("trial_ends_at"),
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
  deadline: timestamp("deadline"), // Case deadline for calendar sync
  syncToCalendar: boolean("sync_to_calendar").notNull().default(false), // Whether to sync deadline to calendar
  deadlineIsAllDay: boolean("deadline_is_all_day").notNull().default(false), // Whether deadline is all-day or has specific time
  litigationHold: boolean("litigation_hold").notNull().default(false), // Prevents auto-deletion of audio
  litigationHoldAppliedAt: timestamp("litigation_hold_applied_at"),
  litigationHoldAppliedBy: varchar("litigation_hold_applied_by").references(() => users.id),
  litigationHoldReason: text("litigation_hold_reason"), // Justification for hold
  litigationHoldReleasedAt: timestamp("litigation_hold_released_at"), // When hold was last released
  litigationHoldReleasedBy: varchar("litigation_hold_released_by").references(() => users.id), // Who released the hold
});

export const quickNotes = pgTable("quick_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id),
  content: text("content").notNull(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const audioRecordings = pgTable("audio_recordings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id),
  filePath: text("file_path"), // Storage path for audio file
  consentSegmentPath: text("consent_segment_path"), // Storage path for preserved consent segment (timestamp-based)
  consentDurationSeconds: integer("consent_duration_seconds"), // Exact duration of consent segment (from start to consent confirmation)
  mimeType: text("mime_type"), // MIME type of audio (audio/webm, audio/wav, etc.)
  duration: integer("duration"), // Duration in seconds
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // 7 days from recording
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
  disclaimerWordingText: text("disclaimer_wording_text"), // Actual text shown/read to client for future defensibility
  consentModality: text("consent_modality").notNull(), // verbal_recorded, verbal_attested, electronic
  ipAddress: text("ip_address"),
  deletionTimestamp: timestamp("deletion_timestamp"), // If consent declined
  deletionReason: text("deletion_reason"), // consent_declined, client_request, retention_expired
  lawfulBasis: text("lawful_basis"), // GDPR Article 6 basis: consent, contract, legitimate_interests
  recordingPurpose: text("recording_purpose"), // Why recording is being made
  consentWithdrawn: boolean("consent_withdrawn").notNull().default(false),
  withdrawalTimestamp: timestamp("withdrawal_timestamp"),
  withdrawalReason: text("withdrawal_reason"),
  withdrawnBy: varchar("withdrawn_by").references(() => users.id),
});

export const transcripts = pgTable("transcripts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id),
  content: text("content").notNull(),
  utterances: jsonb("utterances").default([]), // Array of {speaker, text, start, end, confidence} for diarization
  speakerCount: integer("speaker_count"), // Number of distinct speakers detected
  createdAt: timestamp("created_at").notNull().defaultNow(),
  redactions: jsonb("redactions").default([]), // Array of {start, end, reason, redactedBy, timestamp}
});

// AI-extracted or manually created action items
export const actionItems = pgTable("action_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id),
  transcriptId: varchar("transcript_id").references(() => transcripts.id), // Nullable for manual items
  description: text("description").notNull(),
  originalDescription: text("original_description"), // Preserves AI-generated text before edits
  assignee: text("assignee"), // "Solicitor", "Client", or specific name
  dueDate: timestamp("due_date"),
  priority: text("priority").notNull().default("medium"), // high, medium, low
  status: text("status").notNull().default("draft"), // draft, approved, rejected
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by").references(() => users.id),
  sourceUtteranceIndex: integer("source_utterance_index"),
  isManual: boolean("is_manual").notNull().default(false), // True if manually created by solicitor
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Pre-meeting briefings - AI-generated summaries from all prior meetings on a case
export const preMeetingBriefings = pgTable("pre_meeting_briefings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id),
  content: text("content").notNull(),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  generatedBy: varchar("generated_by").notNull().references(() => users.id),
  sourceMeetingCount: integer("source_meeting_count").notNull().default(0),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  cost: text("cost"), // Stored as string for precision
});

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id),
  transcriptSnapshotId: varchar("transcript_snapshot_id").references(() => transcripts.id), // Links to redaction state at generation time
  type: text("type").notNull(), // attendance_note, summary
  content: text("content").notNull(),
  contentHash: text("content_hash"), // SHA-256 hash for integrity verification
  version: integer("version").notNull().default(1),
  versionType: text("version_type").notNull(), // ai_generated, manually_edited, ai_regenerated
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  isActive: boolean("is_active").notNull().default(true), // Current version flag
  parentVersionId: varchar("parent_version_id"), // Self-referential FK to previous version - set manually to avoid circular reference
  status: text("status").notNull().default("draft"), // draft, approved
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  approvalComment: text("approval_comment"),
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
  consentWorkflowPreferences: jsonb("consent_workflow_preferences").default({}),
  sendRecordingConfirmationEmails: boolean("send_recording_confirmation_emails").notNull().default(false),
});

export const auditTrail = pgTable("audit_trail", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: text("event_type").notNull(), // Comprehensive event types:
  // Recording lifecycle: recording_started, consent_given, consent_declined, audio_uploaded
  // Audio playback: audio_playback_started, audio_playback_paused, audio_seeked, audio_deleted
  // AI operations: transcript_generated, document_generated, document_regenerated
  // Document modifications: document_edited, transcript_redacted
  // Document review: document_approved, document_unlocked
  // Exports: document_exported_pdf, document_exported_word, audit_exported_csv
  // Case actions: case_created, case_viewed, case_updated, case_priority_changed, case_assigned, case_email_sent, calendar_synced, calendar_sync_failed
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

export const dsarRequests = pgTable("dsar_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestType: text("request_type").notNull(), // access, erasure, restriction, rectification, portability, objection
  requesterName: text("requester_name").notNull(),
  requesterEmail: text("requester_email").notNull(),
  requesterPhone: text("requester_phone"),
  requesterRelationship: text("requester_relationship").notNull(), // data_subject, legal_representative, third_party_authorised
  verificationMethod: text("verification_method"), // id_check, email_confirmation, phone_verification
  verifiedAt: timestamp("verified_at"),
  verifiedBy: varchar("verified_by").references(() => users.id),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id),
  dueDate: timestamp("due_date").notNull(), // ICO 30-day deadline
  status: text("status").notNull().default("received"), // received, acknowledged, processing, awaiting_verification, completed, rejected
  dataLocated: jsonb("data_located").default([]), // Array of {type, location, caseId, description}
  dataProvided: jsonb("data_provided").default([]), // Array of {type, description, providedAt, method}
  dataWithheld: jsonb("data_withheld").default([]), // Array of {type, description, legalBasis, reasoning}
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by").references(() => users.id),
  responseMethod: text("response_method"), // email, post, secure_download
  notes: text("notes"), // Internal notes about the request
  handledBy: varchar("handled_by").references(() => users.id), // Assigned handler
  createdBy: varchar("created_by").notNull().references(() => users.id),
});

export const securityIncidents = pgTable("security_incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  incidentType: text("incident_type").notNull(), // failed_access, suspicious_activity, privilege_concern, confidentiality_breach, data_breach
  severity: text("severity").notNull().default("medium"), // low, medium, high, critical
  status: text("status").notNull().default("open"), // open, investigating, resolved, escalated
  reportedAt: timestamp("reported_at").notNull().defaultNow(),
  reportedBy: varchar("reported_by").references(() => users.id),
  affectedUserId: varchar("affected_user_id").references(() => users.id),
  affectedCaseId: varchar("affected_case_id").references(() => cases.id),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  description: text("description").notNull(),
  investigationNotes: text("investigation_notes"),
  investigatedBy: varchar("investigated_by").references(() => users.id),
  investigationStartedAt: timestamp("investigation_started_at"),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolution: text("resolution"),
  remedialActions: jsonb("remedial_actions").default([]), // Array of {action, takenAt, takenBy, description}
  notifiedParties: jsonb("notified_parties").default([]), // Array of {party, notifiedAt, method} for ICO/client notifications
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
  
  // Document Preferences
  includeLocation: boolean("include_location").notNull().default(true),
  showFullSolicitorName: boolean("show_full_solicitor_name").notNull().default(true),
  includeClientConfirmation: boolean("include_client_confirmation").notNull().default(false),
  
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
});

export const calendarIntegrations = pgTable("calendar_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull(), // google, outlook
  accessToken: text("access_token").notNull(), // Encrypted OAuth access token
  refreshToken: text("refresh_token"), // Encrypted OAuth refresh token
  expiresAt: timestamp("expires_at"), // Token expiration time
  calendarId: text("calendar_id"), // Primary calendar ID for the provider
  email: text("email"), // Calendar account email
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
  lastSyncAt: timestamp("last_sync_at"),
}, (table) => ({
  // Compound unique constraint: each user can have one Google and one Outlook connection
  userProviderUnique: unique().on(table.userId, table.provider),
}));

export const calendarEvents = pgTable("calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull(), // google, outlook
  providerEventId: text("provider_event_id").notNull(), // External calendar event ID
  eventType: text("event_type").notNull().default("deadline"), // deadline, hearing, meeting
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
  lastUpdatedAt: timestamp("last_updated_at"),
});

export const shareLinks = pgTable("share_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  recipientEmail: text("recipient_email").notNull(),
  recipientName: text("recipient_name").notNull(),
  isExternal: boolean("is_external").notNull().default(true), // External vs internal sharing
  organization: text("organization"), // External recipient's organization
  accessLevel: text("access_level").notNull().default("view"), // view, download
  expiresAt: timestamp("expires_at").notNull(),
  password: text("password"), // Optional password protection
  clientConsent: boolean("client_consent").notNull().default(false),
  accessCount: integer("access_count").notNull().default(0),
  lastAccessedAt: timestamp("last_accessed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  smsProtection: boolean("sms_protection").notNull().default(false), // Whether SMS verification is required
  smsPhoneNumber: text("sms_phone_number"), // Phone number for SMS verification
  smsVerificationCode: text("sms_verification_code"), // The code sent via SMS
  smsCodeExpiresAt: timestamp("sms_code_expires_at"), // When the SMS code expires
  smsVerified: boolean("sms_verified").notNull().default(false), // Whether SMS verification was completed
  smsVerifiedAt: timestamp("sms_verified_at"), // When SMS verification was completed
  smsCodeSentCount: integer("sms_code_sent_count").notNull().default(0), // Rate limit: max 3 SMS sends per link
  smsVerificationAttempts: integer("sms_verification_attempts").notNull().default(0), // Rate limit: max 5 verification attempts per link
  sharedDocuments: text("shared_documents").array().notNull().default(sql`ARRAY['attendance_note']::text[]`), // Document types to share: attendance_note, summary, transcript
});

// Recall.ai video conferencing connection (per-user OAuth)
export const recallConnections = pgTable("recall_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: text("status").notNull().default("active"), // active, disconnected, error
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
  lastSyncAt: timestamp("last_sync_at"),
  metadata: jsonb("metadata").default({}), // Stores Recall account info, capabilities
}, (table) => ({
  userUnique: unique().on(table.userId),
}));

// Meeting imports from Recall.ai
export const meetingImports = pgTable("meeting_imports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  caseId: varchar("case_id").references(() => cases.id), // Linked case (null if not yet linked)
  recallBotId: text("recall_bot_id").notNull(), // Recall.ai bot ID
  recallRecordingId: text("recall_recording_id"), // Recall.ai recording ID
  meetingPlatform: text("meeting_platform").notNull(), // zoom, teams, meet
  meetingUrl: text("meeting_url"), // Original meeting URL
  meetingTitle: text("meeting_title"),
  meetingStartTime: timestamp("meeting_start_time"),
  meetingEndTime: timestamp("meeting_end_time"),
  durationSeconds: integer("duration_seconds"),
  participants: jsonb("participants").default([]), // Array of {email, name, joined_at}
  status: text("status").notNull().default("pending"), // pending, downloading, transcribing, completed, failed
  audioStoragePath: text("audio_storage_path"), // Path in object storage
  errorMessage: text("error_message"),
  consentConfirmed: boolean("consent_confirmed").notNull().default(false), // Whether consent was confirmed for this import
  preConsentEmailId: varchar("pre_consent_email_id").references(() => preConsentEmails.id), // Link to pre-meeting consent email
  recallCostUSD: text("recall_cost_usd"), // Cost for this recording from Recall.ai (stored as text for precision)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  importedAt: timestamp("imported_at"), // When recording was successfully imported
});

// Scheduled meetings from calendar integration (for auto-recording)
export const scheduledMeetings = pgTable("scheduled_meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  calendarEventId: text("calendar_event_id").notNull(), // Google Calendar event ID
  calendarProvider: text("calendar_provider").notNull().default("google"), // google, outlook
  title: text("title").notNull(),
  description: text("description"),
  meetingUrl: text("meeting_url"), // Extracted meeting link (Zoom, Teams, Meet)
  meetingPlatform: text("meeting_platform"), // zoom, teams, meet, webex
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  attendees: jsonb("attendees").default([]), // Array of {email, name, responseStatus}
  clientEmail: text("client_email"), // Primary client email for consent
  clientName: text("client_name"), // Primary client name
  autoRecordEnabled: boolean("auto_record_enabled").notNull().default(false), // Opt-in for auto-recording
  consentStatus: text("consent_status").notNull().default("pending"), // pending, sent, approved, declined, expired
  preConsentEmailId: varchar("pre_consent_email_id").references(() => preConsentEmails.id),
  recallBotId: text("recall_bot_id"), // Recall.ai bot ID when deployed
  botStatus: text("bot_status"), // waiting, joining, in_call, done, failed
  meetingImportId: varchar("meeting_import_id"), // Link to imported recording
  lastPolledAt: timestamp("last_polled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userCalendarEventUnique: unique().on(table.userId, table.calendarEventId, table.calendarProvider),
}));

// Pre-meeting consent emails for video calls
export const preConsentEmails = pgTable("pre_consent_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  caseId: varchar("case_id").references(() => cases.id), // Optional: link to existing case
  recipientEmail: text("recipient_email").notNull(),
  recipientName: text("recipient_name").notNull(),
  meetingPlatform: text("meeting_platform"), // zoom, teams, meet
  scheduledMeetingTime: timestamp("scheduled_meeting_time"),
  meetingUrl: text("meeting_url"),
  emailSubject: text("email_subject").notNull(),
  emailBody: text("email_body").notNull(),
  consentToken: text("consent_token").notNull(), // Unique token for consent acknowledgement
  consentAcknowledged: boolean("consent_acknowledged").notNull().default(false),
  consentAcknowledgedAt: timestamp("consent_acknowledged_at"),
  consentAcknowledgedIp: text("consent_acknowledged_ip"),
  emailSentAt: timestamp("email_sent_at"),
  emailStatus: text("email_status").notNull().default("pending"), // pending, sent, failed, bounced
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"), // Consent expires after a period
});

// SharePoint/OneDrive connections (per-user, Replit-managed)
export const sharePointConnections = pgTable("share_point_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull(), // sharepoint, onedrive
  driveId: text("drive_id").notNull(), // Microsoft Graph drive ID
  driveName: text("drive_name"), // Display name (e.g., "Documents" or "OneDrive")
  email: text("email"), // User's Microsoft account email
  status: text("status").notNull().default("active"), // active, disconnected, error
  autoSyncEnabled: boolean("auto_sync_enabled").notNull().default(true), // Auto-sync documents
  lastSyncAt: timestamp("last_sync_at"),
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Each user can have one SharePoint and one OneDrive connection
  userProviderUnique: unique().on(table.userId, table.provider),
}));

// Clio Practice Management System integration (OAuth 2.0)
export const clioConnections = pgTable("clio_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  accessToken: text("access_token").notNull(), // Encrypted access token
  refreshToken: text("refresh_token").notNull(), // Encrypted refresh token
  tokenExpiresAt: timestamp("token_expires_at").notNull(),
  clioUserId: text("clio_user_id"), // Clio user ID
  clioFirmId: text("clio_firm_id"), // Clio firm ID
  clioFirmName: text("clio_firm_name"), // Clio firm name for display
  clioUserEmail: text("clio_user_email"), // Connected Clio account email
  status: text("status").notNull().default("active"), // active, expired, disconnected, error
  lastSyncAt: timestamp("last_sync_at"), // Last successful sync timestamp
  syncEnabled: boolean("sync_enabled").notNull().default(true), // Allow auto-sync
  metadata: jsonb("metadata").default({}), // Additional Clio account info
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userUnique: unique().on(table.userId),
}));

// Clio Matter-Case linking (maps Clio matters to LegalNote cases)
export const clioMatterLinks = pgTable("clio_matter_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  caseId: varchar("case_id").notNull().references(() => cases.id),
  clioMatterId: text("clio_matter_id").notNull(), // Clio matter ID
  clioMatterNumber: text("clio_matter_number"), // Clio matter reference number
  clioMatterDescription: text("clio_matter_description"), // Clio matter description
  clioClientId: text("clio_client_id"), // Clio client ID
  clioClientName: text("clio_client_name"), // Clio client name
  syncDirection: text("sync_direction").notNull().default("clio_to_legalnote"), // clio_to_legalnote, legalnote_to_clio, bidirectional
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userMatterUnique: unique().on(table.userId, table.clioMatterId),
  caseMatterUnique: unique().on(table.caseId),
}));

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
  litigationHoldAppliedAt: true, // Server manages this
  litigationHoldAppliedBy: true, // Server assigns this from session
  litigationHoldReleasedAt: true, // Server manages this
  litigationHoldReleasedBy: true, // Server assigns this from session
}).extend({
  title: z.string().min(1).max(500).transform(sanitizeString),
  clientName: z.string().min(1).max(200).transform(sanitizeString),
  matterReference: z.string().max(100).transform(sanitizeString).optional(),
  status: z.enum(["pending", "processing", "review_required", "completed"]).default("pending"),
  priority: z.enum(["urgent", "deadline-soon", "normal"]).default("normal"),
  sourceType: z.enum(["audio", "text"]),
  textNotes: z.string().max(100000).optional(), // 100KB limit for text notes
  litigationHold: z.boolean().default(false),
  litigationHoldReason: z.string().max(2000).optional(),
});

export const insertQuickNoteSchema = createInsertSchema(quickNotes).omit({
  id: true,
  createdAt: true,
  createdBy: true, // Security: Server assigns this from authenticated session
}).extend({
  content: z.string().min(1).max(50000).transform(sanitizeString), // 50KB limit per quick note
  caseId: z.string().uuid(),
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
  withdrawalTimestamp: true,
}).extend({
  caseId: z.string().uuid(),
  audioRecordingId: z.string().uuid().optional(),
  solicitorId: z.string().min(1), // Replit Auth IDs are not UUIDs, just require non-empty string
  consentGiven: z.boolean(),
  disclaimerScriptVersion: z.string().max(50),
  disclaimerWordingText: z.string().max(5000).optional(), // Actual consent wording for defensibility
  consentModality: z.enum(["verbal_recorded", "verbal_attested", "electronic"]),
  ipAddress: z.string().max(50).optional(), // Allow both IPv4 and IPv6
  deletionReason: z.enum(["consent_declined", "client_request", "retention_expired"]).optional(),
  lawfulBasis: z.enum(["consent", "contract", "legitimate_interests", "legal_obligation"]).optional(),
  recordingPurpose: z.string().max(1000).optional(),
  consentWithdrawn: z.boolean().default(false),
  withdrawalReason: z.string().max(1000).optional(),
  withdrawnBy: z.string().min(1).optional(),
});

export const insertTranscriptSchema = createInsertSchema(transcripts).omit({
  id: true,
  createdAt: true,
}).extend({
  caseId: z.string().uuid(),
  content: z.string().max(1000000), // 1MB max for transcript
});

export const insertActionItemSchema = createInsertSchema(actionItems).omit({
  id: true,
  createdAt: true,
}).extend({
  caseId: z.string().uuid(),
  transcriptId: z.string().uuid(),
  description: z.string().min(1).max(1000),
  assignee: z.string().optional(),
  dueDate: z.date().optional(),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  completed: z.boolean().default(false),
  sourceUtteranceIndex: z.number().int().optional()
});

export const insertPreMeetingBriefingSchema = createInsertSchema(preMeetingBriefings).omit({
  id: true,
  generatedAt: true,
}).extend({
  caseId: z.string().uuid(),
  content: z.string().max(100000),
  generatedBy: z.string().min(1),
  sourceMeetingCount: z.number().int().min(0).default(0),
  inputTokens: z.number().int().optional(),
  outputTokens: z.number().int().optional(),
  cost: z.string().optional(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
}).extend({
  caseId: z.string().uuid(),
  transcriptSnapshotId: z.string().uuid().optional(),
  type: z.enum(["attendance_note", "summary"]),
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
  sendRecordingConfirmationEmails: z.boolean().default(false),
});

export const insertAuditTrailSchema = createInsertSchema(auditTrail).omit({
  id: true,
  timestamp: true,
}).extend({
  eventType: z.string().min(1).max(100), // Flexible to allow all AuditEventType values from server/auditLog.ts
  userId: z.string().min(1), // Replit Auth IDs are not UUIDs
  caseId: z.string().uuid().optional(),
  documentId: z.string().uuid().optional(),
  transcriptId: z.string().uuid().optional(),
  audioRecordingId: z.string().uuid().optional(),
  ipAddress: z.string().max(50).optional(), // Allow both IPv4 and IPv6
  userAgent: z.string().max(500).optional(),
  metadata: z.record(z.any()).optional(),
  severity: z.enum(["info", "warning", "critical"]).default("info"),
});

export const insertDsarRequestSchema = createInsertSchema(dsarRequests).omit({
  id: true,
  receivedAt: true,
  acknowledgedAt: true,
  completedAt: true,
}).extend({
  requestType: z.enum(["access", "erasure", "restriction", "rectification", "portability", "objection"]),
  requesterName: z.string().min(1).max(200).transform(sanitizeString),
  requesterEmail: z.string().email().max(255),
  requesterPhone: z.string().max(50).optional(),
  requesterRelationship: z.enum(["data_subject", "legal_representative", "third_party_authorised"]),
  verificationMethod: z.enum(["id_check", "email_confirmation", "phone_verification"]).optional(),
  dueDate: z.date(),
  status: z.enum(["received", "acknowledged", "processing", "awaiting_verification", "completed", "rejected"]).default("received"),
  responseMethod: z.enum(["email", "post", "secure_download"]).optional(),
  notes: z.string().max(10000).optional(),
  createdBy: z.string().min(1),
});

export const insertSecurityIncidentSchema = createInsertSchema(securityIncidents).omit({
  id: true,
  reportedAt: true,
}).extend({
  incidentType: z.enum(["failed_access", "suspicious_activity", "privilege_concern", "confidentiality_breach", "data_breach"]),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z.enum(["open", "investigating", "resolved", "escalated"]).default("open"),
  description: z.string().min(1).max(10000),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().max(500).optional(),
  investigationNotes: z.string().max(50000).optional(),
  resolution: z.string().max(10000).optional(),
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

export const insertCalendarIntegrationSchema = createInsertSchema(calendarIntegrations).omit({
  id: true,
  connectedAt: true,
}).extend({
  userId: z.string().min(1), // Replit Auth IDs are not UUIDs
  provider: z.enum(["google", "outlook"]),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  calendarId: z.string().max(500).optional(),
  email: z.string().email().max(255).optional(),
});

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({
  id: true,
  syncedAt: true,
}).extend({
  caseId: z.string().uuid(),
  userId: z.string().min(1), // Replit Auth IDs are not UUIDs
  provider: z.enum(["google", "outlook"]),
  providerEventId: z.string().min(1).max(500),
  eventType: z.enum(["deadline", "hearing", "meeting"]).default("deadline"),
});

export const insertShareLinkSchema = createInsertSchema(shareLinks).omit({
  id: true,
  createdAt: true,
  accessCount: true,
  lastAccessedAt: true,
  smsVerified: true,
  smsVerifiedAt: true,
}).extend({
  caseId: z.string().uuid(),
  createdBy: z.string().min(1), // Replit Auth IDs are not UUIDs
  recipientEmail: z.string().email().max(255).transform(sanitizeString),
  recipientName: z.string().min(1).max(200).transform(sanitizeString),
  isExternal: z.boolean().default(true),
  organization: z.string().max(200).transform(sanitizeString).optional(),
  accessLevel: z.enum(["view", "download"]).default("view"),
  password: z.string().max(200).optional(),
  clientConsent: z.boolean().default(false),
  smsProtection: z.boolean().default(false),
  smsPhoneNumber: z.string().max(50).transform(sanitizeString).optional(),
  smsVerificationCode: z.string().max(10).optional(),
  smsCodeExpiresAt: z.date().optional(),
  sharedDocuments: z.array(z.enum(["attendance_note", "summary", "transcript"])).min(1, "Must select at least one document to share").default(["attendance_note"]),
});

export const insertRecallConnectionSchema = createInsertSchema(recallConnections).omit({
  id: true,
  connectedAt: true,
}).extend({
  userId: z.string().min(1), // Replit Auth IDs are not UUIDs
  status: z.enum(["active", "disconnected", "error"]).default("active"),
});

export const insertMeetingImportSchema = createInsertSchema(meetingImports).omit({
  id: true,
  createdAt: true,
}).extend({
  userId: z.string().min(1), // Replit Auth IDs are not UUIDs
  caseId: z.string().uuid().optional(),
  recallBotId: z.string().min(1).max(500),
  recallRecordingId: z.string().max(500).optional(),
  meetingPlatform: z.enum(["zoom", "teams", "meet", "webex"]),
  meetingUrl: z.string().url().max(1000).optional(),
  meetingTitle: z.string().max(500).transform(sanitizeString).optional(),
  durationSeconds: z.number().int().min(0).max(43200).optional(), // Max 12 hours
  status: z.enum(["pending", "downloading", "transcribing", "completed", "failed"]).default("pending"),
  consentConfirmed: z.boolean().default(false),
});

export const insertScheduledMeetingSchema = createInsertSchema(scheduledMeetings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  userId: z.string().min(1),
  calendarEventId: z.string().min(1).max(500),
  calendarProvider: z.enum(["google", "outlook"]).default("google"),
  title: z.string().min(1).max(500).transform(sanitizeString),
  description: z.string().max(5000).transform(sanitizeString).optional(),
  meetingUrl: z.string().url().max(1000).optional(),
  meetingPlatform: z.enum(["zoom", "teams", "meet", "webex"]).optional(),
  clientEmail: z.string().email().max(255).transform(sanitizeString).optional(),
  clientName: z.string().max(200).transform(sanitizeString).optional(),
  autoRecordEnabled: z.boolean().default(false),
  consentStatus: z.enum(["pending", "sent", "approved", "declined", "expired"]).default("pending"),
  botStatus: z.enum(["waiting", "joining", "in_call", "done", "failed"]).optional(),
});

export const insertPreConsentEmailSchema = createInsertSchema(preConsentEmails).omit({
  id: true,
  createdAt: true,
  consentAcknowledged: true,
  consentAcknowledgedAt: true,
  consentAcknowledgedIp: true,
}).extend({
  userId: z.string().min(1), // Replit Auth IDs are not UUIDs
  caseId: z.string().uuid().optional(),
  recipientEmail: z.string().email().max(255).transform(sanitizeString),
  recipientName: z.string().min(1).max(200).transform(sanitizeString),
  meetingPlatform: z.enum(["zoom", "teams", "meet", "webex"]).optional(),
  meetingUrl: z.string().url().max(1000).optional(),
  emailSubject: z.string().min(1).max(500).transform(sanitizeString),
  emailBody: z.string().min(1).max(10000),
  consentToken: z.string().min(1).max(100),
  emailStatus: z.enum(["pending", "sent", "failed", "bounced"]).default("pending"),
});

export const insertSharePointConnectionSchema = createInsertSchema(sharePointConnections).omit({
  id: true,
  connectedAt: true,
  updatedAt: true,
}).extend({
  userId: z.string().min(1), // Replit Auth IDs are not UUIDs
  provider: z.enum(["sharepoint", "onedrive"]),
  driveId: z.string().min(1).max(500),
  driveName: z.string().max(500).optional(),
  email: z.string().email().max(255).optional(),
  status: z.enum(["active", "disconnected", "error"]).default("active"),
  autoSyncEnabled: z.boolean().default(true),
});

export const insertClioConnectionSchema = createInsertSchema(clioConnections).omit({
  id: true,
  connectedAt: true,
  updatedAt: true,
}).extend({
  userId: z.string().min(1), // Replit Auth IDs are not UUIDs
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  tokenExpiresAt: z.date(),
  clioUserId: z.string().max(100).optional(),
  clioFirmId: z.string().max(100).optional(),
  clioFirmName: z.string().max(500).optional(),
  clioUserEmail: z.string().email().max(255).optional(),
  status: z.enum(["active", "expired", "disconnected", "error"]).default("active"),
  syncEnabled: z.boolean().default(true),
});

export const insertClioMatterLinkSchema = createInsertSchema(clioMatterLinks).omit({
  id: true,
  createdAt: true,
}).extend({
  userId: z.string().min(1), // Replit Auth IDs are not UUIDs
  caseId: z.string().uuid(),
  clioMatterId: z.string().min(1).max(100),
  clioMatterNumber: z.string().max(100).optional(),
  clioMatterDescription: z.string().max(5000).optional(),
  clioClientId: z.string().max(100).optional(),
  clioClientName: z.string().max(500).optional(),
  syncDirection: z.enum(["clio_to_legalnote", "legalnote_to_clio", "bidirectional"]).default("clio_to_legalnote"),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCase = z.infer<typeof insertCaseSchema>;
export type Case = typeof cases.$inferSelect;

export type InsertQuickNote = z.infer<typeof insertQuickNoteSchema>;
export type QuickNote = typeof quickNotes.$inferSelect;

export type InsertAudioRecording = z.infer<typeof insertAudioRecordingSchema>;
export type AudioRecording = typeof audioRecordings.$inferSelect;

export type InsertConsentLog = z.infer<typeof insertConsentLogSchema>;
export type ConsentLog = typeof consentLogs.$inferSelect;

export type InsertTranscript = z.infer<typeof insertTranscriptSchema>;
export type Transcript = typeof transcripts.$inferSelect;

export type InsertActionItem = z.infer<typeof insertActionItemSchema>;
export type ActionItem = typeof actionItems.$inferSelect;

export type InsertPreMeetingBriefing = z.infer<typeof insertPreMeetingBriefingSchema>;
export type PreMeetingBriefing = typeof preMeetingBriefings.$inferSelect;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export type InsertClientVersionTracking = z.infer<typeof insertClientVersionTrackingSchema>;
export type ClientVersionTracking = typeof clientVersionTracking.$inferSelect;

export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;

export type InsertAuditTrail = z.infer<typeof insertAuditTrailSchema>;
export type AuditTrail = typeof auditTrail.$inferSelect;

export type InsertDsarRequest = z.infer<typeof insertDsarRequestSchema>;
export type DsarRequest = typeof dsarRequests.$inferSelect;

export type InsertSecurityIncident = z.infer<typeof insertSecurityIncidentSchema>;
export type SecurityIncident = typeof securityIncidents.$inferSelect;

export type InsertFirmProfile = z.infer<typeof insertFirmProfileSchema>;
export type FirmProfile = typeof firmProfile.$inferSelect;

export type InsertCalendarIntegration = z.infer<typeof insertCalendarIntegrationSchema>;
export type CalendarIntegration = typeof calendarIntegrations.$inferSelect;

export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;

export type InsertShareLink = z.infer<typeof insertShareLinkSchema>;
export type ShareLink = typeof shareLinks.$inferSelect;

export type InsertRecallConnection = z.infer<typeof insertRecallConnectionSchema>;
export type RecallConnection = typeof recallConnections.$inferSelect;

export type InsertMeetingImport = z.infer<typeof insertMeetingImportSchema>;
export type MeetingImport = typeof meetingImports.$inferSelect;

export type InsertPreConsentEmail = z.infer<typeof insertPreConsentEmailSchema>;
export type PreConsentEmail = typeof preConsentEmails.$inferSelect;

export type InsertScheduledMeeting = z.infer<typeof insertScheduledMeetingSchema>;
export type ScheduledMeeting = typeof scheduledMeetings.$inferSelect;

export type InsertClioConnection = z.infer<typeof insertClioConnectionSchema>;
export type ClioConnection = typeof clioConnections.$inferSelect;

export type InsertClioMatterLink = z.infer<typeof insertClioMatterLinkSchema>;
export type ClioMatterLink = typeof clioMatterLinks.$inferSelect;

export type InsertSharePointConnection = z.infer<typeof insertSharePointConnectionSchema>;
export type SharePointConnection = typeof sharePointConnections.$inferSelect;

// Search History for quick re-access to recent searches
export const searchHistory = pgTable("search_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  query: text("query").notNull(),
  filters: jsonb("filters").default({}), // { dateRange, status, documentType }
  resultCount: integer("result_count").notNull().default(0),
  searchedAt: timestamp("searched_at").notNull().defaultNow(),
});

export const insertSearchHistorySchema = createInsertSchema(searchHistory).omit({
  id: true,
  searchedAt: true,
});

export type InsertSearchHistory = z.infer<typeof insertSearchHistorySchema>;
export type SearchHistory = typeof searchHistory.$inferSelect;
