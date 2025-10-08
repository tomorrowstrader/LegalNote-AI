import type { Express, Response, NextFunction } from "express";
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
        filePath: undefined,
        duration: undefined,
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

  // Configure multer for multipart file uploads (memory storage)
  const multer = await import('multer');
  const upload = multer.default({
    storage: multer.default.memoryStorage(),
    limits: {
      fileSize: MAX_AUDIO_SIZE_BYTES, // 100MB max
    },
    fileFilter: (req, file, cb) => {
      // Accept audio files only
      const allowedMimeTypes = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav', 'audio/mpeg'];
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only audio files are allowed.'));
      }
    },
  });

  // Helper function for parsing object storage paths
  const parseObjectPath = (path: string): { bucketName: string; objectName: string } => {
    if (!path.startsWith("/")) {
      path = `/${path}`;
    }
    const pathParts = path.split("/");
    if (pathParts.length < 3) {
      throw new Error("Invalid path: must contain at least a bucket name");
    }
    const bucketName = pathParts[1];
    const objectName = pathParts.slice(2).join("/");
    return { bucketName, objectName };
  };

  // Multer error handling middleware
  const handleMulterError = (err: any, req: any, res: Response, next: NextFunction) => {
    if (err instanceof multer.default.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File too large (max 100MB)' });
      }
      return res.status(400).json({ message: err.message });
    }
    
    // Handle fileFilter rejections
    if (err.message && err.message.includes('Invalid file type')) {
      return res.status(400).json({ message: err.message });
    }
    
    next(err);
  };

  // Multipart upload endpoint using industry-standard approach
  app.post("/api/audio/:id/upload", 
    isAuthenticated, 
    audioUploadLimiter,
    upload.single('audioFile'),
    handleMulterError,
    async (req: any, res: Response, next: NextFunction) => {
      try {
        const userId = req.user.claims.sub;
        const audioId = req.params.id;
        
        // Validate multipart upload
        if (!req.file) {
          return res.status(400).json({ message: "Audio file is required" });
        }

        if (!req.body.duration) {
          return res.status(400).json({ message: "Duration is required" });
        }

        // Get audio record and verify ownership
        const audioRecording = await storage.getAudioRecording(audioId);
        if (!audioRecording) {
          return res.status(404).json({ message: "Audio recording not found" });
        }

        const caseData = await storage.getCase(audioRecording.caseId);
        if (!caseData || caseData.createdBy !== userId) {
          return res.status(403).json({ message: "Not authorized" });
        }

        // File is already in memory as Buffer (req.file.buffer)
        const audioBuffer = req.file.buffer;
        
        console.log(`Received audio file: ${req.file.originalname}, size: ${audioBuffer.length} bytes, type: ${req.file.mimetype}`);

        // Upload directly to GCS using server-side method
        const objectStorageService = new ObjectStorageService();
        const privateObjectDir = objectStorageService.getPrivateObjectDir();
        
        // Generate unique object name and full path
        const { randomUUID } = await import('crypto');
        const objectId = randomUUID();
        const fullPath = `${privateObjectDir}/uploads/${objectId}`;
        
        const { bucketName, objectName } = parseObjectPath(fullPath);
        
        console.log(`Uploading audio to bucket: ${bucketName}, object: ${objectName}`);
        
        // Import GCS client and upload
        const { objectStorageClient } = await import('./objectStorage');
        const bucket = objectStorageClient.bucket(bucketName);
        const file = bucket.file(objectName);
        
        // Upload buffer to GCS with proper content type
        await file.save(audioBuffer, {
          metadata: {
            contentType: req.file.mimetype,
          },
        });
        
        console.log(`Audio uploaded successfully to ${fullPath}`);
        
        // Construct the storage URL and normalize
        const storageURL = `https://storage.googleapis.com/${bucketName}/${objectName}`;
        const normalizedPath = objectStorageService.normalizeObjectEntityPath(storageURL);
        
        console.log(`Normalized path: ${normalizedPath}, setting ACL...`);
        
        // Set ACL policy
        const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
          storageURL,
          {
            owner: userId,
            visibility: "private",
          }
        );
        
        console.log(`ACL set, final objectPath: ${objectPath}`);

        // Update audio record with file path and duration
        const updated = await storage.updateAudioRecording(audioId, {
          filePath: objectPath,
          duration: parseFloat(req.body.duration),
        });

        auditLogger.logFromRequest(AuditEventType.AUDIO_UPLOADED, req, {
          resourceId: audioId,
          resourceType: "audio",
          action: "upload",
          severity: "medium",
        });

        res.json(updated);
      } catch (error: any) {
        console.error('Audio upload error:', error);
        next(error);
      }
    }
  );

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
