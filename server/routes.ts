import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCaseSchema, insertAudioRecordingSchema } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { MAX_AUDIO_SIZE_BYTES, validateUploadedFile } from "./uploadSecurity";
import {
  generalApiLimiter,
  caseCreationLimiter,
  presignedUrlLimiter,
  audioUploadLimiter,
  authLimiter,
} from "./rateLimiting";
import { auditLogger, AuditEventType } from "./auditLog";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint for deployment platform
  // Must be before auth middleware and CORS is configured to allow requests without origin
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'LegalNote AI', timestamp: new Date().toISOString() });
  });

  // Setup Replit Auth
  await setupAuth(app);

  // Apply general rate limiting to all API routes
  app.use('/api/', generalApiLimiter);

  // Auth user route
  app.get('/api/auth/user', isAuthenticated, authLimiter, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      next(error);
    }
  });

  // Protected Case routes
  app.post("/api/cases", isAuthenticated, caseCreationLimiter, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertCaseSchema.parse(req.body);
      
      // Security: Storage layer enforces user isolation
      const newCase = await storage.createCase(validatedData, userId);
      auditLogger.logFromRequest(AuditEventType.CASE_CREATED, req, {
        resourceId: newCase.id,
        resourceType: "case",
        action: "create",
        severity: "low",
      });
      res.json(newCase);
    } catch (error: any) {
      // Zod validation errors: return 400 with message
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.message });
      }
      // All other errors: use sanitized error handler
      next(error);
    }
  });

  app.get("/api/cases", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const cases = await storage.getCases(userId);
      res.json(cases);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/cases/:id", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseData = await storage.getCase(req.params.id);
      
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Authorization check: user can only access their own cases
      if (caseData.createdBy !== userId) {
        auditLogger.logFromRequest(AuditEventType.ACCESS_CONTROL_VIOLATION, req, {
          resourceId: req.params.id,
          resourceType: "case",
          action: "access",
          severity: "high",
        });
        return res.status(403).json({ message: "Not authorized to access this case" });
      }
      
      res.json(caseData);
    } catch (error: any) {
      next(error);
    }
  });

  // Protected Audio routes
  app.post("/api/audio/upload-url", isAuthenticated, presignedUrlLimiter, async (req, res, next) => {
    try {
      const objectStorageService = new ObjectStorageService();
      // Security: Enforce 100MB size limit on presigned URL
      const uploadURL = await objectStorageService.getObjectEntityUploadURL(MAX_AUDIO_SIZE_BYTES);
      res.json({ uploadURL });
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/audio", isAuthenticated, audioUploadLimiter, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertAudioRecordingSchema.parse(req.body);
      
      const caseData = await storage.getCase(validatedData.caseId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Authorization check: user can only create audio for their own cases
      if (caseData.createdBy !== userId) {
        auditLogger.logFromRequest(AuditEventType.ACCESS_CONTROL_VIOLATION, req, {
          resourceId: validatedData.caseId,
          resourceType: "case",
          action: "create_audio",
          severity: "high",
        });
        return res.status(403).json({ message: "Not authorized to create audio for this case" });
      }
      
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      const audioRecording = await storage.createAudioRecording({
        caseId: validatedData.caseId,
        expiresAt,
        filePath: null,
        duration: null,
        deletedAt: null,
      });
      res.json(audioRecording);
    } catch (error: any) {
      // Zod validation errors: return 400 with message
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.message });
      }
      // All other errors: use sanitized error handler
      next(error);
    }
  });

  app.put("/api/audio/:id", isAuthenticated, audioUploadLimiter, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      
      if (!req.body.audioURL) {
        return res.status(400).json({ message: "audioURL is required" });
      }

      const audioRecording = await storage.getAudioRecording(req.params.id);
      if (!audioRecording) {
        return res.status(404).json({ message: "Audio recording not found" });
      }

      const caseData = await storage.getCase(audioRecording.caseId);
      if (!caseData) {
        return res.status(404).json({ message: "Associated case not found" });
      }
      
      // Authorization check: user can only update audio for their own cases
      if (caseData.createdBy !== userId) {
        return res.status(403).json({ message: "Not authorized to update this audio" });
      }
      
      const objectStorageService = new ObjectStorageService();
      
      // First, normalize the path and get the file
      const normalizedPath = objectStorageService.normalizeObjectEntityPath(req.body.audioURL);
      const objectFile = await objectStorageService.getObjectEntityFile(normalizedPath);
      
      // Security: Verify this object is not already owned by another user
      const { getObjectAclPolicy } = await import("./objectAcl");
      const existingAcl = await getObjectAclPolicy(objectFile);
      
      if (existingAcl && existingAcl.owner !== userId) {
        // Object already has an ACL and is owned by someone else
        auditLogger.logFromRequest(AuditEventType.ACCESS_CONTROL_VIOLATION, req, {
          resourceId: req.params.id,
          resourceType: "audio",
          action: "upload_hijack_attempt",
          severity: "critical",
          additionalInfo: { normalizedPath },
        });
        return res.status(403).json({ 
          message: "Not authorized to use this audio file" 
        });
      }
      
      // Security: Validate uploaded file (size, MIME type, magic numbers)
      const validation = await validateUploadedFile(objectFile);
      if (!validation.valid) {
        // Delete invalid file
        await objectFile.delete();
        auditLogger.logFromRequest(AuditEventType.UPLOAD_SECURITY_VIOLATION, req, {
          resourceId: req.params.id,
          resourceType: "audio",
          action: "upload_validation_failed",
          severity: "high",
          additionalInfo: { error: validation.error },
        });
        return res.status(400).json({ message: validation.error || "Invalid file upload" });
      }
      
      // Set ACL policy after validation
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.audioURL,
        {
          owner: caseData.createdBy,
          visibility: "private",
        }
      );

      const updated = await storage.updateAudioRecording(req.params.id, {
        filePath: objectPath,
        duration: req.body.duration || null,
      });

      auditLogger.logFromRequest(AuditEventType.AUDIO_UPLOADED, req, {
        resourceId: req.params.id,
        resourceType: "audio",
        action: "upload",
        severity: "medium",
      });

      res.json(updated);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/audio/by-case/:caseId", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      
      const caseData = await storage.getCase(req.params.caseId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Authorization check: user can only access audio for their own cases
      if (caseData.createdBy !== userId) {
        return res.status(403).json({ message: "Not authorized to access this audio" });
      }
      
      const audioRecording = await storage.getAudioRecordingByCase(req.params.caseId);
      if (!audioRecording) {
        return res.status(404).json({ message: "Audio recording not found" });
      }
      
      if (new Date() > audioRecording.expiresAt) {
        return res.status(410).json({ message: "Audio recording has expired (24hr retention policy)" });
      }
      
      res.json(audioRecording);
    } catch (error: any) {
      next(error);
    }
  });

  // Protected Object storage route
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res, next) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const userId = req.user.claims.sub;
      const objectPath = `/objects/${req.params.objectPath}`;
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      
      if (!canAccess) {
        return res.sendStatus(403);
      }
      
      // Find audio recording with this path to check expiration
      const audioRecordings = await storage.getCases(userId).then(async cases => {
        const recordings = [];
        for (const c of cases) {
          const rec = await storage.getAudioRecordingByCase(c.id);
          if (rec && rec.filePath === objectPath) {
            recordings.push(rec);
          }
        }
        return recordings;
      });
      
      const audioRecording = audioRecordings[0];
      if (audioRecording && new Date() > audioRecording.expiresAt) {
        return res.status(410).json({ message: "Audio recording has expired (24hr retention policy)" });
      }
      
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      next(error);
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
