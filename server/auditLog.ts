import type { Request } from "express";

/**
 * Security audit logging for LegalNote AI
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
  
  // Consent events
  CONSENT_GIVEN = "CONSENT_GIVEN",
  CONSENT_RECORDED = "CONSENT_RECORDED",
  CONSENT_DECLINED = "CONSENT_DECLINED",
  
  // Security events
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INVALID_INPUT = "INVALID_INPUT",
  UPLOAD_SECURITY_VIOLATION = "UPLOAD_SECURITY_VIOLATION",
  ACCESS_CONTROL_VIOLATION = "ACCESS_CONTROL_VIOLATION",
  
  // System events
  SYSTEM_ERROR = "SYSTEM_ERROR",
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
