import type { Request } from "express";

/**
 * Security audit logging for LegalNote
 * Tracks critical security events for compliance and incident response
 */

export enum AuditEventType {
  // Authentication events
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  LOGIN_FAILED = "LOGIN_FAILED",
  LOGOUT = "LOGOUT",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  
  // Authorization events
  UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  
  // Data access events
  CASE_CREATED = "CASE_CREATED",
  CASE_ACCESSED = "CASE_ACCESSED",
  CASE_UPDATED = "CASE_UPDATED",
  CASE_DELETED = "CASE_DELETED",
  
  // Audio/document events
  AUDIO_UPLOADED = "AUDIO_UPLOADED",
  AUDIO_ACCESSED = "AUDIO_ACCESSED",
  AUDIO_DELETED = "AUDIO_DELETED",
  TRANSCRIPT_GENERATED = "TRANSCRIPT_GENERATED",
  DOCUMENT_GENERATED = "DOCUMENT_GENERATED",
  DOCUMENT_SENT_TO_CLIENT = "DOCUMENT_SENT_TO_CLIENT",
  
  // AI Processing events
  AI_PROCESSING_STARTED = "AI_PROCESSING_STARTED",
  AI_TRANSCRIPTION_COMPLETED = "AI_TRANSCRIPTION_COMPLETED",
  AI_DOCUMENT_GENERATED = "AI_DOCUMENT_GENERATED",
  AI_PROCESSING_FAILED = "AI_PROCESSING_FAILED",
  
  // Consent events
  CONSENT_GIVEN = "CONSENT_GIVEN",
  CONSENT_RECORDED = "CONSENT_RECORDED",
  CONSENT_DECLINED = "CONSENT_DECLINED",
  
  // Security events
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INVALID_INPUT = "INVALID_INPUT",
  UPLOAD_SECURITY_VIOLATION = "UPLOAD_SECURITY_VIOLATION",
  ACCESS_CONTROL_VIOLATION = "ACCESS_CONTROL_VIOLATION",
  
  // Firm settings events
  FIRM_PROFILE_UPDATED = "FIRM_PROFILE_UPDATED",
  
  // System events
  SYSTEM_ERROR = "SYSTEM_ERROR",
  
  // === UK Legal Defensibility Events (Phase 1) ===
  
  // Recording lifecycle events - supports reconstruction of recording scope
  RECORDING_STARTED = "RECORDING_STARTED",
  RECORDING_PAUSED = "RECORDING_PAUSED",
  RECORDING_RESUMED = "RECORDING_RESUMED",
  RECORDING_STOPPED = "RECORDING_STOPPED",
  AUDIO_DOWNLOADED = "AUDIO_DOWNLOADED",
  AUDIO_EXPORTED = "AUDIO_EXPORTED",
  AUDIO_RETENTION_EXTENDED = "AUDIO_RETENTION_EXTENDED",
  AUDIO_GDPR_DELETED = "AUDIO_GDPR_DELETED",
  AUDIO_MANUAL_DELETED = "AUDIO_MANUAL_DELETED",
  
  // Lawful basis and purpose events - GDPR Article 6 documentation
  LAWFUL_BASIS_SELECTED = "LAWFUL_BASIS_SELECTED",
  RECORDING_PURPOSE_SET = "RECORDING_PURPOSE_SET",
  CONSENT_WORDING_RECORDED = "CONSENT_WORDING_RECORDED",
  THIRD_PARTY_NOTIFIED = "THIRD_PARTY_NOTIFIED",
  CONSENT_WITHDRAWN = "CONSENT_WITHDRAWN",
  
  // Governance and configuration events - SRA accountability
  RETENTION_POLICY_CHANGED = "RETENTION_POLICY_CHANGED",
  USER_ROLE_CHANGED = "USER_ROLE_CHANGED",
  INTEGRATION_ACTIVATED = "INTEGRATION_ACTIVATED",
  INTEGRATION_DEACTIVATED = "INTEGRATION_DEACTIVATED",
  AI_TRAINING_SETTING_CHANGED = "AI_TRAINING_SETTING_CHANGED",
  SECURITY_SETTING_CHANGED = "SECURITY_SETTING_CHANGED",
  
  // Litigation hold events - evidence preservation
  LITIGATION_HOLD_APPLIED = "LITIGATION_HOLD_APPLIED",
  LITIGATION_HOLD_RELEASED = "LITIGATION_HOLD_RELEASED",
  RETENTION_OVERRIDE_APPLIED = "RETENTION_OVERRIDE_APPLIED",
  FORCED_DELETION = "FORCED_DELETION",
  BACKUP_RESTORED = "BACKUP_RESTORED",
  
