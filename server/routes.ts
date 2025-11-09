import type { Express, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCaseSchema, insertAudioRecordingSchema, insertConsentLogSchema, insertTranscriptSchema, insertDocumentSchema, insertFirmProfileSchema } from "@shared/schema";
import { z } from "zod";
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
  pollingLimiter,
} from "./rateLimiting";
import { auditLogger, AuditEventType } from "./auditLog";
import { logAuditEvent, auditMiddleware } from "./auditMiddleware";
import { openaiService } from "./openaiService";
import { sendCaseEmail } from "./email";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getConnectedProviders } from "./calendar";
import { sendVerificationCode, generateVerificationCode, formatUKPhoneNumber } from "./sms";
import {
  createGoogleOAuthClient,
  createMicrosoftOAuthClient,
  getGoogleAuthUrl,
  getMicrosoftAuthUrl,
  exchangeGoogleCode,
  exchangeMicrosoftCode,
  generateOAuthState,
  signOAuthState,
  verifyOAuthState,
  generateSecureNonce,
  type OAuthStatePayload,
} from "./oauth";
import bcrypt from "bcrypt";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint for deployment platform
  // Must be before auth middleware and CORS is configured to allow requests without origin
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'LegalNote AI', timestamp: new Date().toISOString() });
  });

  // Setup Replit Auth
  await setupAuth(app);

  // Apply general rate limiting to all API routes (except polling endpoints)
  app.use('/api/', (req, res, next) => {
    // Skip general rate limiter for polling endpoints - they have their own lenient limits
    if (req.path.includes('/processing-status')) {
      return next();
    }
    generalApiLimiter(req, res, next);
  });

  // PUBLIC ROUTES (no authentication required)
  
  // Get share link data (public access for clients)
  app.get('/api/share/:linkId', generalApiLimiter, async (req, res, next) => {
    try {
      const { linkId } = req.params;
      
      // Get share link from database
      const shareLink = await storage.getShareLink(linkId);
      
      if (!shareLink) {
        return res.status(404).json({ message: "Share link not found" });
      }
      
      // Check if link has expired
      if (new Date() > new Date(shareLink.expiresAt)) {
        return res.status(410).json({ message: "Share link has expired" });
      }
      
      // Check if SMS verification is required and not yet verified
      if (shareLink.smsProtection && !shareLink.smsVerified) {
        return res.json({
          requiresSmsVerification: true,
          recipientName: shareLink.recipientName,
          phoneNumber: shareLink.smsPhoneNumber,
        });
      }
      
      // Check if password protection is enabled and not yet verified
      if (shareLink.password) {
        // Check session for password verification
        const sessionKey = `share_password_verified_${linkId}`;
        if (!req.session || !req.session[sessionKey]) {
          return res.json({
            requiresPassword: true,
            recipientName: shareLink.recipientName,
          });
        }
      }
      
      // Get case data
      const caseData = await storage.getCase(shareLink.caseId, shareLink.createdBy);
      
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Get documents
      const documents = await storage.getActiveDocumentsByCase(shareLink.caseId, shareLink.createdBy);
      
      // Get transcript
      const transcript = await storage.getTranscriptByCase(shareLink.caseId, shareLink.createdBy);
      
      // Get firm profile for PDF export branding
      const firmProfile = await storage.getFirmProfile();
      
      // Increment access count
      await storage.incrementShareLinkAccess(linkId);
      
      // Log access
      await storage.createAuditLog({
        eventType: "share_link_accessed",
        userId: shareLink.createdBy,
        caseId: shareLink.caseId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          shareLinkId: linkId,
          recipientEmail: shareLink.recipientEmail,
          accessCount: shareLink.accessCount + 1,
        },
        severity: "info",
      });
      
      // Return case data with documents
      res.json({
        requiresSmsVerification: false,
        requiresPassword: false,
        caseData: {
          title: caseData.title,
          clientName: caseData.clientName,
          matterReference: caseData.matterReference,
          createdAt: caseData.createdAt,
        },
        documents: documents.map(doc => ({
          id: doc.id,
          type: doc.type,
          content: doc.content,
          version: doc.version,
          createdAt: doc.createdAt,
        })),
        transcript: transcript ? {
          id: transcript.id,
          content: transcript.content,
          createdAt: transcript.createdAt,
        } : null,
        shareLink: {
          recipientName: shareLink.recipientName,
          expiresAt: shareLink.expiresAt,
          accessLevel: shareLink.accessLevel,
        },
        firmProfile: firmProfile || undefined,
      });
    } catch (error: any) {
      next(error);
    }
  });

  // Send SMS verification code (public access)
  app.post('/api/share/:linkId/send-sms', generalApiLimiter, async (req, res, next) => {
    try {
      const { linkId } = req.params;
      const { phoneNumber } = req.body;

      // Validate phone number is provided
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        return res.status(400).json({ message: "Phone number is required" });
      }

      // Get share link
      const shareLink = await storage.getShareLink(linkId);
      
      if (!shareLink) {
        return res.status(404).json({ message: "Share link not found" });
      }

      // Check if link has expired
      if (new Date() > new Date(shareLink.expiresAt)) {
        return res.status(410).json({ message: "Share link has expired" });
      }

      // Check if SMS protection is enabled
      if (!shareLink.smsProtection) {
        return res.status(400).json({ message: "SMS verification is not required for this link" });
      }

      // Rate limiting: Check SMS send count (max 3 sends per link)
      if (shareLink.smsCodeSentCount >= 3) {
        return res.status(429).json({ message: "Maximum SMS send attempts exceeded for this link" });
      }

      // Format and validate phone number
      const formattedPhone = formatUKPhoneNumber(phoneNumber);

      // Check if phone number matches (if one was provided during link creation)
      if (shareLink.smsPhoneNumber && shareLink.smsPhoneNumber !== formattedPhone) {
        return res.status(403).json({ message: "Phone number does not match the expected recipient" });
      }

      // Generate verification code
      const verificationCode = generateVerificationCode();
      
      // Calculate expiry (15 minutes from now)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);

      // Get firm profile for branded SMS
      const firmProfile = await storage.getFirmProfile();
      const firmName = firmProfile?.name || "LegalNote AI";

      // Send SMS
      const result = await sendVerificationCode(formattedPhone, verificationCode, firmName);

      if (!result.success) {
        return res.status(500).json({ message: result.error || "Failed to send SMS" });
      }

      // Store code in database
      await storage.updateShareLinkSmsCode(linkId, verificationCode, expiresAt);

      // Log SMS sent event
      await storage.createAuditLog({
        eventType: "sms_code_sent",
        userId: shareLink.createdBy,
        caseId: shareLink.caseId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          shareLinkId: linkId,
          phoneNumber: formattedPhone.replace(/\d(?=\d{4})/g, '*'), // Mask phone number in logs
          expiresAt: expiresAt.toISOString(),
        },
        severity: "info",
      });

      res.json({ 
        success: true, 
        message: "Verification code sent successfully",
        expiresIn: 15, // minutes
      });
    } catch (error: any) {
      console.error('Error sending SMS:', error);
      next(error);
    }
  });

  // Verify SMS code (public access)
  app.post('/api/share/:linkId/verify-sms', generalApiLimiter, async (req, res, next) => {
    try {
      const { linkId } = req.params;
      const { code } = req.body;

      // Validate code is provided
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ message: "Verification code is required" });
      }

      // Get share link
      const shareLink = await storage.getShareLink(linkId);
      
      if (!shareLink) {
        return res.status(404).json({ message: "Share link not found" });
      }

      // Check if link has expired
      if (new Date() > new Date(shareLink.expiresAt)) {
        return res.status(410).json({ message: "Share link has expired" });
      }

      // Check if SMS protection is enabled
      if (!shareLink.smsProtection) {
        return res.status(400).json({ message: "SMS verification is not required for this link" });
      }

      // Rate limiting: Check verification attempts (max 5 attempts per link)
      if (shareLink.smsVerificationAttempts >= 5) {
        return res.status(429).json({ message: "Maximum verification attempts exceeded for this link" });
      }

      // Verify the code
      const verification = await storage.verifyShareLinkSmsCode(linkId, code);

      if (!verification.verified) {
        // Log failed verification
        await storage.createAuditLog({
          eventType: "sms_verification_failed",
          userId: shareLink.createdBy,
          caseId: shareLink.caseId,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          metadata: {
            shareLinkId: linkId,
            reason: verification.expired ? 'code_expired' : 'invalid_code',
          },
          severity: "warning",
        });

        if (verification.expired) {
          return res.status(400).json({ 
            message: "Verification code has expired. Please request a new code.",
            expired: true,
          });
        } else {
          return res.status(400).json({ 
            message: "Invalid verification code. Please try again.",
            invalid: true,
          });
        }
      }

      // Log successful verification
      await storage.createAuditLog({
        eventType: "sms_code_verified",
        userId: shareLink.createdBy,
        caseId: shareLink.caseId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          shareLinkId: linkId,
        },
        severity: "info",
      });

      res.json({ 
        success: true, 
        message: "Phone number verified successfully" 
      });
    } catch (error: any) {
      console.error('Error verifying SMS:', error);
      next(error);
    }
  });

  // Verify password for share link (public access)
  app.post('/api/share/:linkId/verify-password', generalApiLimiter, async (req, res, next) => {
    try {
      const { linkId } = req.params;
      const { password } = req.body;

      // Validate password is provided
      if (!password || typeof password !== 'string') {
        return res.status(400).json({ message: "Password is required" });
      }

      // Get share link
      const shareLink = await storage.getShareLink(linkId);
      
      if (!shareLink) {
        return res.status(404).json({ message: "Share link not found" });
      }

      // Check if link has expired
      if (new Date() > new Date(shareLink.expiresAt)) {
        return res.status(410).json({ message: "Share link has expired" });
      }

      // Check if password protection is enabled
      if (!shareLink.password) {
        return res.status(400).json({ message: "Password protection is not enabled for this link" });
      }

      // Verify password - handle both legacy plaintext and bcrypt hashed passwords
      let isPasswordValid = false;
      const isLegacyPlaintext = !shareLink.password.startsWith('$2'); // bcrypt hashes start with $2
      
      if (isLegacyPlaintext) {
        // Legacy plaintext password - do direct comparison
        isPasswordValid = password === shareLink.password;
        
        // Migrate to hashed password on successful login
        if (isPasswordValid) {
          const saltRounds = 10;
          const hashedPassword = await bcrypt.hash(password, saltRounds);
          await storage.updateShareLink(linkId, { password: hashedPassword });
          console.log(`[SECURITY] Migrated legacy plaintext password to bcrypt hash for share link ${linkId}`);
        }
      } else {
        // Modern bcrypt hashed password
        isPasswordValid = await bcrypt.compare(password, shareLink.password);
      }
      
      if (!isPasswordValid) {
        // Log failed password attempt
        await storage.createAuditLog({
          eventType: "share_password_failed",
          userId: shareLink.createdBy,
          caseId: shareLink.caseId,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          metadata: {
            shareLinkId: linkId,
          },
          severity: "warning",
        });

        return res.status(401).json({ message: "Incorrect password" });
      }

      // Store password verification in session
      const sessionKey = `share_password_verified_${linkId}`;
      if (!req.session) {
        return res.status(500).json({ message: "Session not available" });
      }
      req.session[sessionKey] = true;

      // Log successful password verification
      await storage.createAuditLog({
        eventType: "share_password_verified",
        userId: shareLink.createdBy,
        caseId: shareLink.caseId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          shareLinkId: linkId,
        },
        severity: "info",
      });

      res.json({ 
        success: true, 
        message: "Password verified successfully" 
      });
    } catch (error: any) {
      console.error('Error verifying password:', error);
      next(error);
    }
  });

  // Auth user route
  app.get('/api/auth/user', isAuthenticated, authLimiter, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      let user = await storage.getUser(userId);
      
      // If user not found in storage, upsert from claims (handles edge cases)
      if (!user) {
        user = await storage.upsertUser({
          id: req.user.claims.sub,
          email: req.user.claims.email,
          firstName: req.user.claims.first_name,
          lastName: req.user.claims.last_name,
          profileImageUrl: req.user.claims.profile_image_url,
        });
      }
      
      // Add admin flag to user object (MVP: configurable via env)
      const ADMIN_USER_ID = process.env.ADMIN_USER_ID || "48381245";
      const userWithAdminFlag = {
        ...user,
        isAdmin: userId === ADMIN_USER_ID,
      };
      
      res.json(userWithAdminFlag);
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

  // Search cases
  app.get("/api/search", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const query = req.query.q as string;
      
      if (!query || query.trim().length === 0) {
        return res.json([]);
      }
      
      const cases = await storage.searchCases(query.trim(), userId);
      res.json(cases);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/cases/:id", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseData = await storage.getCase(req.params.id, userId);
      
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Log case view for audit trail
      await logAuditEvent(userId, "case_viewed", {
        caseId: req.params.id,
        metadata: { clientName: caseData.clientName, title: caseData.title },
        req,
      });
      
      res.json(caseData);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/cases/:id/processing-status", isAuthenticated, pollingLimiter, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      const metadata = (caseData.aiProcessingMetadata as any) || {};
      
      res.json({
        status: caseData.status,
        processingMetadata: {
          status: metadata.status || 'not_started',
          progress: metadata.progress || 0,
          currentStep: metadata.currentStep || '',
          totalCost: metadata.totalCost || 0,
          totalTokens: metadata.totalTokens || 0,
          error: metadata.error,
          completedAt: metadata.completedAt,
        }
      });
    } catch (error: any) {
      next(error);
    }
  });

  // Case action routes
  app.post("/api/cases/:id/review", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { reviewed } = req.body;
      
      if (typeof reviewed !== 'boolean') {
        return res.status(400).json({ message: "reviewed field must be a boolean" });
      }
      
      const updatedCase = await storage.markCaseAsReviewed(req.params.id, reviewed, userId);
      
      if (!updatedCase) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      await logAuditEvent(userId, "case_updated", {
        caseId: req.params.id,
        metadata: { action: "mark_reviewed", reviewed },
        req,
      });
      
      res.json(updatedCase);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/cases/:id/archive", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { archived } = req.body;
      
      if (typeof archived !== 'boolean') {
        return res.status(400).json({ message: "archived field must be a boolean" });
      }
      
      const updatedCase = await storage.archiveCase(req.params.id, archived, userId);
      
      if (!updatedCase) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      await logAuditEvent(userId, "case_updated", {
        caseId: req.params.id,
        metadata: { action: "archive", archived },
        req,
      });
      
      res.json(updatedCase);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/cases/:id/assign", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { assignedToUserId } = req.body;
      
      if (assignedToUserId !== null && typeof assignedToUserId !== 'string') {
        return res.status(400).json({ message: "assignedToUserId must be a string or null" });
      }
      
      const updatedCase = await storage.assignCaseToUser(req.params.id, assignedToUserId, userId);
      
      if (!updatedCase) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      await logAuditEvent(userId, "case_updated", {
        caseId: req.params.id,
        metadata: { action: "assign", assignedToUserId },
        req,
      });
      
      res.json(updatedCase);
    } catch (error: any) {
      next(error);
    }
  });

  app.patch("/api/cases/:id", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { priority, deadline, textNotes } = req.body;
      
      // Get current case to verify access
      const currentCase = await storage.getCase(req.params.id, userId);
      if (!currentCase) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Build update object with only provided fields
      const updates: any = {};
      if (priority !== undefined) updates.priority = priority;
      if (deadline !== undefined) {
        // Convert deadline string to Date object for Drizzle
        updates.deadline = deadline ? new Date(deadline) : null;
      }
      if (textNotes !== undefined) updates.textNotes = textNotes;
      
      // Update the case
      const updatedCase = await storage.updateCase(req.params.id, updates, userId);
      
      await logAuditEvent(userId, "case_updated", {
        caseId: req.params.id,
        metadata: { updates },
        req,
      });
      
      res.json(updatedCase);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/cases/:id/email", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body with Zod
      const emailRequestSchema = z.object({
        recipientEmail: z.string().email("Invalid email address"),
        customMessage: z.string().max(5000, "Message too long").optional(),
      });
      
      const validationResult = emailRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation error",
          errors: validationResult.error.format()
        });
      }
      
      const { recipientEmail, customMessage } = validationResult.data;
      
      // Get case data (verify user has access)
      const caseData = await storage.getCase(req.params.id, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Create a secure share link for the client (7 days expiration, view-only)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      const shareLink = await storage.createShareLink({
        caseId: req.params.id,
        createdBy: userId,
        recipientEmail,
        recipientName: caseData.clientName,
        isExternal: true,
        accessLevel: "view",
        expiresAt,
        clientConsent: true, // Email implies consent
        smsProtection: false, // Can be enhanced later
      });
      
      // Get firm profile for email branding
      const firmProfile = await storage.getFirmProfile();
      
      // Send email with share link
      const result = await sendCaseEmail({
        to: recipientEmail,
        caseTitle: caseData.title,
        clientName: caseData.clientName,
        matterReference: caseData.matterReference || undefined,
        shareLinkId: shareLink.id,
        customMessage: customMessage || undefined,
        firmProfile: firmProfile ? {
          firmName: firmProfile.firmName,
          phone: firmProfile.phone || undefined,
          email: firmProfile.email || undefined,
          addressLine1: firmProfile.addressLine1 || undefined,
          addressLine2: firmProfile.addressLine2 || undefined,
          city: firmProfile.city || undefined,
          postcode: firmProfile.postcode || undefined,
        } : undefined,
      });
      
      if (!result.success) {
        return res.status(500).json({ 
          message: "Failed to send email",
          error: result.error 
        });
      }
      
      // Log audit events
      await logAuditEvent(userId, "case_email_sent", {
        caseId: req.params.id,
        metadata: { 
          recipientEmail, 
          messageId: result.messageId,
          hasCustomMessage: !!customMessage,
          shareLinkId: shareLink.id,
        },
        req,
      });
      
      await logAuditEvent(userId, "share_link_created", {
        caseId: req.params.id,
        metadata: { 
          shareLinkId: shareLink.id,
          recipientEmail,
          expiresAt: shareLink.expiresAt,
        },
        req,
      });
      
      res.json({ 
        success: true, 
        message: "Email sent successfully",
        messageId: result.messageId,
        shareLinkId: shareLink.id,
      });
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/cases/:id/share-link", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body with Zod
      const shareLinkRequestSchema = z.object({
        recipientEmail: z.string().email("Invalid email address"),
        recipientName: z.string().min(1, "Recipient name is required"),
        isExternal: z.boolean(),
        organization: z.string().optional(),
        expiration: z.enum(["24hours", "7days", "30days", "custom"]),
        accessLevel: z.enum(["view", "download"]),
        password: z.string().optional(),
        clientConsent: z.boolean(),
        smsProtection: z.boolean().default(false),
        smsPhoneNumber: z.string().optional(),
        customMessage: z.string().optional(),
      });
      
      const validationResult = shareLinkRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation error",
          errors: validationResult.error.format()
        });
      }
      
      const { recipientEmail, recipientName, isExternal, organization, expiration, accessLevel, password, clientConsent, smsProtection, smsPhoneNumber, customMessage } = validationResult.data;
      
      // Validate SMS phone number if SMS protection is enabled
      let formattedPhoneNumber: string | undefined;
      if (smsProtection) {
        if (!smsPhoneNumber) {
          return res.status(400).json({ 
            message: "Phone number is required when SMS protection is enabled" 
          });
        }
        formattedPhoneNumber = formatUKPhoneNumber(smsPhoneNumber);
      }
      
      // Get case data (verify user has access)
      const caseData = await storage.getCase(req.params.id, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // For external sharing, verify server-side consent from database
      if (isExternal) {
        // Check if client consent exists in the database
        const consentLogs = await storage.getConsentLogsByCase(req.params.id, userId);
        const hasValidConsent = consentLogs.some((log: any) => log.consentGiven === true);
        
        if (!hasValidConsent) {
          await logAuditEvent(userId, "case_updated", {
            caseId: req.params.id,
            metadata: { 
              action: "external_share_blocked_no_consent",
              recipientEmail,
            },
            severity: "warning",
            req,
          });
          return res.status(403).json({ 
            message: "Cannot share externally: No client consent on record for this case" 
          });
        }
        
        // Also require frontend confirmation of consent
        if (!clientConsent) {
          return res.status(400).json({ 
            message: "Client consent confirmation is required for external sharing" 
          });
        }
      }
      
      // Calculate expiration date based on selected duration
      const expiresAt = new Date();
      switch (expiration) {
        case "24hours":
          expiresAt.setHours(expiresAt.getHours() + 24);
          break;
        case "7days":
          expiresAt.setDate(expiresAt.getDate() + 7);
          break;
        case "30days":
          expiresAt.setDate(expiresAt.getDate() + 30);
          break;
        default:
          expiresAt.setDate(expiresAt.getDate() + 7); // Default to 7 days
      }
      
      // Hash password if provided
      let hashedPassword: string | undefined;
      if (password) {
        const saltRounds = 10;
        hashedPassword = await bcrypt.hash(password, saltRounds);
      }
      
      // Create share link in database
      const shareLink = await storage.createShareLink({
        caseId: req.params.id,
        createdBy: userId,
        recipientEmail,
        recipientName,
        isExternal,
        organization: organization || undefined,
        accessLevel,
        expiresAt,
        password: hashedPassword,
        clientConsent,
        smsProtection: smsProtection || false,
        smsPhoneNumber: formattedPhoneNumber,
      });
      
      // Get firm profile for email branding
      const firmProfile = await storage.getFirmProfile();
      
      // Send email with share link
      const systemMessage = `You have been granted ${accessLevel} access to this case. This link will expire in ${expiration.replace(/(\d+)(\w+)/, '$1 $2')}.${password ? ' A password is required to access the documents.' : ''}${smsProtection ? ' SMS verification is required to access the documents.' : ''}`;
      const fullMessage = customMessage ? `${customMessage}\n\n${systemMessage}` : systemMessage;
      
      const result = await sendCaseEmail({
        to: recipientEmail,
        caseTitle: caseData.title,
        clientName: recipientName,
        matterReference: caseData.matterReference || undefined,
        shareLinkId: shareLink.id,
        customMessage: fullMessage,
        firmProfile: firmProfile ? {
          firmName: firmProfile.firmName,
          phone: firmProfile.phone || undefined,
          email: firmProfile.email || undefined,
          addressLine1: firmProfile.addressLine1 || undefined,
          addressLine2: firmProfile.addressLine2 || undefined,
          city: firmProfile.city || undefined,
          postcode: firmProfile.postcode || undefined,
        } : undefined,
      });
      
      if (!result.success) {
        return res.status(500).json({ 
          message: "Failed to send secure link",
          error: result.error 
        });
      }
      
      // Log audit events
      await logAuditEvent(userId, "case_link_shared", {
        caseId: req.params.id,
        metadata: { 
          recipientEmail,
          recipientName,
          isExternal,
          organization,
          expiration,
          accessLevel,
          passwordProtected: !!password,
          smsProtected: smsProtection,
          clientConsent,
          messageId: result.messageId,
          shareLinkId: shareLink.id,
        },
        req,
      });
      
      await logAuditEvent(userId, "share_link_created", {
        caseId: req.params.id,
        metadata: { 
          shareLinkId: shareLink.id,
          recipientEmail,
          expiresAt: shareLink.expiresAt,
        },
        req,
      });
      
      res.json({ 
        success: true, 
        message: "Secure link sent successfully",
        messageId: result.messageId,
        shareLinkId: shareLink.id,
      });
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
      
      const caseData = await storage.getCase(validatedData.caseId, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // GDPR Compliance: 7-day retention OR until successful processing (whichever comes first)
      // UK GDPR allows retention "as long as necessary" for processing purpose
      // 7 days ensures reliable AI processing even with API failures/retries
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
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

        const caseData = await storage.getCase(audioRecording.caseId, userId);
        if (!caseData) {
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

      const caseData = await storage.getCase(audioRecording.caseId, userId);
      if (!caseData) {
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
      
      const caseData = await storage.getCase(req.params.caseId, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      const audioRecording = await storage.getAudioRecordingByCase(req.params.caseId, userId);
      if (!audioRecording) {
        return res.status(404).json({ message: "Audio recording not found" });
      }
      
      if (new Date() > audioRecording.expiresAt && !audioRecording.deletedAt) {
        // GDPR Compliance: Delete expired audio and log audit event
        if (audioRecording.filePath) {
          try {
            const objectStorageService = new ObjectStorageService();
            await objectStorageService.deleteObjectEntity(audioRecording.filePath);
            await storage.updateAudioRecording(audioRecording.id, { deletedAt: new Date() });
            
            await logAuditEvent(userId, "audio_deleted", {
              caseId: audioRecording.caseId,
              audioRecordingId: audioRecording.id,
              metadata: {
                reason: "24hr_retention_policy_expiration",
                filePath: audioRecording.filePath,
                expiresAt: audioRecording.expiresAt.toISOString(),
                deletedAt: new Date().toISOString(),
              },
              severity: "warning",
              req,
            });
          } catch (deleteError) {
            console.error("Failed to delete expired audio:", deleteError);
          }
        }
        
        return res.status(410).json({ message: "Audio recording has expired (24hr retention policy)" });
      }
      
      res.json(audioRecording);
    } catch (error: any) {
      next(error);
    }
  });

  // Consent logging routes
  app.post("/api/consent", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertConsentLogSchema.parse({
        ...req.body,
        solicitorId: userId, // Ensure solicitorId matches authenticated user
      });
      
      // Verify user owns the case and create consent log
      const consentLog = await storage.createConsentLog(validatedData, userId);
      
      auditLogger.logFromRequest(
        validatedData.consentGiven ? AuditEventType.CONSENT_GIVEN : AuditEventType.CONSENT_DECLINED,
        req,
        {
          resourceId: consentLog.id,
          resourceType: "consent",
          severity: "medium",
        }
      );
      
      res.json(consentLog);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  });

  app.get("/api/consent/by-case/:caseId", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.caseId;
      
      const consentLogs = await storage.getConsentLogsByCase(caseId, userId);
      res.json(consentLogs);
    } catch (error: any) {
      next(error);
    }
  });

  // AI Processing routes
  
  // Transcribe audio for quick notes (no case association)
  app.post("/api/transcribe", isAuthenticated, upload.single('audio'), async (req: any, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      // Validate file type
      const allowedMimeTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a'];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: "Invalid audio format" });
      }

      // Transcribe using OpenAI Whisper
      console.log('Starting quick note transcription');
      const result = await openaiService.transcribeAudio(req.file.buffer);
      
      console.log('Quick note transcription completed');
      res.json({ text: result.text });
    } catch (error: any) {
      console.error('Quick note transcription error:', error);
      next(error);
    }
  });
  
  app.post("/api/cases/:id/transcribe", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Verify ownership
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Get audio recording
      const audioRecording = await storage.getAudioRecordingByCase(caseId, userId);
      if (!audioRecording || !audioRecording.filePath) {
        return res.status(404).json({ message: "No audio recording found for this case" });
      }
      
      // Check if transcript already exists
      const existingTranscript = await storage.getTranscriptByCase(caseId, userId);
      if (existingTranscript) {
        return res.json({ transcript: existingTranscript, message: "Transcript already exists" });
      }
      
      // Download audio file from storage
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(audioRecording.filePath);
      const audioBuffer = await objectFile.download().then(([buffer]) => buffer);
      
      // Transcribe using OpenAI Whisper
      console.log(`Starting transcription for case ${caseId}`);
      const result = await openaiService.transcribeAudio(audioBuffer);
      
      // Save transcript
      const transcript = await storage.createTranscript({
        caseId,
        content: result.text,
      });
      
      // Update case status
      await storage.updateCase(caseId, { status: "processing" }, userId);
      
      auditLogger.logFromRequest(AuditEventType.TRANSCRIPT_GENERATED, req, {
        resourceId: transcript.id,
        resourceType: "transcript",
        action: "generate",
        severity: "low",
      });
      
      res.json({ transcript, message: "Transcription completed" });
    } catch (error: any) {
      console.error('Transcription error:', error);
      next(error);
    }
  });

  app.post("/api/cases/:id/generate-documents", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Verify ownership
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Get transcript
      const transcript = await storage.getTranscriptByCase(caseId, userId);
      if (!transcript) {
        return res.status(404).json({ message: "No transcript found. Please transcribe the audio first." });
      }
      
      // Check if documents already exist
      const existingDocs = await storage.getActiveDocumentsByCase(caseId, userId);
      if (existingDocs.length > 0) {
        return res.json({ documents: existingDocs, message: "Documents already exist" });
      }
      
      // Generate documents using GPT-4
      console.log(`Generating documents for case ${caseId}`);
      const result = await openaiService.generateDocuments(transcript.content, {
        title: caseData.title,
        clientName: caseData.clientName,
        matterReference: caseData.matterReference || undefined,
      });
      
      // Save attendance note
      const attendanceNote = await storage.createDocument({
        caseId,
        transcriptSnapshotId: transcript.id,
        type: "attendance_note",
        content: result.attendanceNote,
        version: 1,
        versionType: "ai_generated",
        createdBy: userId,
        isActive: true,
      });
      
      // Save legal opinion
      const legalOpinion = await storage.createDocument({
        caseId,
        transcriptSnapshotId: transcript.id,
        type: "legal_opinion",
        content: result.legalOpinion,
        version: 1,
        versionType: "ai_generated",
        createdBy: userId,
        isActive: true,
      });
      
      // Update case status
      await storage.updateCase(caseId, { status: "completed" }, userId);
      
      auditLogger.logFromRequest(AuditEventType.DOCUMENT_GENERATED, req, {
        resourceId: attendanceNote.id,
        resourceType: "document",
        action: "generate",
        severity: "low",
      });
      
      res.json({ 
        attendanceNote, 
        legalOpinion,
        message: "Documents generated successfully" 
      });
    } catch (error: any) {
      console.error('Document generation error:', error);
      next(error);
    }
  });

  // All-in-one processing: transcribe + generate documents using background jobs
  app.post("/api/cases/:id/process", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Verify ownership
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // GDPR Compliance: Verify valid consent exists before processing
      const consentLogs = await storage.getConsentLogsByCase(caseId, userId);
      const hasValidConsent = consentLogs.some(log => log.consentGiven === true);
      
      if (!hasValidConsent) {
        auditLogger.logFromRequest(AuditEventType.ACCESS_CONTROL_VIOLATION, req, {
          resourceId: caseId,
          resourceType: "case",
          action: "process_without_consent",
          severity: "high",
        });
        return res.status(403).json({ 
          message: "GDPR compliance error: Valid client consent must be recorded before processing audio recordings" 
        });
      }
      
      // Check if audio recording exists and has file path
      const audioRecording = await storage.getAudioRecordingByCase(caseId, userId);
      if (!audioRecording || !audioRecording.filePath) {
        return res.status(404).json({ message: "No audio recording found for this case" });
      }
      
      // Prevent duplicate processing - check both case status and metadata
      const metadata = (caseData.aiProcessingMetadata as any) || {};
      if (caseData.status === 'processing' || metadata.status === 'processing') {
        return res.status(400).json({ message: "Case is already being processed" });
      }
      
      // Initialize processing metadata and update status
      await storage.updateCase(caseId, { 
        status: "processing",
        aiProcessingMetadata: {
          status: 'processing',
          progress: 0,
          currentStep: 'Queued for processing...',
        }
      }, userId);
      
      // Queue AI processing job
      const { jobQueue } = await import('./services/jobQueue');
      const jobId = await jobQueue.addJob('ai-processing', { caseId, userId });
      
      auditLogger.logFromRequest(AuditEventType.AI_PROCESSING_STARTED, req, {
        resourceId: caseId,
        resourceType: "case",
        action: "queue_processing",
        severity: "medium",
        additionalInfo: { jobId },
      });
      
      res.json({ 
        message: "AI processing started", 
        jobId,
        status: 'processing'
      });
    } catch (error: any) {
      console.error('Case processing error:', error);
      // Update case status and metadata to indicate failure
      try {
        const userId = (req as any).user?.claims?.sub;
        if (userId) {
          await storage.updateCase(req.params.id, { 
            status: "pending",
            aiProcessingMetadata: {
              status: 'failed',
              error: error.message,
            }
          }, userId);
        }
      } catch (e) {}
      next(error);
    }
  });

  // Retry failed AI processing
  app.post("/api/cases/:id/retry-processing", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Verify ownership
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Check if case actually failed
      const metadata = (caseData.aiProcessingMetadata as any) || {};
      if (caseData.status !== 'failed' && metadata.status !== 'failed') {
        return res.status(400).json({ message: "Only failed cases can be retried" });
      }
      
      // GDPR Compliance: Verify valid consent exists
      const consentLogs = await storage.getConsentLogsByCase(caseId, userId);
      const hasValidConsent = consentLogs.some(log => log.consentGiven === true);
      
      if (!hasValidConsent) {
        return res.status(403).json({ 
          message: "GDPR compliance error: Valid client consent required" 
        });
      }
      
      // Check if audio recording exists
      const audioRecording = await storage.getAudioRecordingByCase(caseId, userId);
      if (!audioRecording || !audioRecording.filePath) {
        return res.status(404).json({ message: "No audio recording found" });
      }
      
      // Reset processing metadata and update status
      await storage.updateCase(caseId, { 
        status: "processing",
        aiProcessingMetadata: {
          status: 'processing',
          progress: 0,
          currentStep: 'Retrying processing...',
          error: undefined, // Clear previous error
        }
      }, userId);
      
      // Queue AI processing job
      const { jobQueue } = await import('./services/jobQueue');
      const jobId = await jobQueue.addJob('ai-processing', { caseId, userId });
      
      auditLogger.logFromRequest(AuditEventType.AI_PROCESSING_STARTED, req, {
        resourceId: caseId,
        resourceType: "case",
        action: "retry_processing",
        severity: "medium",
        additionalInfo: { jobId, retry: true },
      });
      
      res.json({ 
        message: "AI processing retry started", 
        jobId,
        status: 'processing'
      });
    } catch (error: any) {
      console.error('Retry processing error:', error);
      next(error);
    }
  });

  // Get transcript for a case
  app.get("/api/cases/:id/transcript", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Verify ownership
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const transcript = await storage.getTranscriptByCase(caseId, userId);
      if (!transcript) {
        return res.status(404).json({ message: "No transcript found" });
      }
      
      res.json(transcript);
    } catch (error: any) {
      next(error);
    }
  });

  // Get documents for a case
  app.get("/api/cases/:id/documents", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Verify ownership
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const documents = await storage.getActiveDocumentsByCase(caseId, userId);
      res.json(documents);
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
          const rec = await storage.getAudioRecordingByCase(c.id, userId);
          if (rec && rec.filePath === objectPath) {
            recordings.push(rec);
          }
        }
        return recordings;
      });
      
      const audioRecording = audioRecordings[0];
      if (audioRecording && new Date() > audioRecording.expiresAt && !audioRecording.deletedAt) {
        // GDPR Compliance: Delete expired audio and log audit event
        try {
          await objectStorageService.deleteObjectEntity(objectPath);
          await storage.updateAudioRecording(audioRecording.id, { deletedAt: new Date() });
          
          await logAuditEvent(userId, "audio_deleted", {
            caseId: audioRecording.caseId,
            audioRecordingId: audioRecording.id,
            metadata: {
              reason: "24hr_retention_policy_expiration",
              filePath: objectPath,
              expiresAt: audioRecording.expiresAt.toISOString(),
              deletedAt: new Date().toISOString(),
            },
            severity: "warning",
            req,
          });
        } catch (deleteError) {
          console.error("Failed to delete expired audio:", deleteError);
        }
        
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

  // Audit trail API endpoints
  app.post("/api/audit/log", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { eventType, caseId, documentId, transcriptId, audioRecordingId, metadata, severity } = req.body;

      if (!eventType) {
        return res.status(400).json({ message: "eventType is required" });
      }

      await logAuditEvent(userId, eventType, {
        caseId,
        documentId,
        transcriptId,
        audioRecordingId,
        metadata,
        severity,
        req,
      });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/audit/logs", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId, documentId, eventType, startDate, endDate, limit } = req.query;

      const filters: any = {};
      if (caseId) filters.caseId = caseId as string;
      if (documentId) filters.documentId = documentId as string;
      if (eventType) filters.eventType = eventType as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (limit) filters.limit = parseInt(limit as string, 10);

      const logs = await storage.getAuditLogs(filters);

      await logAuditEvent(userId, "case_viewed", {
        metadata: { action: "audit_logs_queried", filters },
        req,
      });

      res.json(logs);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/audit/case/:caseId", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

      const logs = await storage.getAuditLogsByCase(caseId, limit);

      await logAuditEvent(userId, "case_viewed", {
        caseId,
        metadata: { action: "case_audit_history_viewed" },
        req,
      });

      res.json(logs);
    } catch (error) {
      next(error);
    }
  });

  // Admin middleware
  const isAdmin = (req: any, res: Response, next: NextFunction) => {
    const userId = req.user?.claims?.sub;
    const ADMIN_USER_ID = process.env.ADMIN_USER_ID || "48381245";
    
    if (userId !== ADMIN_USER_ID) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  // Admin statistics endpoints
  app.get("/api/admin/statistics", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const stats = await storage.getAdminStatistics();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const userStats = await storage.getUserStatistics();
      res.json(userStats);
    } catch (error) {
      next(error);
    }
  });

  // Firm profile routes (accessible to all authenticated users - public branding info)
  app.get("/api/firm-profile", isAuthenticated, async (req: any, res, next) => {
    try {
      const profile = await storage.getFirmProfile();
      res.json(profile || null);
    } catch (error) {
      next(error);
    }
  });

  // Update firm profile (admin only)
  app.put("/api/firm-profile", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertFirmProfileSchema.parse({
        ...req.body,
        updatedBy: userId,
      });
      
      const updatedProfile = await storage.upsertFirmProfile(validatedData);
      
      auditLogger.logFromRequest(AuditEventType.FIRM_PROFILE_UPDATED, req, {
        resourceId: updatedProfile.id,
        resourceType: "firm_profile",
        action: "update",
        severity: "medium",
      });
      
      res.json(updatedProfile);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  });

  // Get user preferences
  app.get("/api/user-preferences", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = await storage.getUserPreferences(userId);
      res.json(preferences || { userId, dismissedReviewBanner: false, completedOnboarding: false });
    } catch (error) {
      next(error);
    }
  });

  // Update user preferences
  app.put("/api/user-preferences", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const updatedPreferences = await storage.updateUserPreferences(userId, req.body);
      res.json(updatedPreferences);
    } catch (error) {
      next(error);
    }
  });

  // Admin usage statistics endpoint (deprecated - use /api/admin/statistics instead)
  app.get("/api/admin/usage-stats", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      
      // MVP: Admin user ID from environment or hardcoded
      // For production, move this to environment variable or database-driven role system
      const ADMIN_USER_ID = process.env.ADMIN_USER_ID || "48381245";
      
      if (userId !== ADMIN_USER_ID) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      // MVP: Get cases for the admin user to track their own API usage
      // For production with multiple users: implement storage.getAllCases() to aggregate across all users
      const allCases = await storage.getCases(userId);
      
      // Calculate date ranges
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Initialize stats
      let totalCostToday = 0;
      let totalCostWeek = 0;
      let totalCostMonth = 0;
      let totalCostAllTime = 0;
      const costPerUser: Record<string, number> = {};
      const recentExpensiveCases: Array<{ id: string; title: string; cost: number; createdAt: string; userId: string }> = [];
      const dailyCosts: Array<{ date: string; cost: number }> = [];
      
      // Calculate daily costs for last 7 days
      const dailyCostMap: Record<string, number> = {};
      for (let i = 0; i < 7; i++) {
        const date = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        dailyCostMap[dateStr] = 0;
      }
      
      // Process each case
      for (const caseData of allCases) {
        const metadata = (caseData.aiProcessingMetadata as any) || {};
        const cost = metadata.totalCost || 0;
        
        if (cost > 0) {
          const caseDate = new Date(caseData.createdAt);
          const dateStr = caseDate.toISOString().split('T')[0];
          
          // Total costs
          totalCostAllTime += cost;
          
          if (caseDate >= todayStart) {
            totalCostToday += cost;
          }
          if (caseDate >= weekStart) {
            totalCostWeek += cost;
            
            // Daily costs
            if (dailyCostMap.hasOwnProperty(dateStr)) {
              dailyCostMap[dateStr] += cost;
            }
          }
          if (caseDate >= monthStart) {
            totalCostMonth += cost;
          }
          
          // Cost per user
          costPerUser[caseData.createdBy] = (costPerUser[caseData.createdBy] || 0) + cost;
          
          // Recent expensive cases
          recentExpensiveCases.push({
            id: caseData.id,
            title: caseData.title,
            cost,
            createdAt: caseData.createdAt.toISOString(),
            userId: caseData.createdBy,
          });
        }
      }
      
      // Sort and limit expensive cases
      recentExpensiveCases.sort((a, b) => b.cost - a.cost);
      const topExpensiveCases = recentExpensiveCases.slice(0, 10);
      
      // Convert daily costs to array
      for (const [date, cost] of Object.entries(dailyCostMap)) {
        dailyCosts.push({ date, cost });
      }
      dailyCosts.sort((a, b) => a.date.localeCompare(b.date));
      
      // Sort cost per user
      const topUsers = Object.entries(costPerUser)
        .map(([userId, cost]) => ({ userId, cost }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10);
      
      res.json({
        totalCostToday,
        totalCostWeek,
        totalCostMonth,
        totalCostAllTime,
        topUsers,
        topExpensiveCases,
        dailyCosts,
        totalCasesProcessed: allCases.filter((c: any) => (c.aiProcessingMetadata as any)?.totalCost > 0).length,
      });
    } catch (error) {
      next(error);
    }
  });

  // OAuth state management (CSRF protection)
  // In-memory store for OAuth state tokens (expires after 10 minutes)
  const oauthStateStore = new Map<string, { userId: string; provider: string; createdAt: number; popup?: boolean }>();
  
  // Cleanup expired OAuth states every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [state, data] of Array.from(oauthStateStore.entries())) {
      if (now - data.createdAt > 10 * 60 * 1000) { // 10 minutes
        oauthStateStore.delete(state);
      }
    }
  }, 5 * 60 * 1000);

  // OAuth Calendar Integration Routes
  
  // Initiate OAuth flow for calendar provider
  // Accepts optional sync context (caseId, deadline) for auto-sync after OAuth
  app.post("/api/calendar/auth/:provider", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const provider = req.params.provider;
      const popup = req.query.popup === 'true';
      
      if (provider !== 'google' && provider !== 'outlook') {
        return res.status(400).json({ message: "Invalid provider. Must be 'google' or 'outlook'" });
      }

      // Optional sync context from request body
      const { caseId, deadline } = req.body || {};

      // Create signed OAuth state with sync context
      const statePayload: OAuthStatePayload = {
        userId,
        provider: provider as 'google' | 'outlook',
        popup,
        nonce: generateSecureNonce(),
        createdAt: Date.now(),
      };

      // Add sync context if provided
      if (caseId && deadline) {
        statePayload.syncContext = {
          caseId: parseInt(caseId, 10),
          deadline: new Date(deadline).toISOString(),
        };
      }

      // Sign the state token
      const signedState = signOAuthState(statePayload);

      // Get base URL from request
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host;
      const baseUrl = `${protocol}://${host}`;

      try {
        let authUrl: string;
        
        if (provider === 'google') {
          const client = createGoogleOAuthClient(baseUrl);
          authUrl = getGoogleAuthUrl(client, signedState);
        } else {
          const client = createMicrosoftOAuthClient(baseUrl);
          authUrl = await getMicrosoftAuthUrl(client, `${baseUrl}/api/calendar/callback/outlook`, signedState);
        }

        // Return auth URL for frontend to redirect
        res.json({ authUrl });
      } catch (error: any) {
        // OAuth credentials not configured
        if (error.message.includes('not configured')) {
          return res.status(503).json({
            message: `${provider === 'google' ? 'Google' : 'Microsoft'} OAuth is not configured. Please contact your administrator.`,
            details: error.message,
          });
        }
        throw error;
      }
    } catch (error) {
      next(error);
    }
  });

  // OAuth callback handler with auto-sync support
  app.get("/api/calendar/callback/:provider", async (req: any, res, next) => {
    try {
      const provider = req.params.provider;
      const { code, state, error: oauthError } = req.query;

      // Always redirect to /oauth/callback - it handles both popup and mobile flows
      const redirectBase = '/oauth/callback';

      // Check for OAuth errors
      if (oauthError) {
        return res.redirect(`${redirectBase}?calendar_error=${encodeURIComponent(oauthError)}`);
      }

      if (!code || !state) {
        return res.redirect(`${redirectBase}?calendar_error=missing_code_or_state`);
      }

      // Verify and decode signed state token
      const stateData = verifyOAuthState(state as string);
      
      if (!stateData) {
        console.error('Invalid or expired OAuth state token');
        return res.redirect(`${redirectBase}?calendar_error=invalid_state`);
      }

      // Verify provider matches
      if (stateData.provider !== provider) {
        return res.redirect(`${redirectBase}?calendar_error=provider_mismatch`);
      }

      // Get base URL
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host;
      const baseUrl = `${protocol}://${host}`;

      try {
        let tokenData;

        if (provider === 'google') {
          const client = createGoogleOAuthClient(baseUrl);
          tokenData = await exchangeGoogleCode(client, code as string);
        } else {
          const client = createMicrosoftOAuthClient(baseUrl);
          tokenData = await exchangeMicrosoftCode(client, code as string, `${baseUrl}/api/calendar/callback/outlook`);
        }

        // Save calendar integration to storage
        await storage.saveCalendarIntegration({
          userId: stateData.userId,
          provider: provider as 'google' | 'outlook',
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken || undefined,
          expiresAt: tokenData.expiresAt || undefined,
          email: tokenData.email || undefined,
        });

        // Log audit event
        await storage.createAuditLog({
          eventType: 'calendar_connected',
          userId: stateData.userId,
          metadata: {
            provider,
            email: tokenData.email || 'N/A',
          },
          severity: 'info',
        });

        // If sync context exists, attempt to create calendar event immediately
        if (stateData.syncContext) {
          const { caseId, deadline } = stateData.syncContext;
          
          try {
            // Get case data for event details
            const caseData = await storage.getCase(caseId, stateData.userId);
            
            if (!caseData) {
              console.error(`Case ${caseId} not found for auto-sync`);
              return res.redirect(`${redirectBase}?calendar_connected=${provider}&sync_error=case_not_found`);
            }

            // Create calendar event with retry logic
            const maxRetries = 3;
            let lastError: any = null;
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                await createCalendarEvent(
                  storage,
                  stateData.userId,
                  provider as 'google' | 'outlook',
                  {
                    title: `${caseData.clientName} - ${caseData.caseType}`,
                    description: `Case deadline for ${caseData.clientName}`,
                    startTime: new Date(deadline),
                    endTime: new Date(new Date(deadline).getTime() + 60 * 60 * 1000), // 1 hour duration
                    caseId,
                  },
                  baseUrl
                );

                // Update case to mark as synced
                await storage.updateCase(caseId, stateData.userId, {
                  syncToCalendar: provider as 'google' | 'outlook',
                });

                // Log successful sync
                await storage.createAuditLog({
                  eventType: 'calendar_event_created',
                  userId: stateData.userId,
                  caseId,
                  metadata: {
                    provider,
                    eventTitle: `${caseData.clientName} - ${caseData.caseType}`,
                    deadline: deadline,
                    autoSync: true,
                  },
                  severity: 'info',
                });

                // Success! Redirect to case page with success message
                return res.redirect(`${redirectBase}?calendar_connected=${provider}&sync_success=true&case_id=${caseId}`);
              } catch (error: any) {
                lastError = error;
                console.error(`Calendar event creation attempt ${attempt}/${maxRetries} failed:`, error);
                
                // Exponential backoff: wait before retry
                if (attempt < maxRetries) {
                  await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                }
              }
            }

            // All retries failed
            console.error(`Calendar event creation failed after ${maxRetries} attempts:`, lastError);
            return res.redirect(`${redirectBase}?calendar_connected=${provider}&sync_error=event_creation_failed&case_id=${caseId}`);
          } catch (error: any) {
            console.error('Auto-sync error:', error);
            return res.redirect(`${redirectBase}?calendar_connected=${provider}&sync_error=unknown&case_id=${caseId}`);
          }
        }

        // No sync context - just redirect with connection success
        res.redirect(`${redirectBase}?calendar_connected=${provider}`);
      } catch (error: any) {
        console.error(`OAuth token exchange failed for ${provider}:`, error);
        res.redirect(`${redirectBase}?calendar_error=token_exchange_failed`);
      }
    } catch (error) {
      next(error);
    }
  });

  // Get user's calendar connections (list format)
  app.get("/api/calendar/connections", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const connections = await storage.getUserCalendarIntegrations(userId);
      
      // Return safe data (don't expose tokens)
      const safeConnections = connections.map(conn => ({
        provider: conn.provider,
        email: conn.email,
        connectedAt: conn.connectedAt,
        isExpired: conn.expiresAt ? new Date(conn.expiresAt) < new Date() : false,
      }));
      
      res.json(safeConnections);
    } catch (error) {
      next(error);
    }
  });

  // Get user's OAuth connections (object format for Settings UI)
  app.get("/api/oauth/connections", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const providers = await getConnectedProviders(userId, storage);
      res.json(providers);
    } catch (error) {
      next(error);
    }
  });

  // OAuth configuration diagnostic endpoint (shows exact redirect URIs needed)
  app.get("/api/calendar/oauth-config", isAuthenticated, async (req: any, res, next) => {
    try {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host;
      const baseUrl = `${protocol}://${host}`;

      const config = {
        baseUrl,
        redirectUris: {
          google: `${baseUrl}/api/calendar/callback/google`,
          outlook: `${baseUrl}/api/calendar/callback/outlook`,
        },
        instructions: {
          google: {
            step1: "Go to Google Cloud Console: https://console.cloud.google.com/apis/credentials",
            step2: "Select your OAuth 2.0 Client ID",
            step3: `Add this to 'Authorized redirect URIs': ${baseUrl}/api/calendar/callback/google`,
            step4: "Click Save",
          },
          outlook: {
            step1: "Go to Azure Portal: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
            step2: "Select your app registration",
            step3: "Go to 'Authentication' section",
            step4: `Add this to 'Redirect URIs' (Web platform): ${baseUrl}/api/calendar/callback/outlook`,
            step5: "Click Save",
          },
        },
        status: {
          googleConfigured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
          outlookConfigured: !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
        },
      };

      res.json(config);
    } catch (error) {
      next(error);
    }
  });

  // Disconnect calendar
  app.delete("/api/calendar/disconnect/:provider", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const provider = req.params.provider;

      if (provider !== 'google' && provider !== 'outlook') {
        return res.status(400).json({ message: "Invalid provider" });
      }

      await storage.deleteCalendarIntegration(userId, provider as 'google' | 'outlook');

      // Log audit event
      await storage.createAuditLog({
        eventType: 'calendar_disconnected',
        userId,
        metadata: {
          provider,
        },
        severity: 'info',
      });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Legacy calendar status route (will be deprecated - use /api/oauth/connections instead)
  app.get("/api/calendar/status", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const providers = await getConnectedProviders(userId, storage);
      res.json(providers);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/cases/:id/sync-calendar", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { provider } = req.body;

      if (!provider || (provider !== 'google' && provider !== 'outlook')) {
        return res.status(400).json({ message: "Invalid provider. Must be 'google' or 'outlook'" });
      }

      // Get case and verify access
      const caseData = await storage.getCase(req.params.id, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }

      // Check if case has a deadline
      if (!caseData.deadline) {
        return res.status(400).json({ message: "Case must have a deadline to sync to calendar" });
      }

      // Check if event already exists for this provider
      const existingEvent = await storage.getCalendarEventByProvider(req.params.id, userId, provider);

      let result;
      if (existingEvent) {
        // Update existing event
        result = await updateCalendarEvent(userId, provider, existingEvent.providerEventId, {
          caseId: req.params.id,
          title: caseData.title,
          clientName: caseData.clientName,
          matterReference: caseData.matterReference || undefined,
          deadline: new Date(caseData.deadline),
        }, storage);

        if (result.success) {
          await storage.updateCalendarEvent(existingEvent.id, {
            lastUpdatedAt: new Date(),
          });
        }
      } else {
        // Create new event
        result = await createCalendarEvent(userId, provider, {
          caseId: req.params.id,
          title: caseData.title,
          clientName: caseData.clientName,
          matterReference: caseData.matterReference || undefined,
          deadline: new Date(caseData.deadline),
        }, storage);

        if (result.success && result.eventId) {
          await storage.createCalendarEvent({
            caseId: req.params.id,
            userId: userId,
            provider: provider,
            providerEventId: result.eventId,
            eventType: 'deadline',
          });
        }
      }

      if (result.success) {
        // Update case to mark calendar sync enabled
        await storage.updateCase(req.params.id, { syncToCalendar: true }, userId);

        await logAuditEvent(userId, "calendar_synced", {
          caseId: req.params.id,
          metadata: { provider, action: existingEvent ? 'update' : 'create' },
          req,
        });

        res.json({ success: true, provider: result.provider });
      } else {
        await logAuditEvent(userId, "calendar_sync_failed", {
          caseId: req.params.id,
          metadata: { provider, error: result.error },
          req,
        });

        res.status(500).json({ 
          success: false, 
          message: "Failed to sync to calendar",
          error: result.error 
        });
      }
    } catch (error: any) {
      next(error);
    }
  });

  app.delete("/api/cases/:id/unsync-calendar", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { provider } = req.body;

      if (provider && provider !== 'google' && provider !== 'outlook') {
        return res.status(400).json({ message: "Invalid provider. Must be 'google' or 'outlook'" });
      }

      // Get case and verify access
      const caseData = await storage.getCase(req.params.id, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }

      // Get calendar events for this case
      const events = await storage.getCalendarEventsByCase(req.params.id, userId);
      
      // Filter by provider if specified
      const eventsToDelete = provider 
        ? events.filter(e => e.provider === provider)
        : events;

      // Delete events from calendars and database
      for (const event of eventsToDelete) {
        await deleteCalendarEvent(userId, event.provider as 'google' | 'outlook', event.providerEventId, storage);
        await storage.deleteCalendarEvent(event.id);
      }

      // Update case to mark calendar sync disabled if all events deleted
      const remainingEvents = await storage.getCalendarEventsByCase(req.params.id, userId);
      if (remainingEvents.length === 0) {
        await storage.updateCase(req.params.id, { syncToCalendar: false }, userId);
      }

      res.json({ success: true, deletedCount: eventsToDelete.length });
    } catch (error: any) {
      next(error);
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
