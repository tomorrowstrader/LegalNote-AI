import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { type InsertAuditTrail } from "@shared/schema";

export async function logAuditEvent(
  userId: string,
  eventType: InsertAuditTrail["eventType"],
  details: {
    caseId?: string;
    documentId?: string;
    transcriptId?: string;
    audioRecordingId?: string;
    metadata?: Record<string, any>;
    severity?: "info" | "warning" | "critical";
    req?: Request;
    ipAddress?: string;
  }
): Promise<void> {
  try {
    const auditData: InsertAuditTrail = {
      eventType,
      userId,
      caseId: details.caseId,
      documentId: details.documentId,
      transcriptId: details.transcriptId,
      audioRecordingId: details.audioRecordingId,
      ipAddress: details.req?.ip || details.req?.socket?.remoteAddress || details.ipAddress,
      userAgent: details.req?.get("user-agent"),
      metadata: details.metadata || {},
      severity: details.severity || "info",
    };

    await storage.createAuditLog(auditData);
  } catch (error) {
    console.error("[AUDIT] Failed to log audit event:", error);
  }
}

export function auditMiddleware(eventType: InsertAuditTrail["eventType"]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as any;
    const userId = user?.claims?.sub;
    
    if (!userId) {
      return next();
    }

    const caseId = req.params.caseId || req.params.id || req.body?.caseId;
    const documentId = req.params.documentId || req.body?.documentId;

    await logAuditEvent(userId, eventType, {
      caseId,
      documentId,
      req,
    });

    next();
  };
}