  // DSAR (Data Subject Access Request) events - ICO compliance
  DSAR_REQUEST_RECEIVED = "DSAR_REQUEST_RECEIVED",
  DSAR_REQUEST_ACKNOWLEDGED = "DSAR_REQUEST_ACKNOWLEDGED",
  DSAR_DATA_LOCATED = "DSAR_DATA_LOCATED",
  DSAR_DATA_PROVIDED = "DSAR_DATA_PROVIDED",
  DSAR_DATA_WITHHELD = "DSAR_DATA_WITHHELD",
  DSAR_REQUEST_COMPLETED = "DSAR_REQUEST_COMPLETED",
  DSAR_ERASURE_REQUESTED = "DSAR_ERASURE_REQUESTED",
  DSAR_ERASURE_COMPLETED = "DSAR_ERASURE_COMPLETED",
  DSAR_RESTRICTION_APPLIED = "DSAR_RESTRICTION_APPLIED",
  
  // Security incident events - for investigation and remediation
  FAILED_ACCESS_ATTEMPT = "FAILED_ACCESS_ATTEMPT",
  SUSPICIOUS_ACTIVITY_DETECTED = "SUSPICIOUS_ACTIVITY_DETECTED",
  PRIVILEGE_CONCERN_RAISED = "PRIVILEGE_CONCERN_RAISED",
  CONFIDENTIALITY_CONCERN_RAISED = "CONFIDENTIALITY_CONCERN_RAISED",
  SECURITY_INVESTIGATION_STARTED = "SECURITY_INVESTIGATION_STARTED",
  SECURITY_INVESTIGATION_COMPLETED = "SECURITY_INVESTIGATION_COMPLETED",
  REMEDIAL_ACTION_TAKEN = "REMEDIAL_ACTION_TAKEN",
  
  // Document lifecycle events - version control and approval
  DOCUMENT_APPROVED = "DOCUMENT_APPROVED",
  DOCUMENT_UNLOCKED = "DOCUMENT_UNLOCKED",
  DOCUMENT_VERSION_CREATED = "DOCUMENT_VERSION_CREATED",
  TRANSCRIPT_REDACTED = "TRANSCRIPT_REDACTED",
  REDACTION_REMOVED = "REDACTION_REMOVED",
}

interface AuditLogEntry {
  timestamp: Date;
  eventType: AuditEventType;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  resourceId?: string;
  resourceType?: string;
  action?: string;
  details?: any;
  severity: "low" | "medium" | "high" | "critical";
}

class AuditLogger {
  private logs: AuditLogEntry[] = [];

  log(entry: Omit<AuditLogEntry, "timestamp">) {
    const logEntry: AuditLogEntry = {
      timestamp: new Date(),
      ...entry,
    };

    // In production, this would write to a secure logging service
    // For now, log to console with structure
    console.log(
      `[AUDIT] ${logEntry.timestamp.toISOString()} | ${logEntry.eventType} | ` +
      `User: ${logEntry.userId || 'N/A'} | IP: ${logEntry.ipAddress || 'N/A'} | ` +
      `Resource: ${logEntry.resourceType || 'N/A'}:${logEntry.resourceId || 'N/A'} | ` +
      `Severity: ${logEntry.severity}`
    );

    // Store in memory for development (in production, send to external logging service)
    this.logs.push(logEntry);

    // Keep only last 1000 entries in memory
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }
  }

  // Helper method to extract request info
  logFromRequest(
    eventType: AuditEventType,
    req: Request,
    details?: {
      resourceId?: string;
      resourceType?: string;
      action?: string;
      severity?: "low" | "medium" | "high" | "critical";
      additionalInfo?: any;
    }
  ) {
    const user = (req as any).user;
    
    this.log({
      eventType,
      userId: user?.claims?.sub,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
      resourceId: details?.resourceId,
      resourceType: details?.resourceType,
      action: details?.action,
      details: details?.additionalInfo,
      severity: details?.severity || "medium",
    });
  }

  // Get recent logs for monitoring (admin only)
  getRecentLogs(limit: number = 100): AuditLogEntry[] {
    return this.logs.slice(-limit);
  }

  // Search logs by criteria
  searchLogs(criteria: Partial<AuditLogEntry>): AuditLogEntry[] {
    return this.logs.filter(log => {
      return Object.entries(criteria).every(([key, value]) => {
        return log[key as keyof AuditLogEntry] === value;
      });
    });
  }
}

// Singleton instance
export const auditLogger = new AuditLogger();
