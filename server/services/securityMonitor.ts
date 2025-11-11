import crypto from 'crypto';
import { storage } from '../storage';

/**
 * Security Monitoring Service
 * 
 * Provides:
 * - Failed login attempt tracking and account lockout
 * - Suspicious activity detection (IP changes, concurrent sessions)
 * - Audit log integrity verification (cryptographic signatures)
 */

interface LoginAttempt {
  userId: string;
  email: string;
  success: boolean;
  ipAddress: string;
  timestamp: Date;
}

interface SecurityEvent {
  userId: string;
  eventType: 'failed_login' | 'account_locked' | 'ip_change' | 'concurrent_session';
  severity: 'low' | 'medium' | 'high';
  metadata: Record<string, any>;
  timestamp: Date;
}

// In-memory tracking (would be stored in Redis/database in production)
const failedLoginAttempts = new Map<string, LoginAttempt[]>();
const userSessions = new Map<string, { ipAddress: string; sessionId: string; lastSeen: Date }[]>();

// Configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const IP_CHANGE_DETECTION = true;

/**
 * Track a login attempt
 */
export function trackLoginAttempt(params: {
  userId: string;
  email: string;
  success: boolean;
  ipAddress: string;
}): { locked: boolean; remainingAttempts?: number } {
  const { userId, email, success, ipAddress } = params;
  const attempt: LoginAttempt = {
    userId,
    email,
    success,
    ipAddress,
    timestamp: new Date(),
  };

  if (!success) {
    // Track failed attempt
    const attempts = failedLoginAttempts.get(email) || [];
    attempts.push(attempt);
    
    // Keep only recent attempts (last 15 minutes)
    const recentAttempts = attempts.filter(
      a => Date.now() - a.timestamp.getTime() < LOCKOUT_DURATION_MS
    );
    failedLoginAttempts.set(email, recentAttempts);

    // Check if account should be locked
    if (recentAttempts.length >= MAX_FAILED_ATTEMPTS) {
      logSecurityEvent({
        userId,
        eventType: 'account_locked',
        severity: 'high',
        metadata: {
          email,
          ipAddress,
          attemptCount: recentAttempts.length,
          firstAttempt: recentAttempts[0].timestamp,
          lastAttempt: attempt.timestamp,
        },
        timestamp: new Date(),
      });

      return { locked: true };
    }

    // Log failed login
    logSecurityEvent({
      userId,
      eventType: 'failed_login',
      severity: 'medium',
      metadata: {
        email,
        ipAddress,
        attemptNumber: recentAttempts.length,
      },
      timestamp: new Date(),
    });

    return {
      locked: false,
      remainingAttempts: MAX_FAILED_ATTEMPTS - recentAttempts.length,
    };
  } else {
    // Successful login - clear failed attempts
    failedLoginAttempts.delete(email);
    return { locked: false };
  }
}

/**
 * Check if an account is currently locked due to failed login attempts
 */
export function isAccountLocked(email: string): boolean {
  const attempts = failedLoginAttempts.get(email) || [];
  const recentAttempts = attempts.filter(
    a => Date.now() - a.timestamp.getTime() < LOCKOUT_DURATION_MS
  );
  
  return recentAttempts.length >= MAX_FAILED_ATTEMPTS;
}

/**
 * Track user session for suspicious activity detection
 */
export function trackSession(params: {
  userId: string;
  sessionId: string;
  ipAddress: string;
}): { suspicious: boolean; reason?: string } {
  const { userId, sessionId, ipAddress } = params;
  
  const sessions = userSessions.get(userId) || [];
  const existingSession = sessions.find(s => s.sessionId === sessionId);

  if (existingSession) {
    // Check for IP change
    if (IP_CHANGE_DETECTION && existingSession.ipAddress !== ipAddress) {
      logSecurityEvent({
        userId,
        eventType: 'ip_change',
        severity: 'medium',
        metadata: {
          sessionId,
          oldIp: existingSession.ipAddress,
          newIp: ipAddress,
        },
        timestamp: new Date(),
      });

      existingSession.ipAddress = ipAddress;
      existingSession.lastSeen = new Date();
      
      return {
        suspicious: true,
        reason: 'IP address changed during session',
      };
    }

    existingSession.lastSeen = new Date();
  } else {
    // New session
    sessions.push({
      sessionId,
      ipAddress,
      lastSeen: new Date(),
    });

    // Check for concurrent sessions
    const activeSessions = sessions.filter(
      s => Date.now() - s.lastSeen.getTime() < 30 * 60 * 1000 // Active in last 30 min
    );

    if (activeSessions.length > 2) {
      logSecurityEvent({
        userId,
        eventType: 'concurrent_session',
        severity: 'low',
        metadata: {
          sessionCount: activeSessions.length,
          sessions: activeSessions.map(s => ({
            sessionId: s.sessionId,
            ipAddress: s.ipAddress,
          })),
        },
        timestamp: new Date(),
      });

      return {
        suspicious: true,
        reason: 'Multiple concurrent sessions detected',
      };
    }
  }

  userSessions.set(userId, sessions);
  return { suspicious: false };
}

