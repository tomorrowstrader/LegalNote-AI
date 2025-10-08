import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCaseSchema, insertAudioRecordingSchema } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";

const TEMP_USER_ID = "temp-user-123";

export async function registerRoutes(app: Express): Promise<Server> {
  // Case routes
  app.post("/api/cases", async (req, res) => {
    try {
      const validatedData = insertCaseSchema.parse(req.body);
      const newCase = await storage.createCase(validatedData);
      res.json(newCase);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/cases", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }
      const cases = await storage.getCases(userId);
      res.json(cases);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/cases/:id", async (req, res) => {
    try {
      const caseData = await storage.getCase(req.params.id);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      res.json(caseData);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/audio/upload-url", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/audio", async (req, res) => {
    try {
      const validatedData = insertAudioRecordingSchema.parse(req.body);
      
      const caseData = await storage.getCase(validatedData.caseId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      if (caseData.createdBy !== TEMP_USER_ID) {
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
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/audio/:id", async (req, res) => {
    try {
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
      
      if (caseData.createdBy !== TEMP_USER_ID) {
        return res.status(403).json({ message: "Not authorized to update this audio" });
      }
      
      const objectStorageService = new ObjectStorageService();
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

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/audio/by-case/:caseId", async (req, res) => {
    try {
      const caseData = await storage.getCase(req.params.caseId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      if (caseData.createdBy !== TEMP_USER_ID) {
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
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectPath = `/objects/${req.params.objectPath}`;
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: TEMP_USER_ID,
        requestedPermission: ObjectPermission.READ,
      });
      
      if (!canAccess) {
        return res.sendStatus(403);
      }
      
      const audioRecordings = await storage.getCases(TEMP_USER_ID).then(async cases => {
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
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