/**
 * Log security event to audit trail
 */
function logSecurityEvent(event: SecurityEvent) {
  // Log to console for immediate visibility
  console.log('[SECURITY]', {
    timestamp: event.timestamp.toISOString(),
    userId: event.userId,
    eventType: event.eventType,
    severity: event.severity,
    ...event.metadata,
  });

  // Store in audit trail with integrity signature
  try {
    storage.createAuditLog({
      userId: event.userId,
      action: `security.${event.eventType}`,
      resourceType: 'security',
      resourceId: event.userId,
      details: JSON.stringify({
        severity: event.severity,
        ...event.metadata,
      }),
      ipAddress: event.metadata.ipAddress || 'unknown',
      userAgent: 'system',
    });
  } catch (error) {
    console.error('[SECURITY] Failed to log security event:', error);
  }
}

/**
 * Get audit log secret, enforcing it must be set in production
 */
function getAuditLogSecret(): string {
  const secret = process.env.AUDIT_LOG_SECRET;
  
  if (!secret) {
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment) {
      // In development, use a deterministic but clear default
      console.warn('[SECURITY] AUDIT_LOG_SECRET not set - using development default. SET THIS IN PRODUCTION!');
      return 'dev-only-secret-MUST-SET-IN-PRODUCTION';
    } else {
      // In production, MUST be set - throw error if missing
      throw new Error(
        'AUDIT_LOG_SECRET environment variable must be set for tamper-evident audit logging. ' +
        'Generate a strong secret: openssl rand -hex 32'
      );
    }
  }
  
  return secret;
}

/**
 * Generate cryptographic signature for audit log entry
 * Ensures tamper-evident logging for legal compliance
 */
export function generateAuditSignature(logEntry: {
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  timestamp: Date;
  details: string;
}): string {
  // Create deterministic string from log entry
  const dataToSign = [
    logEntry.userId,
    logEntry.action,
    logEntry.resourceType,
    logEntry.resourceId,
    logEntry.timestamp.toISOString(),
    logEntry.details,
  ].join('|');

  // HMAC-SHA256 signature using secret key
  const secret = getAuditLogSecret();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(dataToSign)
    .digest('hex');

  return signature;
}

/**
 * Verify audit log integrity
 * Detects if logs have been tampered with
 */
export function verifyAuditSignature(
  logEntry: {
    userId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    timestamp: Date;
    details: string;
  },
  signature: string
): boolean {
  const expectedSignature = generateAuditSignature(logEntry);
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Clean up old session tracking data (run periodically)
 */
export function cleanupSessionTracking() {
  const now = Date.now();
  const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

  // Clean up old failed login attempts
  for (const [email, attempts] of failedLoginAttempts.entries()) {
    const recentAttempts = attempts.filter(
      a => now - a.timestamp.getTime() < LOCKOUT_DURATION_MS
    );
    
    if (recentAttempts.length === 0) {
      failedLoginAttempts.delete(email);
    } else {
      failedLoginAttempts.set(email, recentAttempts);
    }
  }

  // Clean up old session tracking
  for (const [userId, sessions] of userSessions.entries()) {
    const activeSessions = sessions.filter(
      s => now - s.lastSeen.getTime() < SESSION_EXPIRY_MS
    );
    
    if (activeSessions.length === 0) {
      userSessions.delete(userId);
    } else {
      userSessions.set(userId, activeSessions);
    }
  }

  console.log('[SECURITY] Cleaned up old session tracking data');
}
