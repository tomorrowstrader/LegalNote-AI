import type { Express, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";
import puppeteer from "puppeteer";

// Returns the canonical base URL for generating public-facing links (consent, share, OAuth, etc.)
// Prefers APP_URL env var to prevent host-header spoofing. Falls back to request-derived
// host in development, but warns in production if APP_URL is not configured.
function getCanonicalBaseUrl(req: any): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const replitDomain = process.env.REPLIT_DOMAINS?.split(',')[0]?.trim();
  if (replitDomain) return `https://${replitDomain}`;
  if (process.env.NODE_ENV === 'production') {
    console.warn('[SECURITY] APP_URL is not set. Public URLs are derived from request host header — configure APP_URL in production to harden against host-header spoofing.');
  }
  return `${req.protocol}://${req.get('host')}`;
}

/** Where to send the browser after calendar OAuth (popup vs Settings full-page flow). */
function buildCalendarOAuthReturnUrl(
  popup: boolean,
  params: Record<string, string>,
): string {
  if (popup) {
    const search = new URLSearchParams(params);
    return `/oauth/callback?${search.toString()}`;
  }
  const search = new URLSearchParams({ tab: 'integrations', ...params });
  return `/settings?${search.toString()}`;
}

function meetingAttendees(meeting: ScheduledMeeting): Array<{ email: string; name?: string }> {
  if (!Array.isArray(meeting.attendees)) return [];
  return meeting.attendees
    .map((a) => {
      if (typeof a !== "object" || a === null || !("email" in a)) return null;
      const email = String((a as { email?: string }).email || "").trim();
      if (!email) return null;
      const name =
        "name" in a && typeof (a as { name?: unknown }).name === "string"
          ? String((a as { name: string }).name).trim() || undefined
          : undefined;
      return { email, name };
    })
    .filter((a): a is { email: string; name?: string } => a !== null);
}

function meetingAttendeeEmails(meeting: ScheduledMeeting): string[] {
  return meetingAttendees(meeting).map((a) => a.email);
}

function isConsentRecipientAmongAttendees(meeting: ScheduledMeeting, email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return meetingAttendeeEmails(meeting).some((e) => e.trim().toLowerCase() === normalized);
}

/** Prefer stored name, then attendee display name, then email. */
function resolveConsentRecipientName(
  meeting: ScheduledMeeting,
  email: string,
  explicitName?: string | null,
): string {
  const trimmedExplicit = explicitName?.trim();
  if (trimmedExplicit) return trimmedExplicit;

  const stored = meeting.clientName?.trim();
  if (stored) return stored;

  const normalized = email.trim().toLowerCase();
  const attendee = meetingAttendees(meeting).find(
    (a) => a.email.trim().toLowerCase() === normalized,
  );
  if (attendee?.name) return attendee.name;

  return email.trim();
}

// Helper to resolve template paths in both dev and production
function resolveTemplatePath(filename: string): string {
  // Try multiple possible locations - prioritize cwd for Autoscale deployments
  const possiblePaths = [
    path.resolve(process.cwd(), 'public', filename),          // Works in both dev & production (cwd = project root)
    path.resolve(__dirname, '../public', filename),           // Development fallback
    path.resolve(__dirname, '../templates', filename),        // Alternative production location
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`[TEMPLATE] Found ${filename} at ${p}`);
      return p;
    }
  }
  
  console.error(`[TEMPLATE] Could not find ${filename}. Checked: ${possiblePaths.join(', ')}`);
  // Default to first path (will error if not found)
  return possiblePaths[0];
}
import { storage } from "./storage";
import { db } from "./db";
import { insertCaseSchema, insertAudioRecordingSchema, insertConsentLogSchema, insertTranscriptSchema, insertDocumentSchema, insertFirmProfileSchema, insertAmlMonitoringNoteSchema, insertAmlDecisionRecordSchema, insertTimeEntrySchema, insertUndertakingSchema, insertConflictCheckSchema, PRACTICE_AREAS, type ScheduledMeeting, PRIMARY_ROLES, PRIMARY_ROLE_LABELS, REGULATORY_DESIGNATIONS, REGULATORY_DESIGNATION_LABELS, type RegulatoryDesignation, demoLeads, dpaRequestSchema, dpaConfirmBodySchema, evaluationOnboardingSubmitSchema, isClientMatterKind, normalizeMatterKind, partyLabelForMatterKind, requiresSealedConsentForProcessing, type InsertCase } from "@shared/schema";
import { CONSENT_DISCLAIMER_TEXT, CONSENT_DISCLAIMER_VERSION } from "@shared/consent";
import { defaultRecordingTypeForMatterKind, validateRecordingType } from "@shared/recordingTypes";
import { getAmlRiskDefault } from "./services/practiceAreaConfig";
import { isFeatureVisible, type FeatureKey } from "@shared/featureVisibility";
import { z } from "zod";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { chunkedUploadService } from "./services/chunkedUploadService";
import { setupAuth, isAuthenticated, resolveUserAccessAllowed, getAdminUserId } from "./replitAuth";
import { MAX_AUDIO_SIZE_BYTES } from "./uploadSecurity";
import {
  generalApiLimiter,
  caseCreationLimiter,
  presignedUrlLimiter,
  audioUploadLimiter,
  audioChunkLimiter,
  authUserIpLimiter,
  pollingLimiter,
  dpaSigningLimiter,
} from "./rateLimiting";
import { logAuditEvent, auditMiddleware } from "./auditMiddleware";
import { SYSTEM_USER_ID } from "./systemUser";
import {
  deleteCaseAudioRecording,
  LitigationHoldDeletionBlockedError,
} from "./services/audioDeletionService";
import {
  applyObjectLegalHoldForNewRecording,
  buildObjectLockResponse,
  syncCaseObjectLegalHolds,
} from "./services/litigationHoldObjectLockService";
import {
  clearCaseGraceWindow,
  setCaseGraceWindowOnRelease,
} from "./services/litigationHoldGraceWindowService";
import { askMatterQuestion, compareMatterNote } from "./services/matterAskService";
import { synthesizeVoiceReply, VOICE_TTS_MAX_CHARS } from "./services/voiceTtsService";
import { privilegedComplete } from "./services/llm/privilegedComplete";
import { AssemblyAIService } from "./services/assemblyAIService";
import { sendCaseEmail, sendRecordingConfirmationEmail, sendConsentResponseNotification, sendAcknowledgementRequestEmail, sendInvitationEmail, sendDpaConfirmationEmail, sendLegalAgreementAcceptedEmail, sendEvaluationSetupEmail, sendEvaluationSetupSubmittedAdminEmail, sendGovernedEvaluationLoginInviteEmail, legalNoteBrandHeaderHtml } from "./email";
import {
  renderConsentAlreadyRespondedPage,
  renderConsentDecisionPage,
  renderConsentExpiredPage,
  renderConsentNotFoundPage,
} from "./consentPublicPage";
import { assembleSraReportData, buildSraReportPreview } from "./services/sraReportService";
import { compileSraReportPdf } from "./services/sraReportPdf";
import { logPersonnelMatterAccess } from "./personnelAccessAudit";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getConnectedProviders, createMeetingCalendarEvent, createOutlookMeetingCalendarEvent, deleteOutlookCalendarEvent } from "./calendar";
import { sendVerificationCode, generateVerificationCode, formatUKPhoneNumber, isValidUKPhoneNumber, phoneLastFour } from "./sms";
import {
  createGoogleOAuthClient,
  getGoogleAuthUrl,
  getMicrosoftAuthUrl,
  exchangeGoogleCode,
  exchangeMicrosoftCode,
  isMicrosoftCalendarConfigured,
  diagnoseMicrosoftCredentials,
  mapMicrosoftOAuthErrorCode,
  generateOAuthState,
  signOAuthState,
  verifyOAuthState,
  generateSecureNonce,
  type OAuthStatePayload,
} from "./oauth";
import bcrypt from "bcrypt";
import { stripeService } from "./stripeService";
import { getStripePublishableKey, getUncachableStripeClient } from "./stripeClient";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REFERRAL_CODES: Record<string, { code: string; description: string; discount: string; source: string; stripePromoCode?: string }> = {
  LINKEDIN25: {
    code: "LINKEDIN25",
    description: "LinkedIn exclusive: 25% off your first quarter",
    discount: "25% off first quarter",
    source: "linkedin",
    stripePromoCode: "LINKEDIN25",
  },
};

function validateReferralCode(code: string): typeof REFERRAL_CODES[string] | null {
  const normalized = code?.toUpperCase()?.trim();
  return REFERRAL_CODES[normalized] || null;
}

function requireFeatureVisible(key: FeatureKey) {
  return (_req: any, res: any, next: any) => {
    if (!isFeatureVisible(key)) {
      return res.status(404).json({ message: "Not found" });
    }
    next();
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Pipeline stores the client-facing letter as `client_letter`; older rows and share
  // payloads may still use `summary`. Attendance notes may be `meeting_notes`.
  const CLIENT_LETTER_SHARE_TYPES = new Set(["summary", "client_letter"]);
  const ATTENDANCE_NOTE_SHARE_TYPES = new Set(["attendance_note", "meeting_notes"]);

  const documentMatchesSharedType = (docType: string, sharedType: string): boolean => {
    if (docType === sharedType) return true;
    if (CLIENT_LETTER_SHARE_TYPES.has(docType) && CLIENT_LETTER_SHARE_TYPES.has(sharedType)) return true;
    if (ATTENDANCE_NOTE_SHARE_TYPES.has(docType) && ATTENDANCE_NOTE_SHARE_TYPES.has(sharedType)) return true;
    return false;
  };

  const getUnadoptedSharedDocumentTypes = async (
    caseId: string,
    userId: string,
    selectedTypes: readonly string[],
  ): Promise<string[]> => {
    const documents = await storage.getActiveDocumentsByCase(caseId, userId);
    return selectedTypes.filter((type) => {
      const selectedDocument = documents.find((document) =>
        documentMatchesSharedType(document.type, type),
      );
      return !selectedDocument || selectedDocument.status !== "approved";
    });
  };

  const sseClients = new Map<string, Set<Response>>();

  // S3: Centralised helper — strips sensitive fields from transcript before API response
  function sanitizeTranscriptForResponse(transcript: any) {
    if (!transcript) return transcript;
    return {
      ...transcript,
      privilegedRedactions: undefined,
      redactions: ((transcript.redactions || []) as any[]).map((r: any) => {
        const { selectedText: _st, ...safeRedaction } = r;
        return safeRedaction;
      }),
    };
  }

  /** Persist plain-text repair when a transcript was stored as raw RTF (TextEdit etc.). */
  async function repairStoredRtfTranscript(transcript: any, userId: string) {
    const { looksLikeRtf } = await import("@shared/stripRtf");
    if (!transcript?.content || !looksLikeRtf(transcript.content)) return transcript;
    try {
      const { repairRtfTranscriptContent } = await import(
        "./services/normalizeUploadedTranscript"
      );
      const { generateDocumentHash } = await import("./utils/documentHash");
      const repaired = repairRtfTranscriptContent(transcript.content);
      if (!repaired) return transcript;
      const contentHash = generateDocumentHash(repaired.content);
      const updated = await storage.updateTranscript(
        transcript.id,
        {
          content: repaired.content,
          utterances: repaired.utterances ?? [],
          speakerCount: repaired.speakerCount ?? null,
          contentHash,
        },
        userId,
      );
      return updated ?? {
        ...transcript,
        content: repaired.content,
        utterances: repaired.utterances ?? [],
        speakerCount: repaired.speakerCount ?? null,
        contentHash,
      };
    } catch (err: any) {
      console.warn(
        `[Transcript] RTF repair failed for ${transcript.id}:`,
        err?.message || err,
      );
      const { stripRtfToPlainText } = await import("@shared/stripRtf");
      return { ...transcript, content: stripRtfToPlainText(transcript.content) };
    }
  }

  /**
   * Backfill speaker utterances from labelled content when the JSON utterances
   * column is empty (older rows / incomplete writes). Preserves existing timing
   * when present; text-parsed timings are ordinals and the UI treats them as
   * non-audio (no scrub timestamps).
   */
  async function repairMissingSpeakerUtterances(transcript: any, userId: string) {
    const existing = transcript?.utterances;
    if (Array.isArray(existing) && existing.length > 0) return transcript;
    if (!transcript?.content || typeof transcript.content !== "string") return transcript;
    try {
      const { parseSpeakerUtterances } = await import(
        "./services/normalizeUploadedTranscript"
      );
      const parsed = parseSpeakerUtterances(transcript.content);
      if (parsed.length === 0) return transcript;
      const speakers = new Set(parsed.map((u) => u.speaker));
      const updated = await storage.updateTranscript(
        transcript.id,
        {
          utterances: parsed,
          speakerCount: speakers.size,
        },
        userId,
      );
      return updated ?? {
        ...transcript,
        utterances: parsed,
        speakerCount: speakers.size,
      };
    } catch (err: any) {
      console.warn(
        `[Transcript] Utterance backfill failed for ${transcript.id}:`,
        err?.message || err,
      );
      return transcript;
    }
  }

  // Health check endpoint for deployment platform
  // Must be before auth middleware and CORS is configured to allow requests without origin
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'LegalNote', timestamp: new Date().toISOString() });
  });

  // Setup Replit Auth
  await setupAuth(app);

  // Apply general rate limiting to all API routes (except polling + session identity)
  app.use('/api/', (req, res, next) => {
    // Skip general rate limiter for polling endpoints - they have their own lenient limits
    if (
      req.path.includes('/processing-status') ||
      (req.method === 'GET' && (
        req.path === '/scheduled-meetings' ||
        req.path.startsWith('/recall/imports/unassigned') ||
        req.path.startsWith('/recall/imports/incomplete')
      ))
    ) {
      return next();
    }
    // Never rate-limit the session identity check — a 429 here makes the SPA
    // treat the user as logged out and bounce them to the landing page.
    if (req.path === '/auth/user' || req.path === '/api/auth/user') {
      return next();
    }
    generalApiLimiter(req, res, next);
  });

  // PUBLIC ROUTES (no authentication required)

  // Serve the one-pager HTML explicitly
  app.get('/legalnote-one-pager.html', (req, res) => {
    res.sendFile(resolveTemplatePath('legalnote-one-pager.html'));
  });

  // Direct download for one-pager HTML
  app.get('/download-one-pager', (req, res) => {
    res.download(resolveTemplatePath('legalnote-one-pager.html'), 'LegalNote-One-Pager.html');
  });

  // Serve the mobile-friendly PDF download page
  app.get('/download-zahra-pdf', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'download-zahra-pdf.html'));
  });

  // LinkedIn Post Performance Tracking API
  app.get('/api/linkedin-performance', isAuthenticated, async (req, res, next) => {
    try {
      const data = await storage.getAllLinkedinPostPerformance();
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/linkedin-performance/:postNumber', isAuthenticated, async (req, res, next) => {
    try {
      const postNumber = parseInt(req.params.postNumber);
      const data = await storage.getLinkedinPostPerformance(postNumber);
      res.json(data || null);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/linkedin-performance', isAuthenticated, async (req, res, next) => {
    try {
      const body = { ...req.body };
      if (body.postedAt && typeof body.postedAt === 'string') {
        body.postedAt = new Date(body.postedAt);
      }
      const data = await storage.upsertLinkedinPostPerformance(body);
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/linkedin-post-chat', isAuthenticated, async (req, res, next) => {
    try {
      const { postNumber, currentContent, theme, message, history } = req.body;
      if (!postNumber || !currentContent || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      let historyBlock = '';
      if (history && Array.isArray(history)) {
        historyBlock = history
          .filter((h: any) => (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
          .map((h: any) => `${h.role === 'assistant' ? 'Assistant' : 'User'}: ${h.content}`)
          .join('\n\n');
        if (historyBlock) historyBlock += '\n\n';
      }

      const completion = await privilegedComplete({
        systemPrompt: `You are helping refine a LinkedIn post for a legal tech founder. The post is part of a 60-day content calendar for LegalNote, a compliance-first legal documentation platform.

Your role:
- Help edit, improve, or discuss the post content based on the user's request
- Maintain the authentic voice and tone - this is personal brand content, not corporate
- Keep posts within LinkedIn best practices (hook in first line, conversational, ends with PS question)
- When providing an amended version, output ONLY the full amended post text with no extra commentary
- When discussing/giving feedback, be concise and actionable

The user may ask you to:
1. Make specific edits to the post
2. Discuss whether something works well
3. Suggest improvements
4. Rewrite sections
5. Adjust tone or length

Current post #${postNumber}: "${theme}"

If the user asks for an edit or amendment, respond with JSON: {"type":"edit","content":"<full amended post>","explanation":"<brief note on what changed>"}
If the user asks a question or wants discussion, respond with JSON: {"type":"discussion","response":"<your response>"}`,
        userPrompt: `${historyBlock}Current post content:\n\n${currentContent}\n\nMy request: ${message}`,
        maxTokens: 4096,
        temperature: 0,
        responseFormat: 'json_object',
      });

      const result = JSON.parse(completion.content || '{}');
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/linkedin-post-chat/:postNumber', isAuthenticated, async (req, res, next) => {
    try {
      const postNumber = parseInt(req.params.postNumber);
      if (isNaN(postNumber)) return res.status(400).json({ error: 'Invalid post number' });
      const messages = await storage.getChatMessages(postNumber);
      res.json(messages);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/linkedin-post-chat/message', isAuthenticated, async (req, res, next) => {
    try {
      const { postNumber, role, content, parsedType, parsedContent, parsedExplanation, parsedResponse } = req.body;
      if (!postNumber || !role || !content) return res.status(400).json({ error: 'Missing required fields' });
      const msg = await storage.addChatMessage({
        postNumber,
        role,
        content,
        parsedType: parsedType || null,
        parsedContent: parsedContent || null,
        parsedExplanation: parsedExplanation || null,
        parsedResponse: parsedResponse || null,
      });
      res.json(msg);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/linkedin-post-chat/:postNumber', isAuthenticated, async (req, res, next) => {
    try {
      const postNumber = parseInt(req.params.postNumber);
      if (isNaN(postNumber)) return res.status(400).json({ error: 'Invalid post number' });
      await storage.clearChatMessages(postNumber);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Connection milestones
  app.get('/api/linkedin-connections', isAuthenticated, async (req, res, next) => {
    try {
      const milestones = await storage.getConnectionMilestones();
      res.json(milestones);
    } catch (error) { next(error); }
  });

  app.post('/api/linkedin-connections', isAuthenticated, async (req, res, next) => {
    try {
      const { date, connectionCount, notes } = req.body;
      if (!date || connectionCount === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const milestone = await storage.addConnectionMilestone({
        date: new Date(date),
        connectionCount,
        notes: notes || null,
      });
      res.json(milestone);
    } catch (error) { next(error); }
  });

  app.delete('/api/linkedin-connections/:id', isAuthenticated, async (req, res, next) => {
    try {
      await storage.deleteConnectionMilestone(req.params.id);
      res.json({ success: true });
    } catch (error) { next(error); }
  });

  // Inbound leads
  app.get('/api/linkedin-leads', isAuthenticated, async (req, res, next) => {
    try {
      const leads = await storage.getInboundLeads();
      res.json(leads);
    } catch (error) { next(error); }
  });

  app.post('/api/linkedin-leads', isAuthenticated, async (req, res, next) => {
    try {
      const { name, company, linkedinUrl, triggerPostNumber, leadType, notes } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      const lead = await storage.addInboundLead({
        name,
        company: company || null,
        linkedinUrl: linkedinUrl || null,
        triggerPostNumber: triggerPostNumber || null,
        leadType: leadType || null,
        notes: notes || null,
      });
      res.json(lead);
    } catch (error) { next(error); }
  });

  app.delete('/api/linkedin-leads/:id', isAuthenticated, async (req, res, next) => {
    try {
      await storage.deleteInboundLead(req.params.id);
      res.json({ success: true });
    } catch (error) { next(error); }
  });

  // Hook variants
  app.get('/api/linkedin-hooks/:postNumber', isAuthenticated, async (req, res, next) => {
    try {
      const postNumber = parseInt(req.params.postNumber);
      const variants = await storage.getHookVariants(postNumber);
      res.json(variants);
    } catch (error) { next(error); }
  });

  app.post('/api/linkedin-hooks/generate', isAuthenticated, async (req, res, next) => {
    try {
      const { postNumber, currentHook, theme } = req.body;
      if (!postNumber || !currentHook) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const completion = await privilegedComplete({
        systemPrompt: `Generate 3 alternative LinkedIn post hooks (opening lines) for a legal tech founder. Each hook must be 8 words or fewer. The hooks should be punchy, attention-grabbing, and follow the "How I" > "How to" principle. Return JSON: {"hooks":["hook1","hook2","hook3"]}`,
        userPrompt: `Current hook: "${currentHook}"\nPost theme: "${theme || 'LegalNote legal tech'}"\n\nGenerate 3 alternative hooks.`,
        maxTokens: 500,
        temperature: 0,
        responseFormat: 'json_object',
      });
      const result = JSON.parse(completion.content || '{"hooks":[]}');
      for (const hook of result.hooks) {
        await storage.addHookVariant({ postNumber, variant: hook, used: false });
      }
      const allVariants = await storage.getHookVariants(postNumber);
      res.json(allVariants);
    } catch (error) { next(error); }
  });

  app.delete('/api/linkedin-hooks/:id', isAuthenticated, async (req, res, next) => {
    try {
      await storage.deleteHookVariant(req.params.id);
      res.json({ success: true });
    } catch (error) { next(error); }
  });

  // Voice consistency scoring
  app.post('/api/linkedin-voice-check', isAuthenticated, async (req, res, next) => {
    try {
      const { content, voice } = req.body;
      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }
      const completion = await privilegedComplete({
        systemPrompt: `You are a content consistency checker for a legal tech founder's LinkedIn content. The founder has four voices:
1. Client Who Got Burned - personal experience with bad legal documentation
2. Compliance Professional - corporate background at Clifford Chance, Coutts, Lloyd's, Standard Chartered
3. Obsessed Vibe Coder - passion for building, technical craftsmanship
4. Father Building Something - responsibility, legacy, defensibility

Score the content on: authenticity (1-10), voice consistency with the stated voice (1-10), LinkedIn best practices (1-10), engagement potential (1-10).
Provide brief actionable feedback.
Return JSON: {"scores":{"authenticity":N,"voiceConsistency":N,"linkedinBestPractices":N,"engagementPotential":N},"overall":N,"feedback":"brief feedback","strengths":["strength1"],"improvements":["improvement1"]}`,
        userPrompt: `Voice: ${voice || 'Not specified'}\n\nContent:\n${content}`,
        maxTokens: 1000,
        temperature: 0,
        responseFormat: 'json_object',
      });
      const result = JSON.parse(completion.content || '{}');
      res.json(result);
    } catch (error) { next(error); }
  });

  // Engagement prompts
  app.post('/api/linkedin-engagement-prompts', isAuthenticated, async (req, res, next) => {
    try {
      const { content, theme } = req.body;
      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }
      const completion = await privilegedComplete({
        systemPrompt: `You help a legal tech founder engage with comments on their LinkedIn posts. Given a post, generate 4 suggested reply templates for common comment types they might receive. Each reply should be warm, authentic, and encourage further conversation. Return JSON: {"prompts":[{"commentType":"type","suggestedReply":"reply"},...]}`,
        userPrompt: `Post theme: ${theme || 'Legal tech'}\n\nPost content:\n${content}`,
        maxTokens: 1000,
        temperature: 0,
        responseFormat: 'json_object',
      });
      const result = JSON.parse(completion.content || '{"prompts":[]}');
      res.json(result);
    } catch (error) { next(error); }
  });

  // Campaign dashboard summary
  app.get('/api/linkedin-dashboard', isAuthenticated, async (req, res, next) => {
    try {
      const [allPerf, milestones, leads] = await Promise.all([
        storage.getAllLinkedinPostPerformance(),
        storage.getConnectionMilestones(),
        storage.getInboundLeads(),
      ]);

      const posted = allPerf.filter(p => p.postedAt);
      const totalImpressions = posted.reduce((s, p) => s + (p.impressions7d || p.impressions24h || p.impressions60m || 0), 0);
      const totalReactions = posted.reduce((s, p) => s + (p.reactions7d || p.reactions24h || p.reactions60m || 0), 0);
      const totalComments = posted.reduce((s, p) => s + (p.comments7d || p.comments24h || p.comments60m || 0), 0);
      const totalReposts = posted.reduce((s, p) => s + (p.reposts7d || p.reposts24h || p.reposts60m || 0), 0);
      const totalSaves = posted.reduce((s, p) => s + (p.saves7d || p.saves24h || p.saves60m || 0), 0);
      const totalFollowersGained = posted.reduce((s, p) => s + (p.followersGained7d || p.followersGained24h || p.followersGained60m || 0), 0);
      const totalProfileViewers = posted.reduce((s, p) => s + (p.profileViewers7d || p.profileViewers24h || p.profileViewers60m || 0), 0);

      const avgImpressions = posted.length > 0 ? Math.round(totalImpressions / posted.length) : 0;
      const avgReactions = posted.length > 0 ? Math.round(totalReactions / posted.length) : 0;

      const bestPost = posted.length > 0
        ? posted.reduce((best, p) => {
            const score = (p.impressions7d || 0) + (p.reactions7d || 0) * 5 + (p.comments7d || 0) * 10 + (p.reposts7d || 0) * 15;
            const bestScore = (best.impressions7d || 0) + (best.reactions7d || 0) * 5 + (best.comments7d || 0) * 10 + (best.reposts7d || 0) * 15;
            return score > bestScore ? p : best;
          })
        : null;

      const latestConnection = milestones.length > 0 ? milestones[0].connectionCount : 0;

      const bestTimeData: Record<string, { count: number; totalImpressions: number }> = {};
      posted.forEach(p => {
        if (p.postedAt) {
          const date = new Date(p.postedAt);
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const day = days[date.getDay()];
          const hour = date.getHours();
          const timeSlot = hour < 9 ? 'Early' : hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
          const key = `${day} ${timeSlot}`;
          if (!bestTimeData[key]) bestTimeData[key] = { count: 0, totalImpressions: 0 };
          bestTimeData[key].count++;
          bestTimeData[key].totalImpressions += (p.impressions7d || p.impressions24h || p.impressions60m || 0);
        }
      });

      let bestTime = 'Not enough data';
      let bestTimeAvg = 0;
      Object.entries(bestTimeData).forEach(([key, val]) => {
        const avg = val.totalImpressions / val.count;
        if (avg > bestTimeAvg) {
          bestTimeAvg = avg;
          bestTime = key;
        }
      });

      const currentPhase = posted.length <= 8 ? 1 : posted.length <= 16 ? 2 : posted.length <= 24 ? 3 : 4;
      const phaseNames = ['Origin & Credibility', 'Problem & Pain', 'Vision & Proof', 'Authority & Community'];

      res.json({
        postsPublished: posted.length,
        totalPosts: 32,
        currentPhase,
        phaseName: phaseNames[currentPhase - 1],
        totalImpressions,
        totalReactions,
        totalComments,
        totalReposts,
        totalSaves,
        totalFollowersGained,
        totalProfileViewers,
        avgImpressions,
        avgReactions,
        bestPost: bestPost ? { postNumber: bestPost.postNumber, impressions: bestPost.impressions7d || bestPost.impressions24h || bestPost.impressions60m || 0 } : null,
        currentConnections: latestConnection,
        totalLeads: leads.length,
        bestTime: bestTime !== 'Not enough data' ? bestTime : null,
        bestTimeAvgImpressions: Math.round(bestTimeAvg),
        weekProgress: Math.ceil(posted.length / 4),
      });
    } catch (error) { next(error); }
  });

  // Serve the 60-day LinkedIn content calendar
  app.get('/content-calendar', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'content-calendar.html'));
  });

  // Serve pre-generated static PDFs with download headers for mobile compatibility
  app.get('/static-pdf/:filename', (req, res) => {
    const filename = req.params.filename;
    const safeName = filename.replace(/[^a-zA-Z0-9\-_.]/g, '');
    const filePath = path.join(process.cwd(), 'public', safeName);
    
    if (!safeName.endsWith('.pdf')) {
      return res.status(400).json({ message: 'Invalid file type' });
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(filePath, (err) => {
      if (err) {
        res.status(404).json({ message: 'PDF not found' });
      }
    });
  });

  // Direct download for one-pager PDF with optional personalization
  // Usage: /download-one-pager-pdf?name=Sophie%20Akehurst
  app.get('/download-one-pager-pdf', async (req, res) => {
    try {
      const htmlPath = resolveTemplatePath('legalnote-one-pager.html');
      const recipientName = req.query.name as string | undefined;
      
      // Read the HTML file
      let htmlContent = await fs.promises.readFile(htmlPath, 'utf-8');
      
      // If a recipient name is provided, personalize the content
      if (recipientName && recipientName.trim()) {
        const fullName = recipientName.trim();
        const firstName = fullName.split(' ')[0];
        
        // Replace placeholders with actual values
        htmlContent = htmlContent.replace('{{RECIPIENT_FULL_NAME}}', fullName);
        htmlContent = htmlContent.replace('{{RECIPIENT_FIRST_NAME}}', firstName);
        
        // Make personalization elements visible
        htmlContent = htmlContent.replace(
          'class="personalization-top"',
          'class="personalization-top visible"'
        );
        htmlContent = htmlContent.replace(
          'class="personalization-bottom"',
          'class="personalization-bottom visible"'
        );
      }
      
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.CHROMIUM_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      
      const page = await browser.newPage();
      
      // Set the base URL so relative assets work correctly
      await page.setContent(htmlContent, { 
        waitUntil: 'networkidle0'
      });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
      });
      
      await browser.close();
      
      // Generate filename with recipient name if provided
      const filename = recipientName 
        ? `LegalNote-One-Pager-${recipientName.trim().replace(/\s+/g, '-')}.pdf`
        : 'LegalNote-One-Pager.pdf';
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.end(Buffer.from(pdfBuffer), 'binary');
    } catch (error) {
      console.error('PDF generation error:', error);
      res.status(500).json({ message: 'Failed to generate PDF' });
    }
  });

  // Helper function to sanitize HTML input to prevent XSS/injection
  const sanitizeHtml = (input: string): string => {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  };

  // Download Compliance Trap Checklist PDF with optional personalization
  // Usage: /download-compliance-checklist-pdf?name=Sophie%20Akehurst
  app.get('/download-compliance-checklist-pdf', async (req, res) => {
    try {
      const htmlPath = resolveTemplatePath('compliance-trap-checklist.html');
      const recipientNameRaw = req.query.name as string | undefined;
      const recipientName = recipientNameRaw ? sanitizeHtml(recipientNameRaw) : undefined;
      
      let htmlContent = await fs.promises.readFile(htmlPath, 'utf-8');
      
      if (recipientName && recipientName.trim()) {
        const fullName = recipientName.trim();
        const firstName = fullName.split(' ')[0];
        
        htmlContent = htmlContent.replace(/\{\{RECIPIENT_FULL_NAME\}\}/g, fullName);
        htmlContent = htmlContent.replace(/\{\{RECIPIENT_FIRST_NAME\}\}/g, firstName);
        
        htmlContent = htmlContent.replace(
          'class="personalization-top"',
          'class="personalization-top visible"'
        );
        htmlContent = htmlContent.replace(
          'class="personalization-bottom"',
          'class="personalization-bottom visible"'
        );
      }
      
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.CHROMIUM_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
      });
      
      await browser.close();
      
      const filename = recipientName 
        ? `LegalNote-Compliance-Checklist-${recipientName.trim().replace(/\s+/g, '-')}.pdf`
        : 'LegalNote-Compliance-Checklist.pdf';
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.end(Buffer.from(pdfBuffer), 'binary');
    } catch (error) {
      console.error('PDF generation error:', error);
      res.status(500).json({ message: 'Failed to generate PDF' });
    }
  });

  // Download Compliance Audit Report PDF with personalization
  // Usage: /download-compliance-audit-pdf?name=Sophie%20Akehurst&firm=Smith%20%26%20Co%20Solicitors
  app.get('/download-compliance-audit-pdf', async (req, res) => {
    try {
      const htmlPath = resolveTemplatePath('compliance-audit-report.html');
      const recipientNameRaw = req.query.name as string | undefined;
      const firmNameRaw = req.query.firm as string | undefined;
      const recipientName = recipientNameRaw ? sanitizeHtml(recipientNameRaw) : undefined;
      const firmName = firmNameRaw ? sanitizeHtml(firmNameRaw) : undefined;
      
      let htmlContent = await fs.promises.readFile(htmlPath, 'utf-8');
      
      // Generate report metadata
      const reportDate = new Date().toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
      const reportId = `LN-${Date.now().toString(36).toUpperCase()}`;
      
      // Replace template placeholders
      htmlContent = htmlContent.replace(/\{\{REPORT_DATE\}\}/g, reportDate);
      htmlContent = htmlContent.replace(/\{\{REPORT_ID\}\}/g, reportId);
      htmlContent = htmlContent.replace(/\{\{FIRM_NAME\}\}/g, firmName || '[Firm Name]');
      
      // Default sample scores (these would be customized per audit)
      htmlContent = htmlContent.replace(/\{\{HIGH_RISK_COUNT\}\}/g, '5');
      htmlContent = htmlContent.replace(/\{\{MEDIUM_RISK_COUNT\}\}/g, '4');
      htmlContent = htmlContent.replace(/\{\{COMPLIANT_COUNT\}\}/g, '1');
      htmlContent = htmlContent.replace(/\{\{TOTAL_AREAS\}\}/g, '10');
      htmlContent = htmlContent.replace(/\{\{RISK_SCORE\}\}/g, '68');
      htmlContent = htmlContent.replace(/\{\{RISK_DESCRIPTION\}\}/g, 
        'Elevated risk. Multiple compliance gaps identified that require prompt attention to reduce regulatory and liability exposure.');
      
      if (recipientName && recipientName.trim()) {
        const fullName = recipientName.trim();
        htmlContent = htmlContent.replace(/\{\{RECIPIENT_FULL_NAME\}\}/g, fullName);
        
        htmlContent = htmlContent.replace(
          'class="personalization-top"',
          'class="personalization-top visible"'
        );
      } else {
        htmlContent = htmlContent.replace(/\{\{RECIPIENT_FULL_NAME\}\}/g, '[Recipient Name]');
      }
      
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.CHROMIUM_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
      });
      
      await browser.close();
      
      const safeFilename = firmName 
        ? `LegalNote-Compliance-Audit-${firmName.trim().replace(/[^a-zA-Z0-9]/g, '-')}.pdf`
        : 'LegalNote-Compliance-Audit-Report.pdf';
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      res.end(Buffer.from(pdfBuffer), 'binary');
    } catch (error) {
      console.error('PDF generation error:', error);
      res.status(500).json({ message: 'Failed to generate PDF' });
    }
  });
  
  // --- Public DPA click-to-accept (governed evaluation / B2B) ---
  app.get("/api/dpa/status", generalApiLimiter, async (_req, res) => {
    // Click-to-accept is always available when masters pass boot hash check.
    res.json({ enabled: true, available: true, mode: "click_to_accept" });
  });

  app.get("/api/dpa/document", generalApiLimiter, async (_req, res, next) => {
    try {
      const { loadLegalDocument } = await import("./services/legalDocumentLoader");
      const doc = loadLegalDocument("dpa");
      res.type("text/markdown; charset=utf-8").send(doc.text);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/dpa/evaluation-document", generalApiLimiter, async (_req, res, next) => {
    try {
      const { loadLegalDocument } = await import("./services/legalDocumentLoader");
      const doc = loadLegalDocument("evaluation");
      res.type("text/markdown; charset=utf-8").send(doc.text);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/dpa/request", dpaSigningLimiter, async (req, res, next) => {
    try {
      const parsed = dpaRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid request",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const {
        createPendingAcceptance,
        LegalAcceptanceError,
      } = await import("./services/legalAcceptanceService");

      let result;
      try {
        result = await createPendingAcceptance({ ...parsed.data, req });
      } catch (err) {
        if (err instanceof LegalAcceptanceError) {
          return res.status(err.statusCode).json({ message: err.message, code: err.code });
        }
        throw err;
      }

      await sendDpaConfirmationEmail({
        to: result.acceptance.email,
        firmName: result.acceptance.firmName,
        signerName: result.acceptance.signerName,
        confirmationToken: result.confirmationToken,
        evaluationPeriodDays: result.acceptance.evaluationPeriodDays,
        feeEarnerCount: result.acceptance.feeEarnerCount,
      });

      res.json({
        ok: true,
        message: "Check your email for a confirmation link to complete acceptance.",
        acceptanceId: result.acceptance.id,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/dpa/confirm/:token", generalApiLimiter, async (req, res, next) => {
    try {
      const {
        getPendingAcceptanceByToken,
        LegalAcceptanceError,
      } = await import("./services/legalAcceptanceService");
      const { loadLegalDocument } = await import("./services/legalDocumentLoader");

      let pending;
      try {
        pending = await getPendingAcceptanceByToken(req.params.token);
      } catch (err) {
        if (err instanceof LegalAcceptanceError) {
          return res.status(err.statusCode).json({ message: err.message, code: err.code });
        }
        throw err;
      }

      const dpa = loadLegalDocument("dpa");
      const evaluation = loadLegalDocument("evaluation");

      res.json({
        firmName: pending.firmName,
        signerName: pending.signerName,
        signerTitle: pending.signerTitle,
        email: pending.email,
        evaluationPeriodDays: pending.evaluationPeriodDays,
        feeEarnerCount: pending.feeEarnerCount,
        dpa: { text: dpa.text, contentHash: dpa.contentHash },
        evaluation: { text: evaluation.text, contentHash: evaluation.contentHash },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/dpa/confirm/:token", dpaSigningLimiter, async (req, res, next) => {
    try {
      const parsed = dpaConfirmBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Both agreements must be accepted. Tick both checkboxes to continue.",
          code: "ASSENT_REQUIRED",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const {
        confirmAcceptance,
        LegalAcceptanceError,
      } = await import("./services/legalAcceptanceService");

      let authenticatedUserId: string | null = null;
      let authenticatedUserEmail: string | null = null;
      const user = req.user as any;
      if (req.isAuthenticated?.() && user?.claims?.sub) {
        authenticatedUserId = user.claims.sub;
        const authUser = await storage.getUser(authenticatedUserId);
        authenticatedUserEmail = authUser?.email ?? null;
      }

      let sealed;
      try {
        sealed = await confirmAcceptance({
          token: req.params.token,
          dpaAccepted: parsed.data.dpaAccepted,
          evaluationAccepted: parsed.data.evaluationAccepted,
          req,
          authenticatedUserId,
          authenticatedUserEmail,
        });
      } catch (err) {
        if (err instanceof LegalAcceptanceError) {
          return res.status(err.statusCode).json({ message: err.message, code: err.code });
        }
        throw err;
      }

      if (sealed.verifyToken && sealed.dpaContentHash && sealed.evaluationContentHash && sealed.acceptedAt) {
        await sendLegalAgreementAcceptedEmail({
          to: sealed.email,
          firmName: sealed.firmName,
          signerName: sealed.signerName,
          signerTitle: sealed.signerTitle,
          evaluationPeriodDays: sealed.evaluationPeriodDays,
          feeEarnerCount: sealed.feeEarnerCount,
          acceptedAt: sealed.acceptedAt,
          acceptanceId: sealed.id,
          dpaContentHash: sealed.dpaContentHash,
          evaluationContentHash: sealed.evaluationContentHash,
          verifyToken: sealed.verifyToken,
        });
      }

      // Step 3: evaluation configuration questionnaire (tokenised)
      try {
        const { createEvaluationOnboardingSetup } = await import(
          "./services/evaluationOnboardingService"
        );
        const setup = await createEvaluationOnboardingSetup(sealed);
        if (setup.status === "pending") {
          await sendEvaluationSetupEmail({
            to: sealed.email,
            firmName: sealed.firmName,
            signerName: sealed.signerName,
            setupToken: setup.setupToken,
            feeEarnerCount: sealed.feeEarnerCount,
            evaluationPeriodDays: sealed.evaluationPeriodDays,
            expiresAt: setup.expiresAt,
          });
        }
      } catch (setupErr) {
        console.error("[EVAL_ONBOARDING] Failed to create/send setup after acceptance:", setupErr);
      }

      res.json({
        ok: true,
        acceptanceId: sealed.id,
        acceptedAt: sealed.acceptedAt?.toISOString(),
        dpaContentHash: sealed.dpaContentHash,
        evaluationContentHash: sealed.evaluationContentHash,
        verifyToken: sealed.verifyToken,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/evaluation/setup/:token", generalApiLimiter, async (req, res, next) => {
    try {
      const {
        getSetupByToken,
        toPublicSetupPayload,
        EvaluationOnboardingError,
      } = await import("./services/evaluationOnboardingService");
      try {
        const row = await getSetupByToken(req.params.token);
        return res.json(toPublicSetupPayload(row));
      } catch (err) {
        if (err instanceof EvaluationOnboardingError) {
          return res.status(err.statusCode).json({ message: err.message, code: err.code });
        }
        throw err;
      }
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/evaluation/setup/:token", dpaSigningLimiter, async (req, res, next) => {
    try {
      const parsed = evaluationOnboardingSubmitSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Please check the form and try again.",
          code: "VALIDATION_ERROR",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const {
        submitEvaluationOnboardingSetup,
        EvaluationOnboardingError,
      } = await import("./services/evaluationOnboardingService");

      let updated;
      try {
        updated = await submitEvaluationOnboardingSetup({
          token: req.params.token,
          body: parsed.data,
          req,
        });
      } catch (err) {
        if (err instanceof EvaluationOnboardingError) {
          return res.status(err.statusCode).json({ message: err.message, code: err.code });
        }
        throw err;
      }

      await sendEvaluationSetupSubmittedAdminEmail({
        firmName: updated.firmName,
        signerEmail: updated.signerEmail,
        setupId: updated.id,
        acceptanceId: updated.acceptanceId,
        onboardingOwnerName: updated.onboardingOwnerName || "",
        onboardingOwnerEmail: updated.onboardingOwnerEmail || "",
        primaryAdminEmail: updated.primaryAdminEmail || "",
        feeEarnerCount: updated.feeEarnerCount,
        feeEarnersNominated: Array.isArray(updated.feeEarners) ? updated.feeEarners.length : 0,
        preferredGoLive: updated.preferredGoLive || "",
      });

      res.json({ ok: true, submittedAt: updated.submittedAt?.toISOString() });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/legal-acceptances/:id/verify", generalApiLimiter, async (req, res, next) => {
    try {
      const {
        verifyAcceptanceAccess,
        buildVerifyResponse,
        LegalAcceptanceError,
      } = await import("./services/legalAcceptanceService");

      const isAuth = Boolean(req.isAuthenticated?.() && (req.user as any)?.claims?.sub);
      const token = typeof req.query.token === "string" ? req.query.token : null;

      let row;
      try {
        row = await verifyAcceptanceAccess(req.params.id, {
          isAuthenticated: isAuth,
          verifyToken: token,
        });
      } catch (err) {
        if (err instanceof LegalAcceptanceError) {
          return res.status(err.statusCode).json({ message: err.message, code: err.code });
        }
        throw err;
      }

      const result = await buildVerifyResponse(row);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/legal-acceptances/:id", generalApiLimiter, async (req, res, next) => {
    try {
      const {
        verifyAcceptanceAccess,
        getDocumentsForAcceptance,
        LegalAcceptanceError,
      } = await import("./services/legalAcceptanceService");

      const isAuth = Boolean(req.isAuthenticated?.() && (req.user as any)?.claims?.sub);
      const token = typeof req.query.token === "string" ? req.query.token : null;

      let row;
      try {
        row = await verifyAcceptanceAccess(req.params.id, {
          isAuthenticated: isAuth,
          verifyToken: token,
        });
      } catch (err) {
        if (err instanceof LegalAcceptanceError) {
          return res.status(err.statusCode).json({ message: err.message, code: err.code });
        }
        throw err;
      }

      const docs = await getDocumentsForAcceptance(row);
      res.json({
        id: row.id,
        status: row.status,
        firmName: row.firmName,
        signerName: row.signerName,
        signerTitle: row.signerTitle,
        email: row.email,
        sraNumber: row.sraNumber,
        evaluationPeriodDays: row.evaluationPeriodDays,
        feeEarnerCount: row.feeEarnerCount,
        acceptedAt: row.acceptedAt?.toISOString() ?? null,
        dpaContentHash: row.dpaContentHash,
        evaluationContentHash: row.evaluationContentHash,
        acceptancePayloadHash: row.acceptancePayloadHash,
        documents: docs,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/legal-documents/by-hash/:contentHash", generalApiLimiter, async (req, res, next) => {
    try {
      const { getLegalDocumentSnapshotByHash } = await import("./services/legalAcceptanceService");
      const snap = await getLegalDocumentSnapshotByHash(req.params.contentHash);
      if (!snap) {
        return res.status(404).json({ message: "Document snapshot not found for this hash." });
      }
      res.json({
        text: snap.text,
        documentSlug: snap.documentSlug,
        contentHash: snap.contentHash,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/legal-acceptances/:id/documents/:slug", generalApiLimiter, async (req, res, next) => {
    try {
      const slug = req.params.slug;
      if (slug !== "dpa" && slug !== "evaluation") {
        return res.status(400).json({ message: "slug must be dpa or evaluation" });
      }

      const {
        verifyAcceptanceAccess,
        getDocumentsForAcceptance,
        LegalAcceptanceError,
      } = await import("./services/legalAcceptanceService");

      const isAuth = Boolean(req.isAuthenticated?.() && (req.user as any)?.claims?.sub);
      const token = typeof req.query.token === "string" ? req.query.token : null;

      let row;
      try {
        row = await verifyAcceptanceAccess(req.params.id, {
          isAuthenticated: isAuth,
          verifyToken: token,
        });
      } catch (err) {
        if (err instanceof LegalAcceptanceError) {
          return res.status(err.statusCode).json({ message: err.message, code: err.code });
        }
        throw err;
      }

      const docs = await getDocumentsForAcceptance(row);
      const doc = slug === "dpa" ? docs.dpa : docs.evaluation;
      if (!doc) {
        return res.status(404).json({ message: "Accepted document snapshot not found." });
      }
      res.json(doc);
    } catch (error) {
      next(error);
    }
  });

  // Referral/promo code validation endpoint (public)
  app.get('/api/waitlist/validate-code/:code', generalApiLimiter, async (req, res) => {
    const code = req.params.code?.toUpperCase();
    const result = validateReferralCode(code);
    if (result) {
      return res.json({ valid: true, code: result.code, description: result.description, discount: result.discount });
    }
    return res.json({ valid: false });
  });

  // Waitlist signup (public - no auth required)
  app.post('/api/waitlist', generalApiLimiter, async (req, res, next) => {
    try {
      const { email, firstName, lastName, firmName, firmSize, role, source, gdprConsent, marketingConsent, referralCode } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      if (!gdprConsent) {
        return res.status(400).json({ message: "GDPR consent is required to join the waitlist" });
      }
      
      // Check if email already exists
      const existing = await storage.getWaitlistEntryByEmail(email.toLowerCase());
      if (existing) {
        return res.status(409).json({ message: "This email is already on our waitlist" });
      }

      const validReferralCode = referralCode ? validateReferralCode(referralCode) : null;
      const effectiveSource = validReferralCode?.source || source || 'landing_page';
      
      // Create waitlist entry
      const entry = await storage.createWaitlistEntry({
        email: email.toLowerCase(),
        firstName: firstName || null,
        lastName: lastName || null,
        firmName: firmName || null,
        firmSize: firmSize || null,
        role: role || null,
        source: effectiveSource,
        status: 'pending',
        gdprConsent: true,
        marketingConsent: marketingConsent || false,
        ipAddress: req.ip || null,
        referralCode: validReferralCode?.code || null,
      });
      
      // Send waitlist confirmation email (lead_magnet submissions use the same path)
      let emailSent = false;
      let emailError: string | null = null;
      try {
        const { sendWaitlistConfirmationEmail } = await import('./email');
        const result = await sendWaitlistConfirmationEmail(email, firstName || 'there');
        emailSent = result.success;
        if (!result.success) {
          emailError = result.error || 'Email delivery failed';
        }
      } catch (err: any) {
        console.error('[WAITLIST] Failed to send confirmation email:', err);
        emailError = err.message || 'Email delivery failed';
        // Don't fail the request if email fails
      }
      
      // Send admin notification email (don't block on this)
      try {
        const { sendWaitlistAdminNotification } = await import('./email');
        sendWaitlistAdminNotification({
          email,
          firstName,
          lastName,
          firmName,
          firmSize,
          role,
          source
        }).catch(err => {
          console.error('[WAITLIST] Failed to send admin notification:', err);
        });
      } catch (err: any) {
        console.error('[WAITLIST] Error importing admin notification function:', err);
      }
      
      res.status(201).json({ 
        message: "You've been added to our early access waitlist",
        id: entry.id,
        emailSent,
        emailError
      });
    } catch (error) {
      next(error);
    }
  });
  
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
        // Never return the full phone number — only a masked hint for UX
        return res.json({
          requiresSmsVerification: true,
          recipientName: shareLink.recipientName,
          hasRegisteredPhone: !!shareLink.smsPhoneNumber,
          phoneLastFour: shareLink.smsPhoneNumber
            ? phoneLastFour(shareLink.smsPhoneNumber)
            : undefined,
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
      
      // Get documents and filter based on sharedDocuments selection
      const allDocuments = await storage.getActiveDocumentsByCase(shareLink.caseId, shareLink.createdBy);
      const sharedDocs = shareLink.sharedDocuments || ["attendance_note"]; // Fallback for old links
      const unadoptedTypes = await getUnadoptedSharedDocumentTypes(
        shareLink.caseId,
        shareLink.createdBy,
        sharedDocs,
      );
      if (unadoptedTypes.length > 0) {
        return res.status(403).json({
          message: "This link is unavailable because one or more documents have not been adopted by a fee earner.",
        });
      }
      const documents = allDocuments.filter((doc) =>
        sharedDocs.some((sharedType: string) => documentMatchesSharedType(doc.type, sharedType)),
      );
      
      // Get transcript only if explicitly shared
      const transcript = sharedDocs.includes("transcript") 
        ? await storage.getTranscriptByCase(shareLink.caseId, shareLink.createdBy)
        : null;
      
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
          recipientName: shareLink.recipientName,
          accessCount: shareLink.accessCount + 1,
          documentsShared: sharedDocs,
          documentCount: documents.length,
        },
        severity: "info",
      });

      // Log individual document access by client
      for (const doc of documents) {
        await storage.createAuditLog({
          eventType: "document_viewed_by_client",
          userId: shareLink.createdBy,
          caseId: shareLink.caseId,
          documentId: doc.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          metadata: {
            shareLinkId: linkId,
            recipientEmail: shareLink.recipientEmail,
            recipientName: shareLink.recipientName,
            documentType: doc.type,
            accessLevel: shareLink.accessLevel,
          },
          severity: "info",
        });
      }

      if (transcript) {
        await storage.createAuditLog({
          eventType: "transcript_viewed_by_client",
          userId: shareLink.createdBy,
          caseId: shareLink.caseId,
          transcriptId: transcript.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          metadata: {
            shareLinkId: linkId,
            recipientEmail: shareLink.recipientEmail,
            recipientName: shareLink.recipientName,
            accessLevel: shareLink.accessLevel,
          },
          severity: "info",
        });
      }
      
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
        transcript: transcript ? (() => {
          // Only return content — never return redactions JSONB or privilegedRedactions to external parties
          return {
            id: transcript.id,
            content: transcript.content,
            createdAt: transcript.createdAt,
          };
        })() : null,
        shareLink: {
          recipientName: shareLink.recipientName,
          expiresAt: shareLink.expiresAt,
          accessLevel: shareLink.accessLevel,
          sharedDocuments: sharedDocs,
        },
        firmProfile: firmProfile || undefined,
      });
    } catch (error: any) {
      if (error.message === 'PENDING_REDACTIONS') {
        return res.status(403).json({ 
          message: "This transcript cannot be shared because it has pending redactions. Please commit or undo all redactions before sharing." 
        });
      }
      next(error);
    }
  });

  // Send SMS verification code (public access)
  app.post('/api/share/:linkId/send-sms', generalApiLimiter, async (req, res, next) => {
    try {
      const { linkId } = req.params;
      const { phoneNumber } = req.body;

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

      // Prefer the number registered when the link was created (avoids format mismatches).
      // Otherwise require the recipient to supply a UK mobile number.
      let formattedPhone: string;
      if (shareLink.smsPhoneNumber) {
        formattedPhone = formatUKPhoneNumber(shareLink.smsPhoneNumber);
        // Soft confirm if they typed a number: must match after normalisation
        if (phoneNumber && typeof phoneNumber === 'string' && phoneNumber.trim()) {
          const entered = formatUKPhoneNumber(phoneNumber);
          if (isValidUKPhoneNumber(entered) && entered !== formattedPhone) {
            return res.status(403).json({
              message: "Phone number does not match the expected recipient",
            });
          }
        }
      } else {
        if (!phoneNumber || typeof phoneNumber !== 'string') {
          return res.status(400).json({ message: "Phone number is required" });
        }
        formattedPhone = formatUKPhoneNumber(phoneNumber);
      }

      if (!isValidUKPhoneNumber(formattedPhone)) {
        return res.status(400).json({
          message: "Invalid UK mobile number. Please use a number like 07xxx… or +447xxx…",
        });
      }

      // Generate verification code
      const verificationCode = generateVerificationCode();
      
      // Calculate expiry (15 minutes from now)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);

      // Get firm profile for branded SMS
      const firmProfile = await storage.getFirmProfile();
      const firmName = firmProfile?.firmName || "LegalNote";

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
        phoneLastFour: phoneLastFour(formattedPhone),
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

      // Validate password is provided (trim — mobile keyboards often add trailing spaces)
      if (!password || typeof password !== 'string' || !password.trim()) {
        return res.status(400).json({ message: "Password is required" });
      }
      const submittedPassword = password.trim();

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
        // Legacy plaintext password - compare trimmed values
        isPasswordValid = submittedPassword === shareLink.password.trim();
        
        // Migrate to hashed password on successful login
        if (isPasswordValid) {
          const saltRounds = 10;
          const hashedPassword = await bcrypt.hash(submittedPassword, saltRounds);
          await storage.updateShareLink(linkId, { password: hashedPassword });
          console.log(`[SECURITY] Migrated legacy plaintext password to bcrypt hash for share link ${linkId}`);
        }
      } else {
        // Modern bcrypt hashed password
        isPasswordValid = await bcrypt.compare(submittedPassword, shareLink.password);
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

      // Ensure the session cookie is written before responding (anonymous share visitors)
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => (err ? reject(err) : resolve()));
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

  // Auth user route — IP limiter BEFORE auth so unauthenticated floods are throttled.
  // Exempt from generalApiLimiter (see /api/ mount above); this is the dedicated throttle.
  app.get('/api/auth/user', authUserIpLimiter, isAuthenticated, async (req: any, res, next) => {
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

      // Attach admin-provisioned evaluation firm if this email was reserved before login
      if (user && !user.firmId) {
        const claimed = await storage.claimEvaluationFirmLead(user.id, user.email);
        if (claimed) user = claimed;
      }
      
      // Add admin flag to user object (MVP: configurable via env)
      const ADMIN_USER_ID = getAdminUserId();
      const isAdmin = userId === ADMIN_USER_ID;
      const accessAllowed = await resolveUserAccessAllowed(
        userId,
        user?.email ?? req.user.claims?.email,
      );
      
      // Check waitlist status for non-admin users
      let waitlistStatus: string | null = null;
      if (!isAdmin && user?.email) {
        const waitlistEntry = await storage.getWaitlistEntryByEmail(user.email);
        waitlistStatus = waitlistEntry?.status ?? null;
      }
      
      const identities = await storage.getAuthIdentitiesForUser(userId);
      const authProviders = identities
        .map((identity) => identity.provider)
        .filter((provider): provider is "google" | "microsoft" =>
          provider === "google" || provider === "microsoft",
        );
      // Preferred calendar matches how they signed in (Google → Google Calendar, Microsoft → Outlook).
      const preferredCalendarProvider: "google" | "outlook" =
        authProviders.includes("microsoft") && !authProviders.includes("google")
          ? "outlook"
          : "google";

      const userWithFlags = {
        ...user,
        isAdmin,
        accessAllowed,
        waitlistStatus,
        role: isAdmin ? 'admin' : (user?.role || 'solicitor'),
        authProviders,
        preferredCalendarProvider,
      };
      
      res.json(userWithFlags);
    } catch (error) {
      next(error);
    }
  });

  // ==================== STRIPE BILLING ROUTES ====================
  
  // Get Stripe publishable key (public route for checkout)
  app.get('/api/stripe/config', async (req, res, next) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      next(error);
    }
  });

  // Get products and prices (public for landing page)
  app.get('/api/stripe/products', async (req, res, next) => {
    try {
      const rows = await stripeService.listProductsWithPrices();
      
      // Group prices by product
      const productsMap = new Map();
      for (const row of rows as any[]) {
        if (!productsMap.has(row.product_id)) {
          productsMap.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            description: row.product_description,
            active: row.product_active,
            metadata: row.product_metadata,
            prices: []
          });
        }
        if (row.price_id) {
          productsMap.get(row.product_id).prices.push({
            id: row.price_id,
            unit_amount: row.unit_amount,
            currency: row.currency,
            recurring: row.recurring,
            active: row.price_active,
            metadata: row.price_metadata,
          });
        }
      }

      res.json({ products: Array.from(productsMap.values()) });
    } catch (error) {
      next(error);
    }
  });

  // Get user's subscription status (authenticated)
  app.get('/api/subscription', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.stripeSubscriptionId) {
        return res.json({ 
          subscription: null,
          status: user?.subscriptionStatus || null,
          plan: user?.subscriptionPlan || null,
          trialEndsAt: user?.trialEndsAt || null,
        });
      }

      const subscription = await stripeService.getSubscription(user.stripeSubscriptionId);
      res.json({ 
        subscription,
        status: user.subscriptionStatus,
        plan: user.subscriptionPlan,
        trialEndsAt: user.trialEndsAt,
      });
    } catch (error) {
      next(error);
    }
  });

  // Create checkout session
  app.post('/api/stripe/checkout', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { priceId, trialDays } = req.body;

      if (!priceId) {
        return res.status(400).json({ message: 'priceId is required' });
      }

      let user = await storage.getUser(userId);
      
      // Create Stripe customer if not exists
      let customerId = user?.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(
          user?.email || req.user.claims.email,
          userId,
          `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || undefined
        );
        await storage.updateUserStripeInfo(userId, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }

      // Get base URL for redirects
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      const session = await stripeService.createCheckoutSession(
        customerId,
        priceId,
        `${baseUrl}/?checkout=success`,
        `${baseUrl}/?checkout=cancel`,
        trialDays
      );

      res.json({ url: session.url });
    } catch (error) {
      next(error);
    }
  });

  // Create customer portal session (manage subscription)
  app.post('/api/stripe/portal', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user?.stripeCustomerId) {
        return res.status(400).json({ message: 'No subscription found' });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripeService.createCustomerPortalSession(
        user.stripeCustomerId,
        `${baseUrl}/settings`
      );

      res.json({ url: session.url });
    } catch (error) {
      next(error);
    }
  });

  // ==================== END STRIPE BILLING ROUTES ====================

  // Client routes
  app.get("/api/clients", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const clientsList = await storage.getClientsByUser(userId);
      res.json(clientsList);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/clients/search", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const query = req.query.q as string;
      if (!query || query.trim().length < 1) {
        return res.json([]);
      }
      const results = await storage.searchClients(query.trim(), userId);
      res.json(results);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/clients/:id", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const client = await storage.getClient(req.params.id, userId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/clients/:id/cases", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const client = await storage.getClient(req.params.id, userId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      const clientCases = await storage.getCasesByClientId(req.params.id, userId);
      res.json(clientCases);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/clients", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { insertClientSchema } = await import("@shared/schema");
      const validatedData = insertClientSchema.parse(req.body);
      const client = await storage.createClient(validatedData, userId);
      res.status(201).json(client);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/clients/:id", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const allowedFields = ["name", "email", "phone", "address", "companyName", "amlRiskLevel", "amlRiskLastReviewed", "clioClientId", "dateOfBirth"];
      const sanitized: Record<string, any> = {};
      for (const key of allowedFields) {
        if (key in req.body) {
          sanitized[key] = req.body[key];
        }
      }
      if (sanitized.amlRiskLevel && !["low", "medium", "high"].includes(sanitized.amlRiskLevel)) {
        return res.status(400).json({ message: "amlRiskLevel must be 'low', 'medium', or 'high'" });
      }
      if (sanitized.email && typeof sanitized.email !== "string") {
        return res.status(400).json({ message: "email must be a string" });
      }
      if (sanitized.name !== undefined && (!sanitized.name || typeof sanitized.name !== "string" || !sanitized.name.trim())) {
        return res.status(400).json({ message: "name is required and must be a non-empty string" });
      }
      const client = await storage.updateClient(req.params.id, sanitized, userId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/clients/migrate", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const count = await storage.migrateExistingClientsFromCases(userId);
      res.json({ migrated: count });
    } catch (error) {
      next(error);
    }
  });

  // Protected Case routes
  app.post("/api/cases", isAuthenticated, caseCreationLimiter, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = insertCaseSchema.parse(req.body);
      const validatedData: InsertCase = {
        title: parsed.title as string,
        clientName: String(parsed.clientName ?? ""),
        clientId: parsed.clientId as string | undefined,
        matterKind: normalizeMatterKind(parsed.matterKind),
        matterReference: parsed.matterReference as string | undefined,
        status: parsed.status as InsertCase["status"],
        priority: parsed.priority as InsertCase["priority"],
        sourceType: parsed.sourceType as InsertCase["sourceType"],
        templateId: parsed.templateId as string | undefined,
        parentCaseId: parsed.parentCaseId as string | undefined,
        riskLevel: parsed.riskLevel as InsertCase["riskLevel"],
        practiceArea: parsed.practiceArea as InsertCase["practiceArea"],
        conflictCheckCompleted: Boolean(parsed.conflictCheckCompleted),
        conflictCheckNote: parsed.conflictCheckNote as string | undefined,
        costsEstimate: parsed.costsEstimate as string | undefined,
        textNotes: parsed.textNotes as string | undefined,
        litigationHold: Boolean(parsed.litigationHold),
        litigationHoldReason: parsed.litigationHoldReason as string | undefined,
      };

      // Inherit from parent case first so child/dictation matters keep the parent's kind
      if (validatedData.parentCaseId) {
        const parentCase = await storage.getCase(validatedData.parentCaseId, userId);
        if (parentCase) {
          validatedData.matterKind = normalizeMatterKind(
            (parentCase as { matterKind?: string }).matterKind,
          );
          if (!validatedData.practiceArea && parentCase.practiceArea) {
            validatedData.practiceArea = parentCase.practiceArea;
          }
          if (!validatedData.conflictCheckCompleted && parentCase.conflictCheckCompleted) {
            validatedData.conflictCheckCompleted = true;
          }
          if (isClientMatterKind(validatedData.matterKind) && !validatedData.clientId && parentCase.clientId) {
            validatedData.clientId = parentCase.clientId;
            const parentClient = await storage.getClient(parentCase.clientId, userId);
            if (parentClient) {
              validatedData.clientName = parentClient.name;
            }
          }
        }
      }

      const matterKind = normalizeMatterKind(validatedData.matterKind);
      validatedData.matterKind = matterKind;
      const isClientMatter = isClientMatterKind(matterKind);

      // Enforce client linkage on new top-level client matters
      if (isClientMatter && !validatedData.clientId && !validatedData.parentCaseId) {
        return res.status(400).json({ message: "A client must be selected or created before creating a case" });
      }

      if (!isClientMatter) {
        // Non-client matters must not attach a client registry record
        validatedData.clientId = undefined;
        validatedData.clientName = partyLabelForMatterKind(matterKind);
        validatedData.conflictCheckCompleted = false;
        validatedData.conflictCheckNote = undefined;
      } else {
        validatedData.hasExternalAttendees = false;
      }

      // If clientId provided, verify ownership and derive clientName
      if (validatedData.clientId) {
        const client = await storage.getClient(validatedData.clientId, userId);
        if (!client) {
          return res.status(400).json({ message: "Invalid client: not found or not owned by you" });
        }
        validatedData.clientName = client.name;
      }

      if (!validatedData.clientName?.trim()) {
        validatedData.clientName = isClientMatter
          ? ""
          : partyLabelForMatterKind(matterKind);
      }
      if (isClientMatter && !validatedData.clientName?.trim() && !validatedData.parentCaseId) {
        return res.status(400).json({ message: "Client name is required" });
      }

      if (isClientMatter && !validatedData.parentCaseId && !validatedData.practiceArea) {
        return res.status(400).json({ message: "Practice area is required for new cases" });
      }

      if (
        isClientMatter &&
        !validatedData.parentCaseId &&
        !validatedData.conflictCheckCompleted &&
        !validatedData.conflictCheckNote?.trim()
      ) {
        return res.status(400).json({ message: "Either confirm the conflict check or provide a reason for deferral" });
      }

      if (validatedData.practiceArea) {
        validatedData.riskLevel = getAmlRiskDefault(validatedData.practiceArea);
      }


      const newCase = await storage.createCase(validatedData, userId);
      await logAuditEvent(userId, "case_created", {
        caseId: newCase.id,
        req,
        metadata: { action: "create", matterKind: newCase.matterKind ?? matterKind },
      });

      if (isClientMatter && validatedData.conflictCheckCompleted !== undefined) {
        await logAuditEvent(userId, "case_updated", {
          caseId: newCase.id,
          req,
          metadata: {
            action: "conflict_check",
            conflictCheckCompleted: validatedData.conflictCheckCompleted,
            conflictCheckNote: validatedData.conflictCheckNote || null,
          },
        });
      }

      // Client care letters only apply to solicitor–client matters
      if (isClientMatter) {
        (async () => {
          try {
            const fp = await storage.getFirmProfile();
            if (!fp?.firmName) return;
            const { DocumentService } = await import("./services/documentService");
            const documentService = new DocumentService();
            const { PRACTICE_AREA_LABELS: PAL } = await import("@shared/schema");
            const paLabel = newCase.practiceArea
              ? PAL[newCase.practiceArea as keyof typeof PAL] || newCase.practiceArea
              : "General";
            const feeEarnerUser = await storage.getUser(newCase.assignedToUserId || userId);
            const feeEarnerDisplayName = feeEarnerUser
              ? [feeEarnerUser.firstName, feeEarnerUser.lastName].filter(Boolean).join(" ") || feeEarnerUser.email || "Fee Earner"
              : "Fee Earner";
            const result = await documentService.generateClientCareLetter({
              firmName: fp.firmName,
              firmAddress: [fp.addressLine1, fp.addressLine2, fp.city, fp.postcode].filter(Boolean).join(", ") || undefined,
              firmPhone: fp.phone || undefined,
              firmEmail: fp.email || undefined,
              sraNumber: fp.sraNumber || undefined,
              feeEarnerName: feeEarnerDisplayName,
              clientName: newCase.clientName,
              matterDescription: newCase.title,
              practiceArea: paLabel,
              costsEstimate: newCase.costsEstimate || undefined,
              matterReference: newCase.matterReference || undefined,
            });
            const doc = await storage.createDocument({
              caseId: newCase.id,
              type: "client_care_letter",
              content: result.content,
              version: 1,
              versionType: "system_generated",
              createdBy: userId,
            });
            await storage.updateCase(newCase.id, { clientCareLetterId: doc.id }, userId);
            await logAuditEvent(userId, "document_generated", {
              caseId: newCase.id,
              documentId: doc.id,
              req,
              metadata: {
                action: "auto_generate_client_care_letter",
                practiceArea: newCase.practiceArea,
                generationCost: result.cost,
                automatic: true,
              },
            });
            console.log(`[CLIENT_CARE_LETTER] Auto-generated for case ${newCase.id}`);
          } catch (err) {
            console.error(`[CLIENT_CARE_LETTER] Auto-generation failed for case ${newCase.id}:`, err);
          }
        })();
      }

      res.json(newCase);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  });

  app.get("/api/cases", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      // Include archived cases so the dashboard can show them in the Archived tab
      const includeArchived = req.query.includeArchived !== 'false';
      const cases = await storage.getCases(userId, includeArchived);
      res.json(cases);
    } catch (error: any) {
      next(error);
    }
  });

  // Dashboard attention stats - audio expiring soon
  app.get("/api/dashboard/attention-stats", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const audioExpiringCount = await storage.getExpiringAudioCount(userId, 24);
      res.json({ audioExpiringCount });
    } catch (error: any) {
      next(error);
    }
  });

  // Dashboard enhanced stats - productivity metrics
  app.get("/api/dashboard/productivity-stats", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const range = req.query.range as string | undefined;
      let since: Date | undefined;
      if (range === "7d") {
        since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      } else if (range === "30d") {
        since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }
      const stats = await storage.getProductivityStats(userId, since);
      res.json(stats);
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
  
  // Enhanced search with match details
  app.get("/api/search/enhanced", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const query = req.query.q as string;
      const documentType = req.query.type as 'transcript' | 'attendance_note' | 'summary' | 'all' | undefined;
      const dateRange = req.query.dateRange as 'today' | 'week' | 'month' | 'year' | 'all' | undefined;
      
      if (!query || query.trim().length === 0) {
        return res.json([]);
      }
      
      const results = await storage.searchCasesWithMatches(query.trim(), userId, {
        documentType: documentType || 'all',
        dateRange: dateRange || 'all',
      });
      
      res.json(results);
    } catch (error: any) {
      next(error);
    }
  });
  
  // Search history
  app.get("/api/search/history", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const history = await storage.getSearchHistory(userId, limit);
      res.json(history);
    } catch (error: any) {
      next(error);
    }
  });
  
  app.post("/api/search/history", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { query, resultCount } = req.body;
      
      if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: "Query is required" });
      }
      
      const historyEntry = await storage.createSearchHistory({
        userId,
        query: query.trim(),
        resultCount: resultCount || 0,
      });
      
      res.json(historyEntry);
    } catch (error: any) {
      next(error);
    }
  });
  
  app.delete("/api/search/history", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      await storage.clearSearchHistory(userId);
      res.json({ success: true });
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
      await logPersonnelMatterAccess({
        userId,
        caseId: req.params.id,
        resource: "case",
        req,
        metadata: { title: caseData.title },
      });
      
      res.json(caseData);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/cases/:id/audio-recordings", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseData = await storage.getCase(req.params.id, userId);

      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }

      const recordings = await storage.getAudioRecordingsByCaseId(req.params.id);
      res.json(recordings.map((recording) => ({
        id: recording.id,
        meetingSessionId: recording.meetingSessionId,
        consentSegmentPath: recording.consentSegmentPath,
        consentDurationSeconds: recording.consentDurationSeconds,
        duration: recording.duration,
        recordedAt: recording.recordedAt,
        expiresAt: recording.expiresAt,
        holdReleaseGraceUntil: recording.holdReleaseGraceUntil,
        colpReviewStatus: recording.colpReviewStatus,
        deletedAt: recording.deletedAt,
      })));
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/cases/:id/processing-status", isAuthenticated, pollingLimiter, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;

      // Unstick further-version jobs orphaned by deploy/restart before reporting status
      const { recoverStuckProduceVersionCase } = await import("./services/stuckProduceVersionRecovery");
      await recoverStuckProduceVersionCase(storage, caseId, userId);
      
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
          undertakingCandidates: metadata.undertakingCandidates || [],
          dismissedUndertakingQuotes: metadata.dismissedUndertakingQuotes || [],
          produceVersionFailed: metadata.produceVersionFailed === true,
          produceVersionError: metadata.produceVersionError,
        }
      });
    } catch (error: any) {
      next(error);
    }
  });

  app.patch("/api/cases/:id/processing-status", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;

      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }

      const patchSchema = z.object({
        dismissedUndertakingQuote: z.string().min(1).max(10000),
      });
      const parsed = patchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      }

      const metadata = (caseData.aiProcessingMetadata as any) || {};
      const dismissedQuotes: string[] = metadata.dismissedUndertakingQuotes || [];
      if (!dismissedQuotes.includes(parsed.data.dismissedUndertakingQuote)) {
        dismissedQuotes.push(parsed.data.dismissedUndertakingQuote);
      }

      await storage.updateCase(caseId, {
        aiProcessingMetadata: {
          ...metadata,
          dismissedUndertakingQuotes: dismissedQuotes,
        },
      }, userId);

      res.json({ success: true });
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

  app.get("/api/cases/:id/handover-candidates", isAuthenticated, requireFeatureVisible("caseHandover"), async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseRecord = await storage.getCaseById(req.params.id);
      if (!caseRecord) {
        return res.status(404).json({ message: "Case not found" });
      }
      const isCreator = caseRecord.createdBy === userId;
      const isAssignee = caseRecord.assignedToUserId === userId;
      const actingUser = await storage.getUser(userId);
      const isAdmin = actingUser?.role === 'admin';
      if (!isCreator && !isAssignee && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (!actingUser?.firmId) {
        return res.json([]);
      }

      const firmMembers = await storage.getFirmMembers(actingUser.firmId);
      const candidates = firmMembers
        .filter(member => member.id !== userId && member.id !== SYSTEM_USER_ID)
        .map(member => ({
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
        }));
      res.json(candidates);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/cases/:id/handover", isAuthenticated, requireFeatureVisible("caseHandover"), async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { newFeeEarnerId, handoverNote } = req.body;

      if (!newFeeEarnerId || typeof newFeeEarnerId !== 'string') {
        return res.status(400).json({ message: "newFeeEarnerId is required" });
      }

      if (newFeeEarnerId === userId) {
        return res.status(400).json({ message: "Cannot hand over a case to yourself" });
      }

      const caseRecord = await storage.getCaseById(req.params.id);
      if (!caseRecord) {
        return res.status(404).json({ message: "Case not found" });
      }

      const isCreator = caseRecord.createdBy === userId;
      const isAssignee = caseRecord.assignedToUserId === userId;
      const actingUser = await storage.getUser(userId);
      const isAdmin = actingUser?.role === 'admin';
      if (!isCreator && !isAssignee && !isAdmin) {
        return res.status(403).json({ message: "Only the case owner, current assignee, or an admin can initiate a handover" });
      }

      const incomingUser = await storage.getUser(newFeeEarnerId);
      if (!incomingUser) {
        return res.status(404).json({ message: "Incoming solicitor not found" });
      }
      if (!actingUser?.firmId || incomingUser.firmId !== actingUser.firmId || incomingUser.removedAt) {
        return res.status(400).json({ message: "Incoming solicitor must be an active member of your firm" });
      }

      const outgoingUserId = caseRecord.assignedToUserId || caseRecord.createdBy;
      let outgoingSolicitorName = outgoingUserId;
      if (outgoingUserId) {
        const outgoingUser = await storage.getUser(outgoingUserId);
        if (outgoingUser) {
          outgoingSolicitorName = [outgoingUser.firstName, outgoingUser.lastName].filter(Boolean).join(' ') || outgoingUser.email || outgoingUserId;
        }
      }
      const incomingSolicitorName = [incomingUser.firstName, incomingUser.lastName].filter(Boolean).join(' ') || incomingUser.email || newFeeEarnerId;
      const handoverTimestamp = new Date().toISOString();

      const updatedCase = await storage.updateCase(req.params.id, { assignedToUserId: newFeeEarnerId }, caseRecord.createdBy);

      await logAuditEvent(userId, "case_handover", {
        caseId: req.params.id,
        metadata: {
          outgoingSolicitorId: outgoingUserId,
          outgoingSolicitorName,
          incomingSolicitorId: newFeeEarnerId,
          incomingSolicitorName,
          handoverNote: handoverNote || "",
          handoverTimestamp,
        },
        req,
      });

      await logAuditEvent(newFeeEarnerId, "case_handover_received", {
        caseId: req.params.id,
        metadata: {
          outgoingSolicitorId: outgoingUserId,
          outgoingSolicitorName,
          incomingSolicitorId: newFeeEarnerId,
          incomingSolicitorName,
          handoverNote: handoverNote || "",
          handoverTimestamp,
        },
        req,
      });

      res.json(updatedCase);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/cases/:id/handover-history", isAuthenticated, requireFeatureVisible("caseHandover"), async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseRecord = await storage.getCaseById(req.params.id);
      if (!caseRecord) {
        return res.status(404).json({ message: "Case not found" });
      }
      const isCreator = caseRecord.createdBy === userId;
      const isAssignee = caseRecord.assignedToUserId === userId;
      const actingUser = await storage.getUser(userId);
      const isAdmin = actingUser?.role === 'admin';
      if (!isCreator && !isAssignee && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      const auditLogs = await storage.getAuditLogsByCase(req.params.id);
      const handoverEvents = auditLogs.filter(log => log.eventType === 'case_handover');
      res.json(handoverEvents);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/cases/:id/external-documents", isAuthenticated, requireFeatureVisible("externalReferences"), async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseRecord = await storage.getCase(req.params.id, userId);
      if (!caseRecord) {
        return res.status(404).json({ message: "Case not found" });
      }
      const refs = await storage.getExternalDocumentRefs(req.params.id);
      res.json(refs);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/cases/:id/external-documents", isAuthenticated, requireFeatureVisible("externalReferences"), async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseRecord = await storage.getCase(req.params.id, userId);
      if (!caseRecord) {
        return res.status(404).json({ message: "Case not found" });
      }

      const { insertExternalDocumentRefSchema } = await import("@shared/schema");
      const body = { ...req.body, caseId: req.params.id };
      if (body.documentDate === null || body.documentDate === "" || body.documentDate === undefined) {
        delete body.documentDate;
      }
      const validated = insertExternalDocumentRefSchema.parse(body);

      const ref = await storage.createExternalDocumentRef(validated, userId);

      await logAuditEvent(userId, "external_document_referenced", {
        caseId: req.params.id,
        metadata: {
          externalDocRefId: ref.id,
          description: validated.description,
          documentType: validated.documentType,
          documentDate: validated.documentDate?.toISOString() || null,
          providedBy: validated.providedBy,
        },
        req,
      });

      res.json(ref);
    } catch (error: any) {
      next(error);
    }
  });

  // Time Entry routes
  app.get("/api/cases/:id/time-entries", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseRecord = await storage.getCase(req.params.id, userId);
      if (!caseRecord) {
        return res.status(404).json({ message: "Case not found" });
      }
      const entries = await storage.getTimeEntriesByCase(req.params.id);
      res.json(entries);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/cases/:id/time-entries", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseRecord = await storage.getCase(req.params.id, userId);
      if (!caseRecord) {
        return res.status(404).json({ message: "Case not found" });
      }
      const sessionIdSchema = z.string().uuid("A valid session reference is required");
      const meetingSessionId = sessionIdSchema.parse(req.body.meetingSessionId);
      const session = await storage.getMeetingSession(meetingSessionId);
      if (!session || session.caseId !== req.params.id) {
        return res.status(400).json({ message: "Session does not belong to this matter" });
      }
      const body = { ...req.body, caseId: req.params.id, userId };
      const validated = insertTimeEntrySchema.parse(body);
      const entry = await storage.createTimeEntry(validated);
      await logAuditEvent(userId, "time_entry_created", {
        caseId: req.params.id,
        metadata: {
          timeEntryId: entry.id,
          meetingSessionId: entry.meetingSessionId,
          durationMinutes: entry.durationMinutes,
          units: Math.ceil(entry.durationMinutes / 6),
          sourceDurationSeconds: session.durationSeconds,
          action: "create",
        },
        req,
      });
      res.json(entry);
    } catch (error: any) {
      next(error);
    }
  });

  app.patch("/api/time-entries/:id", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const entry = await storage.getTimeEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ message: "Time entry not found" });
      }
      if (entry.userId !== userId) {
        return res.status(403).json({ message: "Not authorised" });
      }
      const updateSchema = z.object({
        durationMinutes: z.number().int().min(1).optional(),
        description: z.string().min(1).max(5000).optional(),
        hourlyRate: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid decimal number").optional(),
        status: z.enum(["draft", "confirmed"]).optional(),
        meetingSessionId: z.string().uuid().optional(),
      });
      const validated = updateSchema.parse(req.body);
      if (validated.meetingSessionId) {
        const session = await storage.getMeetingSession(validated.meetingSessionId);
        if (!session || session.caseId !== entry.caseId) {
          return res.status(400).json({ message: "Session does not belong to this matter" });
        }
      }
      const updated = await storage.updateTimeEntry(req.params.id, validated);
      if (!updated) {
        return res.status(404).json({ message: "Time entry not found" });
      }
      const changedFields = Object.keys(validated).filter(
        (field) => entry[field as keyof typeof entry] !== updated[field as keyof typeof updated],
      );
      await logAuditEvent(userId, "time_entry_updated", {
        caseId: entry.caseId,
        metadata: {
          timeEntryId: entry.id,
          meetingSessionId: updated.meetingSessionId,
          changedFields,
          before: Object.fromEntries(changedFields.map((field) => [field, entry[field as keyof typeof entry]])),
          after: Object.fromEntries(changedFields.map((field) => [field, updated[field as keyof typeof updated]])),
          durationMinutes: updated.durationMinutes,
          units: Math.ceil(updated.durationMinutes / 6),
          action: "update",
        },
        req,
      });
      res.json(updated);
    } catch (error: any) {
      next(error);
    }
  });

  app.delete("/api/time-entries/:id", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const entry = await storage.getTimeEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ message: "Time entry not found" });
      }
      if (entry.userId !== userId) {
        return res.status(403).json({ message: "Not authorised" });
      }
      await storage.deleteTimeEntry(req.params.id);
      await logAuditEvent(userId, "time_entry_deleted", {
        caseId: entry.caseId,
        metadata: {
          timeEntryId: entry.id,
          meetingSessionId: entry.meetingSessionId,
          durationMinutes: entry.durationMinutes,
          units: Math.ceil(entry.durationMinutes / 6),
          action: "delete",
        },
        req,
      });
      res.json({ success: true });
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/time-entries", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const ADMIN_USER_ID = process.env.ADMIN_USER_ID || "48381245";
      const isAdmin = userId === ADMIN_USER_ID;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      if (isAdmin) {
        const entries = await storage.getAllTimeEntries(startDate, endDate);
        res.json(entries);
      } else {
        const entries = await storage.getTimeEntriesByUser(userId, startDate, endDate);
        res.json(entries);
      }
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/time-entries/export-csv", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const ADMIN_USER_ID = process.env.ADMIN_USER_ID || "48381245";
      const isAdmin = userId === ADMIN_USER_ID;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const entries = isAdmin
        ? await storage.getAllTimeEntries(startDate, endDate)
        : await storage.getTimeEntriesByUser(userId, startDate, endDate);

      const csvHeader = "Date,Fee Earner,Matter,Client,Session,Hours,Minutes,Units\n";
      const csvRows = entries.map(e => {
        const date = new Date(e.createdAt).toISOString().split('T')[0];
        const escape = (s: string | undefined | null) => `"${(s || '').replace(/"/g, '""')}"`;
        const session = (e as any).sessionTitle
          || ((e as any).sessionRecordingType
            ? String((e as any).sessionRecordingType).replace(/_/g, " ")
            : "Unlinked legacy entry");
        return `${date},${escape((e as any).userName)},${escape((e as any).caseTitle)},${escape((e as any).clientName)},${escape(session)},${Math.floor(e.durationMinutes / 60)},${e.durationMinutes % 60},${Math.ceil(e.durationMinutes / 6)}`;
      }).join("\n");

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="time-entries.csv"');
      res.send(csvHeader + csvRows);
    } catch (error: any) {
      next(error);
    }
  });

  app.patch("/api/user/hourly-rate", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const rateSchema = z.object({
        hourlyRate: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid decimal number"),
      });
      const { hourlyRate } = rateSchema.parse(req.body);
      const user = await storage.updateUserHourlyRate(userId, hourlyRate);
      res.json(user);
    } catch (error: any) {
      next(error);
    }
  });

  // Confirm display name once (locks afterward). Admins force-update via /api/admin/users/:id/display-name.
  app.patch("/api/user/display-name", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const nameSchema = z.object({
        firstName: z.string().min(1).max(100).transform((s) => s.trim()),
        lastName: z.string().min(1).max(100).transform((s) => s.trim()),
      });
      const { firstName, lastName } = nameSchema.parse(req.body);
      const user = await storage.confirmUserDisplayName(userId, { firstName, lastName });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      if (error?.name === "DisplayNameAlreadyConfirmedError") {
        return res.status(409).json({ message: error.message });
      }
      next(error);
    }
  });

  app.post("/api/time-entries/:id/push-to-clio", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const entry = await storage.getTimeEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ message: "Time entry not found" });
      }
      if (entry.userId !== userId) {
        return res.status(403).json({ message: "Not authorised" });
      }
      if (entry.status !== 'confirmed') {
        return res.status(400).json({ message: "Only confirmed time entries can be pushed to Clio" });
      }
      res.status(501).json({ message: "Clio integration not yet configured. Please connect your Clio account in Settings." });
    } catch (error: any) {
      next(error);
    }
  });

  // Quick Notes routes
  app.post("/api/cases/:id/quick-notes", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { content } = req.body;

      if (!content || typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ message: "Content is required" });
      }

      // Verify case exists and belongs to user
      const caseRecord = await storage.getCase(req.params.id, userId);
      if (!caseRecord) {
        return res.status(404).json({ message: "Case not found" });
      }

      const quickNote = await storage.createQuickNote({
        caseId: req.params.id,
        content: content.trim(),
      }, userId);

      await logAuditEvent(userId, "quick_note_added", {
        caseId: req.params.id,
        metadata: { 
          noteLength: content.length,
          quickNoteId: quickNote.id,
        },
        req,
      });

      res.json(quickNote);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/cases/:id/quick-notes", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const quickNotes = await storage.getQuickNotesByCase(req.params.id, userId);
      res.json(quickNotes);
    } catch (error: any) {
      next(error);
    }
  });

  app.patch("/api/cases/:id", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { priority, deadline, deadlineIsAllDay, textNotes, conflictCheckCompleted, conflictCheckNote, practiceArea } = req.body;
      
      // Get current case to verify access
      const currentCase = await storage.getCase(req.params.id, userId);
      if (!currentCase) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Build update object with only provided fields
      const updates: any = {};
      if (priority !== undefined) updates.priority = priority;
      if (deadline !== undefined) {
        updates.deadline = deadline ? new Date(deadline) : null;
      }
      if (deadlineIsAllDay !== undefined) updates.deadlineIsAllDay = deadlineIsAllDay;
      if (textNotes !== undefined) updates.textNotes = textNotes;
      if (conflictCheckCompleted !== undefined) updates.conflictCheckCompleted = conflictCheckCompleted;
      if (conflictCheckNote !== undefined) updates.conflictCheckNote = conflictCheckNote;
      if (practiceArea !== undefined) {
        if ((PRACTICE_AREAS as readonly string[]).includes(practiceArea)) {
          updates.practiceArea = practiceArea;
          updates.riskLevel = getAmlRiskDefault(practiceArea);
        }
      }
      
      // Update the case
      const updatedCase = await storage.updateCase(req.params.id, updates, userId);
      
      // Log specific audit events for different update types
      if (textNotes !== undefined) {
        await logAuditEvent(userId, "quick_note_added", {
          caseId: req.params.id,
          metadata: { 
            noteLength: textNotes?.length || 0,
            hasContent: !!textNotes?.trim(),
          },
          req,
        });
      }
      
      if (deadline !== undefined || deadlineIsAllDay !== undefined) {
        await logAuditEvent(userId, "deadline_changed", {
          caseId: req.params.id,
          metadata: { 
            deadline: deadline,
            deadlineIsAllDay: deadlineIsAllDay,
            priority: priority || currentCase.priority,
          },
          req,
        });
      }
      
      if (priority !== undefined) {
        await logAuditEvent(userId, "priority_changed", {
          caseId: req.params.id,
          metadata: { 
            oldPriority: currentCase.priority,
            newPriority: priority,
          },
          req,
        });
      }
      
      if (conflictCheckCompleted !== undefined) {
        await logAuditEvent(userId, "conflict_check_updated", {
          caseId: req.params.id,
          metadata: {
            previousValue: currentCase.conflictCheckCompleted,
            newValue: conflictCheckCompleted,
            conflictCheckNote: conflictCheckNote || null,
          },
          req,
        });
      }

      // General case update log
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

  app.post("/api/firm/compliance-code", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { code, currentCode } = req.body;

      if (!code || typeof code !== "string" || code.trim().length < 6) {
        return res.status(400).json({ message: "Compliance code must be at least 6 characters" });
      }

      const user = await storage.getUser(userId);
      if (!user?.firmId) {
        return res.status(400).json({ message: "No firm associated with your account" });
      }

      const firmProfile = await storage.getFirmProfile(user.firmId);
      if (firmProfile?.complianceCodeHash) {
        if (!currentCode) {
          return res.status(400).json({ message: "Current compliance code is required to set a new one" });
        }
        const currentValid = await storage.verifyFirmComplianceCode(user.firmId, currentCode);
        if (!currentValid) {
          await logAuditEvent(userId, "compliance_code_reset_failed", {
            metadata: { firmId: user.firmId },
            severity: "critical",
          });
          return res.status(403).json({ message: "Current compliance code is incorrect" });
        }
      }

      const bcrypt = await import("bcrypt");
      const codeHash = await bcrypt.hash(code.trim(), 12);
      await storage.setFirmComplianceCode(user.firmId, codeHash, userId);

      await logAuditEvent(userId, "compliance_code_updated", {
        metadata: { firmId: user.firmId },
        severity: "critical",
      });

      res.json({ message: "Compliance code updated successfully" });
    } catch (error: any) {
      next(error);
    }
  });

  // Litigation Hold Management - Privileged operation for legal defensibility
  // This endpoint allows authorized users to apply or release litigation holds on cases
  // Litigation holds prevent automatic data deletion for cases involved in disputes
  app.post("/api/cases/:id/litigation-hold", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      
      const holdSchema = z.object({
        apply: z.boolean(),
        reason: z.string().min(10, "Reason must be at least 10 characters").max(2000).optional(),
      });
      
      const validationResult = holdSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation error",
          errors: validationResult.error.format()
        });
      }
      
      const { apply, reason } = validationResult.data;
      
      // Get current case to verify access
      const currentCase = await storage.getCase(req.params.id, userId);
      if (!currentCase) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Validate reason is provided for both applying and releasing a hold.
      if (!reason) {
        return res.status(400).json({ 
          message: apply
            ? "Reason is required when applying a litigation hold"
            : "Reason is required when releasing a litigation hold"
        });
      }
      
      const updates: any = {
        litigationHold: apply,
      };
      
      if (apply) {
        updates.litigationHoldAppliedAt = new Date();
        updates.litigationHoldAppliedBy = userId;
        updates.litigationHoldReason = reason;
        // Clear release fields when applying a new hold
        updates.litigationHoldReleasedAt = null;
        updates.litigationHoldReleasedBy = null;
      } else {
        // When releasing, preserve who applied the hold but record who released it
        // This creates a complete audit trail of hold lifecycle
        updates.litigationHoldReleasedAt = new Date();
        updates.litigationHoldReleasedBy = userId;
        updates.litigationHoldReleaseReason = reason;
        // Note: We preserve litigationHoldAppliedAt/By to maintain history
      }
      
      const updatedCase = await storage.updateCase(req.params.id, updates, userId);

      if (apply) {
        await clearCaseGraceWindow({
          caseId: req.params.id,
          userId,
          req,
        });
      } else {
        await setCaseGraceWindowOnRelease({
          caseId: req.params.id,
          userId,
          req,
          clientName: currentCase.clientName,
          caseTitle: currentCase.title,
        });
      }

      // Log audit event for litigation hold change - includes acting solicitor for defensibility
      const auditMetadata = apply 
        ? {
            reason: reason,
            appliedBy: userId,
            previousHoldStatus: (currentCase as any).litigationHold,
            clientName: currentCase.clientName,
            caseTitle: currentCase.title,
            actionTimestamp: new Date().toISOString(),
          }
        : {
            reason: reason,
            releasedBy: userId,
            originalAppliedBy: (currentCase as any).litigationHoldAppliedBy,
            originalAppliedAt: (currentCase as any).litigationHoldAppliedAt,
            previousHoldStatus: (currentCase as any).litigationHold,
            clientName: currentCase.clientName,
            caseTitle: currentCase.title,
            actionTimestamp: new Date().toISOString(),
          };
      
      await logAuditEvent(userId, apply ? "litigation_hold_applied" : "litigation_hold_released", {
        caseId: req.params.id,
        metadata: auditMetadata,
        severity: "critical", // Litigation holds are always critical events
        req,
      });

      const objectLockResult = await syncCaseObjectLegalHolds({
        caseId: req.params.id,
        apply,
        userId,
        req,
      });
      const { objectLock, warning: objectLockWarning } = buildObjectLockResponse(objectLockResult);
      
      res.json({
        success: true,
        litigationHold: apply,
        message: apply 
          ? "Litigation hold applied - automatic data deletion is now suspended for this case"
          : "Litigation hold released - normal retention policies will apply",
        updatedCase,
        objectLock,
        ...(objectLockWarning ? { warning: objectLockWarning } : {}),
      });
    } catch (error: any) {
      next(error);
    }
  });

  // Document Review Workflow Routes
  app.post("/api/documents/:id/approve", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body with Zod
      const approveSchema = z.object({
        comment: z.string().trim().max(1000, "Comment too long").optional(),
        reasoningGapsReviewed: z.boolean().optional(),
      });
      
      const validationResult = approveSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation error",
          errors: validationResult.error.format()
        });
      }
      
      const { comment, reasoningGapsReviewed } = validationResult.data;
      
      const approvedDocument = await storage.approveDocument(req.params.id, userId, comment, reasoningGapsReviewed);
      
      if (!approvedDocument) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      res.json(approvedDocument);
    } catch (error: any) {
      next(error);
    }
  });

  // Solicitor Reasoning Note endpoint
  app.patch("/api/documents/:id/reasoning-note", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;

      const schema = z.object({
        note: z.string().max(50000, "Reasoning note too long").nullable(),
        reasoningGapsIdentified: z.number().int().min(0).nullable().optional(),
        reasoningGapsFilled: z.number().int().min(0).nullable().optional(),
        amlConfirmed: z.boolean().optional(),
      });

      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: "Validation error", errors: validationResult.error.format() });
      }

      const { note, reasoningGapsIdentified, reasoningGapsFilled, amlConfirmed } = validationResult.data;

      const document = await storage.updateReasoningNote(req.params.id, note, userId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Update gap tracking counts if provided, and emit gap-fill audit event
      if (reasoningGapsIdentified !== undefined || reasoningGapsFilled !== undefined) {
        const gapUpdates: Partial<{ reasoningGapsIdentified: number | null; reasoningGapsFilled: number | null }> = {};
        if (reasoningGapsIdentified !== undefined) gapUpdates.reasoningGapsIdentified = reasoningGapsIdentified;
        if (reasoningGapsFilled !== undefined) gapUpdates.reasoningGapsFilled = reasoningGapsFilled;
        await storage.updateDocument(req.params.id, gapUpdates, userId);
        if ((reasoningGapsFilled ?? 0) > 0) {
          await logAuditEvent(userId, "document_gaps_filled", {
            caseId: document.caseId,
            documentId: req.params.id,
            req,
            metadata: {
              action: "fill_reasoning_gaps",
              gapsIdentified: reasoningGapsIdentified,
              gapsFilled: reasoningGapsFilled,
            },
          });
        }
      }

      // Emit AML confirmation audit event if the solicitor explicitly confirmed
      if (amlConfirmed === true) {
        await logAuditEvent(userId, "document_aml_confirmed", {
          caseId: document.caseId,
          documentId: req.params.id,
          req,
          metadata: {
            action: "aml_consideration_confirmed",
            confirmedBy: userId,
            confirmedAt: new Date().toISOString(),
          },
        });
      }

      res.json(document);
    } catch (error: any) {
      next(error);
    }
  });

  // Resolve a structured verification warning (confirm professionally derived / dismiss with reason)
  app.post("/api/documents/:id/verification-warnings/:warningId/resolve", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { resolveVerificationWarningBodySchema } = await import("@shared/verificationWarnings");
      const validationResult = resolveVerificationWarningBodySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validationResult.error.format(),
        });
      }

      const { disposition, reason } = validationResult.data;
      const document = await storage.resolveVerificationWarning(
        req.params.id,
        req.params.warningId,
        disposition,
        reason,
        userId,
      );

      if (!document) {
        return res.status(404).json({
          message: "Document or warning not found, or document is locked/approved",
        });
      }

      res.json(document);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/documents/:id/unlock", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      
      // No request body validation needed for unlock (no body expected)
      const unlockedDocument = await storage.unlockDocument(req.params.id, userId);
      
      if (!unlockedDocument) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      res.json(unlockedDocument);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/documents/:id/verify", isAuthenticated, async (req: any, res, next) => {
    try {
      const { verifyDocumentHash } = await import("./utils/documentHash");
      const userId = req.user.claims.sub;
      
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Verify user has access to the case
      const caseData = await storage.getCase(document.caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const isValid = document.contentHash
        ? verifyDocumentHash(document.content, document.contentHash)
        : false;

      let signatureValid: boolean | null = null;
      if (document.contentHash && document.contentSignature) {
        const signingKey = process.env.AUDIT_SIGNING_KEY;
        if (signingKey) {
          const expectedSig = crypto.createHmac('sha256', signingKey)
            .update(document.contentHash)
            .digest('hex');
          signatureValid = document.contentSignature === expectedSig;
        }
      }

      if (!isValid || signatureValid === false) {
        await logAuditEvent(userId, "document_integrity_failure", {
          caseId: document.caseId,
          documentId: document.id,
          metadata: {
            hashValid: isValid,
            signatureValid,
          },
        });
      }

      res.json({
        documentId: document.id,
        verified: isValid,
        signatureValid,
        hasHash: !!document.contentHash,
        hasSignature: !!document.contentSignature,
        algorithm: "SHA-256/HMAC-SHA256",
        verifiedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      next(error);
    }
  });

  app.patch("/api/documents/:id", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body with Zod
      const updateDocumentSchema = z.object({
        content: z.string().min(1, "Content cannot be empty").max(100000, "Content too long"),
        silent: z.boolean().optional(),
      });
      
      const validationResult = updateDocumentSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation error",
          errors: validationResult.error.format()
        });
      }
      
      const { content, silent } = validationResult.data;
      
      // Get the document first to check if it exists and is a draft
      const existingDoc = await storage.getDocument(req.params.id);
      if (!existingDoc) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (existingDoc.status === 'approved') {
        return res.status(400).json({ 
          message: "Cannot edit approved documents. Unlock the document first." 
        });
      }
      
      // Update content — only increment version for explicit saves (not auto-saves)
      const updatedDocument = await storage.updateDocument(
        req.params.id, 
        { 
          content,
          ...(silent ? {} : { version: existingDoc.version + 1 }),
        }, 
        userId
      );
      
      if (!updatedDocument) {
        return res.status(404).json({ message: "Failed to update document" });
      }
      
      // Create audit log for document edit (skip for silent auto-saves)
      if (!silent) {
        await storage.createAuditLog({
          eventType: 'document_edited',
          userId,
          caseId: existingDoc.caseId,
          documentId: req.params.id,
          ipAddress: req.ip || req.socket?.remoteAddress,
          metadata: {
            documentType: existingDoc.type,
            oldVersion: existingDoc.version,
            newVersion: updatedDocument.version,
            contentLength: content.length,
          },
        });
      }
      
      res.json(updatedDocument);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/cases/:caseId/document-versions/:type", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId, type } = req.params;
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      const allDocs = await storage.getDocumentsByCase(caseId, userId);
      const CLIENT_LETTER_TYPES = new Set(["summary", "client_letter"]);
      const versions = allDocs
        .filter((d) => {
          if (CLIENT_LETTER_TYPES.has(type) && CLIENT_LETTER_TYPES.has(d.type)) return true;
          return d.type === type;
        })
        .sort((a, b) => a.version - b.version);
      
      const versionsWithMeta = versions.map(doc => {
        const wordCount = doc.content.split(/\s+/).filter(Boolean).length;
        return {
          id: doc.id,
          version: doc.version,
          versionType: doc.versionType,
          content: doc.content,
          createdAt: doc.createdAt,
          createdBy: doc.createdBy,
          isActive: doc.isActive,
          status: doc.status,
          wordCount,
        };
      });
      
      res.json(versionsWithMeta);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/cases/:caseId/documents/:documentId/new-version", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId, documentId } = req.params;
      const { content, versionType } = req.body;

      if (!content || typeof content !== "string" || content.trim().length === 0) {
        return res.status(400).json({ message: "content is required" });
      }

      const VALID_VERSION_TYPES = [
        "system_generated",
        "further_produced",
        "fee_earner_amended",
        "fee_earner_approved",
        "supervisor_approved",
      ];

      if (!versionType || !VALID_VERSION_TYPES.includes(versionType)) {
        return res.status(400).json({
          message: `versionType is required and must be one of: ${VALID_VERSION_TYPES.join(", ")}`,
        });
      }

      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) return res.status(404).json({ message: "Case not found" });

      const newVersion = await storage.createDocumentVersion(
        documentId,
        content.trim(),
        versionType,
        userId
      );

      if (!newVersion) {
        return res.status(404).json({
          message: "Document not found, access denied, or case is under litigation hold",
        });
      }

      await logAuditEvent(userId, "document_version_created", {
        caseId,
        documentId: newVersion.id,
        metadata: {
          parentDocumentId: documentId,
          newVersion: newVersion.version,
          versionType,
        },
      });

      res.status(201).json(newVersion);
    } catch (error: any) {
      next(error);
    }
  });

  /**
   * Produce a further version of an attendance note or client letter from the
   * existing transcript / attendance note — same derivation engine path as
   * meeting-end processing. Queues a background job and sets case status to
   * processing so the Meeting-to-Matter Engine progress UI appears. Prior
   * version remains on file (inactive); new version is hashed and linked via
   * parentVersionId.
   */
  app.post("/api/cases/:caseId/documents/:documentId/produce-version", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId, documentId } = req.params;
      const reason =
        typeof req.body?.reason === "string" ? req.body.reason.slice(0, 500).trim() : "";
      if (!reason || reason.length < 10) {
        return res.status(400).json({
          message:
            "A reason of at least 10 characters is required to produce a further version. Describe the change that should be applied.",
          code: "reason_required",
        });
      }

      const { enqueueProduceDocumentVersion, ProduceDocumentVersionError } = await import(
        "./services/produceDocumentVersion"
      );

      await enqueueProduceDocumentVersion({
        storage,
        caseId,
        documentId,
        userId,
        reason,
      });

      res.status(202).json({
        status: "processing",
        message: "Further version production started",
      });
    } catch (error: any) {
      if (error?.name === "ProduceDocumentVersionError") {
        return res.status(error.statusCode || 400).json({
          message: error.message,
          code: error.code,
        });
      }
      next(error);
    }
  });

  app.get("/api/documents/:id/comments", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      const caseData = await storage.getCase(document.caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Access denied" });
      }
      const comments = await storage.getDocumentComments(req.params.id);
      res.json(comments);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/documents/:id/comments", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      const caseData = await storage.getCase(document.caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Access denied" });
      }
      const commentSchema = z.object({
        selectedText: z.string().min(1).max(10000),
        commentText: z.string().min(1).max(10000),
      });
      const validationResult = commentSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: "Validation error", errors: validationResult.error.format() });
      }
      const { selectedText, commentText } = validationResult.data;
      const comment = await storage.createDocumentComment({
        documentId: req.params.id,
        userId,
        selectedText,
        commentText,
        resolved: false,
      });
      await storage.createAuditLog({
        eventType: 'document_comment_added',
        userId,
        caseId: document.caseId,
        documentId: req.params.id,
        ipAddress: req.ip || req.socket?.remoteAddress,
        metadata: { selectedTextPreview: selectedText.substring(0, 100) },
      });
      res.json(comment);
    } catch (error: any) {
      next(error);
    }
  });

  app.patch("/api/documents/:id/comments/:commentId", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      const caseData = await storage.getCase(document.caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Access denied" });
      }
      const updateSchema = z.object({
        resolved: z.boolean().optional(),
        commentText: z.string().min(1).max(10000).optional(),
      });
      const validationResult = updateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: "Validation error", errors: validationResult.error.format() });
      }
      const updated = await storage.updateDocumentComment(req.params.commentId, validationResult.data);
      if (!updated) {
        return res.status(404).json({ message: "Comment not found" });
      }
      if (validationResult.data.resolved !== undefined) {
        await storage.createAuditLog({
          eventType: validationResult.data.resolved ? 'document_comment_resolved' : 'document_comment_reopened',
          userId,
          caseId: document.caseId,
          documentId: req.params.id,
          ipAddress: req.ip || req.socket?.remoteAddress,
          metadata: { commentId: req.params.commentId },
        });
      }
      res.json(updated);
    } catch (error: any) {
      next(error);
    }
  });

  app.delete("/api/documents/:id/comments/:commentId", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      const caseData = await storage.getCase(document.caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Access denied" });
      }
      await storage.deleteDocumentComment(req.params.commentId);
      res.json({ success: true });
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

      const sharedDocuments = ["client_letter"] as const;
      const unadoptedTypes = await getUnadoptedSharedDocumentTypes(
        req.params.id,
        userId,
        sharedDocuments,
      );
      if (unadoptedTypes.length > 0) {
        return res.status(403).json({
          message: "The selected document must be reviewed and adopted before it can be shared.",
          unadoptedDocumentTypes: unadoptedTypes,
        });
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
        sharedDocuments: [...sharedDocuments],
      });
      
      // Get firm profile for email branding
      const firmProfile = await storage.getFirmProfile();
      
      // Send email with share link (no case/client PII — GDPR / data residency)
      const result = await sendCaseEmail({
        to: recipientEmail,
        shareLinkId: shareLink.id,
        customMessage: customMessage || undefined,
        systemMessage: 'This secure link will expire in 7 days.',
        firmProfile: firmProfile ? {
          firmName: firmProfile.firmName,
          phone: firmProfile.phone || undefined,
          email: firmProfile.email || undefined,
          addressLine1: firmProfile.addressLine1 || undefined,
          addressLine2: firmProfile.addressLine2 || undefined,
          city: firmProfile.city || undefined,
          postcode: firmProfile.postcode || undefined,
          logoUrl: firmProfile.logoUrl || undefined,
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
        sharedDocuments: z.array(z.enum(["attendance_note", "summary", "transcript", "client_letter", "client_care_letter"])).min(1, "Must select at least one document to share").default(["attendance_note"]),
      });
      
      const validationResult = shareLinkRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation error",
          errors: validationResult.error.format()
        });
      }
      
      const { recipientEmail, recipientName, isExternal, organization, expiration, accessLevel, password, clientConsent, smsProtection, smsPhoneNumber, customMessage, sharedDocuments } = validationResult.data;
      
      // Validate SMS phone number if SMS protection is enabled
      let formattedPhoneNumber: string | undefined;
      if (smsProtection) {
        if (!smsPhoneNumber) {
          return res.status(400).json({ 
            message: "Phone number is required when SMS protection is enabled" 
          });
        }
        formattedPhoneNumber = formatUKPhoneNumber(smsPhoneNumber);
        if (!isValidUKPhoneNumber(formattedPhoneNumber)) {
          return res.status(400).json({
            message: "Invalid UK mobile number. Please use a number like 07xxx… or +447xxx…",
          });
        }
      }
      
      // Get case data (verify user has access)
      const caseData = await storage.getCase(req.params.id, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }

      // L2: Block share link creation if case is under litigation hold
      if (caseData.litigationHold) {
        return res.status(403).json({
          message: "Share links cannot be created while a litigation hold is active on this case",
        });
      }

      const unadoptedTypes = await getUnadoptedSharedDocumentTypes(
        req.params.id,
        userId,
        sharedDocuments,
      );
      if (unadoptedTypes.length > 0) {
        await logAuditEvent(userId, "case_updated", {
          caseId: req.params.id,
          metadata: {
            action: "share_blocked_unadopted_document",
            unadoptedDocumentTypes: unadoptedTypes,
          },
          severity: "warning",
          req,
        });
        return res.status(403).json({
          message: "Every selected document must be reviewed and adopted before it can be shared.",
          unadoptedDocumentTypes: unadoptedTypes,
        });
      }

      // For external sharing on client matters, verify server-side consent from database
      if (isExternal && isClientMatterKind((caseData as { matterKind?: string }).matterKind)) {
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
      
      // Hash password if provided (trim so create/verify stay consistent on mobile)
      let hashedPassword: string | undefined;
      const trimmedPassword = password?.trim();
      if (trimmedPassword) {
        const saltRounds = 10;
        hashedPassword = await bcrypt.hash(trimmedPassword, saltRounds);
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
        sharedDocuments,
      });
      
      // Auto-mark case as completed (actioned) when shared with client
      await storage.updateCase(req.params.id, { status: "completed" }, userId);
      
      // Get firm profile for email branding
      const firmProfile = await storage.getFirmProfile();
      
      // Send email with share link (no case/client/matter PII — GDPR / data residency)
      const expirationLabel =
        expiration === '24hours' ? '24 hours'
        : expiration === '7days' ? '7 days'
        : expiration === '30days' ? '30 days'
        : 'the configured period';
      const systemMessage = [
        `You have been granted ${accessLevel} access to secure documents.`,
        `This link will expire in ${expirationLabel}.`,
        password ? 'A password is required to access the documents.' : '',
        smsProtection ? 'SMS verification is required to access the documents.' : '',
      ].filter(Boolean).join(' ');

      const result = await sendCaseEmail({
        to: recipientEmail,
        shareLinkId: shareLink.id,
        customMessage: customMessage || undefined,
        systemMessage,
        firmProfile: firmProfile ? {
          firmName: firmProfile.firmName,
          phone: firmProfile.phone || undefined,
          email: firmProfile.email || undefined,
          addressLine1: firmProfile.addressLine1 || undefined,
          addressLine2: firmProfile.addressLine2 || undefined,
          city: firmProfile.city || undefined,
          postcode: firmProfile.postcode || undefined,
          logoUrl: firmProfile.logoUrl || undefined,
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
      
      // Track document versions shared with client
      const allCaseDocuments = await storage.getActiveDocumentsByCase(req.params.id, userId);
      for (const doc of allCaseDocuments) {
        if (sharedDocuments.some((sharedType) => documentMatchesSharedType(doc.type, sharedType))) {
          await storage.createClientVersionTracking({
            documentId: doc.id,
            sentToClient: true,
            sentAt: new Date(),
            sentBy: userId,
            sentMethod: smsProtection ? 'sms_2fa' : 'share_link',
            amendmentReason: null,
            versionChangeWarned: false,
          });
        }
      }
      
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

  app.post("/api/audio", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertAudioRecordingSchema.parse(req.body);
      
      const caseData = await storage.getCase(validatedData.caseId, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // GDPR Compliance: 7-day retention window (expiresAt)
      // UK GDPR allows retention "as long as necessary" for processing purpose
      // 7 days ensures reliable AI processing even with API failures/retries
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      const audioRecording = await storage.createAudioRecording({
        caseId: validatedData.caseId,
        meetingSessionId: validatedData.meetingSessionId ?? undefined,
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
    upload.fields([
      { name: "audioFile", maxCount: 1 },
      { name: "consentSegment", maxCount: 1 },
    ]),
    handleMulterError,
    async (req: any, res: Response, next: NextFunction) => {
      try {
        const userId = req.user.claims.sub;
        const audioId = req.params.id;
        const files = req.files as { audioFile?: Express.Multer.File[]; consentSegment?: Express.Multer.File[] } | undefined;
        const audioFile = files?.audioFile?.[0];
        const consentSegmentFile = files?.consentSegment?.[0];
        
        // Validate multipart upload
        if (!audioFile) {
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
        const audioBuffer = audioFile.buffer;
        
        console.log(`Received audio file: size: ${audioBuffer.length} bytes, type: ${audioFile.mimetype}`);

        // Upload to Backblaze B2 using S3 SDK
        const objectStorageService = new ObjectStorageService();
        
        // Generate unique object ID with proper path mapping
        const { id, key, dbPath } = objectStorageService.createPrivateObjectId();
        
        console.log(`Uploading audio to Backblaze B2: ${key} (DB path: ${dbPath})`);
        
        // Upload to S3-compatible storage (Backblaze B2)
        await objectStorageService.uploadFile(key, audioBuffer, audioFile.mimetype);
        
        console.log(`Audio uploaded successfully to ${key}`);
        
        // Store the object path for database (standardized format: /objects/{uuid})
        const objectPath = dbPath;

        let consentSegmentPath: string | undefined;
        let consentDurationSeconds: number | undefined;
        const parsedConsentDuration = req.body.consentDurationSeconds
          ? parseFloat(req.body.consentDurationSeconds)
          : NaN;

        if (consentSegmentFile?.buffer?.length) {
          try {
            const { preserveConsentSegmentFromBuffer } = await import("./services/consentSegmentService");
            const preserved = await preserveConsentSegmentFromBuffer({
              audioBuffer: consentSegmentFile.buffer,
              mimeType: consentSegmentFile.mimetype || audioFile.mimetype,
              consentDurationSeconds: Number.isFinite(parsedConsentDuration)
                ? parsedConsentDuration
                : Math.min(parseFloat(req.body.duration) || 30, 120),
            });
            consentSegmentPath = preserved.consentSegmentPath;
            consentDurationSeconds = preserved.consentDurationSeconds;
          } catch (consentError) {
            console.error("Failed to preserve uploaded consent segment:", consentError);
          }
        } else if (Number.isFinite(parsedConsentDuration) && parsedConsentDuration > 0) {
          try {
            const { preserveConsentSegmentFromFullAudio } = await import("./services/consentSegmentService");
            const preserved = await preserveConsentSegmentFromFullAudio({
              audioBuffer,
              mimeType: audioFile.mimetype,
              consentDurationSeconds: parsedConsentDuration,
            });
            if (preserved) {
              consentSegmentPath = preserved.consentSegmentPath;
              consentDurationSeconds = preserved.consentDurationSeconds;
            }
          } catch (consentError) {
            console.error("Failed to extract consent segment from uploaded audio:", consentError);
          }
        }

        // Update audio record with file path, duration, and MIME type
        const updated = await storage.updateAudioRecording(audioId, {
          filePath: objectPath,
          mimeType: audioFile.mimetype,
          duration: parseFloat(req.body.duration),
          ...(consentSegmentPath
            ? { consentSegmentPath, consentDurationSeconds }
            : {}),
        });

        await logAuditEvent(userId, "audio_uploaded", {
          caseId: audioRecording.caseId,
          audioRecordingId: audioId,
          req,
          metadata: {
            action: "upload",
            consentSegmentPreserved: !!consentSegmentPath,
          },
        });

        const holdResult = await applyObjectLegalHoldForNewRecording({
          caseId: audioRecording.caseId,
          audioRecordingId: audioId,
          filePath: objectPath,
          consentSegmentPath,
          userId,
          req,
        });
        const response: Record<string, unknown> = { ...(updated ?? {}) };
        if (holdResult) {
          const { objectLock, warning } = buildObjectLockResponse(holdResult);
          response.objectLock = objectLock;
          if (warning) {
            response.warning = warning;
          }
        }

        res.json(response);
      } catch (error: any) {
        console.error('Audio upload error:', error);
        next(error);
      }
    }
  );

  // NOTE: Legacy PUT /api/audio/:id route removed - replaced by POST /api/audio/:id/upload multipart

  // ============================================
  // CHUNKED UPLOAD ROUTES (10-second incremental uploads)
  // ============================================

  // Create a new chunked upload session
  app.post("/api/audio/chunk-session", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { mimeType, caseId } = req.body;

      if (!mimeType) {
        return res.status(400).json({ message: "mimeType is required" });
      }

      const sessionId = await chunkedUploadService.createSession(userId, mimeType, caseId);
      
      res.json({ 
        sessionId,
        message: "Chunked upload session created",
      });
    } catch (error: any) {
      next(error);
    }
  });

  // Get incomplete recording sessions for recovery
  app.get("/api/audio/incomplete-sessions", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const sessions = await chunkedUploadService.getIncompleteSessions(userId);
      
      // Enrich with case info if available
      const enrichedSessions = await Promise.all(
        sessions.map(async (session) => {
          let caseName = null;
          let clientName = null;
          if (session.caseId) {
            const caseData = await storage.getCase(session.caseId, userId);
            if (caseData) {
              caseName = caseData.title;
              clientName = caseData.clientName;
            }
          }
          return {
            ...session,
            caseName,
            clientName,
          };
        })
      );
      
      res.json(enrichedSessions);
    } catch (error: any) {
      next(error);
    }
  });

  // Whether durable chunks for an incomplete session are contiguous (auto-recoverable)
  app.get("/api/audio/incomplete-sessions/:sessionId/recoverability", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;
      const result = await chunkedUploadService.getRecoverability(sessionId, userId);
      res.json(result);
    } catch (error: any) {
      next(error);
    }
  });

  // Upload a chunk to an existing session
  app.post("/api/audio/chunk-session/:sessionId/chunk",
    isAuthenticated,
    audioChunkLimiter,
    upload.single('chunk'),
    handleMulterError,
    async (req: any, res, next) => {
      try {
        const userId = req.user.claims.sub;
        const { sessionId } = req.params;
        const chunkNumber = parseInt(req.body.chunkNumber, 10);

        if (!req.file) {
          return res.status(400).json({ message: "Chunk data is required" });
        }

        if (isNaN(chunkNumber) || chunkNumber < 0) {
          return res.status(400).json({ message: "Valid chunkNumber is required" });
        }

        const result = await chunkedUploadService.uploadChunk(
          sessionId,
          userId,
          chunkNumber,
          req.file.buffer
        );

        res.json({
          success: true,
          chunkNumber,
          chunksReceived: result.received,
          bytesStored: result.bytesStored,
        });
      } catch (error: any) {
        if (error.message.includes("not found") || error.message.includes("Unauthorized")) {
          return res.status(404).json({ message: error.message });
        }
        next(error);
      }
    }
  );

  // Finalize a chunked upload session and assemble the audio file
  app.post("/api/audio/chunk-session/:sessionId/finalize", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;
      const { audioRecordingId, duration } = req.body;

      if (!audioRecordingId) {
        return res.status(400).json({ message: "audioRecordingId is required" });
      }

      // Verify the audio recording exists and user owns it
      const audioRecording = await storage.getAudioRecording(audioRecordingId);
      if (!audioRecording) {
        return res.status(404).json({ message: "Audio recording not found" });
      }

      const caseData = await storage.getCase(audioRecording.caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Finalize the session (combines chunks and uploads to storage)
      const result = await chunkedUploadService.finalizeSession(
        sessionId,
        userId,
        audioRecordingId
      );

      // Update the audio recording with the file path and consent duration
      const updated = await storage.updateAudioRecording(audioRecordingId, {
        filePath: result.filePath,
        duration: duration ? parseFloat(duration) : undefined,
        consentSegmentPath: result.consentSegmentPath,
        consentDurationSeconds: result.consentDurationSeconds,
      });

      await logAuditEvent(userId, "audio_uploaded", {
        caseId: audioRecording.caseId,
        audioRecordingId: audioRecordingId,
        req,
        metadata: {
          action: "chunked_upload_finalized",
          totalChunks: result.totalChunks,
          totalBytes: result.totalBytes,
          consentSegmentPreserved: !!result.consentSegmentPath,
        },
      });

      const holdResult = await applyObjectLegalHoldForNewRecording({
        caseId: audioRecording.caseId,
        audioRecordingId: audioRecordingId,
        filePath: result.filePath,
        consentSegmentPath: result.consentSegmentPath,
        userId,
        req,
      });
      const holdResponse = holdResult ? buildObjectLockResponse(holdResult) : null;

      // Send recording confirmation email asynchronously (only if user preference enabled)
      (async () => {
        try {
          const user = await storage.getUser(userId);
          const userPreferences = await storage.getUserPreferences(userId);
          
          // Check if user has enabled recording confirmation emails (default: off)
          if (!userPreferences?.sendRecordingConfirmationEmails) {
            console.log(`[EMAIL] Recording confirmation skipped - user preference disabled for case ${caseData.id}`);
            return;
          }
          
          if (user?.email) {
            const firmProfile = await storage.getFirmProfile(userId);
            const durationSeconds = duration ? parseFloat(duration) : 0;
            const minutes = Math.floor(durationSeconds / 60);
            const seconds = Math.floor(durationSeconds % 60);
            const recordingDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            await sendRecordingConfirmationEmail({
              to: user.email,
              solicitorName: user.firstName || user.email.split('@')[0],
              caseTitle: caseData.title,
              clientName: caseData.clientName,
              matterReference: caseData.matterReference || undefined,
              recordingDuration,
              recordedAt: new Date(),
              caseId: caseData.id,
              documentsGenerated: ['Attendance Note', 'Case Summary', 'Full Transcript'],
              firmProfile: firmProfile ? {
                firmName: firmProfile.firmName,
                phone: firmProfile.phone || undefined,
                email: firmProfile.email || undefined,
              } : undefined,
            });

            console.log(`[EMAIL] Recording confirmation sent for case ${caseData.id}`);
          }
        } catch (emailError) {
          console.error('[EMAIL] Failed to send recording confirmation:', emailError);
        }
      })();

      res.json({
        success: true,
        audioRecording: updated,
        totalChunks: result.totalChunks,
        totalBytes: result.totalBytes,
        consentSegmentPreserved: !!result.consentSegmentPath,
        ...(holdResponse?.objectLock ? { objectLock: holdResponse.objectLock } : {}),
        ...(holdResponse?.warning ? { warning: holdResponse.warning } : {}),
      });
    } catch (error: any) {
      if (error.message.includes("not found") || error.message.includes("Unauthorized")) {
        return res.status(404).json({ message: error.message });
      }
      next(error);
    }
  });

  // Get status of a chunked upload session
  app.get("/api/audio/chunk-session/:sessionId/status", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;

      const status = chunkedUploadService.getSessionStatus(sessionId, userId);
      res.json(status);
    } catch (error: any) {
      next(error);
    }
  });

  // Cancel a chunked upload session
  app.delete("/api/audio/chunk-session/:sessionId", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;

      const cancelled = await chunkedUploadService.cancelSession(sessionId, userId);
      
      if (!cancelled) {
        return res.status(404).json({ message: "Session not found or already finalized" });
      }

      res.json({ success: true, message: "Session cancelled" });
    } catch (error: any) {
      next(error);
    }
  });

  // Get recovery status for a chunked upload session (for resuming after connection issues)
  app.get("/api/audio/chunk-session/:sessionId/recover", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;

      const status = chunkedUploadService.getSessionStatus(sessionId, userId);
      
      if (!status) {
        return res.status(404).json({ 
          canRecover: false,
          message: "Session not found, expired, or already finalized" 
        });
      }

      res.json({
        canRecover: true,
        ...status,
      });
    } catch (error: any) {
      next(error);
    }
  });

  // Upload a recovery chunk directly to durable storage (for sessions expired from memory after server restart)
  app.post("/api/audio/recovery-chunk/:sessionId",
    isAuthenticated,
    audioChunkLimiter,
    upload.single('chunk'),
    handleMulterError,
    async (req: any, res, next) => {
      try {
        const userId = req.user.claims.sub;
        const { sessionId } = req.params;
        const chunkNumber = parseInt(req.body.chunkNumber, 10);

        if (!req.file) {
          return res.status(400).json({ message: "Chunk data is required" });
        }

        if (isNaN(chunkNumber) || chunkNumber < 0) {
          return res.status(400).json({ message: "Valid chunkNumber is required" });
        }

        const result = await chunkedUploadService.uploadRecoveryChunk(
          sessionId,
          userId,
          chunkNumber,
          req.file.buffer
        );

        res.json({
          success: true,
          chunkNumber,
          bytesStored: result.bytesStored,
        });
      } catch (error: any) {
        console.error('Recovery chunk upload error:', error);
        next(error);
      }
    }
  );

  // Recover an interrupted recording session - creates a case from saved chunks
  app.post("/api/audio/recover-session/:sessionId", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;

      const result = await chunkedUploadService.recoverSession(sessionId, userId);
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      await logAuditEvent(userId, "recording_recovered", {
        caseId: result.caseId,
        metadata: {
          sessionId,
          audioRecordingId: result.audioRecordingId,
          durationSeconds: result.durationSeconds,
          hasConsent: result.hasConsent,
        },
        severity: "warning",
        req,
      });

      res.json(result);
    } catch (error: any) {
      console.error('Recovery error:', error);
      next(error);
    }
  });

  // Discard an interrupted recording session
  app.delete("/api/audio/recover-session/:sessionId", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;

      const discarded = await chunkedUploadService.discardSession(sessionId, userId);
      
      if (!discarded) {
        return res.status(404).json({ message: "Session not found" });
      }

      res.json({ success: true, message: "Session discarded" });
    } catch (error: any) {
      next(error);
    }
  });

  // Mark consent confirmation timestamp for a recording session
  app.post("/api/audio/chunk-session/:sessionId/consent", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;

      const result = await chunkedUploadService.markConsentConfirmed(sessionId, userId);
      
      await logAuditEvent(userId, "consent_timestamp_marked", {
        metadata: {
          sessionId,
          consentChunk: result.consentChunk,
          elapsedSeconds: result.elapsedSeconds,
        },
        severity: "info",
        req,
      });

      res.json(result);
    } catch (error: any) {
      if (error.message.includes("not found") || error.message.includes("Unauthorized")) {
        return res.status(404).json({ message: error.message });
      }
      next(error);
    }
  });

  // ============================================
  // END CHUNKED UPLOAD ROUTES
  // ============================================

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
        if (audioRecording.filePath) {
          try {
            await deleteCaseAudioRecording({
              caseId: audioRecording.caseId,
              audioRecordingId: audioRecording.id,
              filePath: audioRecording.filePath,
              trigger: "lazy_by_case",
              userId,
              expiresAt: audioRecording.expiresAt,
              req,
            });
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
            if (deleteError instanceof LitigationHoldDeletionBlockedError) {
              return res.json({
                ...audioRecording,
                preservedByLitigationHold: true,
              });
            }
            console.error("Failed to delete expired audio:", deleteError);
          }
        }

        return res.status(410).json({ message: "Audio recording has expired (7-day retention policy)" });
      }
      
      res.json(audioRecording);
    } catch (error: any) {
      next(error);
    }
  });

  // Get audio by meeting session
  app.get("/api/audio/by-session/:sessionId", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;
      const session = await storage.getMeetingSession(sessionId);
      if (!session) return res.status(404).json({ message: "Session not found" });
      const caseRecord = await storage.getCase(session.caseId, userId);
      if (!caseRecord) return res.status(404).json({ message: "Session not found" });
      const audioRecording = await storage.getAudioRecordingBySession(sessionId);
      if (!audioRecording) return res.status(404).json({ message: "Audio recording not found" });
      res.json(audioRecording);
    } catch (error: any) {
      next(error);
    }
  });

  // Stream audio recording file directly (supports all storage path formats including recall imports)
  app.get("/api/audio/:audioId/stream", isAuthenticated, async (req: any, res, next) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const userId = req.user.claims.sub;
      const { audioId } = req.params;

      const audioRecording = await storage.getAudioRecording(audioId);
      if (!audioRecording) {
        return res.status(404).json({ message: "Audio recording not found" });
      }

      // Verify ownership via the case
      const caseRecord = await storage.getCase(audioRecording.caseId, userId);
      if (!caseRecord) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (audioRecording.deletedAt) {
        return res.status(410).json({ message: "Recording securely deleted" });
      }

      if (!audioRecording.filePath) {
        return res.status(404).json({ message: "Audio file not available" });
      }

      if (new Date() > audioRecording.expiresAt) {
        if (!audioRecording.deletedAt && audioRecording.filePath) {
          try {
            await deleteCaseAudioRecording({
              caseId: audioRecording.caseId,
              audioRecordingId: audioRecording.id,
              filePath: audioRecording.filePath,
              trigger: "lazy_stream",
              userId,
              expiresAt: audioRecording.expiresAt,
              req,
            });
            await storage.updateAudioRecording(audioRecording.id, { deletedAt: new Date() });
            return res.status(410).json({ message: "Audio recording has expired (retention policy)" });
          } catch (deleteError) {
            if (deleteError instanceof LitigationHoldDeletionBlockedError) {
              // Hold active — preserve and stream despite expiry
            } else {
              console.error("Failed to delete expired audio:", deleteError);
              return res.status(410).json({ message: "Audio recording has expired (retention policy)" });
            }
          }
        } else {
          return res.status(410).json({ message: "Audio recording has expired (retention policy)" });
        }
      }

      await logPersonnelMatterAccess({
        userId,
        caseId: audioRecording.caseId,
        resource: "audio",
        audioRecordingId: audioId,
        req,
      });

      await objectStorageService.downloadObject(audioRecording.filePath, res);
    } catch (error: any) {
      next(error);
    }
  });

  // Stream consent segment audio (preserved indefinitely for compliance)
  app.get("/api/audio/:audioId/consent-segment", isAuthenticated, async (req: any, res, next) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const userId = req.user.claims.sub;
      const { audioId } = req.params;

      const audioRecording = await storage.getAudioRecording(audioId);
      if (!audioRecording) {
        return res.status(404).json({ message: "Audio recording not found" });
      }

      const caseRecord = await storage.getCase(audioRecording.caseId, userId);
      if (!caseRecord) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!audioRecording.consentSegmentPath) {
        return res.status(404).json({ message: "No consent segment available for this recording" });
      }

      if (req.method === "HEAD") {
        return res.status(200).end();
      }

      await logAuditEvent(userId, "consent_segment_accessed", {
        audioRecordingId: audioId,
        caseId: audioRecording.caseId,
        metadata: {
          consentSegmentPath: audioRecording.consentSegmentPath,
        },
        severity: "info",
        req,
      });
      await logPersonnelMatterAccess({
        userId,
        caseId: audioRecording.caseId,
        resource: "consent",
        audioRecordingId: audioId,
        req,
      });

      await objectStorageService.downloadObject(audioRecording.consentSegmentPath, res);
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
        solicitorId: userId,
      });

      const { recordConsentEvent } = await import("./services/recordConsentEvent");
      const source =
        typeof req.body?.source === "string" && req.body.source.trim()
          ? req.body.source.trim()
          : "api_consent";

      const result = await recordConsentEvent({
        caseId: validatedData.caseId,
        audioRecordingId: validatedData.audioRecordingId ?? null,
        solicitorId: userId,
        consentGiven: validatedData.consentGiven,
        disclaimerScriptVersion: validatedData.disclaimerScriptVersion,
        disclaimerWordingText: validatedData.disclaimerWordingText ?? null,
        consentModality: validatedData.consentModality,
        lawfulBasis: validatedData.lawfulBasis ?? null,
        recordingPurpose: validatedData.recordingPurpose ?? null,
        source,
        req,
      });

      res.json(result.consentLog);
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
      await logPersonnelMatterAccess({
        userId,
        caseId,
        resource: "consent",
        req,
        metadata: { consentLogCount: consentLogs.length },
      });
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

      console.log('Starting quick note transcription via AssemblyAI (EU)');
      const assemblyAI = new AssemblyAIService();
      const text = await assemblyAI.transcribeBuffer(req.file.buffer);

      console.log('Quick note transcription completed');
      res.json({ text });
    } catch (error: any) {
      console.error('Quick note transcription error:', error);
      next(error);
    }
  });

  // Short UK English voice reply via Amazon Polly (EU). Privileged text stays in AWS EU.
  app.post("/api/voice/tts", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const text = typeof req.body?.text === "string" ? req.body.text : "";
      if (!text.trim()) {
        return res.status(400).json({ message: "text is required" });
      }
      if (text.length > VOICE_TTS_MAX_CHARS + 200) {
        return res.status(400).json({ message: "text is too long" });
      }

      const result = await synthesizeVoiceReply(text);

      await logAuditEvent(userId, "voice_tts", {
        metadata: {
          charCount: result.charCount,
          voiceId: result.voiceId,
          engine: result.engine,
        },
      });

      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Voice-TTS-Provider", `polly-${result.engine}`);
      res.setHeader("X-Voice-TTS-Voice", result.voiceId);
      res.send(result.audio);
    } catch (error: any) {
      if (error?.status === 400 || error?.status === 503) {
        return res.status(error.status).json({ message: error.message || "TTS unavailable" });
      }
      console.error("Voice TTS error:", error);
      next(error);
    }
  });

  // Upload/paste a transcript and derive attendance note + client letter (no audio)
  app.post("/api/cases/:id/transcript-imports", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;

      const { createTranscriptImportRequestSchema } = await import("@shared/schema");
      const parsed = createTranscriptImportRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const { createTranscriptImport, TranscriptImportError } = await import(
        "./services/transcriptImportService"
      );

      try {
        const result = await createTranscriptImport({
          storage,
          caseId,
          userId,
          body: parsed.data,
        });

        res.status(202).json({
          message: "Transcript accepted for derivation",
          importId: result.importRecord.id,
          jobId: result.jobId,
          sessionId: result.importRecord.meetingSessionId,
          transcriptId: result.importRecord.transcriptId,
          status: "processing",
        });
      } catch (error: any) {
        if (error instanceof TranscriptImportError) {
          return res.status(error.statusCode).json({
            message: error.message,
            code: error.code,
          });
        }
        throw error;
      }
    } catch (error: any) {
      console.error("Transcript import error:", error);
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
      
      // GDPR: sealed client consent required for client matters only
      const { assertSealedConsent, SealedConsentError } = await import("./services/assertSealedConsent");
      const sessionId = req.body.sessionId;

      let audioRecording;
      if (sessionId) {
        audioRecording = await storage.getAudioRecordingBySession(sessionId);
        if (audioRecording && audioRecording.caseId !== caseId) {
          return res.status(403).json({ message: "Session does not belong to this case" });
        }
      } else {
        audioRecording = await storage.getAudioRecordingByCase(caseId, userId);
      }

      if (requiresSealedConsentForProcessing(
        (caseData as { matterKind?: string }).matterKind,
        (caseData as { hasExternalAttendees?: boolean }).hasExternalAttendees,
      )) {
        try {
          await assertSealedConsent(caseId, userId, audioRecording?.id);
        } catch (error: any) {
          if (error instanceof SealedConsentError) {
            await logAuditEvent(userId, "access_control_violation", {
              caseId,
              req,
              metadata: {
                action: "process_without_sealed_consent",
                reason: error.reason,
              },
              severity: "critical",
            });
            return res.status(403).json({ message: error.message });
          }
          throw error;
        }
      }

      if (!audioRecording || !audioRecording.filePath) {
        return res.status(404).json({ message: "No audio recording found for this case" });
      }
      
      const effectiveSessionId = sessionId || audioRecording.meetingSessionId;

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

      if (effectiveSessionId) {
        await storage.updateMeetingSession(effectiveSessionId, { status: 'processing' });
      }
      
      // Queue AI processing job
      const { jobQueue } = await import('./services/jobQueue');
      const jobId = await jobQueue.addJob('ai-processing', { caseId, userId, sessionId: effectiveSessionId });
      
      await logAuditEvent(userId, "ai_processing_started", {
        caseId,
        req,
        metadata: { action: "queue_processing", jobId },
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
            status: "failed",
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
      
      // GDPR: sealed client consent required for client matters only
      const { assertSealedConsent, SealedConsentError } = await import("./services/assertSealedConsent");
      const retrySessionId = req.body.sessionId;

      let audioRecording;
      if (retrySessionId) {
        audioRecording = await storage.getAudioRecordingBySession(retrySessionId);
        if (audioRecording && audioRecording.caseId !== caseId) {
          return res.status(403).json({ message: "Session does not belong to this case" });
        }
      } else {
        audioRecording = await storage.getAudioRecordingByCase(caseId, userId);
      }

      if (requiresSealedConsentForProcessing(
        (caseData as { matterKind?: string }).matterKind,
        (caseData as { hasExternalAttendees?: boolean }).hasExternalAttendees,
      )) {
        try {
          await assertSealedConsent(caseId, userId, audioRecording?.id);
        } catch (error: any) {
          if (error instanceof SealedConsentError) {
            return res.status(403).json({ message: error.message });
          }
          throw error;
        }
      }

      if (!audioRecording || !audioRecording.filePath) {
        return res.status(404).json({ message: "No audio recording found" });
      }
      const effectiveRetrySessionId = retrySessionId || audioRecording.meetingSessionId;
      
      // Reset processing metadata and update status
      await storage.updateCase(caseId, { 
        status: "processing",
        aiProcessingMetadata: {
          status: 'processing',
          progress: 0,
          currentStep: 'Retrying processing...',
          error: undefined,
        }
      }, userId);
      
      // Queue AI processing job
      const { jobQueue } = await import('./services/jobQueue');
      const jobId = await jobQueue.addJob('ai-processing', { caseId, userId, sessionId: effectiveRetrySessionId });
      
      await logAuditEvent(userId, "ai_processing_started", {
        caseId,
        req,
        metadata: { action: "retry_processing", jobId, retry: true },
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
      
      let transcript = await storage.getTranscriptByCase(caseId, userId);
      if (!transcript) {
        return res.status(404).json({ message: "No transcript found" });
      }

      transcript = await repairStoredRtfTranscript(transcript, userId);
      transcript = await repairMissingSpeakerUtterances(transcript, userId);

      // Lazy commit: auto-commit any pending redactions whose 30-minute window has expired
      const pendingRedactions = ((transcript.redactions || []) as any[]);
      const hasExpiredPending = pendingRedactions.some((r: any) =>
        r.status === 'pending' && r.pendingUntil && new Date(r.pendingUntil) <= new Date()
      );

      let finalTranscript = transcript;
      if (hasExpiredPending) {
        const committed = await storage.commitTranscriptRedactions(transcript.id, userId);
        if (committed) finalTranscript = committed;
      }

      await logAuditEvent(userId, "transcript_viewed_internal", {
        caseId: req.params.id,
        transcriptId: transcript.id,
        metadata: {
          viewedAt: new Date().toISOString(),
        },
      });
      await logPersonnelMatterAccess({
        userId,
        caseId: req.params.id,
        resource: "transcript",
        transcriptId: transcript.id,
        req,
      });

      // Mark externally uploaded transcripts (paste/file) vs AssemblyAI audio transcription
      let origin: "external_upload" | "audio_transcription" = "audio_transcription";
      let importMeta: { source?: string; originalFilename?: string | null } | undefined;
      try {
        const { transcriptImports } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");
        const rows = await db
          .select({
            source: transcriptImports.source,
            originalFilename: transcriptImports.originalFilename,
          })
          .from(transcriptImports)
          .where(eq(transcriptImports.transcriptId, finalTranscript.id))
          .limit(1);
        if (rows[0]) {
          origin = "external_upload";
          importMeta = {
            source: rows[0].source,
            originalFilename: rows[0].originalFilename,
          };
        } else if (finalTranscript.meetingSessionId) {
          const bySession = await db
            .select({
              source: transcriptImports.source,
              originalFilename: transcriptImports.originalFilename,
            })
            .from(transcriptImports)
            .where(eq(transcriptImports.meetingSessionId, finalTranscript.meetingSessionId))
            .limit(1);
          if (bySession[0]) {
            origin = "external_upload";
            importMeta = {
              source: bySession[0].source,
              originalFilename: bySession[0].originalFilename,
            };
          }
        }
      } catch (originErr) {
        console.warn("[Transcript] Could not resolve transcript origin:", originErr);
      }

      res.json({
        ...sanitizeTranscriptForResponse(finalTranscript),
        origin,
        ...(importMeta ? { importSource: importMeta.source, originalFilename: importMeta.originalFilename } : {}),
      });
    } catch (error: any) {
      next(error);
    }
  });

  // Grounded Q&A over this matter's transcript + notes (EU Bedrock). Not legal advice.
  app.post("/api/cases/:id/ask", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";

      if (!question || question.length < 3) {
        return res.status(400).json({ message: "question is required" });
      }
      if (question.length > 1000) {
        return res.status(400).json({ message: "question is too long" });
      }

      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const result = await askMatterQuestion({
        storage,
        caseId,
        userId,
        question,
      });

      await logAuditEvent(userId, "matter_ask", {
        caseId,
        metadata: {
          questionPreview: question.slice(0, 120),
          refused: result.refused,
          citationCount: result.citations.length,
        },
      });

      res.json(result);
    } catch (error: any) {
      if (error?.status === 403) {
        return res.status(403).json({ message: "Not authorized" });
      }
      console.error("Matter ask error:", error);
      next(error);
    }
  });

  // Compare meeting transcript vs attendance note (omissions / mismatches). Not legal advice.
  app.post("/api/cases/:id/compare-note", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;

      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const result = await compareMatterNote({
        storage,
        caseId,
        userId,
      });

      await logAuditEvent(userId, "matter_compare_note", {
        caseId,
        metadata: {
          refused: result.refused,
          findingCount: result.findings.length,
          citationCount: result.citations.length,
          hasTranscript: result.hasTranscript,
          hasNote: result.hasNote,
        },
      });

      res.json(result);
    } catch (error: any) {
      if (error?.status === 403) {
        return res.status(403).json({ message: "Not authorized" });
      }
      console.error("Matter compare-note error:", error);
      next(error);
    }
  });

  // Add redaction to transcript
  app.post("/api/cases/:id/transcript/redact", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const { start, end, reasonType, reasonNotes, textStart, textEnd, selectedText } = req.body;

      const VALID_REASON_TYPES = [
        'redaction_gdpr',
        'redaction_privilege',
        'redaction_third_party',
        'redaction_commercially_sensitive',
        'redaction_court_order',
        'redaction_without_prejudice',
        'redaction_nda',
        'redaction_ubo',
        'redaction_regulatory_privilege',
        'redaction_foreign_law_privilege',
      ] as const;

      type RedactionReasonType = typeof VALID_REASON_TYPES[number];

      if (typeof start !== 'number' || typeof end !== 'number') {
        return res.status(400).json({ message: "start and end positions are required" });
      }

      if (!reasonType || !VALID_REASON_TYPES.includes(reasonType as RedactionReasonType)) {
        return res.status(400).json({ 
          message: "reasonType is required and must be one of: redaction_gdpr, redaction_privilege, redaction_third_party, redaction_commercially_sensitive, redaction_court_order, redaction_without_prejudice, redaction_nda, redaction_ubo, redaction_regulatory_privilege, redaction_foreign_law_privilege" 
        });
      }

      if (reasonType === 'redaction_privilege' && (!reasonNotes || !reasonNotes.trim() || reasonNotes.trim().length < 10)) {
        return res.status(400).json({ 
          message: "reasonNotes is required for privilege redactions and must be at least 10 characters describing the privilege basis" 
        });
      }

      if (!selectedText || typeof selectedText !== 'string' || !selectedText.trim()) {
        return res.status(400).json({ message: "selectedText is required — the text being redacted must be provided" });
      }

      if (reasonType === 'redaction_privilege') {
        if (!reasonNotes || typeof reasonNotes !== 'string' || reasonNotes.trim().length < 20) {
          return res.status(400).json({ 
            message: "Privilege redactions require a substantive basis note of at least 20 characters." 
          });
        }
      }

      // Verify ownership
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const transcript = await storage.getTranscriptByCase(caseId, userId);
      if (!transcript) {
        return res.status(404).json({ message: "No transcript found" });
      }

      // Block redaction attempts on matters under litigation hold
      if (caseData.litigationHold) {
        return res.status(423).json({ 
          message: "This matter is under litigation hold. All records are preserved pending court disclosure assessment. Contact your COLP to release the hold before modifying redactions.",
          litigationHold: true,
          litigationHoldReason: caseData.litigationHoldReason || null,
          litigationHoldAppliedAt: caseData.litigationHoldAppliedAt || null,
        });
      }
      
      // Get current redactions or initialize empty array
      const currentRedactions = (transcript.redactions || []) as any[];
      
      // Check if this exact redaction already exists
      const isPartialRedaction = typeof textStart === 'number' && typeof textEnd === 'number';
      const alreadyRedacted = currentRedactions.some((r: any) => {
        if (isPartialRedaction) {
          // For partial redactions, check all fields match
          return r.start === start && r.end === end && r.textStart === textStart && r.textEnd === textEnd;
        } else {
          // For full redactions, check only start/end and that it's not a partial redaction
          return r.start === start && r.end === end && r.textStart === undefined && r.textEnd === undefined;
        }
      });
      
      if (alreadyRedacted) {
        return res.status(400).json({ message: "This text is already redacted" });
      }

      const overlaps = currentRedactions.some((r: any) => {
        return r.start < end && r.end > start;
      });

      if (overlaps) {
        return res.status(400).json({ 
          message: "This selection overlaps with an existing redaction. Please adjust your selection." 
        });
      }

      const pendingUntil = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours from now

      const newRedaction: any = {
        id: crypto.randomUUID(),
        start,
        end,
        reasonType: reasonType as RedactionReasonType,
        reasonNotes: reasonNotes?.trim() || null,
        selectedText: selectedText.trim(), // always stored during pending phase
        redactedBy: userId,
        timestamp: new Date().toISOString(),
        status: 'pending',
        pendingUntil: pendingUntil.toISOString(),
      };

      // Preserve partial redaction fields if present
      if (isPartialRedaction) {
        newRedaction.textStart = textStart;
        newRedaction.textEnd = textEnd;
      }
      
      const updatedRedactions = [...currentRedactions, newRedaction];
      
      const updatedTranscript = await storage.updateTranscript(
        transcript.id,
        { redactions: updatedRedactions },
        userId
      );
      
      // Log audit event
      await logAuditEvent(userId, "transcript_redaction_pending", {
        caseId,
        transcriptId: transcript.id,
        metadata: {
          action: 'redaction_pending',
          redactionId: newRedaction.id,
          start,
          end,
          reasonType,
          reasonNotes: reasonNotes?.trim() || null,
          isPartial: isPartialRedaction,
          pendingUntil: pendingUntil.toISOString(),
          // Do not log selectedText in audit trail — it contains the sensitive content
        },
        req,
      });
      
      // Strip selectedText from all redaction markers before returning to client
      // selectedText must never leave the server in API responses
      const safeTranscript = {
        ...updatedTranscript,
        redactions: ((updatedTranscript?.redactions || []) as any[]).map((r: any) => {
          const { selectedText: _st, ...safeRedaction } = r;
          return safeRedaction;
        }),
      };

      res.json(safeTranscript);
    } catch (error: any) {
      next(error);
    }
  });

  // Remove redaction from transcript
  app.delete("/api/cases/:id/transcript/redact", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const { start, end, textStart, textEnd } = req.body;
      
      if (typeof start !== 'number' || typeof end !== 'number') {
        return res.status(400).json({ message: "Invalid redaction data" });
      }
      
      // Verify ownership
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const transcript = await storage.getTranscriptByCase(caseId, userId);
      if (!transcript) {
        return res.status(404).json({ message: "No transcript found" });
      }

      // Block redaction attempts on matters under litigation hold
      if (caseData.litigationHold) {
        return res.status(423).json({ 
          message: "This matter is under litigation hold. All records are preserved pending court disclosure assessment. Contact your COLP to release the hold before modifying redactions.",
          litigationHold: true,
          litigationHoldReason: caseData.litigationHoldReason || null,
          litigationHoldAppliedAt: caseData.litigationHoldAppliedAt || null,
        });
      }
      
      // Get current redactions
      const currentRedactions = (transcript.redactions || []) as any[];
      
      // Find the redaction first to check its status before attempting removal
      const isPartialRemoval = typeof textStart === 'number' && typeof textEnd === 'number';
      const targetRedaction = currentRedactions.find((r: any) => {
        if (isPartialRemoval) {
          return r.start === start && r.end === end && r.textStart === textStart && r.textEnd === textEnd;
        } else {
          return r.start === start && r.end === end && r.textStart === undefined && r.textEnd === undefined;
        }
      });

      if (!targetRedaction) {
        return res.status(404).json({ message: "Redaction not found" });
      }

      if (targetRedaction.status === 'committed') {
        return res.status(403).json({ 
          message: "This redaction has been committed and cannot be undone. Contact your supervisor if an amendment note is required." 
        });
      }

      if (targetRedaction.pendingUntil && new Date(targetRedaction.pendingUntil) < new Date()) {
        return res.status(403).json({ 
          message: "The 30-minute undo window for this redaction has expired. Contact your supervisor if an amendment note is required." 
        });
      }

      // Find and remove the redaction (supporting both full and partial redactions)
      const updatedRedactions = currentRedactions.filter((r: any) => {
        if (isPartialRemoval) {
          // For partial redactions, match all fields
          return !(r.start === start && r.end === end && r.textStart === textStart && r.textEnd === textEnd);
        } else {
          // For full redactions, match start/end and ensure it's not a partial redaction
          return !(r.start === start && r.end === end && r.textStart === undefined && r.textEnd === undefined);
        }
      });
      
      const updatedTranscript = await storage.updateTranscript(
        transcript.id,
        { redactions: updatedRedactions },
        userId
      );
      
      // Log audit event
      await logAuditEvent(userId, "transcript_redaction_undone", {
        caseId,
        transcriptId: transcript.id,
        metadata: {
          action: 'redaction_undone',
          start,
          end,
          reasonType: targetRedaction.reasonType,
          isPartial: isPartialRemoval,
          textStart: isPartialRemoval ? textStart : undefined,
          textEnd: isPartialRemoval ? textEnd : undefined,
        },
        req,
      });
      
      res.json(updatedTranscript);
    } catch (error: any) {
      next(error);
    }
  });

  // Commit pending redactions — physically rewrites transcript content
  // Call explicitly to commit before 30-minute window, or system auto-commits on expiry
  app.post("/api/cases/:id/transcript/redact/commit", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const { redactionIds } = req.body; // Optional: specific IDs to commit, or all pending if omitted

      // Verify ownership
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const transcript = await storage.getTranscriptByCase(caseId, userId);
      if (!transcript) {
        return res.status(404).json({ message: "No transcript found" });
      }

      // Validate redactionIds if provided
      if (redactionIds !== undefined && !Array.isArray(redactionIds)) {
        return res.status(400).json({ message: "redactionIds must be an array if provided" });
      }

      // Count what will be committed for audit log
      const pendingRedactions = ((transcript.redactions || []) as any[]).filter((r: any) => {
        if (r.status === 'committed') return false;
        if (redactionIds) return redactionIds.includes(r.id);
        return r.status === 'pending';
      });

      if (pendingRedactions.length === 0) {
        return res.status(400).json({ message: "No pending redactions found to commit" });
      }

      const gdprCount = pendingRedactions.filter((r: any) => 
        ['redaction_gdpr', 'redaction_third_party', 'redaction_commercially_sensitive'].includes(r.reasonType)
      ).length;
      const privilegeCount = pendingRedactions.filter((r: any) => 
        r.reasonType === 'redaction_privilege'
      ).length;

      // Commit the redactions
      const updatedTranscript = await storage.commitTranscriptRedactions(
        transcript.id,
        userId,
        redactionIds
      );

      if (!updatedTranscript) {
        return res.status(500).json({ message: "Failed to commit redactions" });
      }

      // Log audit event
      await logAuditEvent(userId, "transcript_redactions_committed", {
        caseId,
        transcriptId: transcript.id,
        metadata: {
          totalCommitted: pendingRedactions.length,
          gdprDeletions: gdprCount,
          privilegePreservations: privilegeCount,
          specificIds: redactionIds || null,
          committedAt: new Date().toISOString(),
        },
        severity: "critical",
        req,
      });

      // Strip privilegedRedactions and selectedText from response
      const safeTranscript = {
        ...updatedTranscript,
        privilegedRedactions: undefined,
        redactions: ((updatedTranscript?.redactions || []) as any[]).map((r: any) => {
          const { selectedText: _st, ...safeRedaction } = r;
          return safeRedaction;
        }),
      };

      res.json({
        success: true,
        transcript: safeTranscript,
        committed: {
          total: pendingRedactions.length,
          gdprDeletions: gdprCount,
          privilegePreservations: privilegeCount,
        },
      });
    } catch (error: any) {
      next(error);
    }
  });

app.post("/api/cases/:id/transcript/privileged-access", isAuthenticated, async (req: any, res, next) => {
  try {
    const userId = req.user.claims.sub;
    const { redactionId, reasonNotes, complianceCode } = req.body;

    // Validate required fields
    if (!redactionId || typeof redactionId !== "string") {
      return res.status(400).json({ message: "redactionId is required" });
    }
    if (!reasonNotes || typeof reasonNotes !== "string" || reasonNotes.trim().length < 20) {
      return res.status(400).json({ message: "reasonNotes is required and must be at least 20 characters" });
    }

    // Verify case ownership
    const caseData = await storage.getCase(req.params.id, userId);
    if (!caseData) return res.status(404).json({ message: "Case not found" });

    const user = await storage.getUser(userId);
    if (!user?.firmId) {
      return res.status(400).json({ message: "No firm associated with your account" });
    }

    const firmProfile = await storage.getFirmProfile(user.firmId);
    if (!firmProfile?.complianceCodeHash) {
      return res.status(403).json({
        message:
          "Privileged content access requires a firm compliance code to be set. Please contact your COLP or managing partner.",
      });
    }

    if (!complianceCode || typeof complianceCode !== "string") {
      return res.status(400).json({ message: "complianceCode is required to access privileged content" });
    }

    const codeValid = await storage.verifyFirmComplianceCode(user.firmId, complianceCode);
    if (!codeValid) {
      await logAuditEvent(userId, "privileged_access_code_failed", {
        caseId: req.params.id,
        metadata: { redactionId, firmId: user.firmId },
        severity: "critical",
      });
      return res.status(403).json({ message: "Incorrect compliance code" });
    }

    // Get transcript
    const transcript = await storage.getTranscriptByCase(req.params.id, userId);
    if (!transcript) return res.status(404).json({ message: "Transcript not found" });

    // Find the requested privileged redaction
    const privilegedRedactions = (transcript.privilegedRedactions || []) as any[];
    const entry = privilegedRedactions.find((r: any) => r.id === redactionId);

    if (!entry) {
      return res.status(404).json({ message: "Privileged redaction not found" });
    }

    // Log access — mandatory audit event
    await logAuditEvent(userId, "transcript_privileged_content_accessed", {
      caseId: req.params.id,
      transcriptId: transcript.id,
      metadata: {
        redactionId,
        reasonNotes: reasonNotes.trim(),
      },
    });

    // Set session flag valid for 10 minutes
    if (req.session) {
      const flagKey = `privileged_access_${req.params.id}_${redactionId}`;
      req.session[flagKey] = Date.now() + 10 * 60 * 1000;
    }

    res.json({
      redactionId: entry.id,
      text: entry.text,
      start: entry.start,
      end: entry.end,
      reasonNotes: entry.reasonNotes,
      redactedBy: entry.redactedBy,
      committedAt: entry.committedAt,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
  } catch (error: any) {
    next(error);
  }
});

app.post("/api/cases/:id/transcript/redaction-amendment", isAuthenticated, async (req: any, res, next) => {
  try {
    const userId = req.user.claims.sub;
    const { redactionId, amendmentNote } = req.body;

    if (!redactionId || typeof redactionId !== "string") {
      return res.status(400).json({ message: "redactionId is required" });
    }
    if (!amendmentNote || typeof amendmentNote !== "string" || amendmentNote.trim().length < 20) {
      return res.status(400).json({ message: "amendmentNote is required and must be at least 20 characters" });
    }

    const caseData = await storage.getCase(req.params.id, userId);
    if (!caseData) return res.status(404).json({ message: "Case not found" });

    const transcript = await storage.getTranscriptByCase(req.params.id, userId);
    if (!transcript) return res.status(404).json({ message: "Transcript not found" });

    const redactions = (transcript.redactions || []) as any[];
    const redactionIndex = redactions.findIndex((r: any) => r.id === redactionId);

    if (redactionIndex === -1) {
      return res.status(404).json({ message: "Redaction not found" });
    }

    const existingNotes = redactions[redactionIndex].amendmentNotes || [];
    const updatedRedactions = redactions.map((r: any, i: number) => {
      if (i !== redactionIndex) return r;
      return {
        ...r,
        amendmentNotes: [
          ...existingNotes,
          {
            note: amendmentNote.trim(),
            addedBy: userId,
            addedAt: new Date().toISOString(),
          },
        ],
      };
    });

    const updatedTranscript = await storage.updateTranscript(
      transcript.id,
      { redactions: updatedRedactions },
      userId
    );

    await logAuditEvent(userId, "transcript_redaction_amendment_noted", {
      caseId: req.params.id,
      transcriptId: transcript.id,
      metadata: {
        redactionId,
        amendmentNote: amendmentNote.trim(),
      },
    });

    const safeTranscript = {
      ...updatedTranscript,
      privilegedRedactions: undefined,
      redactions: ((updatedTranscript?.redactions || []) as any[]).map((r: any) => {
        const { selectedText: _st, ...safeRedaction } = r;
        return safeRedaction;
      }),
    };

    res.json(safeTranscript);
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
      await logPersonnelMatterAccess({
        userId,
        caseId,
        resource: "document",
        req,
        metadata: { documentCount: documents.length },
      });
      res.json(documents);
    } catch (error: any) {
      next(error);
    }
  });

  // Get client version tracking history for a case
  app.get("/api/cases/:id/shared-history", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      // Verify ownership
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const history = await storage.getClientVersionTrackingByCase(caseId, userId);
      res.json(history);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/cases/:id/share-links", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseData = await storage.getCase(req.params.id, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const links = await storage.getShareLinksByCase(req.params.id, userId);
      res.json(links.map((link) => ({
        id: link.id,
        recipientEmail: link.recipientEmail,
        recipientName: link.recipientName,
        accessLevel: link.accessLevel,
        expiresAt: link.expiresAt,
        createdAt: link.createdAt,
        accessCount: link.accessCount,
        lastAccessedAt: link.lastAccessedAt,
        sharedDocuments: link.sharedDocuments,
        passwordProtected: Boolean(link.password),
        smsProtected: link.smsProtection,
      })));
    } catch (error: any) {
      next(error);
    }
  });

  app.delete("/api/share-links/:id", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const shareLink = await storage.getShareLink(req.params.id);
      if (!shareLink) {
        return res.status(404).json({ message: "Share link not found" });
      }

      const caseData = await storage.getCase(shareLink.caseId, userId);
      if (!caseData || shareLink.createdBy !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const revoked = await storage.deleteShareLink(shareLink.id, userId);
      if (!revoked) {
        return res.status(404).json({ message: "Share link not found" });
      }

      await logAuditEvent(userId, "share_link_revoked", {
        caseId: shareLink.caseId,
        metadata: {
          shareLinkId: shareLink.id,
          recipientEmail: shareLink.recipientEmail,
          recipientName: shareLink.recipientName,
          expiresAt: shareLink.expiresAt,
          accessCount: shareLink.accessCount,
        },
        req,
      });

      res.json({ success: true });
    } catch (error: any) {
      next(error);
    }
  });

  // Record document shared with client
  app.post("/api/documents/:documentId/track-share", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { documentId } = req.params;
      const { sentMethod, amendmentReason } = req.body;
      
      // Verify document exists and user owns it
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      const caseData = await storage.getCase(document.caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Check if a previous version was shared
      const latestShared = await storage.getLatestClientVersion(documentId);
      const versionChangeWarned = latestShared ? latestShared.documentId !== documentId : false;
      
      const tracking = await storage.createClientVersionTracking({
        documentId,
        sentToClient: true,
        sentAt: new Date(),
        sentBy: userId,
        sentMethod: sentMethod || 'share_link',
        amendmentReason: amendmentReason || null,
        versionChangeWarned,
      });
      
      // Log audit event
      await logAuditEvent(userId, "document_shared_with_client", {
        caseId: document.caseId,
        documentId,
        metadata: {
          documentType: document.type,
          documentVersion: document.version,
          sentMethod,
          versionChangeWarned,
        },
        req,
      });
      
      res.json(tracking);
    } catch (error: any) {
      next(error);
    }
  });

  // Get latest version sent to client for a document
  app.get("/api/documents/:documentId/latest-client-version", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { documentId } = req.params;
      
      // Verify document exists and user owns it
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      const caseData = await storage.getCase(document.caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const latestVersion = await storage.getLatestClientVersion(documentId);
      res.json(latestVersion || null);
    } catch (error: any) {
      next(error);
    }
  });

  // ============================================
  // Client Care Letter Acknowledgement Routes
  // ============================================

  // Request acknowledgement — authenticated solicitor sends email to client
  app.post("/api/documents/:id/request-acknowledgement", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { id: documentId } = req.params;

      const document = await storage.getDocument(documentId);
      if (!document) return res.status(404).json({ message: "Document not found" });

      const caseData = await storage.getCase(document.caseId, userId);
      if (!caseData) return res.status(403).json({ message: "Not authorised" });

      if (document.type !== 'client_care_letter' && document.type !== 'client_letter' && document.type !== 'summary') {
        return res.status(400).json({ message: "Acknowledgement is only available for client letters and client care letters" });
      }

      const documentLabel =
        document.type === 'client_care_letter' ? 'Client Care Letter' : 'Client Letter';

      // Get the client email — body override allowed so solicitors can supply it at send time
      const client = caseData.clientId ? await storage.getClient(caseData.clientId, userId) : null;
      const rawEmail = (client?.email || req.body.clientEmail || "").toString().trim();
      if (!rawEmail) {
        return res.status(400).json({
          message: "No client email address found. Please provide an email to send the acknowledgement request.",
          code: "CLIENT_EMAIL_REQUIRED",
        });
      }
      const emailParsed = z.string().email("Please enter a valid email address").safeParse(rawEmail);
      if (!emailParsed.success) {
        return res.status(400).json({ message: emailParsed.error.errors[0]?.message || "Invalid email address" });
      }
      const clientEmail = emailParsed.data;

      // Persist to the client record when supplied and missing, so next send doesn't re-prompt
      if (client && caseData.clientId && !client.email) {
        try {
          await storage.updateClient(caseData.clientId, { email: clientEmail }, userId);
        } catch (persistErr) {
          console.warn("[ACK] Could not save client email to profile:", persistErr);
        }
      }

      // Generate a secure token
      const token = crypto.randomBytes(32).toString('hex');

      // Store the token on the document
      await storage.updateDocument(documentId, {
        acknowledgedToken: token,
        acknowledgedAt: null,
        acknowledgedByEmail: null,
        acknowledgedIp: null,
      } as any, userId);

      // Get firm profile for branding
      const firmProfile = await storage.getFirmProfile();

      // Send the email
      const emailResult = await sendAcknowledgementRequestEmail({
        to: clientEmail,
        clientName: client?.name || 'Client',
        caseTitle: caseData.title,
        matterReference: caseData.matterReference || undefined,
        token,
        documentLabel,
        firmProfile: firmProfile ? {
          firmName: firmProfile.firmName,
          phone: firmProfile.phone || undefined,
          email: firmProfile.email || undefined,
        } : undefined,
      });

      if (!emailResult.success) {
        return res.status(500).json({ message: "Failed to send acknowledgement email", error: emailResult.error });
      }

      await logAuditEvent(userId, "acknowledgement_requested", {
        documentId,
        caseId: document.caseId,
        metadata: {
          clientEmail,
          caseTitle: caseData.title,
          documentType: document.type,
          documentLabel,
        },
        req,
      });

      res.json({ success: true, sentTo: clientEmail, documentLabel });
    } catch (error: any) {
      next(error);
    }
  });

  // Public: Get document for acknowledgement (no auth required)
  app.get("/api/documents/acknowledge/:token", async (req, res, next) => {
    try {
      const { token } = req.params;

      const document = await storage.getDocumentByAcknowledgeToken(token);
      if (!document) return res.status(404).json({ message: "This link is invalid or has expired." });

      const caseData = await storage.getCaseById(document.caseId);
      const firmProfile = await storage.getFirmProfile();

      res.json({
        documentId: document.id,
        content: document.content,
        documentType: document.type,
        documentLabel:
          document.type === "client_care_letter"
            ? "Client Care Letter"
            : document.type === "client_letter" || document.type === "summary"
              ? "Client Letter"
              : "Letter",
        caseTitle: caseData?.title || 'Your Matter',
        matterReference: caseData?.matterReference || null,
        acknowledgedAt: document.acknowledgedAt,
        acknowledgedByEmail: document.acknowledgedByEmail,
        firmProfile: firmProfile ? {
          firmName: firmProfile.firmName,
          logoUrl: firmProfile.logoUrl || null,
        } : null,
      });
    } catch (error: any) {
      next(error);
    }
  });

  // Public: Submit acknowledgement (no auth required)
  app.post("/api/documents/acknowledge/:token", async (req, res, next) => {
    try {
      const { token } = req.params;
      const clientEmail = req.body.email || '';
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
        || req.socket.remoteAddress
        || 'unknown';

      const document = await storage.getDocumentByAcknowledgeToken(token);
      if (!document) return res.status(404).json({ message: "This link is invalid or has expired." });

      if (document.acknowledgedAt) {
        return res.json({ alreadyAcknowledged: true, acknowledgedAt: document.acknowledgedAt });
      }

      const now = new Date();
      await storage.recordDocumentAcknowledgement(document.id, now, clientEmail, ip);

      res.json({ success: true, acknowledgedAt: now.toISOString() });
    } catch (error: any) {
      next(error);
    }
  });

  // ============================================
  // Action Items Routes
  // ============================================

  // Get action items for a case
  app.get("/api/cases/:id/action-items", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const items = await storage.getActionItemsByCase(caseId, userId);
      res.json(items);
    } catch (error: any) {
      next(error);
    }
  });

  // Create action item for a case
  app.post("/api/cases/:id/action-items", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const { description, assignee, dueDate, priority, transcriptId, sourceUtteranceIndex } = req.body;
      
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Get transcript for case if not provided
      let actualTranscriptId = transcriptId;
      if (!actualTranscriptId) {
        const transcript = await storage.getTranscriptByCase(caseId, userId);
        if (!transcript) {
          return res.status(400).json({ message: "No transcript found for this case" });
        }
        actualTranscriptId = transcript.id;
      }
      
      const item = await storage.createActionItem({
        caseId,
        transcriptId: actualTranscriptId,
        description,
        assignee: assignee || null,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        priority: priority || "medium",
        sourceUtteranceIndex: sourceUtteranceIndex || undefined,
      });
      
      await logAuditEvent(userId, "action_item_created", {
        caseId,
        metadata: {
          actionItemId: item.id,
          description: item.description.substring(0, 100),
          assignee: item.assignee,
          priority: item.priority,
        },
        req,
      });
      
      res.json(item);
    } catch (error: any) {
      next(error);
    }
  });

  // Update action item (mark complete, etc.)
  app.patch("/api/action-items/:id", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { completed, assignee, dueDate, priority, description, status } = req.body;
      
      // If trying to mark as complete, enforce approval-first policy
      // "AI-assisted, not AI-decided": items must be approved before completion
      if (completed === true) {
        const currentItem = await storage.getActionItem(id, userId);
        
        if (!currentItem) {
          return res.status(404).json({ message: "Action item not found or not authorized" });
        }
        
        if ((currentItem as any).status !== 'approved') {
          return res.status(400).json({ 
            message: "Action items must be approved before they can be marked as complete. This ensures solicitor oversight of all AI-generated content."
          });
        }
      }
      
      const updates: any = {};
      if (completed !== undefined) {
        updates.completed = completed;
        if (completed) {
          updates.completedAt = new Date();
          updates.completedBy = userId;
        } else {
          updates.completedAt = null;
          updates.completedBy = null;
        }
      }
      if (assignee !== undefined) updates.assignee = assignee;
      if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
      if (priority !== undefined) updates.priority = priority;
      if (description !== undefined) updates.description = description;
      
      // Handle status/approval changes
      if (status !== undefined) {
        updates.status = status;
        if (status === 'approved') {
          updates.approvedBy = userId;
          updates.approvedAt = new Date();
        } else if (status === 'draft') {
          updates.approvedBy = null;
          updates.approvedAt = null;
        }
      }
      
      const item = await storage.updateActionItem(id, updates, userId);
      if (!item) {
        return res.status(404).json({ message: "Action item not found or not authorized" });
      }
      
      // Log appropriate audit event based on what changed
      if (status === 'approved') {
        await logAuditEvent(userId, "action_item_approved", {
          caseId: item.caseId,
          metadata: {
            actionItemId: id,
            description: item.description?.substring(0, 100),
            originalDescription: (item as any).originalDescription?.substring(0, 100),
            wasEdited: item.description !== (item as any).originalDescription,
            assignee: item.assignee,
            dueDate: item.dueDate,
          },
          severity: "info",
          req,
        });
      } else {
        await logAuditEvent(userId, "action_item_updated", {
          caseId: item.caseId,
          metadata: {
            actionItemId: id,
            updates: Object.keys(updates),
            completed: item.completed,
          },
          req,
        });
      }
      
      res.json(item);
    } catch (error: any) {
      next(error);
    }
  });
  
  // Bulk approve all action items for a case
  app.post("/api/cases/:id/action-items/approve-all", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const items = await storage.getActionItemsByCase(caseId, userId);
      // Match frontend: approve anything not already approved (draft or legacy null/other)
      const pendingItems = items.filter(item => (item as any).status !== 'approved');
      
      const approvedAt = new Date();
      const approvedItems = [];
      for (const item of pendingItems) {
        const updated = await storage.updateActionItem(item.id, {
          status: 'approved',
          approvedBy: userId,
          approvedAt,
        }, userId);
        if (updated) {
          approvedItems.push(updated);
        }
      }
      
      await logAuditEvent(userId, "action_items_bulk_approved", {
        caseId,
        metadata: {
          approvedCount: approvedItems.length,
          totalItems: items.length,
        },
        severity: "info",
        req,
      });
      
      res.json({ success: true, approvedCount: approvedItems.length, items: approvedItems });
    } catch (error: any) {
      next(error);
    }
  });

  // Delete action item
  app.delete("/api/action-items/:id", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      const deleted = await storage.deleteActionItem(id, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Action item not found or not authorized" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      next(error);
    }
  });

  // Create manual action item (without transcript)
  app.post("/api/cases/:id/action-items/manual", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const { description, assignee, dueDate, priority } = req.body;
      
      if (!description?.trim()) {
        return res.status(400).json({ message: "Description is required" });
      }
      
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const item = await storage.createManualActionItem({
        caseId,
        description: description.trim(),
        assignee: assignee || null,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        priority: priority || "medium",
        isManual: true,
      });
      
      await logAuditEvent(userId, "action_item_created_manual", {
        caseId,
        metadata: {
          actionItemId: item.id,
          description: item.description.substring(0, 100),
          assignee: item.assignee,
          priority: item.priority,
          isManual: true,
        },
        req,
      });
      
      res.json(item);
    } catch (error: any) {
      next(error);
    }
  });

  // Get pre-meeting briefing for a case
  app.get("/api/cases/:id/pre-meeting-briefing", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const briefing = await storage.getLatestPreMeetingBriefing(caseId, userId);
      res.json(briefing || null);
    } catch (error: any) {
      next(error);
    }
  });

  // Generate pre-meeting briefing for a case
  app.post("/api/cases/:id/pre-meeting-briefing", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;

      const {
        generateAndPersistPreMeetingBriefing,
      } = await import("./services/preMeetingBriefingService");

      const result = await generateAndPersistPreMeetingBriefing(caseId, userId);
      res.json({
        briefing: result.briefing,
        generationCost: result.generationCost,
      });
    } catch (error: any) {
      if (error?.name === "PreMeetingBriefingError") {
        return res.status(error.statusCode).json({ message: error.message });
      }
      next(error);
    }
  });

  const clientCareLetterSchema = z.object({
    firmName: z.string().min(1).max(200),
    firmAddress: z.string().max(500).optional(),
    firmPhone: z.string().max(50).optional(),
    firmEmail: z.string().max(200).optional(),
    sraNumber: z.string().max(50).optional(),
    feeEarnerName: z.string().min(1).max(200),
    costsEstimate: z.string().max(500).optional(),
  });

  app.post("/api/cases/:id/client-care-letter", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;

      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const validatedBody = clientCareLetterSchema.parse(req.body);
      const { firmName, firmAddress, firmPhone, firmEmail, sraNumber, feeEarnerName, costsEstimate } = validatedBody;

      const { DocumentService } = await import("./services/documentService");
      const documentService = new DocumentService();
      const { PRACTICE_AREA_LABELS } = await import("@shared/schema");

      const practiceAreaLabel = caseData.practiceArea
        ? PRACTICE_AREA_LABELS[caseData.practiceArea as keyof typeof PRACTICE_AREA_LABELS] || caseData.practiceArea
        : "General";

      const result = await documentService.generateClientCareLetter({
        firmName,
        firmAddress,
        firmPhone,
        firmEmail,
        sraNumber,
        feeEarnerName,
        clientName: caseData.clientName,
        matterDescription: caseData.title,
        practiceArea: practiceAreaLabel,
        costsEstimate: costsEstimate || caseData.costsEstimate || undefined,
        matterReference: caseData.matterReference || undefined,
      });

      const document = await storage.createDocument({
        caseId,
        type: "client_care_letter",
        content: result.content,
        version: 1,
        versionType: "system_generated",
        createdBy: userId,
      });

      await storage.updateCase(caseId, { clientCareLetterId: document.id }, userId);

      await logAuditEvent(userId, "document_generated", {
        caseId,
        documentId: document.id,
        req,
        metadata: {
          action: "generate_client_care_letter",
          practiceArea: caseData.practiceArea,
          generationCost: result.cost,
        },
      });

      res.json({
        document,
        generationCost: result.cost,
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  });

  // Get undertakings for a case
  app.get("/api/cases/:id/undertakings", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const items = await storage.getUndertakingsByCase(caseId);
      res.json(items);
    } catch (error) {
      next(error);
    }
  });

  // Create/confirm an undertaking
  app.post("/api/cases/:id/undertakings", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const bodySchema = z.object({
        wording: z.string().min(1, "Wording is required").max(5000),
        speaker: z.string().max(500).nullable().optional(),
        sourceQuote: z.string().max(5000).nullable().optional(),
        deadline: z.string().nullable().optional(),
        dateGiven: z.string().nullable().optional(),
        meetingSessionId: z.string().uuid().nullable().optional(),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      }
      const { wording, speaker, sourceQuote, deadline, dateGiven, meetingSessionId } = parsed.data;
      const undertaking = await storage.createUndertaking({
        caseId,
        meetingSessionId: meetingSessionId || null,
        wording,
        speaker: speaker || null,
        sourceQuote: sourceQuote || null,
        deadline: deadline ? new Date(deadline) : undefined,
        status: "outstanding",
        confirmedBy: userId,
        confirmedAt: new Date(),
        dateGiven: dateGiven ? new Date(dateGiven) : new Date(),
      });

      await logAuditEvent(userId, "undertaking_confirmed", {
        caseId,
        metadata: { undertakingId: undertaking.id, wording: undertaking.wording },
        req,
      });

      res.json(undertaking);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/cases/:id/send-client-care-letter", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;

      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }

      if (!caseData.clientCareLetterId) {
        return res.status(400).json({ message: "No client care letter has been generated for this case" });
      }

      // Block delivery while litigation hold is active (same gate as share-link)
      if (caseData.litigationHold) {
        return res.status(403).json({
          message: "Client care letters cannot be shared while a litigation hold is active on this case",
        });
      }

      const sendSchema = z.object({
        recipientEmail: z.string().email(),
        recipientName: z.string().min(1).max(200).optional(),
      });
      const { recipientEmail, recipientName } = sendSchema.parse(req.body);

      const documents = await storage.getDocumentsByCase(caseId, userId);
      const careLetter = documents.find(d => d.id === caseData.clientCareLetterId && d.isActive !== false);
      if (!careLetter || careLetter.type !== "client_care_letter") {
        return res.status(404).json({ message: "Client care letter document not found" });
      }
      if (careLetter.status !== "approved") {
        return res.status(403).json({
          message: "The client care letter must be reviewed and adopted before it can be shared.",
        });
      }

      // Same delivery model as share-link: notification email carries a link only —
      // never the letter body, matter reference, or other privileged content (DPA 11.2).
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      const sharedDocuments = ["client_care_letter"] as const;

      const shareLink = await storage.createShareLink({
        caseId,
        createdBy: userId,
        recipientEmail,
        recipientName: recipientName || caseData.clientName,
        isExternal: true,
        accessLevel: "view",
        expiresAt,
        clientConsent: true,
        smsProtection: false,
        sharedDocuments: [...sharedDocuments],
      });

      const firmProfile = await storage.getFirmProfile();
      const emailResult = await sendCaseEmail({
        to: recipientEmail,
        shareLinkId: shareLink.id,
        systemMessage:
          "You have been granted view access to a secure document. This link will expire in 7 days.",
        firmProfile: firmProfile
          ? {
              firmName: firmProfile.firmName,
              phone: firmProfile.phone || undefined,
              email: firmProfile.email || undefined,
              addressLine1: firmProfile.addressLine1 || undefined,
              addressLine2: firmProfile.addressLine2 || undefined,
              city: firmProfile.city || undefined,
              postcode: firmProfile.postcode || undefined,
              logoUrl: firmProfile.logoUrl || undefined,
            }
          : undefined,
      });

      await logAuditEvent(userId, "share_link_created", {
        caseId,
        documentId: caseData.clientCareLetterId ?? undefined,
        req,
        metadata: {
          action: "send_client_care_letter",
          delivery: "secure_share_link",
          recipientEmail,
          shareLinkId: shareLink.id,
          sharedDocuments: [...sharedDocuments],
          accessLevel: "view",
          success: emailResult.success,
          messageId: emailResult.messageId,
        },
      });

      if (!emailResult.success) {
        return res.status(500).json({ message: emailResult.error || "Failed to send secure link" });
      }

      await storage.createClientVersionTracking({
        documentId: careLetter.id,
        sentToClient: true,
        sentAt: new Date(),
        sentBy: userId,
        sentMethod: "email",
        amendmentReason: undefined,
        versionChangeWarned: false,
      });

      await storage.updateCase(caseId, { clientCareLetterSentAt: new Date() }, userId);
      res.json({
        success: true,
        messageId: emailResult.messageId,
        shareLinkId: shareLink.id,
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  });

  // Update an undertaking (edit wording, discharge, etc.)
  app.patch("/api/undertakings/:id", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const undertakingId = req.params.id;
      const existing = await storage.getUndertaking(undertakingId);
      if (!existing) {
        return res.status(404).json({ message: "Undertaking not found" });
      }
      const caseData = await storage.getCase(existing.caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const patchSchema = z.object({
        wording: z.string().min(1).max(5000).optional(),
        deadline: z.string().nullable().optional(),
        status: z.enum(["outstanding", "discharged", "varied"]).optional(),
        dischargeNote: z.string().max(5000).optional(),
      });
      const parsed = patchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      }
      const { wording, deadline, status, dischargeNote } = parsed.data;
      const updates: Record<string, any> = {};
      if (wording !== undefined) updates.wording = wording;
      if (deadline !== undefined) updates.deadline = deadline ? new Date(deadline) : null;
      if (status !== undefined) {
        if (existing.status === "discharged" && status === "outstanding") {
          return res.status(400).json({ message: "Cannot reopen a discharged undertaking" });
        }
        updates.status = status;
        if (status === "discharged") {
          updates.dischargedAt = new Date();
          updates.dischargedBy = userId;
          if (dischargeNote) updates.dischargeNote = dischargeNote;
        }
      }
      const updated = await storage.updateUndertaking(undertakingId, updates);

      if (status === "discharged") {
        await logAuditEvent(userId, "undertaking_discharged", {
          caseId: existing.caseId,
          metadata: { undertakingId, wording: existing.wording, dischargeNote },
          req,
        });
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // Get all outstanding undertakings (firm-wide admin view)
  app.get("/api/undertakings/outstanding", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const ADMIN_USER_ID = process.env.ADMIN_USER_ID || "48381245";
      const user = await storage.getUser(userId);
      if (userId !== ADMIN_USER_ID && user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const items = await storage.getAllOutstandingUndertakings();
      res.json(items);
    } catch (error) {
      next(error);
    }
  });

  // ---- Conflict Check (singular path per spec) ----
  app.get("/api/cases/:id/conflict-check", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) return res.status(403).json({ message: "Not authorized" });
      const records = await storage.getConflictChecksByCase(caseId);
      res.json(records);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/cases/:id/conflict-check", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) return res.status(403).json({ message: "Not authorized" });
      const parsed = insertConflictCheckSchema.safeParse({ ...req.body, caseId, performedBy: userId });
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      const record = await storage.createConflictCheck(parsed.data);
      await logAuditEvent(userId, "conflict_check_recorded", { caseId, metadata: { outcome: record.outcome }, req });
      res.status(201).json(record);
    } catch (error) {
      next(error);
    }
  });

  // ---- Conflict Checks (plural alias retained for backwards compatibility) ----
  app.get("/api/cases/:id/conflict-checks", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) return res.status(403).json({ message: "Not authorized" });
      const records = await storage.getConflictChecksByCase(caseId);
      res.json(records);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/cases/:id/conflict-checks", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) return res.status(403).json({ message: "Not authorized" });
      const parsed = insertConflictCheckSchema.safeParse({ ...req.body, caseId, performedBy: userId });
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      const record = await storage.createConflictCheck(parsed.data);
      await logAuditEvent(userId, "conflict_check_recorded", { caseId, metadata: { outcome: record.outcome }, req });
      res.status(201).json(record);
    } catch (error) {
      next(error);
    }
  });

  // ---- SRA Compliance Readiness ----
  app.get("/api/cases/:id/sra-readiness", isAuthenticated, async (req: any, res, next) => {
    try {
      if (!isFeatureVisible("sraReadiness")) {
        return res.status(404).json({ message: "Not found" });
      }
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) return res.status(403).json({ message: "Not authorized" });

      const [
        client,
        consentLogs,
        amlDecisions,
        amlMonitoringNotes,
        conflictChecks,
        documents,
        obligations,
        undertakings,
        sessions,
        timeEntries,
      ] = await Promise.all([
        caseData.clientId ? storage.getClient(caseData.clientId) : Promise.resolve(undefined),
        storage.getConsentLogsByCase(caseId),
        storage.getAmlDecisionRecords(caseId),
        storage.getAmlMonitoringNotes(caseId),
        storage.getConflictChecksByCase(caseId),
        storage.getDocumentsByCase(caseId, userId),
        storage.getActionItemsByCase(caseId, userId),
        storage.getUndertakingsByCase(caseId),
        storage.getMeetingSessionsByCase(caseId),
        storage.getTimeEntriesByCase(caseId),
      ]);

      type ReadinessCriterion = {
        key: string;
        label: string;
        status: "green" | "amber" | "red";
        detail: string;
        sraRef: string;
        actionRoute: string | null;
        externalNote: string | null;
      };
      const criteria: ReadinessCriterion[] = [];
      const now = new Date();

      // 1. Client identity verification and AML (SRA Standard 4, MLR 2017)
      // Red: No AML risk level assigned to the client/matter record
      // Red: No AML monitoring notes or decisions recorded at all
      // Amber: AML monitoring notes recorded but no formal AML decision (trigger assessment)
      // Amber: High-risk matter with no EDD rationale recorded
      // Green: AML risk level assigned and monitoring on record
      // amlDecisions = AmlDecisionRecord[] (trigger event/concern decisions)
      // amlMonitoringNotes = AmlMonitoringNote[] (monitoring entries including EDD)
      const hasAmlDecision = amlDecisions && amlDecisions.length > 0;
      const hasAmlMonitoring = amlMonitoringNotes && amlMonitoringNotes.length > 0;
      const latestMonitoring = hasAmlMonitoring
        ? [...amlMonitoringNotes].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0]
        : null;
      const clientTyped = client as ({ amlRiskLevel?: string | null } | undefined);
      const amlRiskAssigned = !!(clientTyped?.amlRiskLevel || caseData.riskLevel);
      const clientIsHighRisk = clientTyped?.amlRiskLevel === "high" || caseData.riskLevel === "high";
      const amlHasEddRationale = hasAmlMonitoring && amlMonitoringNotes.some((n) => n.eddDecision || n.eddReasoning);
      const latestRisk = latestMonitoring?.riskLevel ?? caseData.riskLevel ?? "standard";
      let amlStatus: "green" | "amber" | "red" = "green";
      let amlDetail = `AML monitoring on record. Risk level: ${latestRisk}.`;
      if (!amlRiskAssigned) {
        amlStatus = "red";
        amlDetail = "No AML risk level assigned to this matter or client. SRA AML compliance requires risk classification before acting.";
      } else if (!hasAmlMonitoring) {
        amlStatus = "red";
        amlDetail = "No AML monitoring records on file. Identity verification and source of funds must be documented before acting.";
      } else if (!hasAmlDecision && hasAmlMonitoring && amlMonitoringNotes.some(n => n.recordType === "inception")) {
        // Inception note present but no formal AML trigger decision — green if risk is assigned and inception recorded
        amlStatus = "green";
        amlDetail = `AML inception check recorded. Risk level: ${latestRisk}.`;
        if (clientIsHighRisk && !amlHasEddRationale) {
          amlStatus = "amber";
          amlDetail = "High-risk matter. Enhanced due diligence (EDD) rationale should be recorded in the monitoring notes.";
        }
      } else if (!hasAmlDecision && hasAmlMonitoring) {
        amlStatus = "amber";
        amlDetail = "AML monitoring notes recorded but no formal AML trigger decision found.";
      } else if (clientIsHighRisk && !amlHasEddRationale) {
        amlStatus = "amber";
        amlDetail = "High-risk matter. Enhanced due diligence (EDD) rationale should be recorded in the monitoring notes.";
      }
      criteria.push({
        key: "client_identity",
        label: "Client Identity and AML",
        status: amlStatus,
        detail: amlDetail,
        sraRef: "SRA AML Practice Note 2023, r.28 MLR 2017",
        actionRoute: `/cases/${caseId}?tab=compliance`,
        externalNote: "Identity verification documents held externally are not reflected here.",
      });

      // 2. Conflict of interest check (SRA Code 6.1)
      // Red: No conflict check recorded
      // Amber: Conflict identified and managed (requires ongoing review)
      const hasConflictCheck = conflictChecks && conflictChecks.length > 0;
      const latestConflict = hasConflictCheck
        ? [...conflictChecks].sort((a, b) => new Date(b.datePerformed ?? 0).getTime() - new Date(a.datePerformed ?? 0).getTime())[0]
        : null;
      criteria.push({
        key: "conflict_check",
        label: "Conflict of Interest Check",
        status: !hasConflictCheck ? "red" : latestConflict?.outcome === "conflict_managed" ? "amber" : "green",
        detail: !hasConflictCheck
          ? "No conflict check recorded. SRA Code requires a check before acting."
          : latestConflict?.outcome === "conflict_managed"
          ? "Conflict identified and managed. Management measures should be reviewed."
          : "Conflict check recorded: no conflict identified.",
        sraRef: "SRA Code of Conduct 2019, para 6.1-6.2",
        actionRoute: null,
        externalNote: "Conflicts held in a separate firm register are not reflected here.",
      });

      // 3a. Client care letter - independent Red/Amber/Green criterion
      // Red: No client care letter recorded
      // Amber: Care letter recorded but not yet acknowledged by client
      // Green: Care letter recorded and acknowledged
      const careLetterDoc = documents && documents.find((d) => d.type === "client_care_letter" && d.isActive);
      const careLetterAcknowledged = !!careLetterDoc?.acknowledgedAt;
      let careLetterStatus: "green" | "amber" | "red" = !careLetterDoc ? "red"
        : !careLetterAcknowledged ? "amber"
        : "green";
      const careLetterDetail = !careLetterDoc
        ? "No client care letter recorded in LegalNote. A care letter is required before substantive work."
        : !careLetterAcknowledged
        ? `Client care letter issued on ${careLetterDoc.createdAt ? new Date(careLetterDoc.createdAt as string).toLocaleDateString("en-GB") : "unknown date"} but not yet acknowledged by client.`
        : `Client care letter issued and acknowledged by client.`;
      criteria.push({
        key: "client_care_letter",
        label: "Client Care Letter",
        status: careLetterStatus,
        detail: careLetterDetail,
        sraRef: "SRA Code of Conduct 2019, para 8.6; SRA Transparency Rules",
        actionRoute: `/cases/${caseId}?tab=documents`,
        externalNote: "Letters held in paper or external DMS are not reflected here.",
      });

      // 3b. Consent for recording - independent Red/Amber/Green criterion
      // Red: No consent records at all
      // Red: Any consent log records a declined consent (regardless of other logs)
      // Amber: Consent has been withdrawn for at least one session
      // Green: Consent given and not withdrawn, with no declined records
      const givenConsent = consentLogs && consentLogs.some((c) => c.consentGiven === true && !c.consentWithdrawn);
      const declinedConsent = consentLogs && consentLogs.some((c) => c.consentGiven === false);
      const withdrawnConsent = consentLogs && consentLogs.some((c) => c.consentWithdrawn === true);
      let consentStatus: "green" | "amber" | "red" = "green";
      let consentDetail = "Consent recorded and confirmed for this matter.";
      if (!consentLogs || consentLogs.length === 0) {
        consentStatus = "red";
        consentDetail = "No consent records found for this matter. Consent must be recorded before any session recording.";
      } else if (declinedConsent) {
        // Any declined consent record is Red — regardless of whether other sessions have consent
        consentStatus = "red";
        consentDetail = "Consent was declined for at least one session. Recording must not proceed without documented lawful basis.";
      } else if (withdrawnConsent) {
        consentStatus = "amber";
        consentDetail = "Consent has been withdrawn for at least one session. Recordings after withdrawal should not be retained.";
      } else if (givenConsent) {
        // Amber if consent is verbal/attested only AND no care letter has been acknowledged
        // (no documentary evidence of client acknowledgement in that case)
        const allVerbalAttested = consentLogs!.filter(c => c.consentGiven === true && !c.consentWithdrawn)
          .every(c => c.consentModality === "verbal_attested");
        if (allVerbalAttested && !careLetterAcknowledged) {
          consentStatus = "amber";
          consentDetail = "Consent recorded verbally (attested) but no client acknowledgement document is on file. Consider obtaining written or electronically confirmed consent to strengthen the record.";
        } else {
          consentStatus = "green";
        }
      }
      criteria.push({
        key: "client_consent",
        label: "Consent for Recording",
        status: consentStatus,
        detail: consentDetail,
        sraRef: "GDPR Art. 6 / Art. 9; SRA Code of Conduct 2019, para 8.6",
        actionRoute: `/cases/${caseId}?tab=consent`,
        externalNote: null,
      });

      // 4. Matter record and attendance notes (SRA Code 8.7)
      // Red: Sessions exist but NO session has an attendance note
      // Amber: Sessions exist but only some have an attendance note; or no sessions at all
      // Green: All sessions have an associated attendance note
      const hasSessionNotes = sessions && sessions.length > 0;
      const sessionsWithAttendanceNotes = sessions
        ? sessions.filter((s) => documents && documents.some(
            (d) => d.isActive && d.type === "attendance_note" && d.meetingSessionId === s.id
          )).length
        : 0;
      let attendanceStatus: "green" | "amber" | "red" = "green";
      let attendanceDetail = `${sessions?.length ?? 0} session(s), each with an attendance note on file.`;
      if (!hasSessionNotes) {
        attendanceStatus = "amber";
        attendanceDetail = "No session records on file. Attendance notes should be created for all client contact.";
      } else if (sessionsWithAttendanceNotes === 0) {
        attendanceStatus = "red";
        attendanceDetail = `${sessions?.length ?? 0} session(s) recorded but no attendance notes found for any session.`;
      } else if (sessionsWithAttendanceNotes < (sessions?.length ?? 0)) {
        attendanceStatus = "amber";
        attendanceDetail = `${sessionsWithAttendanceNotes} of ${sessions?.length} session(s) have an attendance note on file.`;
      }
      criteria.push({
        key: "matter_record",
        label: "Matter Record (Attendance Notes)",
        status: attendanceStatus,
        detail: attendanceDetail,
        sraRef: "SRA Code of Conduct 2019, para 8.7",
        actionRoute: `/cases/${caseId}?tab=attendance`,
        externalNote: "Paper attendance notes or telephone records held externally are not reflected here.",
      });

      // 5. Open obligations (SRA Code 8.7)
      // Green: No open/overdue obligations
      // Green: Open obligations that are not overdue (future-dated or undated)
      // Amber: Any obligations past their due date
      const openObligations = (obligations || []).filter(
        (o) => o.status !== "completed" && o.status !== "done" && o.status !== "rejected"
      );
      const overdueObligations = openObligations.filter(
        (o) => o.dueDate && new Date(o.dueDate as string) < now
      );
      criteria.push({
        key: "obligations",
        label: "Open Obligations",
        status: overdueObligations.length > 0 ? "amber" : "green",
        detail: overdueObligations.length > 0
          ? `${overdueObligations.length} obligation(s) past due date. Prompt attention required.`
          : openObligations.length === 0
          ? "All obligations complete or closed."
          : `${openObligations.length} open obligation(s), none currently overdue.`,
        sraRef: "SRA Code of Conduct 2019, para 8.7",
        actionRoute: `/cases/${caseId}?tab=obligations`,
        externalNote: null,
      });

      // 6. Undertakings (SRA Code 1.3, Law Society Undertakings Practice Note)
      // Green: No outstanding undertakings, or all recently given (under 30 days)
      // Amber: Any undertaking outstanding for more than 30 days (requires review)
      const openUndertakings = (undertakings || []).filter((u) => u.status === "outstanding");
      const longStandingUndertakings = openUndertakings.filter((u) => {
        if (!u.dateGiven) return false;
        return (now.getTime() - new Date(u.dateGiven as string).getTime()) > 30 * 24 * 60 * 60 * 1000;
      });
      criteria.push({
        key: "undertakings",
        label: "Undertakings",
        status: longStandingUndertakings.length > 0 ? "amber" : "green",
        detail: longStandingUndertakings.length > 0
          ? `${longStandingUndertakings.length} undertaking(s) outstanding for over 30 days. Prompt discharge required.`
          : openUndertakings.length > 0
          ? `${openUndertakings.length} undertaking(s) outstanding (all given within the last 30 days).`
          : "No outstanding undertakings.",
        sraRef: "SRA Code of Conduct 2019, para 1.3; Law Society Undertakings Practice Note",
        actionRoute: `/cases/${caseId}?tab=undertakings`,
        externalNote: null,
      });

      // 7. Time recording (SRA Transparency Rules)
      // Amber: No time entries recorded where sessions exist
      const hasTimeEntries = timeEntries && timeEntries.length > 0;
      criteria.push({
        key: "time_recording",
        label: "Time Recording",
        status: hasSessionNotes && !hasTimeEntries ? "amber" : "green",
        detail: !hasTimeEntries && hasSessionNotes
          ? "Sessions recorded but no time entries found. Time recording is expected for billing transparency."
          : !hasTimeEntries
          ? "No time entries recorded for this matter."
          : `${timeEntries.length} time entr${timeEntries.length === 1 ? "y" : "ies"} recorded.`,
        sraRef: "SRA Transparency Rules 2018; SRA Code of Conduct 2019, para 8.7",
        actionRoute: `/cases/${caseId}?tab=time`,
        externalNote: "Time entries held in external billing systems are not reflected here.",
      });

      // Overall status and outstanding count
      const hasRed = criteria.some((c) => c.status === "red");
      const hasAmber = criteria.some((c) => c.status === "amber");
      const overall: "green" | "amber" | "red" = hasRed ? "red" : hasAmber ? "amber" : "green";
      const outstandingCount = criteria.filter((c) => c.status !== "green").length;

      res.json({
        overall,
        outstandingCount,
        criteria,
        disclaimer: "This readiness check is based solely on records held in LegalNote for this matter. Records held in external systems, paper files, or other practice management systems are not reflected. This check does not constitute legal advice and is not a substitute for professional regulatory review.",
      });
    } catch (error) {
      next(error);
    }
  });

  // ---- SRA Matter Report Preview (section counts for modal) ----
  app.get("/api/cases/:id/sra-report/preview", isAuthenticated, async (req: any, res, next) => {
    try {
      if (!isFeatureVisible("sraReadiness")) {
        return res.status(404).json({ message: "Not found" });
      }
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) return res.status(403).json({ message: "Not authorized" });
      const reportData = await assembleSraReportData(caseId, userId);
      const preview = buildSraReportPreview(reportData);
      await logPersonnelMatterAccess({
        userId,
        caseId,
        resource: "export",
        req,
        metadata: { exportType: "sra_report_preview" },
      });
      res.json({
        ...preview,
        disclaimer: "This report is a complete extract of records held in LegalNote for this matter. Records held in external systems, paper files, or other practice management systems are not included. Compile only for the purpose of SRA regulatory review or file audit.",
      });
    } catch (error) {
      next(error);
    }
  });

  // ---- SRA Matter Report (compile PDF) ----
  app.post("/api/cases/:id/sra-report", isAuthenticated, async (req: any, res, next) => {
    try {
      if (!isFeatureVisible("sraReadiness")) {
        return res.status(404).json({ message: "Not found" });
      }
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) return res.status(403).json({ message: "Not authorized" });

      const reportData = await assembleSraReportData(caseId, userId);
      const pdfBytes = compileSraReportPdf(reportData);

      await logAuditEvent(userId, "sra_report_compiled", {
        caseId,
        metadata: { reportTitle: `SRA Matter Report - ${caseData.title}` },
        req,
        severity: "critical",
      });
      await logPersonnelMatterAccess({
        userId,
        caseId,
        resource: "export",
        req,
        metadata: { exportType: "sra_report_pdf" },
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="SRA-Matter-Report-${caseId}.pdf"`
      );
      res.end(pdfBytes);
    } catch (error) {
      next(error);
    }
  });

  // Supervision sign-offs
  app.get("/api/cases/:id/supervision-signoffs", isAuthenticated, requireFeatureVisible("supervision"), async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const ADMIN_USER_ID = process.env.ADMIN_USER_ID || "48381245";
      const isAdminUser = userId === ADMIN_USER_ID;
      const user = await storage.getUser(userId);
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData && !isAdminUser && !['partner', 'colp', 'admin'].includes(user?.role || '')) {
        return res.status(403).json({ message: "Not authorised" });
      }
      const signoffs = await storage.getSupervisionSignoffsByCase(caseId);
      res.json(signoffs);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/cases/:id/supervision-signoffs", isAuthenticated, requireFeatureVisible("supervision"), async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const ADMIN_USER_ID = process.env.ADMIN_USER_ID || "48381245";
      const isAdminUser = userId === ADMIN_USER_ID;
      const user = await storage.getUser(userId);

      const allowedRoles = ['supervisor', 'partner', 'colp', 'admin'];
      if (!isAdminUser && !allowedRoles.includes(user?.role || '')) {
        return res.status(403).json({ message: "Supervision sign-off requires supervisor, partner, or COLP role" });
      }

      const caseRecord = await storage.getCase(caseId, userId);
      if (!caseRecord && !isAdminUser) {
        return res.status(404).json({ message: "Case not found" });
      }

      const { signoffDate, reviewNotes } = req.body;
      if (!reviewNotes || !reviewNotes.trim()) {
        return res.status(400).json({ message: "Review notes are required" });
      }

      const supervisorName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || userId;
      const supervisorRole = user?.role || 'supervisor';

      const signoff = await storage.createSupervisionSignoff({
        caseId,
        supervisorUserId: userId,
        supervisorName,
        supervisorRole,
        signoffDate: signoffDate ? new Date(signoffDate) : new Date(),
        reviewNotes: reviewNotes.trim(),
      });

      await logAuditEvent(userId, "supervision_signoff_recorded", {
        caseId,
        metadata: { signoffId: signoff.id, supervisorName, supervisorRole },
        req,
      });

      res.status(201).json(signoff);
    } catch (error) {
      next(error);
    }
  });

  // Firm compliance overview — DISABLED pending firm-scoped isolation fix
  app.get("/api/firm/compliance-overview", isAuthenticated, async (_req, res) => {
    res.status(503).json({ message: "This endpoint is temporarily disabled" });
  });

  // Extract action items from transcript using AI
  app.post("/api/cases/:id/extract-action-items", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const transcript = await storage.getTranscriptByCase(caseId, userId);
      if (!transcript) {
        return res.status(400).json({ message: "No transcript found for this case" });
      }

      // Idempotency: skip extraction if obligations already exist
      const existingItems = await storage.getActionItemsByCase(caseId, userId);
      if (existingItems.length > 0) {
        return res.json({ items: existingItems, extractionCost: 0, skipped: true });
      }
      
      // Import document service dynamically
      const { DocumentService } = await import("./services/documentService");
      const documentService = new DocumentService();
      
      const metadata = {
        title: caseData.title,
        clientName: caseData.clientName,
        matterReference: caseData.matterReference || undefined,
        recordingDate: new Date().toISOString().split('T')[0],
      };
      
      const result = await documentService.extractActionItems(transcript.content, metadata);
      
      // Store extracted action items with originalDescription for audit trail
      const createdItems = [];
      for (const item of result.items) {
        const created = await storage.createActionItem({
          caseId,
          transcriptId: transcript.id,
          description: item.description,
          originalDescription: item.description, // Preserve AI-generated text for audit
          assignee: item.assignee || null,
          dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
          priority: item.priority || "medium",
          status: 'draft', // All AI-extracted items start as draft
        });
        createdItems.push(created);
      }
      
      await logAuditEvent(userId, "action_items_extracted", {
        caseId,
        metadata: {
          itemCount: createdItems.length,
          cost: result.cost,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        },
        req,
      });
      
      res.json({
        items: createdItems,
        extractionCost: result.cost,
      });
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
      
      // SECURITY: Verify ownership using centralized storage method
      const objectInfo = await storage.findObjectByPath(objectPath, userId);
      
      // Authorization: User must own the object
      // CRITICAL: If object is unknown (null) OR not owned, deny access
      // This prevents access to legacy paths, unknown object types, and unowned objects
      if (!objectInfo) {
        // Object not found in any table - deny access
        return res.sendStatus(403);
      }
      
      if (!objectInfo.owned) {
        // Object exists but user doesn't own it - deny access
        return res.sendStatus(403);
      }
      
      // Type-specific processing (currently only audio)
      if (objectInfo.type === 'audio') {
        const audioRecording = await storage.getAudioRecording(objectInfo.objectId);
        
        if (!audioRecording) {
          return res.sendStatus(404);
        }
        
        // GDPR Compliance: Check expiration and delete if expired
        if (new Date() > audioRecording.expiresAt && !audioRecording.deletedAt) {
          if (audioRecording.filePath) {
            try {
              await deleteCaseAudioRecording({
                caseId: audioRecording.caseId,
                audioRecordingId: audioRecording.id,
                filePath: objectPath,
                trigger: "lazy_objects",
                userId,
                expiresAt: audioRecording.expiresAt,
                req,
              });
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
              return res.status(410).json({ message: "Audio recording has expired (7-day retention policy)" });
            } catch (deleteError) {
              if (deleteError instanceof LitigationHoldDeletionBlockedError) {
                // Hold active — fall through to serve the file
              } else {
                console.error("Failed to delete expired audio:", deleteError);
                return res.status(410).json({ message: "Audio recording has expired (7-day retention policy)" });
              }
            }
          } else {
            return res.status(410).json({ message: "Audio recording has expired (7-day retention policy)" });
          }
        }
      }
      
      // Fetch and stream the object (ownership already verified)
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
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

      filters.userId = userId;
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

      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) return res.status(404).json({ message: "Case not found" });

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

  // Signed audit PDF export — DISABLED pending ownership/firm scoping fix
  app.post("/api/audit/export/signed-pdf", isAuthenticated, async (_req, res) => {
    res.status(503).json({ message: "This endpoint is temporarily disabled" });
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

  /** Any authenticated user may edit firm letterhead and logo (shared firm profile). */
  const canManageFirmProfile = async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      next();
    } catch (err) {
      next(err);
    }
  };

  // Update user role (admin only)
  app.patch("/api/admin/users/:id/role", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      const validRoles = ['solicitor', 'supervisor', 'partner', 'colp', 'admin'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
      }
      const updated = await storage.updateUserRole(id, role);
      if (!updated) return res.status(404).json({ message: "User not found" });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // Force-update a user's locked display name (admin only)
  app.patch("/api/admin/users/:id/display-name", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const nameSchema = z.object({
        firstName: z.string().min(1).max(100).transform((s) => s.trim()),
        lastName: z.string().min(1).max(100).transform((s) => s.trim()),
      });
      const { firstName, lastName } = nameSchema.parse(req.body);
      const user = await storage.confirmUserDisplayName(
        req.params.id,
        { firstName, lastName },
        { force: true },
      );
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      next(error);
    }
  });

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
      const ADMIN_USER_ID = process.env.ADMIN_USER_ID || "48381245";
      const userStats = await storage.getUserStatistics();
      const enriched = userStats.map(u => ({
        ...u,
        isAdmin: u.userId === ADMIN_USER_ID,
      }));
      res.json(enriched);
    } catch (error) {
      next(error);
    }
  });

  // Mint signed DPA acceptance links (admin only — signing key never leaves the server)
  app.post("/api/admin/dpa/mint", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const schema = z.object({
        evaluationPeriodDays: z.coerce.number().int().min(1).max(3650),
        feeEarnerCount: z.coerce.number().int().min(1).max(100000),
        validForDays: z.coerce.number().int().min(1).max(365),
        ref: z
          .string()
          .max(100)
          .optional()
          .transform((s) => (s?.trim() ? s.trim() : undefined)),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid mint request",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const { evaluationPeriodDays, feeEarnerCount, validForDays, ref } = parsed.data;
      const expiresAtUnix = Math.floor(Date.now() / 1000) + validForDays * 24 * 60 * 60;
      const expiresAt = new Date(expiresAtUnix * 1000);

      const { buildSignedKeyTermsQuery } = await import("./services/keyTermsSign");
      const query = buildSignedKeyTermsQuery(
        { evaluationPeriodDays, feeEarnerCount, expiresAtUnix },
        ref ? { ref } : undefined,
      );
      const baseUrl = getCanonicalBaseUrl(req);
      const url = `${baseUrl}/dpa?${query}`;

      res.json({
        url,
        evaluationPeriodDays,
        feeEarnerCount,
        ktExp: expiresAtUnix,
        validForDays,
        expiresAt: expiresAt.toISOString(),
        expiresAtDisplay: expiresAt.toUTCString(),
        ref: ref ?? null,
      });
    } catch (error) {
      next(error);
    }
  });

  // List all DPA / evaluation acceptances (admin only)
  app.get("/api/admin/dpa/acceptances", isAuthenticated, isAdmin, async (_req, res, next) => {
    try {
      const { legalAgreementAcceptances } = await import("@shared/schema");
      const { desc } = await import("drizzle-orm");
      const rows = await db
        .select({
          id: legalAgreementAcceptances.id,
          status: legalAgreementAcceptances.status,
          firmName: legalAgreementAcceptances.firmName,
          signerName: legalAgreementAcceptances.signerName,
          signerTitle: legalAgreementAcceptances.signerTitle,
          email: legalAgreementAcceptances.email,
          sraNumber: legalAgreementAcceptances.sraNumber,
          ref: legalAgreementAcceptances.ref,
          evaluationPeriodDays: legalAgreementAcceptances.evaluationPeriodDays,
          feeEarnerCount: legalAgreementAcceptances.feeEarnerCount,
          acceptedAt: legalAgreementAcceptances.acceptedAt,
          createdAt: legalAgreementAcceptances.createdAt,
          verifyToken: legalAgreementAcceptances.verifyToken,
        })
        .from(legalAgreementAcceptances)
        .orderBy(desc(legalAgreementAcceptances.createdAt));

      // verifyToken is returned only so the admin UI can build tokenised certificate
      // links; the page must not display the raw token.
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  // Provision an evaluation firm reserved for a lead email (platform admin only)
  app.post("/api/admin/evaluation-firms", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const schema = z.object({
        firmName: z.string().min(1).max(300).transform((s) => s.trim()),
        leadEmail: z.string().email().max(255),
        seatLimit: z.coerce.number().int().min(1).max(500).default(3),
        evaluationEndsAt: z.string().min(1).max(40).optional().nullable(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid provision request",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      let evaluationEndsAt: Date | null = null;
      if (parsed.data.evaluationEndsAt) {
        const raw = parsed.data.evaluationEndsAt.trim();
        evaluationEndsAt = /^\d{4}-\d{2}-\d{2}$/.test(raw)
          ? new Date(`${raw}T23:59:59.000Z`)
          : new Date(raw);
        if (Number.isNaN(evaluationEndsAt.getTime())) {
          return res.status(400).json({ message: "Invalid evaluation end date" });
        }
      }

      const prior = await storage.getFirmByProvisionedLeadEmail(parsed.data.leadEmail);
      const wasUpdate = Boolean(prior && !prior.provisionedLeadUserId);

      const firm = await storage.provisionEvaluationFirm({
        firmName: parsed.data.firmName,
        leadEmail: parsed.data.leadEmail,
        seatLimit: parsed.data.seatLimit,
        provisionedByUserId: req.user.claims.sub,
        evaluationEndsAt,
      });

      await storage.createAuditLog({
        eventType: wasUpdate ? "evaluation_firm_provision_updated" : "evaluation_firm_provisioned",
        userId: req.user.claims.sub,
        severity: "info",
        metadata: {
          firmId: firm.id,
          firmName: firm.name,
          leadEmail: firm.provisionedLeadEmail,
          seatLimit: firm.seatLimit,
          evaluationEndsAt: firm.evaluationEndsAt,
          wasUpdate,
        },
      }).catch(() => {});

      res.status(wasUpdate ? 200 : 201).json({ ...firm, wasUpdate });
    } catch (error: any) {
      if (error?.message && /already|member/i.test(error.message)) {
        return res.status(409).json({ message: error.message });
      }
      next(error);
    }
  });

  app.get("/api/admin/evaluation-firms", isAuthenticated, isAdmin, async (_req, res, next) => {
    try {
      const firmsList = await storage.listEvaluationFirms();
      res.json(firmsList);
    } catch (error) {
      next(error);
    }
  });

  // Email a provisioned governed-evaluation lead their first-login invite
  app.post("/api/admin/evaluation-firms/send-login-invite", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const schema = z.object({
        firmId: z.string().uuid().optional(),
        email: z.string().email().max(255).optional(),
        /** Optional: correct evaluation end date before sending the invite email. */
        evaluationEndsAt: z.string().min(1).max(40).optional().nullable(),
      }).refine((d) => Boolean(d.firmId || d.email), {
        message: "Provide firmId or email",
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid request — provide a firmId or lead email",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      let firm = parsed.data.firmId
        ? await storage.getFirm(parsed.data.firmId)
        : undefined;
      if (!firm && parsed.data.email) {
        firm = await storage.getFirmByProvisionedLeadEmail(parsed.data.email);
      }
      if (!firm || !firm.isEvaluation) {
        return res.status(404).json({
          message: "No evaluation firm found for that firm or email. Provision the firm first.",
        });
      }
      if (!firm.provisionedLeadEmail) {
        return res.status(400).json({
          message: "This evaluation firm has no lead email on file.",
        });
      }

      if (parsed.data.evaluationEndsAt !== undefined) {
        let evaluationEndsAt: Date | null = null;
        if (parsed.data.evaluationEndsAt) {
          const raw = parsed.data.evaluationEndsAt.trim();
          evaluationEndsAt = /^\d{4}-\d{2}-\d{2}$/.test(raw)
            ? new Date(`${raw}T23:59:59.000Z`)
            : new Date(raw);
          if (Number.isNaN(evaluationEndsAt.getTime())) {
            return res.status(400).json({ message: "Invalid evaluation end date" });
          }
        }
        const updated = await storage.updateFirm(firm.id, { evaluationEndsAt });
        if (updated) firm = updated;
      }

      const adminUser = await storage.getUser(req.user.claims.sub);
      const invitedByName = adminUser
        ? [adminUser.firstName, adminUser.lastName].filter(Boolean).join(" ") || adminUser.email
        : null;

      const emailResult = await sendGovernedEvaluationLoginInviteEmail({
        to: firm.provisionedLeadEmail,
        firmName: firm.name,
        seatLimit: firm.seatLimit,
        evaluationEndsAt: firm.evaluationEndsAt,
        invitedByName,
      });

      if (!emailResult.success) {
        return res.status(502).json({
          message: emailResult.error || "Failed to send invite email",
          firmId: firm.id,
          email: firm.provisionedLeadEmail,
        });
      }

      await storage.createAuditLog({
        eventType: "evaluation_login_invite_sent",
        userId: req.user.claims.sub,
        severity: "info",
        metadata: {
          firmId: firm.id,
          firmName: firm.name,
          leadEmail: firm.provisionedLeadEmail,
          alreadyClaimed: Boolean(firm.provisionedLeadUserId),
          messageId: emailResult.messageId,
        },
      }).catch(() => {});

      res.json({
        success: true,
        message: `Login invite sent to ${firm.provisionedLeadEmail}`,
        firmId: firm.id,
        firmName: firm.name,
        email: firm.provisionedLeadEmail,
        alreadyClaimed: Boolean(firm.provisionedLeadUserId),
        messageId: emailResult.messageId,
      });
    } catch (error) {
      next(error);
    }
  });

  // Seed the Reeve family sample matter into a target user account (platform admin only)
  app.post("/api/admin/sample-matters/reeve", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const schema = z.object({
        email: z.string().email().max(255).optional(),
        userId: z.string().min(1).max(128).optional(),
      }).refine((d) => Boolean(d.email || d.userId), {
        message: "Provide email or userId",
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid request — provide a user email or userId",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const { seedReeveSampleMatter } = await import("./services/seedReeveSampleMatter");
      const result = await seedReeveSampleMatter({
        userEmail: parsed.data.email,
        userId: parsed.data.userId,
      });

      if (!result.success) {
        const notFound = /no user found/i.test(result.message);
        return res.status(notFound ? 404 : 400).json(result);
      }

      await storage.createAuditLog({
        eventType: "sample_matter_seeded",
        userId: req.user.claims.sub,
        caseId: result.caseId,
        severity: "info",
        metadata: {
          sample: "reeve_family_conference",
          targetUserId: result.userId,
          targetEmail: result.userEmail,
          matterReference: "REE/FAM26-01188",
        },
      }).catch(() => {});

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  // Strategy documents API (admin only)
  app.get("/api/admin/docs", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const docsDir = path.join(process.cwd(), 'docs');
      
      const files = await fs.readdir(docsDir);
      const mdFiles = files.filter(f => f.endsWith('.md'));
      
      const docs = await Promise.all(mdFiles.map(async (filename) => {
        const filePath = path.join(docsDir, filename);
        const stats = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        const firstLine = content.split('\n')[0].replace(/^#\s*/, '').trim();
        
        return {
          filename,
          title: firstLine || filename.replace('.md', '').replace(/_/g, ' '),
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
        };
      }));
      
      res.json(docs);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/docs/:filename", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { filename } = req.params;
      
      // Security: prevent directory traversal
      if (filename.includes('..') || filename.includes('/') || !filename.endsWith('.md')) {
        return res.status(400).json({ message: "Invalid filename" });
      }
      
      const filePath = path.join(process.cwd(), 'docs', filename);
      
      // Check file size before reading (limit to 1MB to prevent blocking)
      const stats = await fs.stat(filePath);
      const MAX_FILE_SIZE = 1024 * 1024; // 1MB
      if (stats.size > MAX_FILE_SIZE) {
        return res.status(413).json({ message: "File too large for PDF export" });
      }
      
      const content = await fs.readFile(filePath, 'utf-8');
      
      res.json({ filename, content });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ message: "Document not found" });
      }
      next(error);
    }
  });

  // Waitlist admin endpoints
  app.get("/api/admin/waitlist", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const entries = await storage.getAllWaitlistEntries();
      res.json(entries);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/waitlist/stats", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const stats = await storage.getWaitlistStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/waitlist/:id", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      
      const updates: any = {};
      if (status) updates.status = status;
      if (notes !== undefined) updates.notes = notes;
      
      if (status === 'invited') {
        updates.invitedAt = new Date();
        updates.invitedBy = req.user.claims.sub;
      }
      
      const entry = await storage.updateWaitlistEntry(id, updates);
      if (!entry) {
        return res.status(404).json({ message: "Waitlist entry not found" });
      }
      
      res.json(entry);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/waitlist/:id", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const { id } = req.params;
      await storage.deleteWaitlistEntry(id);
      res.status(204).send();
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

  // Update firm profile (platform admin or firm admin)
  app.put("/api/firm-profile", isAuthenticated, canManageFirmProfile, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertFirmProfileSchema.parse({
        ...req.body,
        updatedBy: userId,
      });
      
      const updatedProfile = await storage.upsertFirmProfile(validatedData);
      
      await logAuditEvent(userId, "firm_profile_updated", {
        req,
        metadata: { action: "update", firmProfileId: updatedProfile.id },
      });
      
      res.json(updatedProfile);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  });

  // Patch only the logoUrl on firm profile — works even when other required fields are not yet set.
  // Used by the logo upload flow so upload always persists independently of profile completeness.
  app.patch("/api/firm-profile/logo-url", isAuthenticated, canManageFirmProfile, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { logoUrl } = req.body;
      if (typeof logoUrl !== 'string') {
        return res.status(400).json({ message: 'logoUrl must be a string (empty string to remove logo)' });
      }
      const updated = await storage.patchFirmProfileLogoUrl(logoUrl, userId);
      res.json(updated);
    } catch (error: any) {
      next(error);
    }
  });

  // Firm risk digest — DISABLED pending firm-scoped isolation fix
  app.get("/api/firm/risk-digest", isAuthenticated, async (_req, res) => {
    res.status(503).json({ message: "This endpoint is temporarily disabled" });
  });

  // Compliance score — DISABLED pending firm-scoped isolation fix
  app.get("/api/firm/compliance-score", isAuthenticated, async (_req, res) => {
    res.status(503).json({ message: "This endpoint is temporarily disabled" });
  });

  // Finance compliance overview — restricted to COFA, firm admin, and managing partner
  app.get("/api/firm/finance-compliance", isAuthenticated, requireFeatureVisible("firmComplianceDashboard"), async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "User not found" });

      const designations: string[] = user.regulatoryDesignations ?? [];
      const primaryRole = user.primaryRole ?? "";
      const hasAccess =
        designations.includes("is_cofa") ||
        designations.includes("is_firm_admin") ||
        primaryRole === "managing_partner";

      if (!hasAccess) {
        return res.status(403).json({ message: "Access restricted to COFA, firm administrators, and managing partners." });
      }

      // Gather all active (non-archived) firm matters
      const firmCases = user.firmId
        ? await storage.getFirmCases(user.firmId, false)
        : await storage.getCases(userId, false);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Build per-matter finance compliance data
      const matterData = await Promise.all(
        firmCases.map(async (c) => {
          const [caseTimeEntries, caseSessions] = await Promise.all([
            storage.getTimeEntriesByCase(c.id),
            storage.getMeetingSessionsByCase(c.id, userId),
          ]);

          const totalMinutes = caseTimeEntries.reduce((sum, e) => sum + e.durationMinutes, 0);
          const billableValue = caseTimeEntries.reduce((sum, e) => {
            const rate = parseFloat(e.hourlyRate) || 0;
            return sum + (rate * e.durationMinutes) / 60;
          }, 0);

          const lastEntry = caseTimeEntries.length > 0
            ? caseTimeEntries.reduce((latest, e) => new Date(e.createdAt) > new Date(latest.createdAt) ? e : latest)
            : null;

          const lastTimeEntryDate = lastEntry ? lastEntry.createdAt : null;
          const noTimeIn30Days = caseTimeEntries.length === 0 || (lastTimeEntryDate && new Date(lastTimeEntryDate) < thirtyDaysAgo);

          // Sessions with no time entry: sessions that have no time entry linked via meetingSessionId
          const sessionIdsWithEntry = new Set(caseTimeEntries.map(e => e.meetingSessionId).filter(Boolean));
          const sessionsWithNoEntry = caseSessions.filter(s => !sessionIdsWithEntry.has(s.id));

          // Billable but not communicated: time recorded but no costsEstimate on file
          const hasCostsEstimate = !!(c.costsEstimate && c.costsEstimate.trim().length > 0);

          // Unbilled: time has been recorded but no costs communication on file (costsEstimate null or empty)
          const hasTimeRecorded = caseTimeEntries.length > 0;

          return {
            caseId: c.id,
            caseTitle: c.title,
            clientName: c.clientName,
            matterReference: c.matterReference ?? null,
            practiceArea: c.practiceArea ?? null,
            createdAt: c.createdAt,
            totalMinutes,
            billableValue: Math.round(billableValue * 100) / 100,
            costsEstimate: c.costsEstimate ?? null,
            hasCostsEstimate,
            hasTimeRecorded,
            lastTimeEntryDate,
            noTimeIn30Days: !!noTimeIn30Days,
            sessionCount: caseSessions.length,
            sessionsWithNoEntryCount: sessionsWithNoEntry.length,
            timeEntryCount: caseTimeEntries.length,
          };
        })
      );

      // Compute variance: costsEstimate vs billableValue
      const mattersWithVariance = matterData.map((m) => {
        const estimatedAmount = m.costsEstimate ? parseFloat(m.costsEstimate.replace(/[^0-9.]/g, "")) : null;
        const variance = estimatedAmount !== null && !isNaN(estimatedAmount)
          ? Math.round((m.billableValue - estimatedAmount) * 100) / 100
          : null;
        return { ...m, estimatedAmount, variance };
      });

      // Summary counts
      const unbilledMatters = mattersWithVariance.filter(m => m.hasTimeRecorded && !m.hasCostsEstimate);
      const costsTransparencyFlags = mattersWithVariance.filter(m => !m.hasCostsEstimate);
      const timeGapMatters = mattersWithVariance.filter(m => m.sessionsWithNoEntryCount > 0);
      const inactiveMatters = mattersWithVariance.filter(m => m.noTimeIn30Days && m.hasTimeRecorded);

      res.json({
        summary: {
          totalActiveMatters: firmCases.length,
          unbilledCount: unbilledMatters.length,
          costsTransparencyCount: costsTransparencyFlags.length,
          timeGapCount: timeGapMatters.length,
          inactiveCount: inactiveMatters.length,
        },
        matters: mattersWithVariance,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) { next(error); }
  });

  // Public compliance badge (no auth — embeddable on firm website)
  app.get("/api/public/badge/:slug", async (req, res, next) => {
    try {
      if (!isFeatureVisible("publicComplianceBadge")) {
        return res.status(404).json({ message: "Not found" });
      }
      const { slug } = req.params;
      const profile = await storage.getFirmProfile();
      if (!profile || profile.complianceBadgeSlug !== slug || !profile.complianceBadgeEnabled) {
        return res.status(404).json({ message: "Badge not found" });
      }
      const score = await storage.getComplianceScore();
      res.json({ firmName: profile.firmName, score: score.overall, grade: score.grade, lastUpdated: score.lastUpdated });
    } catch (error) { next(error); }
  });

  app.get("/api/public/badge/:slug/image", async (_req, res) => {
    if (!isFeatureVisible("publicComplianceBadge")) {
      return res.status(404).json({ message: "Not found" });
    }
    return res.status(404).json({ message: "Not found" });
  });

  // PI Defence Pack — PDF bundle of all matter documentation for one case
  app.get("/api/cases/:id/pi-pack", isAuthenticated, requireFeatureVisible("piDefencePack"), async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;
      const caseRecord = await storage.getCase(caseId, userId);
      if (!caseRecord) return res.status(404).json({ message: "Matter not found" });

      const [docs, consentLogs, auditEntries, sessions] = await Promise.all([
        storage.getDocumentsByCase(caseId, userId),
        storage.getConsentLogsByCase(caseId, userId),
        storage.getAuditLogsByCase(caseId, 50),
        storage.getSessionsByCase(caseId, userId),
      ]);
      const firmProfile = await storage.getFirmProfile();

      await logPersonnelMatterAccess({
        userId,
        caseId,
        resource: "export",
        req,
        metadata: { exportType: "pi_defence_pack" },
      });

      // Return structured JSON bundle for client-side PDF generation
      res.json({
        matter: {
          title: caseRecord.title,
          matterReference: caseRecord.matterReference,
          practiceArea: caseRecord.practiceArea,
          clientName: caseRecord.clientName,
          createdAt: caseRecord.createdAt,
          riskLevel: caseRecord.riskLevel,
        },
        firm: firmProfile ? { firmName: firmProfile.firmName, sraNumber: firmProfile.sraNumber, email: firmProfile.email } : null,
        sessions: sessions.map(s => ({
          id: s.id, recordingType: s.recordingType, sessionTitle: s.sessionTitle,
          startedAt: s.startedAt, durationSeconds: s.durationSeconds, status: s.status,
        })),
        documents: docs.filter(d => d.isActive).map(d => ({
          id: d.id, type: d.type, sessionId: d.meetingSessionId,
          createdAt: d.createdAt, content: d.content,
        })),
        consentLog: consentLogs.map(c => ({
          consentGiven: c.consentGiven, consentModality: c.consentModality,
          consentTimestamp: c.consentTimestamp, disclaimerWordingText: c.disclaimerWordingText,
        })),
        auditHighlights: auditEntries.slice(0, 50).map(a => ({
          eventType: a.eventType, timestamp: a.timestamp, description: a.description,
          userId: a.userId, ipAddress: a.ipAddress,
        })),
        generatedAt: new Date().toISOString(),
        disclaimer: "This document pack is produced by LegalNote for professional indemnity defence purposes. It contains tamper-evident records of solicitor-client interactions.",
      });
    } catch (error) { next(error); }
  });

  // Upload firm logo (platform admin or firm admin) — stores as public object, returns URL
  app.post("/api/firm-profile/logo", isAuthenticated, canManageFirmProfile, async (req: any, res, next) => {
    try {
      const multerMod = await import('multer');
      const logoUpload = multerMod.default({
        storage: multerMod.default.memoryStorage(),
        limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
        fileFilter: (_req: any, file: any, cb: any) => {
          const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
          if (allowed.includes(file.mimetype)) {
            cb(null, true);
          } else {
            cb(new Error('Only PNG, JPG, and SVG files are allowed'));
          }
        },
      });

      await new Promise<void>((resolve, reject) => {
        logoUpload.single('logo')(req, res as any, (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const objectStorageService = new ObjectStorageService();
      const ext = req.file.mimetype === 'image/svg+xml' ? 'svg' : req.file.mimetype === 'image/png' ? 'png' : 'jpg';
      const fileKey = `public/logos/firm-logo-${Date.now()}.${ext}`;
      await objectStorageService.uploadFile(fileKey, req.file.buffer, req.file.mimetype);

      // Build a proxy URL for the logo (served through our /api/logo/serve route)
      const logoUrl = `/api/firm-profile/logo/serve?key=${encodeURIComponent(fileKey)}`;

      res.json({ logoUrl, fileKey });
    } catch (error: any) {
      next(error);
    }
  });

  // Serve firm logo from object storage (public proxy)
  app.get("/api/firm-profile/logo/serve", async (req: any, res, next) => {
    try {
      const key = req.query.key as string;
      if (!key || !key.startsWith('public/logos/')) {
        return res.status(400).json({ message: 'Invalid logo key' });
      }
      const objectStorageService = new ObjectStorageService();
      const fileBuffer = await objectStorageService.getObjectEntityFile(key);
      const ext = key.split('.').pop()?.toLowerCase();
      const contentType = ext === 'svg' ? 'image/svg+xml' : ext === 'png' ? 'image/png' : 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(fileBuffer);
    } catch (error: any) {
      next(error);
    }
  });

  // Get user preferences
  app.get("/api/user-preferences", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = await storage.getUserPreferences(userId);
      res.json(preferences || {
        userId,
        dismissedReviewBanner: false,
        completedOnboarding: false,
        completedIntegrationsOnboarding: false,
      });
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
  
  // Direct OAuth connect route (for Settings page navigation)
  // GET endpoint that redirects to the OAuth authorization URL
  app.get("/api/oauth/connect/:provider", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const provider = req.params.provider;
      
      if (provider !== 'google') {
        return res.status(400).json({ message: "Invalid provider. Only 'google' is supported" });
      }

      // Create signed OAuth state
      const statePayload: OAuthStatePayload = {
        userId,
        provider: 'google',
        popup: false,
        nonce: generateSecureNonce(),
        createdAt: Date.now(),
        baseUrl: getCanonicalBaseUrl(req),
      };

      const signedState = signOAuthState(statePayload);

      // Get base URL from request
      const baseUrl = getCanonicalBaseUrl(req);

      try {
        const client = createGoogleOAuthClient(baseUrl);
        const authUrl = getGoogleAuthUrl(client, signedState);
        console.log('[OAUTH] Generated Google auth URL:', authUrl);
        console.log('[OAUTH] Redirect URI used:', `${baseUrl}/api/calendar/callback/google`);

        // Redirect to OAuth authorization URL
        console.log('[OAUTH] Redirecting to:', authUrl);
        return res.redirect(authUrl);
      } catch (configError: any) {
        console.error(`[OAUTH] Failed to create Google OAuth client:`, configError.message);
        return res.status(503).json({
          message: `Google OAuth is not configured. Please contact your administrator.`,
        });
      }
    } catch (error) {
      next(error);
    }
  });

  // Initiate OAuth flow for calendar provider
  // Accepts optional sync context (caseId, deadline) for auto-sync after OAuth
  app.post("/api/calendar/auth/:provider", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const provider = req.params.provider;
      const popup = req.query.popup === 'true';
      
      if (provider !== 'google' && provider !== 'outlook') {
        return res.status(400).json({ message: "Invalid provider. Only 'google' and 'outlook' are supported" });
      }

      // Optional sync context from request body
      const { caseId, deadline, notes, priority, isAllDay } = req.body || {};

      if (provider === 'outlook') {
        try {
          const baseUrl = getCanonicalBaseUrl(req);
          const statePayload: OAuthStatePayload = {
            userId,
            provider: 'outlook',
            popup,
            nonce: generateSecureNonce(),
            createdAt: Date.now(),
            baseUrl,
            ...(caseId && deadline
              ? {
                  syncContext: {
                    caseId,
                    deadline: new Date(deadline).toISOString(),
                    notes: notes || undefined,
                    priority: priority || 'normal',
                    isAllDay: isAllDay || false,
                  },
                }
              : {}),
          };

          const signedState = signOAuthState(statePayload);
          const authUrl = getMicrosoftAuthUrl(baseUrl, signedState);

          return res.json({ authUrl });
        } catch (configError: any) {
          return res.status(503).json({
            message: 'Microsoft OAuth is not configured. Please contact your administrator.',
            details: configError.message,
          });
        }
      }

      // Google OAuth flow
      // Create signed OAuth state with sync context
      const baseUrl = getCanonicalBaseUrl(req);
      const statePayload: OAuthStatePayload = {
        userId,
        provider: 'google',
        popup,
        nonce: generateSecureNonce(),
        createdAt: Date.now(),
        baseUrl,
      };

      // Add sync context if provided
      if (caseId && deadline) {
        statePayload.syncContext = {
          caseId, // UUID string - no parsing needed
          deadline: new Date(deadline).toISOString(),
          notes: notes || undefined,
          priority: priority || 'normal',
          isAllDay: isAllDay || false,
        };
      }

      // Sign the state token
      const signedState = signOAuthState(statePayload);

      try {
        const client = createGoogleOAuthClient(baseUrl);
        const authUrl = getGoogleAuthUrl(client, signedState);

        // Return auth URL for frontend to redirect
        res.json({ authUrl });
      } catch (error: any) {
        // OAuth credentials not configured
        if (error.message.includes('not configured')) {
          return res.status(503).json({
            message: `Google OAuth is not configured. Please contact your administrator.`,
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

      // Check for OAuth errors (popup unknown — default to Settings redirect)
      if (oauthError) {
        return res.redirect(
          buildCalendarOAuthReturnUrl(false, {
            calendar_error: String(oauthError),
          }),
        );
      }

      if (!code || !state) {
        return res.redirect(
          buildCalendarOAuthReturnUrl(false, {
            calendar_error: 'missing_code_or_state',
          }),
        );
      }

      // Verify and decode signed state token
      const stateData = verifyOAuthState(state as string);
      
      if (!stateData) {
        console.error('Invalid or expired OAuth state token');
        return res.redirect(
          buildCalendarOAuthReturnUrl(false, { calendar_error: 'invalid_state' }),
        );
      }

      // Verify provider matches
      if (stateData.provider !== provider) {
        return res.redirect(
          buildCalendarOAuthReturnUrl(stateData.popup, {
            calendar_error: 'provider_mismatch',
          }),
        );
      }

      // Use the same base URL that was embedded in the auth request (avoids redirect_uri mismatch)
      const baseUrl = stateData.baseUrl || getCanonicalBaseUrl(req);

      try {
        if (provider === 'outlook') {
          const tokenData = await exchangeMicrosoftCode(code as string, baseUrl);

          await storage.saveCalendarIntegration({
            userId: stateData.userId,
            provider: 'outlook',
            accessToken: tokenData.accessToken,
            refreshToken: tokenData.refreshToken || undefined,
            expiresAt: tokenData.expiresAt || undefined,
            email: tokenData.email || undefined,
          });

          console.log(`[OAUTH] Outlook calendar connected for user ${stateData.userId}`);

          await storage.createAuditLog({
            eventType: 'calendar_connected',
            userId: stateData.userId,
            ipAddress: req.ip || req.socket?.remoteAddress,
            metadata: {
              provider: 'outlook',
              email: tokenData.email || 'N/A',
            },
            severity: 'info',
          });

          if (stateData.syncContext) {
            const { caseId, deadline, notes, priority, isAllDay } = stateData.syncContext;
            try {
              const caseData = await storage.getCase(caseId, stateData.userId);
              if (!caseData) {
                return res.redirect(
                  buildCalendarOAuthReturnUrl(stateData.popup, {
                    calendar_connected: 'outlook',
                    sync_error: 'case_not_found',
                    case_id: caseId,
                  }),
                );
              }

              const { Client } = await import('@microsoft/microsoft-graph-client');
              const { computeReminderSchedule } = await import('./reminderScheduler');
              const graphClient = Client.initWithMiddleware({
                authProvider: { getAccessToken: async () => tokenData.accessToken },
              });
              const deadlineDate = new Date(deadline);
              const { minutesBefore } = computeReminderSchedule({
                deadline: deadlineDate,
                isAllDay: isAllDay || false,
                priority: priority || 'normal',
              });
              const eventSubject = `${caseData.clientName} - ${caseData.title}`;
              const event: any = {
                subject: eventSubject,
                body: {
                  contentType: 'Text',
                  content: notes || `LegalNote deadline for ${caseData.clientName}${caseData.matterReference ? ` (${caseData.matterReference})` : ''}`,
                },
                isReminderOn: true,
                reminderMinutesBeforeStart: minutesBefore[0] || 15,
              };
              if (isAllDay) {
                const dateStr = deadlineDate.toISOString().split('T')[0];
                event.isAllDay = true;
                event.start = { dateTime: `${dateStr}T00:00:00`, timeZone: 'Europe/London' };
                event.end = { dateTime: `${dateStr}T23:59:59`, timeZone: 'Europe/London' };
              } else {
                const endDate = new Date(deadlineDate.getTime() + 60 * 60 * 1000);
                event.start = { dateTime: deadlineDate.toISOString(), timeZone: 'Europe/London' };
                event.end = { dateTime: endDate.toISOString(), timeZone: 'Europe/London' };
              }
              const createdEvent = await graphClient.api('/me/events').post(event);

              if (createdEvent?.id) {
                await storage.createCalendarEvent({
                  caseId,
                  userId: stateData.userId,
                  provider: 'outlook',
                  providerEventId: createdEvent.id,
                  eventType: 'deadline',
                });
              }

              await storage.updateCase(caseId, {
                syncToCalendar: true,
              }, stateData.userId);

              await storage.createAuditLog({
                eventType: 'calendar_event_created',
                userId: stateData.userId,
                caseId,
                ipAddress: req.ip || req.socket?.remoteAddress,
                metadata: {
                  provider: 'outlook',
                  eventTitle: eventSubject,
                  deadline,
                  autoSync: true,
                },
                severity: 'info',
              });

              return res.redirect(
                buildCalendarOAuthReturnUrl(stateData.popup, {
                  calendar_connected: 'outlook',
                  sync_success: 'true',
                  case_id: caseId,
                }),
              );
            } catch (syncError: any) {
              console.error('[OAUTH] Outlook auto-sync failed:', syncError);
              return res.redirect(
                buildCalendarOAuthReturnUrl(stateData.popup, {
                  calendar_connected: 'outlook',
                  sync_error: 'event_creation_failed',
                  case_id: caseId,
                }),
              );
            }
          }

          return res.redirect(
            buildCalendarOAuthReturnUrl(stateData.popup, {
              calendar_connected: 'outlook',
            }),
          );
        }

        if (provider !== 'google') {
          return res.redirect(
            buildCalendarOAuthReturnUrl(stateData.popup, {
              calendar_error: 'invalid_provider',
            }),
          );
        }

        const client = createGoogleOAuthClient(baseUrl);
        const tokenData = await exchangeGoogleCode(client, code as string);

        // Save calendar integration to storage
        await storage.saveCalendarIntegration({
          userId: stateData.userId,
          provider: 'google',
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken || undefined,
          expiresAt: tokenData.expiresAt || undefined,
          email: tokenData.email || undefined,
        });

        // Log audit event
        await storage.createAuditLog({
          eventType: 'calendar_connected',
          userId: stateData.userId,
          ipAddress: req.ip || req.socket?.remoteAddress,
          metadata: {
            provider,
            email: tokenData.email || 'N/A',
          },
          severity: 'info',
        });

        // If sync context exists, attempt to create calendar event immediately
        if (stateData.syncContext) {
          const { caseId, deadline, notes, priority, isAllDay } = stateData.syncContext;
          
          try {
            // Get case data for event details
            const caseData = await storage.getCase(caseId, stateData.userId);
            
            if (!caseData) {
              console.error(`Case ${caseId} not found for auto-sync`);
              return res.redirect(
                buildCalendarOAuthReturnUrl(stateData.popup, {
                  calendar_connected: provider,
                  sync_error: 'case_not_found',
                }),
              );
            }

            // Create calendar event with retry logic
            const maxRetries = 3;
            let lastError: any = null;
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                const result = await createCalendarEvent(
                  stateData.userId,
                  {
                    caseId,
                    title: caseData.title,
                    clientName: caseData.clientName,
                    matterReference: caseData.matterReference || undefined,
                    deadline: new Date(deadline),
                    notes: notes || undefined,
                    priority: priority || 'normal',
                    isAllDay: isAllDay || false,
                  },
                  storage
                );

                if (!result.success) {
                  throw new Error(result.error || 'Calendar event creation failed');
                }

                // Save calendar event to database
                if (result.eventId) {
                  await storage.createCalendarEvent({
                    caseId,
                    userId: stateData.userId,
                    provider: 'google',
                    providerEventId: result.eventId,
                    eventType: 'deadline',
                  });
                }

                // Update case to mark as synced
                await storage.updateCase(caseId, {
                  syncToCalendar: true,
                }, stateData.userId);

                // Log successful sync
                await storage.createAuditLog({
                  eventType: 'calendar_event_created',
                  userId: stateData.userId,
                  caseId,
                  ipAddress: req.ip || req.socket?.remoteAddress,
                  metadata: {
                    provider,
                    eventTitle: `${caseData.clientName} - ${caseData.caseType}`,
                    deadline: deadline,
                    autoSync: true,
                  },
                  severity: 'info',
                });

                // Success! Redirect to case page with success message
                return res.redirect(
                  buildCalendarOAuthReturnUrl(stateData.popup, {
                    calendar_connected: provider,
                    sync_success: 'true',
                    case_id: caseId,
                  }),
                );
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
            return res.redirect(
              buildCalendarOAuthReturnUrl(stateData.popup, {
                calendar_connected: provider,
                sync_error: 'event_creation_failed',
                case_id: caseId,
              }),
            );
          } catch (error: any) {
            console.error('Auto-sync error:', error);
            return res.redirect(
              buildCalendarOAuthReturnUrl(stateData.popup, {
                calendar_connected: provider,
                sync_error: 'unknown',
                case_id: caseId,
              }),
            );
          }
        }

        res.redirect(
          buildCalendarOAuthReturnUrl(stateData.popup, {
            calendar_connected: provider,
          }),
        );
      } catch (error: any) {
        console.error(`OAuth token exchange failed for ${provider}:`, error);
        const rawMessage =
          error instanceof Error ? error.message : 'token_exchange_failed';
        const calendarError =
          provider === 'outlook'
            ? mapMicrosoftOAuthErrorCode(rawMessage)
            : 'token_exchange_failed';
        res.redirect(
          buildCalendarOAuthReturnUrl(stateData.popup, {
            calendar_error: calendarError,
          }),
        );
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
      const baseUrl = getCanonicalBaseUrl(req);
      const microsoftDiagnostics = diagnoseMicrosoftCredentials();

      const config = {
        baseUrl,
        redirectUris: {
          google: `${baseUrl}/api/calendar/callback/google`,
          googleLogin: `${baseUrl}/api/auth/google/callback`,
          outlook: `${baseUrl}/api/calendar/callback/outlook`,
        },
        instructions: {
          google: {
            step1: "Go to Google Cloud Console: https://console.cloud.google.com/apis/credentials",
            step2: "Select your OAuth 2.0 Client ID (the same one used for login)",
            step3: `Add this calendar redirect URI to 'Authorized redirect URIs': ${baseUrl}/api/calendar/callback/google`,
            step4: "Note: this is separate from the login URI (/api/auth/google/callback). Both must be listed if you use both features.",
            step5: "Click Save and wait a few minutes for Google to propagate changes",
          },
          outlook: {
            step1: "Go to Azure Portal → App registrations → your Microsoft app",
            step2: "Open Certificates & secrets → New client secret → copy the Value immediately (not the Secret ID)",
            step3: `Set MICROSOFT_CLIENT_SECRET (or MICROSOFT_LOGIN_CLIENT_SECRET) to that Value in your deployment secrets`,
            step4: "Open Authentication → Redirect URIs",
            step5: `Add this redirect URI: ${baseUrl}/api/calendar/callback/outlook`,
            step6: "Under API permissions, grant Calendars.ReadWrite, User.Read, and offline_access (with admin consent if required)",
          },
        },
        status: {
          googleConfigured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
          outlookConfigured: microsoftDiagnostics.configured && !microsoftDiagnostics.issue,
          outlookSecretSource: microsoftDiagnostics.secretSource,
          outlookIssue: microsoftDiagnostics.issue,
          outlookIssueDetail: microsoftDiagnostics.issueDetail,
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
        return res.status(400).json({ message: "Invalid provider. Only 'google' and 'outlook' are supported" });
      }

      await storage.deleteCalendarIntegration(userId, provider);

      // Log audit event
      await storage.createAuditLog({
        eventType: 'calendar_disconnected',
        userId,
        ipAddress: req.ip || req.socket?.remoteAddress,
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
      const { provider, notes, priority, isAllDay } = req.body;

      console.log('[SYNC] Calendar sync requested:', {
        caseId: req.params.id,
        userId,
        provider,
        hasNotes: !!notes,
        priority,
        isAllDay,
      });

      if (!provider || !['google', 'outlook'].includes(provider)) {
        return res.status(400).json({ message: "Invalid provider. Supported: 'google', 'outlook'" });
      }

      // Get case and verify access
      const caseData = await storage.getCase(req.params.id, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }

      console.log('[SYNC] Case found:', {
        caseId: req.params.id,
        deadline: caseData.deadline?.toISOString(),
      });

      // Check if case has a deadline
      if (!caseData.deadline) {
        return res.status(400).json({ message: "Case must have a deadline to sync to calendar" });
      }

      // Prepare event data with notes, priority, and isAllDay flag
      const eventData = {
        caseId: req.params.id,
        title: caseData.title,
        clientName: caseData.clientName,
        matterReference: caseData.matterReference || undefined,
        deadline: new Date(caseData.deadline),
        notes: notes || caseData.textNotes || undefined,
        priority: priority || caseData.priority || 'normal',
        isAllDay: isAllDay !== undefined ? isAllDay : false,
      };

      // Check if event already exists for this provider
      const existingEvent = await storage.getCalendarEventByProvider(req.params.id, userId, provider);

      let result: { success: boolean; eventId?: string; error?: string; provider?: string };
      
      // Handle Outlook calendar sync
      if (provider === 'outlook') {
        const outlookIntegration = await storage.getCalendarIntegration(userId, 'outlook');

        if (!outlookIntegration || !outlookIntegration.accessToken || outlookIntegration.accessToken === 'replit-managed') {
          return res.status(400).json({ message: "Outlook calendar is not connected. Please connect via Settings." });
        }

        const { ensureFreshOutlookToken } = await import('./oauth');
        const baseUrl = getCanonicalBaseUrl(req);
        const accessToken = await ensureFreshOutlookToken(storage, userId, baseUrl);

        const { Client } = await import('@microsoft/microsoft-graph-client');
        const { computeReminderSchedule } = await import('./reminderScheduler');
        const graphClient = Client.initWithMiddleware({
          authProvider: { getAccessToken: async () => accessToken },
        });

        const deadlineDate = eventData.deadline;
        const { minutesBefore } = computeReminderSchedule({
          deadline: deadlineDate,
          isAllDay: eventData.isAllDay || false,
          priority: eventData.priority || 'normal',
        });

        const event: any = {
          subject: `Deadline: ${caseData.title}`,
          body: {
            contentType: 'Text',
            content: `LegalNote Case Deadline\n\nCase: ${caseData.title}\nClient: ${caseData.clientName}${eventData.notes ? `\n\nNotes: ${eventData.notes}` : ''}\n\nCase ID: ${req.params.id}\nCreated by LegalNote`,
          },
          isReminderOn: true,
          reminderMinutesBeforeStart: minutesBefore[0] || 15,
        };

        if (eventData.isAllDay) {
          const dateStr = deadlineDate.toISOString().split('T')[0];
          event.isAllDay = true;
          event.start = { dateTime: `${dateStr}T00:00:00`, timeZone: 'Europe/London' };
          event.end = { dateTime: `${dateStr}T23:59:59`, timeZone: 'Europe/London' };
        } else {
          const endDate = new Date(deadlineDate.getTime() + 60 * 60 * 1000);
          event.start = { dateTime: deadlineDate.toISOString(), timeZone: 'Europe/London' };
          event.end = { dateTime: endDate.toISOString(), timeZone: 'Europe/London' };
        }

        try {
          let outlookEventId: string | undefined;

          if (existingEvent) {
            await graphClient.api(`/me/events/${existingEvent.providerEventId}`).patch(event);
            outlookEventId = existingEvent.providerEventId;
            await storage.updateCalendarEvent(existingEvent.id, { lastUpdatedAt: new Date() });
          } else {
            const response = await graphClient.api('/me/events').post(event);
            outlookEventId = response.id;
          }

          if (outlookEventId && !existingEvent) {
            await storage.createCalendarEvent({
              caseId: req.params.id,
              userId,
              provider: 'outlook',
              providerEventId: outlookEventId,
              eventType: 'deadline',
              title: `Deadline: ${caseData.title}`,
              deadline: deadlineDate,
              isAllDay: eventData.isAllDay || false,
            });

            await storage.updateCase(req.params.id, {
              calendarSyncStatus: 'synced',
              calendarEventId: outlookEventId,
              calendarProvider: 'outlook',
            });
          }

          result = { success: true, eventId: outlookEventId, provider: 'outlook' };
        } catch (outlookError: any) {
          console.error('[SYNC] Outlook Graph API error:', outlookError);
          result = { success: false, error: outlookError.message, provider: 'outlook' };
        }
      }
      // Handle Google calendar sync via user OAuth
      else if (provider === 'google') {
        const googleIntegration = await storage.getCalendarIntegration(userId, 'google');
        if (!googleIntegration?.accessToken || googleIntegration.accessToken === 'replit-managed') {
          return res.status(400).json({ message: "Google Calendar is not connected. Please connect via Settings." });
        }

        if (existingEvent) {
          result = await updateCalendarEvent(userId, existingEvent.providerEventId, eventData, storage);
          if (result.success) {
            await storage.updateCalendarEvent(existingEvent.id, { lastUpdatedAt: new Date() });
          }
        } else {
          result = await createCalendarEvent(userId, eventData, storage);
          if (result.success && result.eventId) {
            await storage.createCalendarEvent({
              caseId: req.params.id,
              userId: userId,
              provider: 'google',
              providerEventId: result.eventId,
              eventType: 'deadline',
            });
          }
        }
      }

      if (result.success) {
        console.log('[SYNC] ✅ Calendar sync successful');
        // Update case to mark calendar sync enabled
        await storage.updateCase(req.params.id, { syncToCalendar: true }, userId);

        await logAuditEvent(userId, "calendar_synced", {
          caseId: req.params.id,
          metadata: { provider, action: existingEvent ? 'update' : 'create' },
          req,
        });

        res.json({ success: true, provider: result.provider });
      } else {
        console.error('[SYNC] ❌ Calendar sync failed:', result.error);
        await logAuditEvent(userId, "calendar_sync_failed", {
          caseId: req.params.id,
          metadata: { provider, error: result.error },
          req,
        });

        // Check if this is an OAuth token expiry issue
        const isTokenExpired = result.error === 'invalid_grant' || 
                               result.error?.includes('invalid_grant') ||
                               result.error?.includes('Token has been expired') ||
                               result.error?.includes('Token has been revoked');

        if (isTokenExpired) {
          // Don't delete the connection - just inform user they need to reconnect
          // User can manually reconnect in Settings to get fresh tokens
          res.status(401).json({ 
            success: false, 
            message: "Your calendar connection has expired. Please go to Settings and reconnect your calendar.",
            error: 'token_expired',
            requiresReconnect: true,
          });
        } else {
          res.status(500).json({ 
            success: false, 
            message: "Failed to sync to calendar",
            error: result.error 
          });
        }
      }
    } catch (error: any) {
      console.error('[SYNC] ❌ Exception during sync:', error);
      next(error);
    }
  });

  app.delete("/api/cases/:id/unsync-calendar", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { provider } = req.body;

      if (provider && !['google', 'outlook'].includes(provider)) {
        return res.status(400).json({ message: "Invalid provider. Supported: 'google', 'outlook'" });
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
        if (event.provider === 'outlook') {
          const del = await deleteOutlookCalendarEvent(
            userId,
            event.providerEventId,
            storage,
            getCanonicalBaseUrl(req),
          );
          if (!del.success) {
            console.warn('[UNSYNC] Outlook delete failed:', del.error);
          }
        } else {
          await deleteCalendarEvent(userId, event.providerEventId, storage);
        }
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

  // Log document export/download events
  app.post("/api/cases/:id/audit/track-change", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { action, documentId, changes } = req.body;

      if (!action || !Array.isArray(changes) || changes.length === 0) {
        return res.status(400).json({ message: "action and a non-empty changes array are required" });
      }

      const caseData = await storage.getCase(req.params.id, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }

      const TEXT_CAP = 1000;
      for (const change of changes) {
        const rawText = typeof change.text === 'string' ? change.text : '';
        const fullLength = rawText.length;
        const truncated = fullLength > TEXT_CAP;
        const text = truncated ? rawText.slice(0, TEXT_CAP) : rawText;

        await logAuditEvent(userId, "track_change_action", {
          caseId: req.params.id,
          documentId: documentId || undefined,
          metadata: {
            action,
            changeId: change.changeId || null,
            changeType: change.changeType || null,
            text,
            author: change.author || null,
            changeTimestamp: change.changeTimestamp || null,
            ...(truncated ? { truncated: true, fullLength } : {}),
          },
          req,
        });
      }

      res.json({ success: true, loggedCount: changes.length });
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/cases/:id/audit/export", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { format, documents: exportedDocs } = req.body;
      
      // Verify user has access to the case
      const caseData = await storage.getCase(req.params.id, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }

      await logAuditEvent(userId, "documents_exported", {
        caseId: req.params.id,
        metadata: { 
          format: format || 'pdf',
          documents: exportedDocs || [],
          documentCount: exportedDocs?.length || 0,
        },
        req,
      });
      
      // Track document versions exported (for client version tracking)
      const allCaseDocuments = await storage.getActiveDocumentsByCase(req.params.id, userId);
      // A4: Verify document integrity before export
      const integrityFailures: string[] = [];
      for (const doc of allCaseDocuments) {
        if (doc.contentHash && doc.contentSignature) {
          const signingKey = process.env.AUDIT_SIGNING_KEY || '';
          if (signingKey) {
            const expectedSig = crypto.createHmac('sha256', signingKey)
              .update(doc.contentHash)
              .digest('hex');
            if (doc.contentSignature !== expectedSig) {
              integrityFailures.push(doc.id);
              await logAuditEvent(userId, "document_integrity_failure", {
                caseId: req.params.id,
                documentId: doc.id,
                metadata: {
                  context: "export",
                  hashValid: true,
                  signatureValid: false,
                },
                severity: "critical",
              });
            }
          }
        }
      }

      if (integrityFailures.length > 0) {
        return res.status(422).json({
          message: "Export blocked: document integrity verification failed",
          failedDocumentIds: integrityFailures,
        });
      }
      for (const doc of allCaseDocuments) {
        if ((exportedDocs || []).includes(doc.type)) {
          await storage.createClientVersionTracking({
            documentId: doc.id,
            sentToClient: true,
            sentAt: new Date(),
            sentBy: userId,
            sentMethod: 'download',
            amendmentReason: null,
            versionChangeWarned: false,
          });
        }
      }
      
      res.json({ success: true });
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/cases/:id/audit/verify-chain", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;

      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) return res.status(404).json({ message: "Case not found" });

      const entries = await storage.getAuditLogsByCase(caseId);
      const { getAuditSigningKey, verifyAuditChainEntries } = await import("./services/auditChain");
      const signingKey = getAuditSigningKey();
      const { chainIntact, failedEntryIds } = verifyAuditChainEntries(entries, signingKey);

      res.json({
        caseId,
        totalEntries: entries.length,
        chainIntact,
        failedEntryIds,
        verifiedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/cases/:id/consent/verify", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = req.params.id;

      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) return res.status(404).json({ message: "Case not found" });

      const { verifyCaseConsentSealing } = await import("./services/assertSealedConsent");
      const result = await verifyCaseConsentSealing(caseId);

      res.json({
        caseId,
        ...result,
        verifiedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      next(error);
    }
  });

  // ============================================
  // Recall.ai Video Conferencing Integration
  // ============================================
  
  // Check if Recall.ai is configured
  app.get("/api/recall/status", isAuthenticated, async (req: any, res, next) => {
    try {
      const { recallService } = await import("./services/recallService");
      const userId = req.user.claims.sub;
      
      const connection = await storage.getRecallConnection(userId);
      const isConfigured = recallService.isConfigured();
      
      res.json({
        configured: isConfigured,
        connected: connection?.status === 'active',
        connection: connection ? {
          status: connection.status,
          connectedAt: connection.connectedAt,
          lastSyncAt: connection.lastSyncAt,
        } : null,
      });
    } catch (error) {
      next(error);
    }
  });
  
  // Connect to Recall.ai (validate API key and create connection)
  app.post("/api/recall/connect", isAuthenticated, async (req: any, res, next) => {
    try {
      const { recallService } = await import("./services/recallService");
      const userId = req.user.claims.sub;
      
      const result = await recallService.validateConnection(userId);
      
      if (result.valid) {
        await storage.createAuditLog({
          eventType: 'recall_connected',
          userId,
          ipAddress: req.ip || req.socket?.remoteAddress,
          metadata: { message: result.message },
          severity: 'info',
        });
      }
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
  
  // Disconnect from Recall.ai
  app.delete("/api/recall/disconnect", isAuthenticated, async (req: any, res, next) => {
    try {
      const { recallService } = await import("./services/recallService");
      const userId = req.user.claims.sub;
      
      await recallService.disconnectUser(userId);
      
      await storage.createAuditLog({
        eventType: 'recall_disconnected',
        userId,
        ipAddress: req.ip || req.socket?.remoteAddress,
        metadata: {},
        severity: 'info',
      });
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });
  
  // List available meetings for import
  app.get("/api/recall/meetings", isAuthenticated, async (req: any, res, next) => {
    try {
      const { recallService } = await import("./services/recallService");
      const userId = req.user.claims.sub;
      
      // Check if user is connected
      const connection = await storage.getRecallConnection(userId);
      if (!connection || connection.status !== 'active') {
        return res.status(400).json({ message: "Not connected to Recall.ai" });
      }
      
      const meetings = await recallService.getImportableMeetings(userId);
      res.json(meetings);
    } catch (error) {
      next(error);
    }
  });
  
  // Get user's meeting imports
  app.get("/api/recall/imports", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const imports = await storage.getMeetingImportsByUser(userId);
      res.json(imports);
    } catch (error) {
      next(error);
    }
  });
  
  // Start importing a meeting
  app.post("/api/recall/import", isAuthenticated, async (req: any, res, next) => {
    try {
      const { recallService } = await import("./services/recallService");
      const userId = req.user.claims.sub;
      const { botId, caseId, preConsentEmailId } = req.body;
      // SECURITY: Never trust client-provided consentConfirmed - always verify server-side
      
      if (!botId) {
        return res.status(400).json({ message: "Bot ID is required" });
      }
      
      // Check if user is connected
      const connection = await storage.getRecallConnection(userId);
      if (!connection || connection.status !== 'active') {
        return res.status(400).json({ message: "Not connected to Recall.ai" });
      }
      
      // Verify case access if provided
      if (caseId) {
        const caseData = await storage.getCase(caseId, userId);
        if (!caseData) {
          return res.status(404).json({ message: "Case not found" });
        }
      }
      
      // Server-side consent verification from pre-consent email acknowledgement
      let hasValidConsent = false;
      if (preConsentEmailId) {
        const consentEmail = await storage.getPreConsentEmail(preConsentEmailId);
        if (consentEmail && consentEmail.consentAcknowledged && consentEmail.userId === userId) {
          hasValidConsent = true;
        }
      }
      
      // Start the import with server-verified consent status
      const meetingImport = await recallService.startMeetingImport(
        userId,
        botId,
        caseId,
        hasValidConsent, // Only true if we verified server-side
        preConsentEmailId
      );
      
      await storage.createAuditLog({
        eventType: 'meeting_import_started',
        userId,
        caseId: caseId || undefined,
        ipAddress: req.ip || req.socket?.remoteAddress,
        metadata: {
          botId,
          platform: meetingImport.meetingPlatform,
          consentVerified: hasValidConsent,
          preConsentEmailId: preConsentEmailId || null,
        },
        severity: 'info',
      });
      
      res.json(meetingImport);
    } catch (error) {
      next(error);
    }
  });
  
  // Get import status
  app.get("/api/recall/import/:importId", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const importData = await storage.getMeetingImport(req.params.importId);
      
      if (!importData || importData.userId !== userId) {
        return res.status(404).json({ message: "Import not found" });
      }
      
      res.json(importData);
    } catch (error) {
      next(error);
    }
  });
  
  // Process a bot recording import (download from Recall.ai and trigger AI pipeline)
  app.post("/api/recall/import/:importId/process", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { importId } = req.params;

      const importRecord = await storage.getMeetingImport(importId);
      if (!importRecord || importRecord.userId !== userId) {
        return res.status(404).json({ message: "Import not found" });
      }
      if (!['live', 'pending', 'failed'].includes(importRecord.status)) {
        return res.status(400).json({ message: `This recording is already ${importRecord.status} and cannot be re-processed.` });
      }
      if (!importRecord.recallBotId) {
        return res.status(400).json({ message: "No bot ID on this import" });
      }

      const botNotDone = importRecord.botStatus && !['done', 'recording_done', 'call_ended', 'fatal'].includes(importRecord.botStatus);
      if (importRecord.status === 'live' && botNotDone) {
        return res.status(400).json({ message: "The bot is still in the meeting. Processing will start automatically when it finishes." });
      }

      await storage.updateMeetingImport(importId, { status: 'pending' });
      const fresh = await storage.getMeetingImport(importId);

      const { processBotRecording } = await import("./services/recallProcessing");
      processBotRecording(fresh!).catch((err) => {
        console.error('[ManualProcess] processBotRecording error:', err.message);
      });

      res.json({ message: "Processing started", importId });
    } catch (error) {
      next(error);
    }
  });
  
  // Get the active/live import for a case (used by case detail page to show processing banner)
  app.get("/api/cases/:caseId/live-import", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId } = req.params;
      const imports = await storage.getMeetingImportsByCase(caseId, userId);
      // Return the most recent active import first
      const active = imports.find(i => ['live', 'pending', 'transcribing', 'failed'].includes(i.status));
      if (active) {
        // Auto-resolve stuck imports once the case already has documents or a transcript
        if (['transcribing', 'pending', 'live'].includes(active.status)) {
          const docs = await storage.getDocumentsByCase(caseId, userId);
          const hasDocs = docs && docs.length > 0;
          let hasTranscript = false;
          if (!hasDocs) {
            try {
              const t = await storage.getTranscriptByCase(caseId, userId);
              hasTranscript = !!t?.content;
            } catch {
              hasTranscript = false;
            }
          }
          if (hasDocs || hasTranscript) {
            await storage.updateMeetingImport(active.id, { status: 'completed' });
            return res.json(null);
          }
        }
        return res.json({
          importId: active.id,
          botId: active.recallBotId,
          status: active.status,
          botStatus: active.botStatus,
          errorMessage: active.errorMessage,
          createdAt: active.createdAt,
          consentMode: active.consentMode || 'pre_confirmed',
          consentConfirmed: active.consentConfirmed,
        });
      }
      // Also return clearly-ended imports where in-meeting consent is still unresolved
      // (transcribing → completed → failed) so the banner persists until consent is confirmed.
      // 'pending' is excluded: it's shown via the generic live-import banner which has
      // its own processing prompt, and the consent banner only appears once session has ended.
      const pendingConsentCompleted = imports.find(
        i => ['transcribing', 'completed', 'failed'].includes(i.status) && (i.consentMode || 'pre_confirmed') === 'in_meeting' && !i.consentConfirmed
      );
      if (pendingConsentCompleted) {
        return res.json({
          importId: pendingConsentCompleted.id,
          botId: pendingConsentCompleted.recallBotId,
          status: pendingConsentCompleted.status,
          botStatus: pendingConsentCompleted.botStatus,
          errorMessage: pendingConsentCompleted.errorMessage,
          createdAt: pendingConsentCompleted.createdAt,
          consentMode: pendingConsentCompleted.consentMode || 'pre_confirmed',
          consentConfirmed: pendingConsentCompleted.consentConfirmed,
        });
      }
      res.json(null);
    } catch (error) {
      next(error);
    }
  });

  // Link import to a case
  app.patch("/api/recall/import/:importId/link-case", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId } = req.body;
      
      if (!caseId) {
        return res.status(400).json({ message: "Case ID is required" });
      }
      
      const importData = await storage.getMeetingImport(req.params.importId);
      if (!importData || importData.userId !== userId) {
        return res.status(404).json({ message: "Import not found" });
      }
      
      // Verify case access
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      await storage.updateMeetingImport(importData.id, { caseId });
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Get all unassigned meeting imports (awaiting matter assignment)
  app.get("/api/recall/imports/unassigned", isAuthenticated, pollingLimiter, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const imports = await storage.getUnassignedMeetingImports(userId);
      res.json(imports);
    } catch (error) {
      next(error);
    }
  });

  // Incomplete video-bot imports for recovery-style prompt on app load
  app.get("/api/recall/imports/incomplete", isAuthenticated, pollingLimiter, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const imports = await storage.getMeetingImportsByUser(userId);
      const incompleteStatuses = new Set([
        "live",
        "pending",
        "downloading",
        "transcribing",
        "awaiting_assignment",
        "failed",
      ]);
      const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const incomplete = imports.filter(
        (i) =>
          incompleteStatuses.has(i.status) &&
          i.recallBotId &&
          new Date(i.createdAt).getTime() >= cutoff,
      );

      const caseIds = Array.from(
        new Set(incomplete.map((i) => i.caseId).filter((id): id is string => !!id)),
      );
      const caseTitleById = new Map<string, string>();
      await Promise.all(
        caseIds.map(async (caseId) => {
          const c = await storage.getCase(caseId, userId);
          if (c?.title) caseTitleById.set(caseId, c.title);
        }),
      );

      res.json(
        incomplete.map((i) => ({
          importId: i.id,
          botId: i.recallBotId,
          caseId: i.caseId,
          caseTitle: i.caseId ? caseTitleById.get(i.caseId) || null : null,
          status: i.status,
          botStatus: i.botStatus,
          meetingTitle: i.meetingTitle,
          meetingPlatform: i.meetingPlatform,
          meetingUrl: i.meetingUrl,
          createdAt: i.createdAt,
          consentMode: i.consentMode || "pre_confirmed",
          consentConfirmed: i.consentConfirmed,
          errorMessage: i.errorMessage,
        })),
      );
    } catch (error) {
      next(error);
    }
  });

  // Assign an unassigned meeting import to a matter and trigger processing
  // Supports: { caseId } to link to existing case, or { createCase: true, caseData: { title, clientName } } to create a new matter inline
  app.post("/api/recall/import/:importId/assign", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId: bodyExistingCaseId, recordingType, createCase: shouldCreateCase, caseData: newCaseData } = req.body;

      if (!shouldCreateCase && !bodyExistingCaseId) {
        return res.status(400).json({ message: "Either caseId or createCase with caseData is required" });
      }
      if (shouldCreateCase && (!newCaseData?.title)) {
        return res.status(400).json({ message: "caseData.title is required when createCase is true" });
      }

      const importData = await storage.getMeetingImport(req.params.importId);
      if (!importData || importData.userId !== userId) {
        return res.status(404).json({ message: "Import not found" });
      }

      if (importData.status !== 'awaiting_assignment') {
        return res.status(400).json({ message: "This recording is not awaiting assignment" });
      }

      let caseId = bodyExistingCaseId;

      if (shouldCreateCase) {
        // Create a new matter inline (client or internal/firm)
        const resolvedTitle = (newCaseData?.title || 'Meeting recording').trim();
        const matterKind = normalizeMatterKind(newCaseData?.matterKind);
        const isClientMatter = isClientMatterKind(matterKind);
        const resolvedClientName = (newCaseData?.clientName || '').trim();

        if (isClientMatter && !resolvedClientName) {
          return res.status(400).json({ message: "caseData.clientName is required when createCase is true for a client matter" });
        }

        let newCase;
        if (isClientMatter) {
          const clientData = await storage.createClient({ name: resolvedClientName }, userId);
          newCase = await storage.createCase({
            title: resolvedTitle,
            clientId: clientData.id,
            clientName: resolvedClientName,
            matterKind: "client",
            status: 'pending',
            priority: 'normal',
            sourceType: 'audio',
          }, userId);
        } else {
          newCase = await storage.createCase({
            title: resolvedTitle,
            clientName: partyLabelForMatterKind(matterKind),
            matterKind,
            hasExternalAttendees: !!newCaseData?.hasExternalAttendees,
            status: 'pending',
            priority: 'normal',
            sourceType: 'audio',
            conflictCheckCompleted: false,
          }, userId);
        }
        caseId = newCase.id;
      } else {
        // Verify access to the existing case
        const caseData = await storage.getCase(caseId, userId);
        if (!caseData) {
          return res.status(404).json({ message: "Case not found" });
        }
      }

      const assignedCase = await storage.getCase(caseId, userId);
      const recordingTypeResult = validateRecordingType(
        recordingType || defaultRecordingTypeForMatterKind(assignedCase?.matterKind),
        { matterKind: assignedCase?.matterKind },
      );
      if (!recordingTypeResult.ok) {
        return res.status(400).json({ message: recordingTypeResult.message });
      }
      const resolvedRecordingType = recordingTypeResult.recordingType;

      // Create a meeting session for this recording with all required fields
      let createdSessionId: string | undefined;
      try {
        const newSession = await storage.createMeetingSession({
          caseId,
          createdBy: userId,
          recordingType: resolvedRecordingType,
          status: 'pending',
          durationSeconds: importData.durationSeconds || undefined,
        });
        createdSessionId = newSession.id;
      } catch (sessionErr) {
        console.warn('[Assign] Failed to create meeting session:', sessionErr);
      }

      // Link the import to the case and mark as pending
      // The processing pipeline reads audioStoragePath to use stored recording rather than re-fetching from Recall
      await storage.updateMeetingImport(importData.id, {
        caseId,
        status: 'pending',
      });

      await storage.createAuditLog({
        eventType: 'meeting_import_assigned',
        userId,
        caseId,
        ipAddress: req.ip || req.socket?.remoteAddress,
        metadata: { importId: importData.id, caseId, recordingType: resolvedRecordingType, sessionId: createdSessionId },
        severity: 'info',
      });

      // Seal prior in-meeting attestation onto the case now that it has a matter ID.
      if (importData.consentConfirmed) {
        const { recordConsentEvent } = await import('./services/recordConsentEvent');
        await recordConsentEvent({
          caseId,
          solicitorId: userId,
          consentGiven: true,
          disclaimerScriptVersion: CONSENT_DISCLAIMER_VERSION,
          disclaimerWordingText: CONSENT_DISCLAIMER_TEXT,
          consentModality: 'verbal_attested',
          lawfulBasis: 'consent',
          recordingPurpose: 'Creation of attendance notes and transcripts for legal record-keeping',
          source: 'recall_assign_prior_attestation',
          req,
          auditMetadataExtras: {
            importId: importData.id,
            sealedOnAssignment: true,
          },
        });
      }

      // Trigger the AI processing pipeline asynchronously
      // The pipeline will use the stored audio at audioStoragePath to avoid relying on Recall URL availability
      const updatedImport = await storage.getMeetingImport(importData.id);
      if (updatedImport) {
        const { processBotRecording } = await import('./services/recallProcessing');
        processBotRecording(updatedImport).catch((err: Error) => {
          console.error(`[Assign] Background processing error for import ${importData.id}:`, err.message);
        });
      }

      res.json({ success: true, caseId, importId: importData.id });
    } catch (error) {
      next(error);
    }
  });

  // Discard an unassigned meeting import — GDPR: deletes stored recording from object storage
  app.post("/api/recall/import/:importId/discard", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;

      const importData = await storage.getMeetingImport(req.params.importId);
      if (!importData || importData.userId !== userId) {
        return res.status(404).json({ message: "Import not found" });
      }

      if (importData.status !== 'awaiting_assignment') {
        return res.status(400).json({ message: "Only recordings awaiting assignment can be discarded" });
      }

      // GDPR: delete the stored recording from object storage BEFORE marking as discarded.
      // This is transactional — if deletion fails we do NOT mark the record discarded and return an error.
      if (importData.audioStoragePath) {
        try {
          const { ObjectStorageService } = await import('./objectStorage');
          const storageService = new ObjectStorageService();
          await storageService.deleteObjectEntity(importData.audioStoragePath);
          console.log(`[Discard] Deleted recording from object storage: ${importData.audioStoragePath}`);
        } catch (deleteErr: any) {
          // Deletion failed — do NOT mark discarded; inform caller so they can retry
          console.error(`[Discard] Storage deletion failed for import ${importData.id}:`, deleteErr.message);
          return res.status(500).json({
            message: 'Could not delete recording from storage — import not discarded. Please try again.',
            retryable: true,
          });
        }
      }

      // Storage deletion confirmed (or there was no file to delete) — now mark as discarded
      await storage.updateMeetingImport(importData.id, {
        status: 'discarded',
        audioStoragePath: null,
        errorMessage: 'Discarded by user — no matter assigned',
      });

      await storage.createAuditLog({
        eventType: 'meeting_import_discarded',
        userId,
        caseId: undefined,
        ipAddress: req.ip || req.socket?.remoteAddress,
        metadata: { importId: importData.id, audioDeleted: !!importData.audioStoragePath },
        severity: 'info',
      });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Update consent status - requires audit log entry for GDPR compliance
  app.patch("/api/recall/import/:importId/consent", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { preConsentEmailId, userConfirmsVerbalConsent, elapsedSeconds, consentSource: clientConsentSource } = req.body;
      // SECURITY: Don't accept a direct "confirmed" flag - require evidence
      
      const importData = await storage.getMeetingImport(req.params.importId);
      if (!importData || importData.userId !== userId) {
        return res.status(404).json({ message: "Import not found" });
      }
      
      let consentConfirmed = false;
      let consentSource = '';
      
      // Option 1: Verify pre-consent email was acknowledged
      if (preConsentEmailId) {
        const consentEmail = await storage.getPreConsentEmail(preConsentEmailId);
        if (consentEmail && consentEmail.consentAcknowledged && consentEmail.userId === userId) {
          consentConfirmed = true;
          consentSource = 'pre_consent_email';
        } else {
          return res.status(400).json({ 
            message: "Pre-consent email has not been acknowledged by the participant" 
          });
        }
      }
      // Option 2: User attests that verbal consent was obtained during the call
      // This creates an audit trail of the user's attestation for GDPR compliance
      else if (userConfirmsVerbalConsent === true) {
        consentConfirmed = true;
        
        // Format elapsed time label for audit trail
        let elapsedLabel: string | undefined;
        if (typeof elapsedSeconds === 'number' && elapsedSeconds >= 0) {
          const m = Math.floor(elapsedSeconds / 60);
          const s = elapsedSeconds % 60;
          elapsedLabel = m > 0 ? `${m}m ${s}s` : `${s}s`;
        }

        // Determine source: prefer explicit clientConsentSource from caller; otherwise
        // infer from elapsedSeconds (in-recording) or import's consentMode (post-meeting)
        const auditSource = clientConsentSource === 'post_meeting_confirm'
          ? 'post_meeting_confirm'
          : clientConsentSource === 'in_meeting_live_panel'
          ? 'in_meeting_live_panel'
          : elapsedLabel
          ? 'in_meeting_live_panel'
          : (importData.consentMode || 'pre_confirmed') === 'in_meeting'
          ? 'post_meeting_confirm'
          : 'pre_confirmed_verbal';

        // Align API response source with audit source for consistency
        consentSource = auditSource;

        // In-meeting live confirmation with a timestamp is captured on the recording itself.
        // Post-meeting attestation remains verbal_attested (no playable consent snippet expected).
        const consentModality =
          auditSource === "in_meeting_live_panel" && typeof elapsedSeconds === "number" && elapsedSeconds >= 0
            ? "verbal_recorded"
            : "verbal_attested";

        if (importData.caseId) {
          const { recordConsentEvent } = await import("./services/recordConsentEvent");
          await recordConsentEvent({
            caseId: importData.caseId,
            solicitorId: userId,
            consentGiven: true,
            disclaimerScriptVersion: CONSENT_DISCLAIMER_VERSION,
            disclaimerWordingText: CONSENT_DISCLAIMER_TEXT,
            consentModality,
            lawfulBasis: "consent",
            recordingPurpose: "Creation of attendance notes and transcripts for legal record-keeping",
            source: auditSource,
            req,
            ipAddress: req.ip || req.socket?.remoteAddress,
            auditMetadataExtras: {
              importId: importData.id,
              meetingPlatform: importData.meetingPlatform,
              ...(elapsedLabel ? { elapsedIntoRecording: elapsedLabel } : {}),
              ...(typeof elapsedSeconds === "number" ? { audioSecondsAtConsent: elapsedSeconds } : {}),
            },
          });
        } else {
          await storage.createAuditLog({
            eventType: "consent_attestation",
            userId,
            ipAddress: req.ip || req.socket?.remoteAddress,
            metadata: {
              importId: importData.id,
              attestationType: "verbal_consent_obtained",
              attestedAt: new Date().toISOString(),
              meetingPlatform: importData.meetingPlatform,
              source: auditSource,
              consentModality,
              disclaimerScriptVersion: CONSENT_DISCLAIMER_VERSION,
              disclaimerWordingText: CONSENT_DISCLAIMER_TEXT,
              ...(elapsedLabel ? { elapsedIntoRecording: elapsedLabel } : {}),
              ...(typeof elapsedSeconds === "number" ? { audioSecondsAtConsent: elapsedSeconds } : {}),
            },
            severity: "info",
          });
        }
      }
      
      if (!consentConfirmed) {
        return res.status(400).json({ 
          message: "Consent verification required. Provide preConsentEmailId or userConfirmsVerbalConsent." 
        });
      }
      
      await storage.updateMeetingImport(importData.id, { 
        consentConfirmed: true,
        preConsentEmailId: preConsentEmailId || undefined,
        ...(typeof elapsedSeconds === "number" && elapsedSeconds >= 0
          ? { consentElapsedSeconds: Math.round(elapsedSeconds) }
          : {}),
      });
      
      res.json({ success: true, consentSource });
    } catch (error) {
      next(error);
    }
  });

  // Log an in-meeting consent decline — no DB flag change (solicitor can still obtain later),
  // but creates an audit trail entry for GDPR traceability
  app.post("/api/recall/import/:importId/consent-decline", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { elapsedSeconds } = req.body;
      const importData = await storage.getMeetingImport(req.params.importId);
      if (!importData || importData.userId !== userId) {
        return res.status(404).json({ message: "Import not found" });
      }

      let elapsedLabel: string | undefined;
      if (typeof elapsedSeconds === 'number' && elapsedSeconds >= 0) {
        const m = Math.floor(elapsedSeconds / 60);
        const s = elapsedSeconds % 60;
        elapsedLabel = m > 0 ? `${m}m ${s}s` : `${s}s`;
      }

      // Eject the bot immediately — solicitor must not have to remove it manually
      let botLeft = false;
      let leaveError: string | undefined;
      if (importData.recallBotId) {
        try {
          const { recallService } = await import("./services/recallService");
          await recallService.leaveCall(importData.recallBotId);
          botLeft = true;
        } catch (err) {
          leaveError = err instanceof Error ? err.message : String(err);
          console.error(`[Recall] leaveCall failed on consent decline for bot ${importData.recallBotId}:`, leaveError);
        }
      }

      await storage.updateMeetingImport(importData.id, {
        status: 'failed',
        botStatus: botLeft ? 'left_consent_declined' : (importData.botStatus || 'consent_declined'),
        errorMessage: 'Client declined consent — bot removed from call',
        consentConfirmed: false,
      });

      await storage.createAuditLog({
        eventType: 'consent_declined',
        userId,
        caseId: importData.caseId || undefined,
        metadata: {
          importId: importData.id,
          botId: importData.recallBotId,
          declinedAt: new Date().toISOString(),
          source: 'in_meeting_live_panel',
          botLeft,
          ...(leaveError ? { leaveError } : {}),
          ...(elapsedLabel ? { elapsedIntoRecording: elapsedLabel } : {}),
        },
        severity: 'warning',
      });

      res.json({ success: true, botLeft, leaveError });
    } catch (error) {
      next(error);
    }
  });

  // Send a consent link to client during or after a live bot meeting (email or SMS)
  app.post("/api/recall/import/:importId/send-consent-link", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { contactEmail, contactMobile, contactName, source: callerSource } = req.body;

      if (!contactEmail && !contactMobile) {
        return res.status(400).json({ message: "Client email or mobile number is required" });
      }

      const importData = await storage.getMeetingImport(req.params.importId);
      if (!importData || importData.userId !== userId) {
        return res.status(404).json({ message: "Import not found" });
      }

      const crypto = await import("crypto");
      const consentToken = crypto.randomBytes(32).toString("hex");

      const baseUrl = getCanonicalBaseUrl(req);
      const consentUrl = `${baseUrl}/consent/${consentToken}`;

      const recipientName = contactName || "Client";
      const recipientEmail = contactEmail || `sms-${consentToken.substring(0, 8)}@placeholder.invalid`;
      const emailSubject = "Recording consent request";
      const emailBody = [
        "Your solicitor has requested recording consent for a meeting.",
        "Respond via the LegalNote consent link. No matter details are included in this email.",
        consentUrl,
      ].join("\n\n");

      const consentEmail = await storage.createPreConsentEmail({
        userId,
        caseId: importData.caseId || undefined,
        recipientEmail,
        recipientName,
        emailSubject,
        emailBody,
        consentToken,
        emailStatus: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      let deliveryMethod = contactEmail ? 'email' : 'sms';

      if (contactEmail) {
        // Send via email
        try {
          const { sendPreConsentEmail } = await import("./email");
          const result = await sendPreConsentEmail({
            to: contactEmail,
            recipientName,
            consentUrl,
          });

          if (!result.success) {
            await storage.updatePreConsentEmail(consentEmail.id, { emailStatus: 'failed' });
            return res.status(500).json({ message: "Failed to send consent email" });
          }

          await storage.updatePreConsentEmail(consentEmail.id, {
            emailStatus: 'sent',
            emailSentAt: new Date(),
          });
        } catch (emailErr: any) {
          await storage.updatePreConsentEmail(consentEmail.id, { emailStatus: 'failed' });
          return res.status(500).json({ message: "Failed to send consent email", error: emailErr.message });
        }
      } else if (contactMobile) {
        // Send via SMS
        try {
          const { formatUKPhoneNumber, sendSmsMessage } = await import("./sms");
          const formattedPhone = formatUKPhoneNumber(contactMobile);
          const smsBody = `Your solicitor requests consent to record a meeting. Tap to respond: ${consentUrl}`;

          const smsResult = await sendSmsMessage(formattedPhone, smsBody);
          if (!smsResult.success) {
            await storage.updatePreConsentEmail(consentEmail.id, { emailStatus: 'failed' });
            const status = smsResult.error?.includes('not configured') ? 503 : 500;
            return res.status(status).json({
              message: smsResult.error || "Failed to send consent SMS",
            });
          }

          await storage.updatePreConsentEmail(consentEmail.id, {
            emailStatus: 'sent',
            emailSentAt: new Date(),
          });
          deliveryMethod = 'sms';
        } catch (smsErr: any) {
          await storage.updatePreConsentEmail(consentEmail.id, { emailStatus: 'failed' });
          return res.status(500).json({ message: "Failed to send consent SMS", error: smsErr.message });
        }
      }

      await storage.updateMeetingImport(importData.id, {
        preConsentEmailId: consentEmail.id,
      });

      await storage.createAuditLog({
        eventType: 'pre_consent_email_sent',
        userId,
        caseId: importData.caseId || undefined,
        metadata: {
          recipientEmail: contactEmail || undefined,
          recipientMobile: contactMobile || undefined,
          recipientName,
          consentEmailId: consentEmail.id,
          importId: importData.id,
          deliveryMethod,
          source: callerSource || 'live_meeting_panel',
        },
        severity: 'info',
      });

      res.json({ success: true, consentEmailId: consentEmail.id, deliveryMethod });
    } catch (error) {
      next(error);
    }
  });

  // ── Live Bot Workflow ──────────────────────────────────────────────────────

  // Send a bot to join a live meeting right now (ad-hoc, no calendar required)
  app.post("/api/recall/bot", isAuthenticated, async (req: any, res, next) => {
    try {
      const { recallService } = await import("./services/recallService");
      const userId = req.user.claims.sub;
      const { meetingUrl, caseId, consentMode } = req.body;
      const resolvedConsentMode = consentMode === 'in_meeting' ? 'in_meeting' : 'pre_confirmed';

      if (!meetingUrl) {
        return res.status(400).json({ message: "Meeting URL is required" });
      }

      const platform = recallService.detectMeetingPlatform(meetingUrl);
      if (!platform) {
        return res.status(400).json({ message: "URL must be a Zoom, Microsoft Teams, or Google Meet link" });
      }

      if (caseId) {
        const caseData = await storage.getCase(caseId, userId);
        if (!caseData) {
          return res.status(404).json({ message: "Case not found" });
        }
      }

      if (!recallService.isConfigured()) {
        return res.status(503).json({ message: "Video conferencing integration is not configured" });
      }

      // Deploy the bot
      let bot;
      try {
        bot = await recallService.createBot(meetingUrl, 'LegalNote');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Surface auth failures as a clear 503 so the frontend shows a readable message
        if (msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('authentication')) {
          return res.status(503).json({ message: 'Unable to connect to video conferencing service. The API key may be expired — please contact support.' });
        }
        return res.status(502).json({ message: `Bot deployment failed: ${msg}` });
      }

      // Create an import record to track this live session
      const meetingImport = await storage.createMeetingImport({
        userId,
        caseId: caseId || undefined,
        recallBotId: bot.id,
        meetingPlatform: platform,
        meetingUrl,
        status: 'live',
        botStatus: recallService.getBotStatusCode(bot) || 'joining_call',
        consentConfirmed: false,
        consentMode: resolvedConsentMode,
      });

      await storage.createAuditLog({
        eventType: 'live_bot_deployed',
        userId,
        caseId: caseId || undefined,
        ipAddress: req.ip || req.socket?.remoteAddress,
        metadata: { botId: bot.id, platform, meetingUrl },
        severity: 'info',
      });

      res.json({ importId: meetingImport.id, botId: bot.id, platform, status: recallService.getBotStatusCode(bot) });
    } catch (error) {
      next(error);
    }
  });

  // Poll the current status of a live bot
  app.get("/api/recall/bot/:botId", isAuthenticated, async (req: any, res, next) => {
    try {
      const { recallService } = await import("./services/recallService");
      const userId = req.user.claims.sub;
      const { botId } = req.params;

      let importRecord = await storage.getMeetingImportByBotId(botId);
      if (!importRecord || importRecord.userId !== userId) {
        return res.status(404).json({ message: "Bot not found" });
      }

      const bot = await recallService.getBot(botId);
      const botStatusCode = recallService.getBotStatusCode(bot);
      const subCode = recallService.getBotSubCode(bot);

      // Only write to DB when we have a status to record
      if (botStatusCode) {
        await storage.updateMeetingImport(importRecord.id, {
          botStatus: botStatusCode,
        });
        importRecord = (await storage.getMeetingImport(importRecord.id)) || importRecord;
      }

      // Fail fast on never-started / waiting-room timeouts so the client never
      // enters Meeting-to-Matter for an empty recording.
      const terminal =
        botStatusCode === 'done' ||
        botStatusCode === 'recording_done' ||
        botStatusCode === 'call_ended' ||
        botStatusCode === 'fatal';
      if (
        terminal &&
        importRecord.status === 'live'
      ) {
        const { markAbandonedIfNeverRecorded } = await import("./services/recallProcessing");
        const abandon = await markAbandonedIfNeverRecorded(importRecord, {
          subCode,
          botStatus: botStatusCode,
        });
        if (abandon.abandoned) {
          importRecord = (await storage.getMeetingImport(importRecord.id)) || importRecord;
        }
      }

      res.json({
        importId: importRecord.id,
        botId,
        botStatus: botStatusCode,
        subCode,
        importStatus: importRecord.status,
        errorMessage: importRecord.errorMessage || null,
        statusLabel: recallService.formatBotStatus(bot),
        participants: bot.meeting_participants?.map(p => ({ name: p.name })) || [],
        meetingTitle: bot.meeting_metadata?.title,
        consentMode: importRecord.consentMode || 'pre_confirmed',
        consentConfirmed: importRecord.consentConfirmed,
      });
    } catch (error) {
      next(error);
    }
  });

  // Cancel a live bot while still waiting / before recording starts (discards — no processing)
  app.post("/api/recall/bot/:botId/cancel", isAuthenticated, async (req: any, res, next) => {
    try {
      const { recallService } = await import("./services/recallService");
      const {
        USER_CANCELLED_LIVE_BOT_MESSAGE,
        isCancellableBotStatus,
      } = await import("@shared/liveBotLifecycle");
      const userId = req.user.claims.sub;
      const { botId } = req.params;

      const importRecord = await storage.getMeetingImportByBotId(botId);
      if (!importRecord || importRecord.userId !== userId) {
        return res.status(404).json({ message: "Bot not found" });
      }

      if (importRecord.status !== 'live') {
        return res.status(409).json({
          message: "This meeting session is no longer active",
          importStatus: importRecord.status,
        });
      }

      // Refresh status from Recall when possible
      let botStatus = importRecord.botStatus;
      try {
        const bot = await recallService.getBot(botId);
        botStatus = recallService.getBotStatusCode(bot) || botStatus;
      } catch {
        // proceed with stored status
      }

      if (botStatus === 'in_call_recording') {
        return res.status(409).json({
          message:
            "Recording is in progress — use Stop to leave and produce the attendance note.",
          botStatus,
          useStop: true,
        });
      }

      if (botStatus && !isCancellableBotStatus(botStatus)) {
        if (['done', 'recording_done', 'call_ended', 'fatal', 'left_consent_declined', 'left_user_cancelled'].includes(botStatus)) {
          return res.status(409).json({
            message: "LegalNote has already left this meeting",
            botStatus,
          });
        }
        return res.status(409).json({
          message: "LegalNote cannot be cancelled in the current state",
          botStatus,
        });
      }

      let botLeft = false;
      let leaveError: string | undefined;
      try {
        await recallService.leaveCall(botId);
        botLeft = true;
      } catch (err) {
        leaveError = err instanceof Error ? err.message : String(err);
        console.error(`[Recall] leaveCall failed on cancel for bot ${botId}:`, leaveError);
      }

      await storage.updateMeetingImport(importRecord.id, {
        status: 'failed',
        botStatus: botLeft ? 'left_user_cancelled' : (botStatus || 'left_user_cancelled'),
        errorMessage: USER_CANCELLED_LIVE_BOT_MESSAGE,
      });

      await storage.createAuditLog({
        eventType: 'live_bot_cancelled',
        userId,
        caseId: importRecord.caseId || undefined,
        ipAddress: req.ip || req.socket?.remoteAddress,
        metadata: {
          importId: importRecord.id,
          botId,
          botLeft,
          priorBotStatus: botStatus,
          ...(leaveError ? { leaveError } : {}),
        },
        severity: 'info',
      });

      const fresh = await storage.getMeetingImport(importRecord.id);
      res.json({
        success: true,
        botLeft,
        leaveError,
        importStatus: fresh?.status || 'failed',
        errorMessage: fresh?.errorMessage || USER_CANCELLED_LIVE_BOT_MESSAGE,
      });
    } catch (error) {
      next(error);
    }
  });

  // Stop a live bot during recording — leave the call but still produce the attendance note
  app.post("/api/recall/bot/:botId/stop", isAuthenticated, async (req: any, res, next) => {
    try {
      const { recallService } = await import("./services/recallService");
      const { isCancellableBotStatus } = await import("@shared/liveBotLifecycle");
      const userId = req.user.claims.sub;
      const { botId } = req.params;

      const importRecord = await storage.getMeetingImportByBotId(botId);
      if (!importRecord || importRecord.userId !== userId) {
        return res.status(404).json({ message: "Bot not found" });
      }

      if (importRecord.status !== 'live') {
        return res.status(409).json({
          message: "This meeting session is no longer active",
          importStatus: importRecord.status,
        });
      }

      let botStatus = importRecord.botStatus;
      try {
        const bot = await recallService.getBot(botId);
        botStatus = recallService.getBotStatusCode(bot) || botStatus;
      } catch {
        // proceed with stored status
      }

      if (
        botStatus &&
        ['done', 'recording_done', 'call_ended', 'fatal', 'left_consent_declined', 'left_user_cancelled'].includes(botStatus)
      ) {
        return res.status(409).json({
          message: "LegalNote has already left this meeting",
          botStatus,
        });
      }

      // Nothing captured yet — cancel (discard) is the right action
      if (!botStatus || isCancellableBotStatus(botStatus)) {
        return res.status(409).json({
          message: "Nothing has been recorded yet — use Cancel LegalNote instead.",
          botStatus,
          useCancel: true,
        });
      }

      let botLeft = false;
      let leaveError: string | undefined;
      try {
        await recallService.leaveCall(botId);
        botLeft = true;
      } catch (err) {
        leaveError = err instanceof Error ? err.message : String(err);
        console.error(`[Recall] leaveCall failed on stop for bot ${botId}:`, leaveError);
        return res.status(502).json({
          message: leaveError || "Could not remove LegalNote from the meeting",
          botLeft: false,
        });
      }

      // Keep import live — webhook / cron will process when Recall marks the bot done
      await storage.updateMeetingImport(importRecord.id, {
        botStatus: 'call_ended',
      });

      await storage.createAuditLog({
        eventType: 'live_bot_stopped',
        userId,
        caseId: importRecord.caseId || undefined,
        ipAddress: req.ip || req.socket?.remoteAddress,
        metadata: {
          importId: importRecord.id,
          botId,
          botLeft,
          priorBotStatus: botStatus,
          ...(leaveError ? { leaveError } : {}),
        },
        severity: 'info',
      });

      const fresh = await storage.getMeetingImport(importRecord.id);
      res.json({
        success: true,
        botLeft,
        importStatus: fresh?.status || 'live',
        botStatus: fresh?.botStatus || 'call_ended',
      });
    } catch (error) {
      next(error);
    }
  });

  // Recall.ai webhook — receives bot lifecycle events (no auth, validated by botId lookup)
  // Handles both old API (bot.status_change) and new API (bot.done, bot.call_ended, etc.)
  app.post("/api/recall/webhook", async (req, res, next) => {
    try {
      const { event, data } = req.body;

      if (!event || !data) {
        return res.status(400).json({ message: "Invalid webhook payload" });
      }

      // Ignore non-bot events
      if (!event.startsWith('bot.')) {
        return res.json({ received: true });
      }

      // Extract bot ID — present on all bot.* events
      const botId = data?.bot?.id || data?.id;
      if (!botId) {
        return res.json({ received: true });
      }

      console.log(`[Recall webhook] event=${event} botId=${botId}`);

      const importRecord = await storage.getMeetingImportByBotId(botId);
      if (!importRecord) {
        console.log(`[Recall webhook] No import found for bot ${botId} — ignoring`);
        return res.json({ received: true });
      }

      // Map new-API event names to a status code for our DB
      const eventStatusMap: Record<string, string> = {
        'bot.joining_call':                'joining',
        'bot.in_waiting_room':             'in_waiting_room',
        'bot.in_call_not_recording':       'in_call_not_recording',
        'bot.in_call_recording':           'in_call_recording',
        'bot.recording_permission_allowed':'in_call_recording',
        'bot.recording_permission_denied': 'recording_permission_denied',
        'bot.call_ended':                  'call_ended',
        'bot.done':                        'done',
        'bot.fatal':                       'fatal',
        // Legacy event
        'bot.status_change':               data?.status?.code
          || (Array.isArray(data?.status_changes) && data.status_changes.length
            ? data.status_changes[data.status_changes.length - 1].code
            : 'unknown'),
      };

      const statusCode = eventStatusMap[event] || event.replace('bot.', '');
      const webhookSubCode =
        data?.status?.sub_code ||
        data?.data?.sub_code ||
        (Array.isArray(data?.status_changes) && data.status_changes.length
          ? data.status_changes[data.status_changes.length - 1].sub_code
          : undefined);

      // Don't clobber a consent-decline / user-cancel ejection with later lifecycle events
      const alreadyDeclined =
        importRecord.botStatus === 'left_consent_declined' ||
        (typeof importRecord.errorMessage === 'string' && importRecord.errorMessage.includes('declined consent'));
      const alreadyCancelled =
        importRecord.botStatus === 'left_user_cancelled' ||
        (typeof importRecord.errorMessage === 'string' &&
          importRecord.errorMessage.toLowerCase().includes('cancelled'));
      if (!alreadyDeclined && !alreadyCancelled) {
        await storage.updateMeetingImport(importRecord.id, { botStatus: statusCode });
      }

      // bot.done = recording fully ready — trigger processing pipeline
      // Skip if solicitor already ejected the bot after consent was declined / cancelled
      if (event === 'bot.done' || statusCode === 'done') {
        if (alreadyDeclined || alreadyCancelled) {
          console.log(`[Recall webhook] Import ${importRecord.id} declined/cancelled — skipping processing`);
        } else {
          const fresh = await storage.getMeetingImport(importRecord.id);
          const declinedAfter =
            fresh?.botStatus === 'left_consent_declined' ||
            (typeof fresh?.errorMessage === 'string' && fresh.errorMessage.includes('declined consent'));
          const cancelledAfter =
            fresh?.botStatus === 'left_user_cancelled' ||
            (typeof fresh?.errorMessage === 'string' &&
              fresh.errorMessage.toLowerCase().includes('cancelled'));
          if (declinedAfter || cancelledAfter) {
            console.log(`[Recall webhook] Import ${importRecord.id} declined/cancelled — skipping processing`);
          } else {
            const { markAbandonedIfNeverRecorded, processBotRecording } = await import("./services/recallProcessing");
            const abandon = await markAbandonedIfNeverRecorded(fresh || importRecord, {
              subCode: webhookSubCode,
              botStatus: statusCode,
            });
            if (!abandon.abandoned) {
              processBotRecording(fresh || importRecord).catch((err: Error) => {
                console.error('[Recall webhook] processBotRecording error:', err.message);
              });
            }
          }
        }
      }

      // call_ended with abandon sub_code — mark failed immediately (don't wait for bot.done)
      if (
        (event === 'bot.call_ended' || statusCode === 'call_ended') &&
        !alreadyDeclined &&
        !alreadyCancelled
      ) {
        const { markAbandonedIfNeverRecorded } = await import("./services/recallProcessing");
        const fresh = await storage.getMeetingImport(importRecord.id);
        if (fresh && fresh.status === 'live') {
          await markAbandonedIfNeverRecorded(fresh, {
            subCode: webhookSubCode,
            botStatus: statusCode,
          });
        }
      }

      // bot.fatal = unrecoverable error
      if (event === 'bot.fatal' || statusCode === 'fatal') {
        const { markAbandonedIfNeverRecorded } = await import("./services/recallProcessing");
        const fresh = await storage.getMeetingImport(importRecord.id);
        const abandon = fresh
          ? await markAbandonedIfNeverRecorded(fresh, {
              subCode: webhookSubCode,
              botStatus: 'fatal',
            })
          : { abandoned: false };
        if (!abandon.abandoned) {
          await storage.updateMeetingImport(importRecord.id, {
            status: 'failed',
            errorMessage: 'The bot encountered an unrecoverable error during the meeting.',
          });
        }
      }

      res.json({ received: true });
    } catch (error) {
      next(error);
    }
  });
  
  // NOTE: Recall.ai webhook (POST /api/recall/webhook/bot-status) is registered in
  // index.ts before express.json() for raw body signature verification.
  
  // Pre-consent email routes
  app.post("/api/pre-consent", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { 
        recipientEmail, 
        recipientName, 
        meetingPlatform, 
        scheduledMeetingTime, 
        meetingUrl,
        caseId 
      } = req.body;
      
      if (!recipientEmail || !recipientName) {
        return res.status(400).json({ message: "Recipient email and name are required" });
      }
      
      // Generate consent token
      const consentToken = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      const baseUrl = getCanonicalBaseUrl(req);
      const consentUrl = `${baseUrl}/consent/${consentToken}`;
      const scheduledAt = scheduledMeetingTime ? new Date(scheduledMeetingTime) : undefined;

      // Stored copy only — outbound HTML is owned by sendPreConsentEmail (no matter / meeting URL PII).
      const emailSubject = "Recording consent request";
      const emailBody = [
        "Your solicitor has requested recording consent for an upcoming meeting.",
        "Respond via the LegalNote consent link. No matter details are included in this email.",
        consentUrl,
      ].join("\n\n");

      // Create consent email record
      const consentEmail = await storage.createPreConsentEmail({
        userId,
        caseId: caseId || undefined,
        recipientEmail,
        recipientName,
        meetingPlatform: meetingPlatform || undefined,
        scheduledMeetingTime: scheduledAt,
        meetingUrl: meetingUrl || undefined,
        emailSubject,
        emailBody,
        consentToken,
        emailStatus: 'pending',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });
      
      try {
        const { sendPreConsentEmail } = await import("./email");
        const result = await sendPreConsentEmail({
          to: recipientEmail,
          recipientName,
          consentUrl,
          scheduledMeetingTime: scheduledAt,
        });

        if (!result.success) {
          await storage.updatePreConsentEmail(consentEmail.id, { emailStatus: 'failed' });
          return res.status(500).json({
            message: "Failed to send consent email",
            error: result.error,
          });
        }
        
        await storage.updatePreConsentEmail(consentEmail.id, { 
          emailStatus: 'sent',
          emailSentAt: new Date(),
        });
        
        await storage.createAuditLog({
          eventType: 'pre_consent_email_sent',
          userId,
          caseId: caseId || undefined,
          ipAddress: req.ip || req.socket?.remoteAddress,
          metadata: { 
            recipientEmail, 
            recipientName,
            meetingPlatform,
            consentEmailId: consentEmail.id,
          },
          severity: 'info',
        });
      } catch (emailError: any) {
        console.error('Failed to send pre-consent email:', emailError);
        await storage.updatePreConsentEmail(consentEmail.id, { 
          emailStatus: 'failed',
        });
        return res.status(500).json({ 
          message: "Failed to send consent email",
          error: emailError.message 
        });
      }
      
      res.json({ 
        success: true, 
        consentEmailId: consentEmail.id,
        message: "Consent email sent successfully" 
      });
    } catch (error) {
      next(error);
    }
  });
  
  // Get pre-consent emails for user
  app.get("/api/pre-consent", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const emails = await storage.getPreConsentEmailsByUser(userId);
      res.json(emails);
    } catch (error) {
      next(error);
    }
  });
  
  // Public endpoint for acknowledging consent (no auth required)
  const consentResponseSchema = z.object({
    responseType: z.enum(['granted', 'declined', 'reschedule_requested']).default('granted'),
    message: z.string().max(1000).optional(),
  });

  app.post("/api/pre-consent/acknowledge/:token", async (req, res, next) => {
    try {
      const { token } = req.params;
      
      // Validate input
      const parsed = consentResponseSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request. Please provide a valid response type." });
      }
      const { responseType: status, message: clientMessage } = parsed.data;
      
      const consentEmail = await storage.getPreConsentEmailByToken(token);
      if (!consentEmail) {
        return res.status(404).json({ message: "Consent request not found" });
      }
      
      // Check if already responded (not just acknowledged)
      if (consentEmail.consentResponseStatus && consentEmail.consentResponseStatus !== 'awaiting') {
        return res.json({ 
          success: true, 
          alreadyAcknowledged: true,
          message: "A response has already been recorded for this consent request" 
        });
      }
      
      // Check if expired
      if (consentEmail.expiresAt && new Date(consentEmail.expiresAt) < new Date()) {
        return res.status(400).json({ message: "Consent request has expired" });
      }
      
      // Get IP address
      const ipAddress = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
      
      // Record the consent response atomically (only updates if still 'awaiting')
      const updatedEmail = await storage.acknowledgePreConsentEmail(consentEmail.id, ipAddress, status, clientMessage || undefined);
      
      // If no row was updated, another request got there first
      if (!updatedEmail) {
        return res.json({ 
          success: true, 
          alreadyAcknowledged: true,
          message: "A response has already been recorded for this consent request" 
        });
      }
      
      // Update any linked scheduled meeting's consent status
      const meetings = await storage.getScheduledMeetingsByUser(consentEmail.userId);
      const linkedMeeting = meetings.find(m => m.preConsentEmailId === consentEmail.id);
      if (linkedMeeting) {
        const meetingConsentStatus = status === 'granted' ? 'approved' : status === 'declined' ? 'declined' : 'declined';
        await storage.updateScheduledMeeting(linkedMeeting.id, { consentStatus: meetingConsentStatus });
      }

      // Update any linked meeting import's consentConfirmed when client grants consent via digital link
      let linkedImportId: string | undefined;
      try {
        const userImports = await storage.getMeetingImportsByUser(consentEmail.userId);
        const linkedImport = userImports.find(i => i.preConsentEmailId === consentEmail.id);
        if (linkedImport && status === 'granted' && !linkedImport.consentConfirmed) {
          linkedImportId = linkedImport.id;
          await storage.updateMeetingImport(linkedImport.id, { consentConfirmed: true });
          await storage.createAuditLog({
            eventType: 'consent_attestation',
            userId: consentEmail.userId,
            caseId: consentEmail.caseId || undefined,
            metadata: {
              importId: linkedImport.id,
              attestationType: 'digital_consent_link',
              consentEmailId: consentEmail.id,
              source: 'digital_link',
              clientIp: ipAddress,
              grantedAt: new Date().toISOString(),
            },
            severity: 'info',
          });
        }
      } catch (importErr) {
        console.error('[CONSENT] Failed to update linked meeting import:', importErr);
      }
      
      // Determine audit event type based on response
      const eventType = status === 'granted' ? 'pre_consent_acknowledged'
        : status === 'declined' ? 'pre_consent_declined'
        : 'pre_consent_reschedule_requested';
      
      await storage.createAuditLog({
        eventType,
        userId: consentEmail.userId,
        caseId: consentEmail.caseId || undefined,
        ipAddress,
        metadata: { 
          recipientEmail: consentEmail.recipientEmail,
          recipientName: consentEmail.recipientName,
          consentEmailId: consentEmail.id,
          scheduledMeetingId: linkedMeeting?.id,
          linkedImportId: linkedImportId,
          responseStatus: status,
          source: 'digital_link',
          clientMessage: clientMessage || undefined,
          ipAddress,
        },
        severity: status === 'declined' ? 'warning' : 'info',
      });
      
      // Send solicitor notification via email
      try {
        const solicitor = await storage.getUser(consentEmail.userId);
        if (solicitor?.email) {
          await sendConsentResponseNotification({
            to: solicitor.email,
            solicitorName: solicitor.firstName || 'Solicitor',
            clientName: consentEmail.recipientName,
            clientEmail: consentEmail.recipientEmail,
            responseStatus: status,
            meetingTitle: linkedMeeting?.title,
            meetingTime: consentEmail.scheduledMeetingTime || undefined,
            rescheduleNote: clientMessage || undefined,
            caseId: consentEmail.caseId || undefined,
          });
        }
      } catch (emailError) {
        console.error('[CONSENT] Failed to send solicitor notification email:', emailError);
      }
      
      // Trigger SSE notification for real-time update
      try {
        const userClients = sseClients.get(consentEmail.userId);
        if (userClients) {
          userClients.forEach(client => {
            client.write(`data: ${JSON.stringify({ type: 'consent_response', status })}\n\n`);
          });
        }
      } catch (sseError) {
        console.error('[CONSENT] Failed to send SSE notification:', sseError);
      }
      
      const responseMessage = status === 'granted' 
        ? "Thank you for acknowledging the recording consent"
        : status === 'declined'
        ? "Your response has been recorded. The solicitor has been notified that consent was declined."
        : "Your reschedule request has been sent to the solicitor.";
      
      res.json({ 
        success: true, 
        message: responseMessage 
      });
    } catch (error) {
      next(error);
    }
  });
  
  // Get consent acknowledgement page (public)
  app.get("/consent/:token", async (req, res, next) => {
    try {
      const { token } = req.params;
      
      const consentEmail = await storage.getPreConsentEmailByToken(token);
      if (!consentEmail) {
        return res.status(404).send(renderConsentNotFoundPage());
      }
      
      if (consentEmail.consentResponseStatus && consentEmail.consentResponseStatus !== 'awaiting') {
        const statusLabel = consentEmail.consentResponseStatus === 'granted' ? 'Consent granted'
          : consentEmail.consentResponseStatus === 'declined' ? 'Consent declined'
          : 'Reschedule requested';
        const respondedAt = consentEmail.consentRespondedAt 
          ? new Date(consentEmail.consentRespondedAt).toLocaleString('en-GB')
          : consentEmail.consentAcknowledgedAt 
          ? new Date(consentEmail.consentAcknowledgedAt).toLocaleString('en-GB')
          : 'earlier';
        return res.send(renderConsentAlreadyRespondedPage(statusLabel, respondedAt));
      }
      
      if (consentEmail.expiresAt && new Date(consentEmail.expiresAt) < new Date()) {
        return res.send(renderConsentExpiredPage());
      }
      
      res.send(renderConsentDecisionPage(token));
    } catch (error) {
      next(error);
    }
  });

  // ==================== SCHEDULED MEETINGS API ====================
  
  // Get upcoming scheduled meetings (next 7 days)
  app.get("/api/scheduled-meetings", isAuthenticated, pollingLimiter, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const daysAhead = parseInt(req.query.daysAhead as string) || 7;
      
      const meetings = await storage.getUpcomingScheduledMeetings(userId, daysAhead);
      res.json(meetings);
    } catch (error: any) {
      console.error("[SCHEDULED_MEETINGS] Error listing upcoming meetings:", error);
      const msg = String(error?.message || error || "");
      if (
        msg.includes("reminder_30m_sent_at") ||
        msg.includes("reminder_10m_sent_at")
      ) {
        return res.status(500).json({
          message:
            "Database is missing meeting reminder columns. Run scripts/meeting-reminder-columns.sql (or npm run db:push), then retry.",
          code: "SCHEMA_MIGRATION_REQUIRED",
        });
      }
      next(error);
    }
  });
  
  app.get("/api/scheduled-meetings/by-case/:caseId", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId } = req.params;
      
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      const meetings = await storage.getScheduledMeetingsByCase(caseId, userId);
      res.json(meetings);
    } catch (error) {
      next(error);
    }
  });
  
  // Poll calendar and sync meetings
  app.post("/api/scheduled-meetings/sync", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      
      const { meetingSchedulerService } = await import("./services/meetingSchedulerService");
      const meetings = await meetingSchedulerService.pollCalendarMeetings(userId);
      
      await storage.createAuditLog({
        eventType: 'calendar_synced',
        userId,
        ipAddress: req.ip || req.socket?.remoteAddress,
        metadata: { meetingsCount: meetings.length },
        severity: 'info',
      });
      
      res.json({ success: true, meetings });
    } catch (error: any) {
      console.error('[SCHEDULED_MEETINGS] Error syncing calendar:', error);
      
      if (error.message?.includes('not connected')) {
        return res.status(400).json({ 
          message: "Calendar not connected. Please connect Google Calendar or Outlook in Settings.",
          needsCalendarConnection: true,
        });
      }
      
      next(error);
    }
  });

  // Create a new meeting and push it to the user's connected calendar
  app.post("/api/scheduled-meetings", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;

      const createSchema = z.object({
        title: z.string().trim().min(1).max(500),
        description: z.string().trim().max(5000).optional().nullable(),
        startTime: z.string().min(1),
        endTime: z.string().min(1).optional().nullable(),
        meetingUrl: z.union([z.string().url().max(1000), z.literal(""), z.null()]).optional(),
        /** Default true when no meetingUrl — mint Meet (Google) or Teams (Outlook) */
        createConference: z.boolean().optional().default(true),
        caseId: z.string().min(1).optional().nullable(),
        provider: z.enum(["google", "outlook"]).optional(),
        attendees: z
          .array(
            z.object({
              email: z.string().email().max(255),
              name: z.string().trim().max(200).optional(),
            }),
          )
          .max(50)
          .optional()
          .default([]),
        clientEmail: z.union([z.string().email().max(255), z.literal(""), z.null()]).optional(),
        clientName: z.union([z.string().trim().max(200), z.literal(""), z.null()]).optional(),
      });

      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid meeting details",
          errors: parsed.error.flatten(),
        });
      }

      const data = parsed.data;
      const startTime = new Date(data.startTime);
      if (isNaN(startTime.getTime()) || startTime <= new Date()) {
        return res.status(400).json({ message: "Start time must be a valid future date" });
      }

      let endTime: Date | undefined;
      if (data.endTime) {
        endTime = new Date(data.endTime);
        if (isNaN(endTime.getTime()) || endTime <= startTime) {
          return res.status(400).json({ message: "End time must be after start time" });
        }
      } else {
        endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      }

      if (data.caseId) {
        const caseData = await storage.getCase(data.caseId, userId);
        if (!caseData) {
          return res.status(403).json({ message: "Case not found or not authorized" });
        }
      }

      const connections = await getConnectedProviders(userId, storage);
      const outlookConnected = connections.outlook.connected;
      const googleConnected = connections.google.connected;

      if (!googleConnected && !outlookConnected) {
        return res.status(400).json({
          message: "Calendar not connected. Please connect Google Calendar or Outlook in Settings.",
          needsCalendarConnection: true,
        });
      }

      let provider: "google" | "outlook" =
        data.provider ||
        (googleConnected ? "google" : "outlook");

      if (provider === "google" && !googleConnected) {
        if (!outlookConnected) {
          return res.status(400).json({
            message: "Google Calendar is not connected.",
            needsCalendarConnection: true,
          });
        }
        provider = "outlook";
      }
      if (provider === "outlook" && !outlookConnected) {
        if (!googleConnected) {
          return res.status(400).json({
            message: "Outlook Calendar is not connected.",
            needsCalendarConnection: true,
          });
        }
        provider = "google";
      }

      const providedMeetingUrl =
        data.meetingUrl && data.meetingUrl.trim().length > 0
          ? data.meetingUrl.trim()
          : undefined;
      const createConference = providedMeetingUrl ? false : data.createConference !== false;
      const attendees = (data.attendees || []).filter((a) => a.email);
      const description = data.description?.trim() || undefined;

      let calendarEventId: string | undefined;
      let meetingUrl = providedMeetingUrl;
      let meetingPlatform: "zoom" | "teams" | "meet" | "webex" | undefined;

      if (provider === "outlook") {
        const outlookResult = await createOutlookMeetingCalendarEvent(
          userId,
          {
            title: data.title,
            description,
            startTime,
            endTime,
            meetingUrl: providedMeetingUrl,
            attendees,
            createConference,
          },
          storage,
          getCanonicalBaseUrl(req),
        );

        if (!outlookResult.success || !outlookResult.eventId) {
          return res.status(502).json({
            message: `Failed to create Outlook calendar event: ${outlookResult.error || "Unknown error"}`,
          });
        }
        calendarEventId = outlookResult.eventId;
        if (outlookResult.meetingUrl) {
          meetingUrl = outlookResult.meetingUrl;
        }
        if (outlookResult.meetingPlatform === "teams" || outlookResult.meetingPlatform === "meet") {
          meetingPlatform = outlookResult.meetingPlatform;
        }
      } else {
        const googleResult = await createMeetingCalendarEvent(
          userId,
          {
            title: data.title,
            description,
            startTime,
            endTime,
            meetingUrl: providedMeetingUrl,
            attendees,
            createConference,
          },
          storage,
        );
        if (!googleResult.success || !googleResult.eventId) {
          return res.status(502).json({
            message: `Failed to create Google calendar event: ${googleResult.error || "Unknown error"}`,
          });
        }
        calendarEventId = googleResult.eventId;
        if (googleResult.meetingUrl) {
          meetingUrl = googleResult.meetingUrl;
        }
        if (googleResult.meetingPlatform) {
          meetingPlatform = googleResult.meetingPlatform;
        }
      }

      if (!meetingPlatform && meetingUrl) {
        const urlLower = meetingUrl.toLowerCase();
        if (urlLower.includes("zoom.us")) meetingPlatform = "zoom";
        else if (urlLower.includes("teams.microsoft.com") || urlLower.includes("teams.live.com")) {
          meetingPlatform = "teams";
        } else if (urlLower.includes("meet.google.com")) meetingPlatform = "meet";
        else if (urlLower.includes("webex.com")) meetingPlatform = "webex";
      }

      const clientEmail =
        data.clientEmail && data.clientEmail.trim().length > 0
          ? data.clientEmail.trim()
          : attendees[0]?.email;
      const clientName =
        data.clientName && data.clientName.trim().length > 0
          ? data.clientName.trim()
          : clientEmail
            ? attendees.find((a) => a.email.toLowerCase() === clientEmail.toLowerCase())?.name ||
              attendees[0]?.name ||
              clientEmail
            : undefined;

      const meeting = await storage.createScheduledMeeting({
        userId,
        caseId: data.caseId || undefined,
        calendarEventId,
        calendarProvider: provider,
        title: data.title,
        description,
        meetingUrl,
        meetingPlatform,
        startTime,
        endTime,
        attendees,
        clientEmail: clientEmail || undefined,
        clientName: clientName || undefined,
        autoRecordEnabled: false,
        consentStatus: "pending",
        status: "scheduled",
      });

      await storage.createAuditLog({
        eventType: "meeting_scheduled",
        userId,
        caseId: data.caseId || undefined,
        ipAddress: req.ip || req.socket?.remoteAddress,
        metadata: {
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          startTime: meeting.startTime,
          calendarProvider: provider,
          calendarEventId,
          attendeeCount: attendees.length,
          meetingUrl: meetingUrl || null,
          meetingPlatform: meetingPlatform || null,
          conferenceAutoCreated: createConference && !providedMeetingUrl,
        },
        severity: "info",
      });

      res.status(201).json(meeting);
    } catch (error) {
      console.error("[SCHEDULED_MEETINGS] Error creating meeting:", error);
      next(error);
    }
  });
  
  // Update scheduled meeting (enable/disable auto-record, set client info, link case)
  app.patch("/api/scheduled-meetings/:id", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { autoRecordEnabled, clientEmail, clientName, caseId, title } = req.body;
      
      const meeting = await storage.getScheduledMeeting(id);
      if (!meeting || meeting.userId !== userId) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      if (meeting.status === 'cancelled') {
        return res.status(400).json({ message: "Cannot update a cancelled meeting" });
      }

      if (autoRecordEnabled === true && !isFeatureVisible('calendarAutoRecord')) {
        return res.status(403).json({ message: "Auto-record is not available" });
      }
      
      const updates: Partial<ScheduledMeeting> = {};
      if (title !== undefined) {
        if (typeof title !== 'string' || !title.trim()) {
          return res.status(400).json({ message: "Title must be a non-empty string" });
        }
        if (title.trim().length > 500) {
          return res.status(400).json({ message: "Title must be 500 characters or less" });
        }
        updates.title = title.trim();
      }
      if (autoRecordEnabled !== undefined) updates.autoRecordEnabled = !!autoRecordEnabled;
      if (clientEmail !== undefined) {
        if (clientEmail === null || clientEmail === '') {
          updates.clientEmail = null;
          if (clientName === undefined) {
            updates.clientName = null;
          }
        } else if (typeof clientEmail !== 'string') {
          return res.status(400).json({ message: "clientEmail must be a string" });
        } else if (!isConsentRecipientAmongAttendees(meeting, clientEmail)) {
          return res.status(400).json({
            message: "Consent recipient must be selected from this meeting's attendee list",
          });
        } else {
          updates.clientEmail = clientEmail.trim();
          if (clientName === undefined) {
            updates.clientName = resolveConsentRecipientName(meeting, updates.clientEmail);
          }
        }
      }
      if (clientName !== undefined) {
        updates.clientName = clientName === null || clientName === '' ? null : String(clientName).trim();
      }

      const nextEmail =
        updates.clientEmail !== undefined ? updates.clientEmail : meeting.clientEmail;
      const nextName =
        updates.clientName !== undefined ? updates.clientName : meeting.clientName;
      if (nextEmail && !nextName) {
        updates.clientName = resolveConsentRecipientName(meeting, nextEmail);
      }
      
      if (caseId !== undefined) {
        if (caseId) {
          const caseData = await storage.getCase(caseId, userId);
          if (!caseData) {
            return res.status(403).json({ message: "Case not found or not authorized" });
          }
          updates.caseId = caseId;
        } else {
          updates.caseId = null;
        }
      }
      
      const updated = await storage.updateScheduledMeeting(id, updates);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });
  
  // Cancel a scheduled meeting
  app.post("/api/scheduled-meetings/:id/cancel", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { reason } = req.body;
      
      if (reason !== undefined && (typeof reason !== 'string' || reason.length > 1000)) {
        return res.status(400).json({ message: "Reason must be a string of 1000 characters or less" });
      }
      
      const meeting = await storage.getScheduledMeeting(id);
      if (!meeting || meeting.userId !== userId) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      if (meeting.status !== 'scheduled') {
        return res.status(400).json({ message: `Cannot cancel a ${meeting.status} meeting` });
      }
      
      let calendarDeleteResult: { success: boolean; error?: string } | null = null;
      if (meeting.calendarEventId && !meeting.calendarEventId.startsWith('rescheduled-')) {
        try {
          if (meeting.calendarProvider === 'outlook') {
            calendarDeleteResult = await deleteOutlookCalendarEvent(
              userId,
              meeting.calendarEventId,
              storage,
              getCanonicalBaseUrl(req),
            );
          } else {
            calendarDeleteResult = await deleteCalendarEvent(userId, meeting.calendarEventId, storage);
          }
          if (!calendarDeleteResult.success) {
            return res.status(502).json({ message: `Failed to cancel calendar event: ${calendarDeleteResult.error}` });
          }
        } catch (calErr) {
          return res.status(502).json({ message: `Calendar sync failed: ${calErr instanceof Error ? calErr.message : String(calErr)}` });
        }
      }
      
      const updated = await storage.updateScheduledMeeting(id, {
        status: 'cancelled',
        cancellationReason: reason || null,
      });
      
      if (meeting.clientEmail) {
        try {
          const { sendBrandedClientNoticeEmail } = await import("./email");
          await sendBrandedClientNoticeEmail({
            to: meeting.clientEmail,
            subject: "Meeting cancelled",
            heading: "Meeting cancelled",
            messageHtml: `<p style="margin:0 0 12px;">A meeting with your solicitor has been cancelled.${reason ? " Please contact them if you need further details." : ""}</p><p style="margin:0;">If you have questions, reply to your solicitor directly.</p>`,
          });
        } catch (emailErr) {
          console.log(`[MEETING_CANCEL] Notification email failed (non-blocking): ${emailErr}`);
        }
      }
      
      await storage.createAuditLog({
        eventType: 'meeting_cancelled',
        userId,
        caseId: meeting.caseId || undefined,
        ipAddress: req.ip || req.socket?.remoteAddress,
        metadata: {
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          reason: reason || 'No reason provided',
          startTime: meeting.startTime,
          clientEmail: meeting.clientEmail,
          calendarEventDeleted: !!calendarDeleteResult?.success,
        },
        severity: 'info',
      });
      
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });
  
  // Reschedule a meeting
  app.post("/api/scheduled-meetings/:id/reschedule", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { newStartTime, newEndTime, title } = req.body;
      
      if (!newStartTime) {
        return res.status(400).json({ message: "New start time is required" });
      }

      let nextTitle: string | undefined;
      if (title !== undefined) {
        if (typeof title !== 'string' || !title.trim()) {
          return res.status(400).json({ message: "Title must be a non-empty string" });
        }
        if (title.trim().length > 500) {
          return res.status(400).json({ message: "Title must be 500 characters or less" });
        }
        nextTitle = title.trim();
      }
      
      const meeting = await storage.getScheduledMeeting(id);
      if (!meeting || meeting.userId !== userId) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      if (meeting.status !== 'scheduled') {
        return res.status(400).json({ message: `Cannot reschedule a ${meeting.status} meeting` });
      }
      
      const parsedStart = new Date(newStartTime);
      if (isNaN(parsedStart.getTime()) || parsedStart <= new Date()) {
        return res.status(400).json({ message: "New start time must be a valid future date" });
      }
      
      let calendarEventId = `rescheduled-${meeting.calendarEventId}-${Date.now()}`;
      
      let calendarSynced = false;
      let replacementMeetingUrl = meeting.meetingUrl || undefined;
      let replacementPlatform = meeting.meetingPlatform || undefined;
      
      if (meeting.calendarEventId && !meeting.calendarEventId.startsWith('rescheduled-')) {
        try {
          if (meeting.calendarProvider === 'outlook') {
            const calResult = await deleteOutlookCalendarEvent(
              userId,
              meeting.calendarEventId,
              storage,
              getCanonicalBaseUrl(req),
            );
            if (!calResult.success) {
              return res.status(502).json({ message: `Failed to void original calendar event: ${calResult.error}` });
            }
          } else {
            const calResult = await deleteCalendarEvent(userId, meeting.calendarEventId, storage);
            if (!calResult.success) {
              return res.status(502).json({ message: `Failed to void original calendar event: ${calResult.error}` });
            }
          }
        } catch (calErr) {
          return res.status(502).json({ message: `Failed to void original calendar event: ${calErr instanceof Error ? calErr.message : String(calErr)}` });
        }
      }
      
      try {
        const attendeesList = Array.isArray(meeting.attendees) 
          ? (meeting.attendees as Array<{ email: string; name?: string }>).filter(a => a.email)
          : [];
        const parsedEnd = newEndTime ? new Date(newEndTime) : undefined;
        const eventTitle = nextTitle || meeting.title;

        if (meeting.calendarProvider === 'outlook') {
          const outlookResult = await createOutlookMeetingCalendarEvent(
            userId,
            {
              title: eventTitle,
              description: meeting.description || undefined,
              startTime: parsedStart,
              endTime: parsedEnd,
              meetingUrl: meeting.meetingUrl || undefined,
              attendees: attendeesList,
              createConference: !meeting.meetingUrl,
            },
            storage,
            getCanonicalBaseUrl(req),
          );
          if (outlookResult.success && outlookResult.eventId) {
            calendarEventId = outlookResult.eventId;
            calendarSynced = true;
            if (outlookResult.meetingUrl) replacementMeetingUrl = outlookResult.meetingUrl;
            if (outlookResult.meetingPlatform) replacementPlatform = outlookResult.meetingPlatform;
          } else {
            return res.status(502).json({ message: `Failed to create replacement calendar event: ${outlookResult.error}` });
          }
        } else {
          const newCalResult = await createMeetingCalendarEvent(userId, {
            title: eventTitle,
            description: meeting.description || undefined,
            startTime: parsedStart,
            endTime: parsedEnd,
            meetingUrl: meeting.meetingUrl || undefined,
            attendees: attendeesList,
            createConference: !meeting.meetingUrl,
          }, storage);
          if (newCalResult.success && newCalResult.eventId) {
            calendarEventId = newCalResult.eventId;
            calendarSynced = true;
            if (newCalResult.meetingUrl) replacementMeetingUrl = newCalResult.meetingUrl;
            if (newCalResult.meetingPlatform) replacementPlatform = newCalResult.meetingPlatform;
          } else {
            return res.status(502).json({ message: `Failed to create replacement calendar event: ${newCalResult.error}` });
          }
        }
      } catch (calErr) {
        return res.status(502).json({ message: `Calendar sync failed: ${calErr instanceof Error ? calErr.message : String(calErr)}` });
      }
      
      const validPlatforms = ['zoom', 'teams', 'meet', 'webex'] as const;
      const platform = validPlatforms.includes(replacementPlatform as typeof validPlatforms[number])
        ? (replacementPlatform as typeof validPlatforms[number])
        : undefined;
      const provider = (meeting.calendarProvider === 'google' || meeting.calendarProvider === 'outlook')
        ? meeting.calendarProvider
        : 'google' as const;
      
      const newMeeting = await storage.createScheduledMeeting({
        userId,
        caseId: meeting.caseId || undefined,
        calendarEventId,
        calendarProvider: provider,
        title: nextTitle || meeting.title,
        description: meeting.description || undefined,
        meetingUrl: replacementMeetingUrl,
        meetingPlatform: platform,
        startTime: parsedStart,
        endTime: newEndTime ? new Date(newEndTime) : undefined,
        attendees: Array.isArray(meeting.attendees) ? meeting.attendees : [],
        clientEmail: meeting.clientEmail || undefined,
        clientName: meeting.clientName || undefined,
        autoRecordEnabled: meeting.autoRecordEnabled,
        consentStatus: 'pending',
        status: 'scheduled',
      });
      
      await storage.updateScheduledMeeting(id, {
        status: 'rescheduled',
        replacedByMeetingId: newMeeting.id,
      });
      
      if (meeting.clientEmail) {
        try {
          const { sendBrandedClientNoticeEmail } = await import("./email");
          const when = parsedStart.toLocaleString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          await sendBrandedClientNoticeEmail({
            to: meeting.clientEmail,
            subject: "Meeting rescheduled",
            heading: "Meeting rescheduled",
            messageHtml: `<p style="margin:0 0 12px;">A meeting with your solicitor has been rescheduled to <strong>${when}</strong>.</p><p style="margin:0;">If you have questions, reply to your solicitor directly.</p>`,
          });
        } catch (emailErr) {
          console.log(`[MEETING_RESCHEDULE] Notification email failed (non-blocking): ${emailErr}`);
        }
      }
      
      await storage.createAuditLog({
        eventType: 'meeting_rescheduled',
        userId,
        caseId: meeting.caseId || undefined,
        ipAddress: req.ip || req.socket?.remoteAddress,
        metadata: {
          originalMeetingId: meeting.id,
          newMeetingId: newMeeting.id,
          originalStartTime: meeting.startTime,
          newStartTime: newStartTime,
          meetingTitle: nextTitle || meeting.title,
          clientEmail: meeting.clientEmail,
          calendarEventCreated: calendarSynced,
        },
        severity: 'info',
      });
      
      res.json({ originalMeeting: meeting, newMeeting });
    } catch (error) {
      next(error);
    }
  });
  
  // Manually trigger consent email for a meeting
  app.post("/api/scheduled-meetings/:id/send-consent", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      const meeting = await storage.getScheduledMeeting(id);
      if (!meeting || meeting.userId !== userId) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      if (!meeting.clientEmail) {
        return res.status(400).json({ message: "No consent recipient set for this meeting" });
      }

      if (!isConsentRecipientAmongAttendees(meeting, meeting.clientEmail)) {
        return res.status(400).json({
          message: "Consent recipient must be selected from this meeting's attendee list",
        });
      }

      const recipientName = resolveConsentRecipientName(meeting, meeting.clientEmail);
      if (!meeting.clientName || meeting.clientName.trim() !== recipientName) {
        await storage.updateScheduledMeeting(meeting.id, { clientName: recipientName });
        meeting.clientName = recipientName;
      }
      
      const { meetingSchedulerService } = await import("./services/meetingSchedulerService");
      const success = await meetingSchedulerService.sendConsentEmailForMeeting(meeting);
      
      if (success) {
        await storage.createAuditLog({
          eventType: 'pre_consent_email_sent',
          userId,
          ipAddress: req.ip || req.socket?.remoteAddress,
          metadata: { 
            meetingId: meeting.id,
            recipientEmail: meeting.clientEmail,
          },
          severity: 'info',
        });
        
        res.json({ success: true, message: "Consent email sent" });
      } else {
        res.status(500).json({ success: false, message: "Failed to send consent email" });
      }
    } catch (error) {
      next(error);
    }
  });
  
  // Manually deploy bot for a meeting
  app.post("/api/scheduled-meetings/:id/deploy-bot", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      const meeting = await storage.getScheduledMeeting(id);
      if (!meeting || meeting.userId !== userId) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      if (!meeting.meetingUrl) {
        return res.status(400).json({ message: "No meeting URL detected for this meeting" });
      }
      
      if (meeting.consentStatus !== 'approved') {
        return res.status(400).json({ message: "Client consent not yet approved" });
      }
      
      const { meetingSchedulerService } = await import("./services/meetingSchedulerService");
      const success = await meetingSchedulerService.deployBotForMeeting(meeting);
      
      if (success) {
        res.json({ success: true, message: "Bot deployed" });
      } else {
        res.status(500).json({ success: false, message: "Failed to deploy bot" });
      }
    } catch (error) {
      next(error);
    }
  });
  
  // Set meeting URL manually (for meetings without detected URL)
  app.post("/api/scheduled-meetings/:id/set-url", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { meetingUrl } = req.body;
      
      if (!meetingUrl) {
        return res.status(400).json({ message: "Meeting URL is required" });
      }
      
      const meeting = await storage.getScheduledMeeting(id);
      if (!meeting || meeting.userId !== userId) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      // Detect platform from URL
      let meetingPlatform: string | undefined;
      const urlLower = meetingUrl.toLowerCase();
      if (urlLower.includes('zoom.us')) meetingPlatform = 'zoom';
      else if (urlLower.includes('teams.microsoft.com') || urlLower.includes('teams.live.com')) meetingPlatform = 'teams';
      else if (urlLower.includes('meet.google.com')) meetingPlatform = 'meet';
      else if (urlLower.includes('webex.com')) meetingPlatform = 'webex';
      
      const updated = await storage.updateScheduledMeeting(id, { 
        meetingUrl,
        meetingPlatform: meetingPlatform || null,
      });
      
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // ============================
  // CLIO INTEGRATION ROUTES
  // ============================

  // Get Clio connection status
  app.get("/api/clio/status", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { clioService } = await import("./clio");

      if (!clioService.isConfigured()) {
        return res.json({
          configured: false,
          connected: false,
          message: "Clio integration not configured. Add CLIO_CLIENT_ID and CLIO_CLIENT_SECRET to connect.",
        });
      }

      const connection = await clioService.getConnection(userId);

      if (!connection) {
        return res.json({
          configured: true,
          connected: false,
        });
      }

      res.json({
        configured: true,
        connected: connection.status === "active",
        status: connection.status,
        firmName: connection.clioFirmName,
        email: connection.clioUserEmail,
        lastSyncAt: connection.lastSyncAt,
        syncEnabled: connection.syncEnabled,
      });
    } catch (error) {
      next(error);
    }
  });

  // Initiate Clio OAuth flow
  app.get("/api/clio/auth", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { clioService } = await import("./clio");

      if (!clioService.isConfigured()) {
        return res.status(503).json({
          message: "Clio integration not configured. Please contact your administrator.",
        });
      }

      const statePayload: OAuthStatePayload = {
        userId,
        provider: 'clio',
        popup: false,
        nonce: generateSecureNonce(),
        createdAt: Date.now(),
      };

      const signedState = signOAuthState(statePayload);
      const authUrl = clioService.getAuthorizationUrl(signedState);

      res.redirect(authUrl);
    } catch (error) {
      next(error);
    }
  });

  // Clio OAuth callback
  app.get("/api/clio/callback", async (req: any, res, next) => {
    try {
      const { code, state, error: oauthError } = req.query;

      if (oauthError) {
        console.error("[Clio] OAuth error:", oauthError);
        return res.redirect("/settings?tab=integrations&clio_error=" + encodeURIComponent(String(oauthError)));
      }

      if (!code || !state) {
        return res.redirect("/settings?tab=integrations&clio_error=missing_code_or_state");
      }

      const stateData = verifyOAuthState(state as string);
      
      if (!stateData || stateData.provider !== 'clio') {
        return res.redirect("/settings?tab=integrations&clio_error=invalid_state");
      }

      const { clioService } = await import("./clio");

      try {
        const tokens = await clioService.exchangeCodeForTokens(code as string);
        const userInfo = await clioService.getCurrentUser(tokens.access_token);

        await clioService.saveConnection(stateData.userId, tokens, userInfo);

        await storage.createAuditLog({
          eventType: 'clio_connected',
          userId: stateData.userId,
          ipAddress: req.ip || req.socket?.remoteAddress,
          metadata: {
            firmName: userInfo.firm.name,
            clioUserId: userInfo.user.id,
          },
          severity: 'info',
        });

        res.redirect("/settings?tab=integrations&clio_connected=true");
      } catch (exchangeError: any) {
        console.error("[Clio] Token exchange error:", exchangeError);
        res.redirect("/settings?tab=integrations&clio_error=" + encodeURIComponent("Failed to connect to Clio"));
      }
    } catch (error) {
      next(error);
    }
  });

  // Disconnect Clio
  app.post("/api/clio/disconnect", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { clioService } = await import("./clio");

      await clioService.disconnectUser(userId);

      await storage.createAuditLog({
        eventType: 'clio_disconnected',
        userId,
        ipAddress: req.ip || req.socket?.remoteAddress,
        metadata: {},
        severity: 'info',
      });

      res.json({ success: true, message: "Disconnected from Clio" });
    } catch (error) {
      next(error);
    }
  });

  // Get Clio matters list
  app.get("/api/clio/matters", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { status, search, limit, offset } = req.query;
      const { clioService } = await import("./clio");

      const accessToken = await clioService.ensureValidToken(userId);
      
      if (!accessToken) {
        return res.status(401).json({
          message: "Clio connection expired. Please reconnect.",
          requiresReconnect: true,
        });
      }

      const matters = await clioService.getMatters(accessToken, {
        status: status as string,
        search: search as string,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });

      res.json(matters);
    } catch (error: any) {
      if (error.message === "CLIO_TOKEN_EXPIRED") {
        return res.status(401).json({
          message: "Clio connection expired. Please reconnect.",
          requiresReconnect: true,
        });
      }
      next(error);
    }
  });

  // Import a Clio matter as a new case
  app.post("/api/clio/matters/:matterId/import", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { matterId } = req.params;
      const { clioService } = await import("./clio");

      const accessToken = await clioService.ensureValidToken(userId);
      
      if (!accessToken) {
        return res.status(401).json({
          message: "Clio connection expired. Please reconnect.",
          requiresReconnect: true,
        });
      }

      const matter = await clioService.getMatter(accessToken, matterId);
      const caseId = await clioService.importMatterAsCase(userId, matter);

      await storage.createAuditLog({
        eventType: 'clio_matter_imported',
        userId,
        caseId,
        ipAddress: req.ip || req.socket?.remoteAddress,
        metadata: {
          clioMatterId: matterId,
          clioMatterNumber: matter.display_number,
          clientName: matter.client?.name,
        },
        severity: 'info',
      });

      res.json({
        success: true,
        caseId,
        message: `Imported matter "${matter.display_number}" as case`,
      });
    } catch (error: any) {
      if (error.message === "CLIO_TOKEN_EXPIRED") {
        return res.status(401).json({
          message: "Clio connection expired. Please reconnect.",
          requiresReconnect: true,
        });
      }
      next(error);
    }
  });

  // Link an existing case to a Clio matter
  app.post("/api/cases/:caseId/link-clio", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId } = req.params;
      const { matterId } = req.body;
      const { clioService } = await import("./clio");

      const caseData = await storage.getCase(caseId);
      if (!caseData || caseData.createdBy !== userId) {
        return res.status(404).json({ message: "Case not found" });
      }

      const accessToken = await clioService.ensureValidToken(userId);
      
      if (!accessToken) {
        return res.status(401).json({
          message: "Clio connection expired. Please reconnect.",
          requiresReconnect: true,
        });
      }

      const matter = await clioService.getMatter(accessToken, matterId);
      await clioService.linkMatterToCase(userId, caseId, matter);

      await storage.createAuditLog({
        eventType: 'clio_matter_linked',
        userId,
        caseId,
        ipAddress: req.ip || req.socket?.remoteAddress,
        metadata: {
          clioMatterId: matterId,
          clioMatterNumber: matter.display_number,
        },
        severity: 'info',
      });

      res.json({
        success: true,
        message: `Linked case to Clio matter "${matter.display_number}"`,
      });
    } catch (error: any) {
      if (error.message === "CLIO_TOKEN_EXPIRED") {
        return res.status(401).json({
          message: "Clio connection expired. Please reconnect.",
          requiresReconnect: true,
        });
      }
      next(error);
    }
  });

  // Unlink a case from Clio
  app.delete("/api/cases/:caseId/link-clio", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId } = req.params;
      const { clioService } = await import("./clio");

      const caseData = await storage.getCase(caseId);
      if (!caseData || caseData.createdBy !== userId) {
        return res.status(404).json({ message: "Case not found" });
      }

      await clioService.unlinkCase(caseId);

      await storage.createAuditLog({
        eventType: 'clio_matter_unlinked',
        userId,
        caseId,
        ipAddress: req.ip || req.socket?.remoteAddress,
        metadata: {},
        severity: 'info',
      });

      res.json({ success: true, message: "Unlinked case from Clio" });
    } catch (error) {
      next(error);
    }
  });

  // Get linked Clio matters for user
  app.get("/api/clio/links", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { clioService } = await import("./clio");

      const links = await clioService.getMatterLinks(userId);
      res.json(links);
    } catch (error) {
      next(error);
    }
  });

  // ============================
  // SHAREPOINT/ONEDRIVE INTEGRATION ROUTES
  // ============================

  // Get SharePoint/OneDrive connection status
  app.get("/api/storage/status", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { isStorageConnected, getStorageInfo } = await import("./sharepoint");
      
      const [sharePointConnected, oneDriveConnected] = await Promise.all([
        isStorageConnected('sharepoint'),
        isStorageConnected('onedrive'),
      ]);
      
      const connections = await storage.getUserSharePointConnections(userId);
      const sharePointConnection = connections.find(c => c.provider === 'sharepoint');
      const oneDriveConnection = connections.find(c => c.provider === 'onedrive');
      
      const result: any = {
        sharepoint: {
          available: sharePointConnected,
          connected: !!sharePointConnection,
          autoSyncEnabled: sharePointConnection?.autoSyncEnabled ?? false,
          email: sharePointConnection?.email || null,
          driveName: sharePointConnection?.driveName || null,
        },
        onedrive: {
          available: oneDriveConnected,
          connected: !!oneDriveConnection,
          autoSyncEnabled: oneDriveConnection?.autoSyncEnabled ?? false,
          email: oneDriveConnection?.email || null,
          driveName: oneDriveConnection?.driveName || null,
        },
      };
      
      // Get additional info if Replit connectors are available
      if (sharePointConnected && !sharePointConnection) {
        try {
          const info = await getStorageInfo('sharepoint');
          result.sharepoint.availableInfo = {
            email: info.email,
            drive: info.drive,
            sites: info.sites,
          };
        } catch {}
      }
      
      if (oneDriveConnected && !oneDriveConnection) {
        try {
          const info = await getStorageInfo('onedrive');
          result.onedrive.availableInfo = {
            email: info.email,
            drive: info.drive,
          };
        } catch {}
      }
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Connect SharePoint/OneDrive (save connection after Replit connector auth)
  app.post("/api/storage/connect", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { provider, driveId, siteId } = req.body;
      
      if (!provider || !['sharepoint', 'onedrive'].includes(provider)) {
        return res.status(400).json({ message: "Invalid provider. Use 'sharepoint' or 'onedrive'" });
      }
      
      const { isStorageConnected, getStorageInfo, ensureLegalNoteFolderStructure, getSiteDrives } = await import("./sharepoint");
      
      // Check if Replit connector is available
      const connectorAvailable = await isStorageConnected(provider);
      if (!connectorAvailable) {
        return res.status(400).json({ 
          message: `${provider === 'sharepoint' ? 'SharePoint' : 'OneDrive'} connector not set up. Please connect via Replit Tools first.` 
        });
      }
      
      // Get connection info
      const info = await getStorageInfo(provider);
      
      let targetDriveId = driveId;
      let targetDriveName = info.drive?.name || null;
      
      // For SharePoint, user can specify a site and drive
      if (provider === 'sharepoint' && siteId) {
        const siteDrives = await getSiteDrives(siteId);
        if (siteDrives.length > 0) {
          targetDriveId = siteDrives[0].id;
          targetDriveName = siteDrives[0].name;
        }
      } else if (!targetDriveId && info.drive) {
        targetDriveId = info.drive.id;
      }
      
      if (!targetDriveId) {
        return res.status(400).json({ message: "No drive found. Please select a drive." });
      }
      
      // Create folder structure
      const folders = await ensureLegalNoteFolderStructure(provider, targetDriveId);
      if (!folders.rootFolder) {
        return res.status(500).json({ message: "Failed to create LegalNote folder structure" });
      }
      
      // Save connection
      const connection = await storage.saveSharePointConnection({
        userId,
        provider,
        driveId: targetDriveId,
        driveName: targetDriveName,
        email: info.email,
        status: 'active',
        autoSyncEnabled: true,
      });
      
      await storage.createAuditLog({
        eventType: `${provider}_connected`,
        userId,
        ipAddress: req.ip || req.socket?.remoteAddress,
        metadata: {
          driveId: targetDriveId,
          driveName: targetDriveName,
          email: info.email,
        },
        severity: 'info',
      });
      
      res.json({
        success: true,
        connection: {
          provider: connection.provider,
          driveId: connection.driveId,
          driveName: connection.driveName,
          email: connection.email,
          autoSyncEnabled: connection.autoSyncEnabled,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // Disconnect SharePoint/OneDrive
  app.delete("/api/storage/disconnect/:provider", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { provider } = req.params;
      
      if (!['sharepoint', 'onedrive'].includes(provider)) {
        return res.status(400).json({ message: "Invalid provider" });
      }
      
      await storage.deleteSharePointConnection(userId, provider as 'sharepoint' | 'onedrive');
      
      await storage.createAuditLog({
        eventType: `${provider}_disconnected`,
        userId,
        ipAddress: req.ip || req.socket?.remoteAddress,
        metadata: {},
        severity: 'info',
      });
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Update auto-sync setting
  app.patch("/api/storage/:provider/settings", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { provider } = req.params;
      const { autoSyncEnabled } = req.body;
      
      if (!['sharepoint', 'onedrive'].includes(provider)) {
        return res.status(400).json({ message: "Invalid provider" });
      }
      
      const connection = await storage.getSharePointConnection(userId, provider as 'sharepoint' | 'onedrive');
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }
      
      const updated = await storage.updateSharePointConnection(
        userId, 
        provider as 'sharepoint' | 'onedrive',
        { autoSyncEnabled }
      );
      
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // Sync a document to storage
  app.post("/api/storage/sync-document", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { provider, documentId, caseId } = req.body;
      
      if (!provider || !['sharepoint', 'onedrive'].includes(provider)) {
        return res.status(400).json({ message: "Invalid provider" });
      }
      
      if (!documentId || !caseId) {
        return res.status(400).json({ message: "documentId and caseId are required" });
      }
      
      const connection = await storage.getSharePointConnection(userId, provider as 'sharepoint' | 'onedrive');
      if (!connection) {
        return res.status(400).json({ message: `Not connected to ${provider}` });
      }
      
      // Get document and case
      const document = await storage.getDocument(documentId);
      const caseData = await storage.getCase(caseId, userId);
      
      if (!document || !caseData) {
        return res.status(404).json({ message: "Document or case not found" });
      }
      
      const { syncDocumentToStorage } = await import("./sharepoint");
      
      // Determine file name and content
      const ext = document.format === 'docx' ? '.docx' : '.pdf';
      const fileName = `${document.title || document.type}${ext}`;
      const content = document.content || '';
      const mimeType = document.format === 'docx' 
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf';
      
      const uploaded = await syncDocumentToStorage(
        provider as 'sharepoint' | 'onedrive',
        connection.driveId,
        caseData.title,
        caseData.clientName,
        document.type,
        fileName,
        Buffer.from(content),
        mimeType
      );
      
      if (!uploaded) {
        return res.status(500).json({ message: "Failed to sync document" });
      }
      
      await storage.createAuditLog({
        eventType: 'document_synced_to_storage',
        userId,
        caseId,
        ipAddress: req.ip || req.socket?.remoteAddress,
        metadata: {
          provider,
          documentId,
          fileName,
          webUrl: uploaded.webUrl,
        },
        severity: 'info',
      });
      
      res.json({
        success: true,
        file: uploaded,
      });
    } catch (error) {
      next(error);
    }
  });

  // List SharePoint sites (for site selection UI)
  app.get("/api/storage/sharepoint/sites", isAuthenticated, async (req: any, res, next) => {
    try {
      const { isStorageConnected, getSharePointSites } = await import("./sharepoint");
      
      const connected = await isStorageConnected('sharepoint');
      if (!connected) {
        return res.status(400).json({ message: "SharePoint connector not set up" });
      }
      
      const sites = await getSharePointSites();
      res.json(sites);
    } catch (error) {
      next(error);
    }
  });

  // Get drives for a SharePoint site
  app.get("/api/storage/sharepoint/sites/:siteId/drives", isAuthenticated, async (req: any, res, next) => {
    try {
      const { siteId } = req.params;
      const { isStorageConnected, getSiteDrives } = await import("./sharepoint");
      
      const connected = await isStorageConnected('sharepoint');
      if (!connected) {
        return res.status(400).json({ message: "SharePoint connector not set up" });
      }
      
      const drives = await getSiteDrives(siteId);
      res.json(drives);
    } catch (error) {
      next(error);
    }
  });

  // DEMO DATA ENDPOINTS
  
  // Seed demo data for demonstrations
  app.post("/api/demo/seed", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { seedDemoData } = await import("./services/demoSeedService");
      const result = await seedDemoData(userId);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      console.error('[DEMO] Error seeding demo data:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to seed demo data",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Reset demo data (clear and re-seed)
  app.post("/api/demo/reset", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { resetDemoData } = await import("./services/demoSeedService");
      const result = await resetDemoData(userId);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      console.error('[DEMO] Error resetting demo data:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to reset demo data",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Clear demo data
  app.delete("/api/demo/clear", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { clearDemoData } = await import("./services/demoSeedService");
      const result = await clearDemoData(userId);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      console.error('[DEMO] Error clearing demo data:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to clear demo data",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Public demo interaction endpoints (unauthenticated)
  // These allow demo visitors to trigger real emails/SMS without being logged in.

  // Capture lead data when a demo link is generated by a logged-in user
  app.post("/api/demo/capture-lead", generalApiLimiter, async (req, res, next) => {
    try {
      const { firstName, lastName, firmName, practiceArea, firmSize, region, sraNumber, billingRate, demoUrl } = req.body;
      await db.insert(demoLeads).values({
        firstName: firstName || null,
        lastName: lastName || null,
        firmName: firmName || null,
        practiceArea: practiceArea || null,
        firmSize: firmSize || null,
        region: region || null,
        sraNumber: sraNumber || null,
        billingRate: billingRate ? parseInt(billingRate, 10) : null,
        demoUrl: demoUrl || null,
      });
      console.log(`[DEMO] Lead captured (practiceArea: ${practiceArea || 'unknown'})`);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/demo/leads", generalApiLimiter, async (req, res, next) => {
    try {
      const demoLeadSchema = z.object({
        email: z.string().max(255).optional().nullable(),
        name: z.string().max(255).optional().nullable(),
        mobile: z.string().max(50).optional().nullable(),
        practiceArea: z.string().max(100).optional().nullable(),
        practiceAreaLabel: z.string().max(255).optional().nullable(),
      });
      const parsed = demoLeadSchema.parse(req.body);
      await db.insert(demoLeads).values({
        email: parsed.email || null,
        name: parsed.name || null,
        mobile: parsed.mobile || null,
        practiceArea: parsed.practiceArea || null,
        practiceAreaLabel: parsed.practiceAreaLabel || null,
      });
      console.log(`[DEMO] Tour lead captured (practiceArea: ${parsed.practiceArea || 'unknown'})`);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/demo/send-share", generalApiLimiter, async (req, res, next) => {
    try {
      const { recipientEmail, caseTitle, senderName, firmName, demoUrl } = req.body;
      if (!recipientEmail) return res.status(400).json({ message: "recipientEmail required" });
      console.log('[DEMO] Share request received');
      if (process.env.RESEND_API_KEY) {
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: "LegalNote <noreply@legalnote.app>",
            to: recipientEmail,
            subject: `${senderName} shared a matter record with you`,
            html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#222;max-width:600px;margin:0 auto;padding:0;background:#faf9f7">${legalNoteBrandHeaderHtml()}<div style="padding:24px;background:#fff"><p>Hello,</p><p><strong>${senderName}</strong> at <strong>${firmName}</strong> has shared access to a matter record via LegalNote.</p><p>This record includes a session transcript, attendance note, and audit trail.</p>${demoUrl ? `<p style="margin:28px 0"><a href="${demoUrl}" style="background:#c97d4d;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:bold">View Matter Record</a></p>` : ""}<hr style="margin:32px 0;border:none;border-top:1px solid #e8e4df"><p style="font-size:12px;color:#8a7d72">Sent via LegalNote — Meeting to Matter.</p></div></body></html>`,
          });
        } catch (emailErr) {
          console.error("[DEMO] Email send failed:", emailErr);
        }
      }
      res.json({ success: true, message: "Share notification sent" });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/demo/send-consent-sms", generalApiLimiter, async (req, res, next) => {
    try {
      const { phone, clientName, solicitorName, firmName } = req.body;
      if (!phone) return res.status(400).json({ message: "phone required" });
      console.log('[DEMO] Consent SMS request received');
      const smsBody = `${solicitorName} at ${firmName || "the firm"} is requesting your consent to record your upcoming meeting. Reply YES to consent. Sent via LegalNote.`;
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
        try {
          const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          await twilio.messages.create({
            body: smsBody,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone,
          });
          console.log('[DEMO] Consent SMS delivered');
          return res.json({ success: true, delivered: true, message: "Consent request sent to " + phone });
        } catch (smsErr) {
          console.error("[DEMO] Twilio SMS send failed:", smsErr);
        }
      }
      res.json({ success: false, delivered: false, message: "SMS delivery requires Twilio configuration." });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/demo/send-colleague-link", generalApiLimiter, async (req, res, next) => {
    try {
      const { email, senderName, firmName, demoUrl } = req.body;
      if (!email) return res.status(400).json({ message: "email required" });
      console.log('[DEMO] Colleague link request received');
      if (process.env.RESEND_API_KEY) {
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: "LegalNote <noreply@legalnote.app>",
            to: email,
            subject: `${senderName} thought you should see this`,
            html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#222;max-width:600px;margin:0 auto;padding:0;background:#faf9f7">${legalNoteBrandHeaderHtml()}<div style="padding:24px;background:#fff"><p>Hello,</p><p><strong>${senderName}</strong> from <strong>${firmName}</strong> sent you this because they believe LegalNote is relevant to your firm's compliance obligations.</p>${demoUrl ? `<p style="margin:28px 0"><a href="${demoUrl}" style="background:#c97d4d;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:bold">See the interactive walkthrough</a></p>` : ""}<hr style="margin:32px 0;border:none;border-top:1px solid #e8e4df"><p style="font-size:12px;color:#8a7d72">Sent via LegalNote — Meeting to Matter.</p></div></body></html>`,
          });
        } catch (emailErr) {
          console.error("[DEMO] Colleague link email failed:", emailErr);
        }
      }
      res.json({ success: true, message: "Colleague invitation sent" });
    } catch (error) {
      next(error);
    }
  });

  // TEST ENDPOINT: Trigger audio cleanup (development only)
  app.post("/api/test/trigger-audio-cleanup", async (req, res, next) => {
    try {
      // Security: Only allow in development mode
      if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ 
          message: "This endpoint is only available in development mode" 
        });
      }

      const { cleanupExpiredAudio } = await import("./audioCleanup");
      await cleanupExpiredAudio();

      res.json({ 
        success: true, 
        message: "Audio cleanup completed successfully",
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[TEST] Error triggering cleanup:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to trigger audio cleanup",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Global action items (all cases for the user)
  app.get("/api/action-items/all", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const items = await storage.getAllActionItemsForUser(userId);
      res.json(items);
    } catch (error: any) {
      next(error);
    }
  });

  // In-app notifications system (simple polling + SSE)
  // Notifications are generated from audit trail events
  app.get("/api/notifications", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      
      // Generate notifications from recent audit trail events
      const { db: dbConn } = await import("./db");
      const { auditTrail, cases: casesTable } = await import("@shared/schema");
      const { eq, and, desc, gte, inArray: inArr } = await import("drizzle-orm");
      const {
        buildNotificationCopy,
        buildNotificationHref,
        resolveDocumentType,
      } = await import("./services/notificationPresentation");
      
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days
      
      const notifiableEvents = [
        'transcript_generated', 'transcription_completed',
        'document_generated', 'document_regenerated',
        'case_email_sent', 'audio_expiring_soon', 'deadline_approaching', 'consent_given',
        'case_handover_received',
        'pre_consent_acknowledged', 'pre_consent_declined', 'pre_consent_reschedule_requested',
        'meeting_reminder',
      ];
      
      const events = await dbConn
        .select()
        .from(auditTrail)
        .where(
          and(
            eq(auditTrail.userId, userId),
            gte(auditTrail.timestamp, since),
            inArr(auditTrail.eventType, notifiableEvents)
          )
        )
        .orderBy(desc(auditTrail.timestamp))
        .limit(30);
      
      // Get case titles for events that have caseIds
      const caseIds = [...new Set(events.filter(e => e.caseId).map(e => e.caseId as string))];
      let caseMap: Map<string, any> = new Map();
      if (caseIds.length > 0) {
        const caseRecords = await dbConn.select().from(casesTable).where(inArr(casesTable.id, caseIds));
        caseMap = new Map(caseRecords.map(c => [c.id, c]));
      }
      
      // Get user's read notifications from user preferences metadata (stored in audit trail metadata)
      const readNotifications = new Set<string>();
      let markAllReadAt: Date | null = null;
      const readEvents = await dbConn
        .select()
        .from(auditTrail)
        .where(
          and(
            eq(auditTrail.userId, userId),
            eq(auditTrail.eventType, 'notification_read')
          )
        );
      readEvents.forEach(e => {
        const meta = e.metadata as any;
        if (meta?.notificationId) readNotifications.add(meta.notificationId);
        if (meta?.markAllRead) {
          const ts = meta.timestamp ? new Date(meta.timestamp) : e.timestamp;
          if (!markAllReadAt || ts > markAllReadAt) markAllReadAt = ts;
        }
      });
      
      const notifications = events.map(event => {
        const caseRecord = event.caseId ? caseMap.get(event.caseId) : null;
        const { title, message } = buildNotificationCopy(event, caseRecord);
        const href = buildNotificationHref(event);
        const documentType = resolveDocumentType(event);
        const isRead =
          readNotifications.has(event.id) ||
          (!!markAllReadAt && event.timestamp <= markAllReadAt);
        
        return {
          id: event.id,
          type: event.eventType,
          title,
          message,
          caseId: event.caseId || undefined,
          caseTitle: caseRecord?.title || undefined,
          documentId: event.documentId || undefined,
          documentType: documentType || undefined,
          href,
          createdAt: event.timestamp.toISOString(),
          readAt: isRead ? event.timestamp.toISOString() : undefined,
        };
      }).filter(n => n.title);
      
      res.json(notifications);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/notifications/:id/read", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      await logAuditEvent(userId, "notification_read", {
        metadata: { notificationId: id },
        req,
      });
      res.json({ success: true });
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/notifications/mark-all-read", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      await logAuditEvent(userId, "notification_read", {
        metadata: { markAllRead: true, timestamp: new Date().toISOString() },
        req,
      });
      res.json({ success: true });
    } catch (error: any) {
      next(error);
    }
  });

  // SSE stream for real-time notifications
  app.get("/api/notifications/stream", isAuthenticated, (req: any, res: any) => {
    const userId = req.user.claims.sub;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    
    if (!sseClients.has(userId)) sseClients.set(userId, new Set());
    sseClients.get(userId)!.add(res);
    
    const heartbeat = setInterval(() => {
      res.write(':heartbeat\n\n');
    }, 30000);
    
    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.get(userId)?.delete(res);
    });
  });

  // ==================== Compliance Thread Routes ====================

  const requireAmlComplianceFeature = (_req: any, res: any, next: any) => {
    if (!isFeatureVisible("amlCompliance")) {
      return res.status(404).json({ message: "Not found" });
    }
    next();
  };

  const requireComplianceThread = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.complianceThread) {
        return res.status(403).json({ message: "Compliance Thread is not enabled. Enable it in Settings." });
      }
      next();
    } catch (error) {
      res.status(500).json({ message: "Failed to check compliance entitlement" });
    }
  };

  app.get("/api/cases/:caseId/aml-monitoring-notes", isAuthenticated, requireAmlComplianceFeature, requireComplianceThread, async (req: any, res) => {
    try {
      const { caseId } = req.params;
      const userId = req.user.claims.sub;
      const caseRecord = await storage.getCase(caseId, userId);
      if (!caseRecord) return res.status(404).json({ message: "Case not found" });
      const notes = await storage.getAmlMonitoringNotes(caseId);
      res.json(notes);
    } catch (error: any) {
      console.error("[AML] Error fetching monitoring notes:", error);
      res.status(500).json({ message: "Failed to fetch AML monitoring notes" });
    }
  });

  app.post("/api/cases/:caseId/aml-monitoring-notes", isAuthenticated, requireAmlComplianceFeature, requireComplianceThread, async (req: any, res) => {
    try {
      const { caseId } = req.params;
      const userId = req.user.claims.sub;
      const caseRecord = await storage.getCase(caseId, userId);
      if (!caseRecord) return res.status(404).json({ message: "Case not found" });

      const validatedData = insertAmlMonitoringNoteSchema.parse({
        ...req.body,
        caseId,
        userId,
      });

      const note = await storage.createAmlMonitoringNote(validatedData);

      if (validatedData.riskLevel) {
        await storage.updateCase(caseId, { riskLevel: validatedData.riskLevel }, userId);
      }

      await storage.createAuditLog({
        userId,
        eventType: "aml_monitoring_note_created",
        caseId,
        metadata: {
          recordType: validatedData.recordType,
          riskLevel: validatedData.riskLevel,
          noteId: note.id,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent") || "",
      });

      res.status(201).json(note);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("[AML] Error creating monitoring note:", error);
      res.status(500).json({ message: "Failed to create AML monitoring note" });
    }
  });

  app.get("/api/cases/:caseId/aml-decision-records", isAuthenticated, requireAmlComplianceFeature, requireComplianceThread, async (req: any, res) => {
    try {
      const { caseId } = req.params;
      const userId = req.user.claims.sub;
      const caseRecord = await storage.getCase(caseId, userId);
      if (!caseRecord) return res.status(404).json({ message: "Case not found" });
      const records = await storage.getAmlDecisionRecords(caseId);
      res.json(records);
    } catch (error: any) {
      console.error("[AML] Error fetching decision records:", error);
      res.status(500).json({ message: "Failed to fetch AML decision records" });
    }
  });

  app.post("/api/cases/:caseId/aml-decision-records", isAuthenticated, requireAmlComplianceFeature, requireComplianceThread, async (req: any, res) => {
    try {
      const { caseId } = req.params;
      const userId = req.user.claims.sub;
      const caseRecord = await storage.getCase(caseId, userId);
      if (!caseRecord) return res.status(404).json({ message: "Case not found" });

      const validatedData = insertAmlDecisionRecordSchema.parse({
        ...req.body,
        caseId,
        userId,
      });

      const sigPayload = JSON.stringify({
        caseId: validatedData.caseId,
        userId: validatedData.userId,
        decision: validatedData.decision,
        concernDescription: validatedData.concernDescription,
        decisionReasoning: validatedData.decisionReasoning,
        timestamp: new Date().toISOString(),
      });
      const signingKey = process.env.SESSION_SECRET;
      if (!signingKey) {
        return res.status(500).json({ message: "Server signing key not configured. Set SESSION_SECRET environment variable." });
      }
      const signatureHash = crypto.createHmac("sha256", signingKey).update(sigPayload).digest("hex");

      const record = await storage.createAmlDecisionRecord({
        ...validatedData,
        signatureHash,
      });

      await storage.createAuditLog({
        userId,
        eventType: "aml_decision_recorded",
        caseId,
        metadata: {
          decision: validatedData.decision,
          signatureHash,
          concernDescription: validatedData.concernDescription,
          decisionReasoning: validatedData.decisionReasoning,
          recordId: record.id,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent") || "",
        severity: "high",
      });

      res.status(201).json(record);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("[AML] Error creating decision record:", error);
      res.status(500).json({ message: "Failed to create AML decision record" });
    }
  });

  app.patch("/api/cases/:caseId/risk-level", isAuthenticated, requireAmlComplianceFeature, requireComplianceThread, async (req: any, res) => {
    try {
      const { caseId } = req.params;
      const userId = req.user.claims.sub;
      const { riskLevel } = req.body;
      const validLevel = z.enum(["low", "medium", "high"]).parse(riskLevel);
      const updated = await storage.updateCase(caseId, { riskLevel: validLevel }, userId);
      if (!updated) return res.status(404).json({ message: "Case not found" });

      await storage.createAuditLog({
        userId,
        eventType: "case_risk_level_updated",
        caseId,
        metadata: { riskLevel: validLevel },
        ipAddress: req.ip,
        userAgent: req.get("user-agent") || "",
      });

      res.json(updated);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid risk level" });
      }
      console.error("[AML] Error updating risk level:", error);
      res.status(500).json({ message: "Failed to update risk level" });
    }
  });

  app.post("/api/aml-activity-dates", isAuthenticated, requireAmlComplianceFeature, requireComplianceThread, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { caseIds } = req.body;
      if (!Array.isArray(caseIds)) return res.status(400).json({ message: "caseIds must be an array" });
      const userCases = await storage.getCases(userId);
      const ownedIds = new Set(userCases.map(c => c.id));
      const validatedCaseIds = caseIds.filter((id: string) => ownedIds.has(id));
      const dates = await storage.getLastAmlActivityDates(validatedCaseIds);
      const serialized: Record<string, string> = {};
      for (const [k, v] of Object.entries(dates)) {
        serialized[k] = v.toISOString();
      }
      res.json(serialized);
    } catch (error: any) {
      console.error("[AML] Error fetching activity dates:", error);
      res.status(500).json({ message: "Failed to fetch AML activity dates" });
    }
  });

  app.patch("/api/user/compliance-thread", isAuthenticated, requireAmlComplianceFeature, isAdmin, async (req: any, res) => {
    try {
      const { enabled, targetUserId } = req.body;
      const userId = targetUserId || req.user.claims.sub;
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ message: "enabled must be a boolean" });
      }
      const updated = await storage.updateUserComplianceThread(userId, enabled);
      if (!updated) return res.status(404).json({ message: "User not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("[AML] Error toggling compliance thread:", error);
      res.status(500).json({ message: "Failed to update compliance thread setting" });
    }
  });

  app.post("/api/cases/:caseId/sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId } = req.params;
      const caseData = await storage.getCase(caseId, userId);
      if (!caseData) return res.status(404).json({ message: "Case not found" });

      const recordingTypeResult = validateRecordingType(req.body.recordingType ?? 'full_meeting', {
        matterKind: (caseData as { matterKind?: string }).matterKind,
      });
      if (!recordingTypeResult.ok) {
        return res.status(400).json({ message: recordingTypeResult.message });
      }
      const recordingType = recordingTypeResult.recordingType;

      const sessionData = {
        caseId,
        recordingType,
        sessionTitle: typeof req.body.sessionTitle === "string" && req.body.sessionTitle.trim() ? req.body.sessionTitle.trim() : undefined,
        status: "pending" as const,
        notes: typeof req.body.notes === "string" ? req.body.notes : null,
        createdBy: userId,
      };

      const session = await storage.createMeetingSession(sessionData);
      res.status(201).json(session);
    } catch (error: any) {
      console.error("[Sessions] Error creating session:", error);
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  app.get("/api/cases/:caseId/sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { caseId } = req.params;
      const sessions = await storage.getMeetingSessionsByCase(caseId, userId);
      res.json(sessions);
    } catch (error: any) {
      console.error("[Sessions] Error fetching sessions:", error);
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  app.get("/api/sessions/:sessionId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const session = await storage.getMeetingSession(req.params.sessionId);
      if (!session) return res.status(404).json({ message: "Session not found" });
      const caseData = await storage.getCase(session.caseId, userId);
      if (!caseData) return res.status(404).json({ message: "Session not found" });
      const transcript = await storage.getTranscriptBySession(session.id);
      const documents = await storage.getDocumentsBySession(session.id);
      // Strip selectedText and privilegedRedactions before returning
      // These fields must never leave the server in API responses
      const safeSessionTranscript = transcript
        ? {
            ...transcript,
            privilegedRedactions: undefined,
            redactions: ((transcript.redactions || []) as any[]).map((r: any) => {
              const { selectedText: _st, ...safeRedaction } = r;
              return safeRedaction;
            }),
          }
        : null;

      res.json({ ...session, transcript: safeSessionTranscript, documents });
    } catch (error: any) {
      console.error("[Sessions] Error fetching session:", error);
      res.status(500).json({ message: "Failed to fetch session" });
    }
  });

  app.patch("/api/sessions/:sessionId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.params;
      const session = await storage.getMeetingSession(sessionId);
      if (!session) return res.status(404).json({ message: "Session not found" });
      const caseData = await storage.getCase(session.caseId, userId);
      if (!caseData) return res.status(404).json({ message: "Session not found" });

      const validStatuses = ["pending", "processing", "completed", "failed"];
      const updates: Record<string, any> = {};
      if (req.body.status && validStatuses.includes(req.body.status)) {
        updates.status = req.body.status;
      }
      if (typeof req.body.durationSeconds === "number" && req.body.durationSeconds >= 0) {
        updates.durationSeconds = req.body.durationSeconds;
      }
      if (typeof req.body.notes === "string") {
        updates.notes = req.body.notes;
      }
      if (typeof req.body.sessionTitle === "string") {
        updates.sessionTitle = req.body.sessionTitle.trim() || null;
      }

      const updated = await storage.updateMeetingSession(sessionId, updates);
      if (!updated) return res.status(404).json({ message: "Session not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("[Sessions] Error updating session:", error);
      res.status(500).json({ message: "Failed to update session" });
    }
  });

  // ========================
  // Team management routes
  // ========================

  /**
   * Middleware factory: ensures the authenticated user holds at least one of the given
   * primary roles or regulatory designations, and that their account is in the given firm.
   * Sets req.firmUser to the resolved user object on success.
   */
  const requireRole = (allowedRoles: string[], allowedDesignations: string[] = []) => {
    return async (req: any, res: any, next: any) => {
      try {
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "Not authenticated" });
        const user = await storage.getUser(userId);
        if (!user?.firmId) return res.status(400).json({ message: "No firm associated with your account" });

        const designations = user.regulatoryDesignations ?? [];
        // Access is granted if the user satisfies at least one non-empty check list.
        // An empty list is NOT a wildcard — it means that criteria is not being tested.
        // At least one non-empty list must be provided; the user must satisfy one of them.
        const roleOk = allowedRoles.length > 0 && allowedRoles.includes(user.primaryRole ?? "");
        const designationOk = allowedDesignations.length > 0 && allowedDesignations.some(d => designations.includes(d));

        if (!roleOk && !designationOk) {
          return res.status(403).json({ message: "You do not have permission to perform this action" });
        }
        req.firmUser = user;
        next();
      } catch (err) {
        next(err);
      }
    };
  };

  /** Middleware: ensures the authenticated user is a firm admin */
  const requireFirmAdmin = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(userId);
      if (!user?.firmId) return res.status(400).json({ message: "No firm associated with your account" });
      if (!(user.regulatoryDesignations ?? []).includes("is_firm_admin")) {
        return res.status(403).json({ message: "Only firm administrators can perform this action" });
      }
      req.firmAdminUser = user;
      req.firmUser = user;
      next();
    } catch (err) {
      next(err);
    }
  };

  // Get current user's firm (or create one if they don't have one)
  app.get("/api/firm", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const firm = await storage.ensureUserHasFirm(userId);
      res.json(firm);
    } catch (error: any) {
      console.error("[Firm] Error getting firm:", error);
      res.status(500).json({ message: "Failed to get firm" });
    }
  });

  // Firm evaluation / team value stats (firm admin only)
  app.get("/api/firm/evaluation-stats", isAuthenticated, requireFirmAdmin, async (req: any, res) => {
    try {
      const rangeParam = String(req.query.range || "today");
      const range =
        rangeParam === "48h" || rangeParam === "week" || rangeParam === "all" || rangeParam === "today"
          ? rangeParam
          : "today";
      const stats = await storage.getFirmEvaluationStats(req.firmAdminUser.firmId, range);
      res.json(stats);
    } catch (error: any) {
      console.error("[Firm] Error getting evaluation stats:", error);
      res.status(500).json({ message: "Failed to get firm evaluation stats" });
    }
  });

  // Update firm details (firm admin only)
  app.patch("/api/firm", isAuthenticated, requireFirmAdmin, async (req: any, res) => {
    try {
      const adminUser = req.firmAdminUser;

      const schema = z.object({
        name: z.string().min(1).max(200).optional(),
        sraNumber: z.string().max(20).optional().nullable(),
        addressLine1: z.string().max(200).optional().nullable(),
        addressLine2: z.string().max(200).optional().nullable(),
        city: z.string().max(100).optional().nullable(),
        postcode: z.string().max(20).optional().nullable(),
        phone: z.string().max(30).optional().nullable(),
        email: z.string().email().optional().nullable(),
        website: z.string().url().optional().nullable(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });

      const updated = await storage.updateFirm(adminUser.firmId, parsed.data);
      res.json(updated);
    } catch (error: any) {
      console.error("[Firm] Error updating firm:", error);
      res.status(500).json({ message: "Failed to update firm" });
    }
  });

  // Get team members (available to all firm members; firm admins get full details including inviteStatus)
  app.get("/api/team/members", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.firmId) return res.status(400).json({ message: "No firm associated with your account" });
      const isAdminView = (user.regulatoryDesignations ?? []).includes("is_firm_admin");

      const members = await storage.getFirmMembers(user.firmId);
      const sanitized = members.map(m => {
        const base = {
          id: m.id,
          firstName: m.firstName,
          lastName: m.lastName,
          profileImageUrl: m.profileImageUrl,
          primaryRole: m.primaryRole,
          customRoleLabel: m.customRoleLabel,
          regulatoryDesignations: m.regulatoryDesignations,
          createdAt: m.createdAt,
        };
        if (isAdminView) {
          return {
            ...base,
            email: m.email,
            inviteStatus: m.inviteStatus,
            invitedAt: m.invitedAt,
            lastActiveAt: m.lastActiveAt,
          };
        }
        return base;
      });
      res.json(sanitized);
    } catch (error: any) {
      console.error("[Team] Error getting members:", error);
      res.status(500).json({ message: "Failed to get team members" });
    }
  });

  // Get former team members
  app.get("/api/team/members/former", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.firmId) return res.status(400).json({ message: "No firm associated with your account" });

      const isFirmAdmin = (user.regulatoryDesignations ?? []).includes("is_firm_admin");
      if (!isFirmAdmin) return res.status(403).json({ message: "Only firm administrators can view former members" });

      const members = await storage.getFormerFirmMembers(user.firmId);
      const sanitized = members.map(m => ({
        id: m.id,
        email: m.email,
        firstName: m.firstName,
        lastName: m.lastName,
        profileImageUrl: m.profileImageUrl,
        primaryRole: m.primaryRole,
        customRoleLabel: m.customRoleLabel,
        removedAt: m.removedAt,
      }));
      res.json(sanitized);
    } catch (error: any) {
      console.error("[Team] Error getting former members:", error);
      res.status(500).json({ message: "Failed to get former members" });
    }
  });

  // Update team member's role (firm admin only)
  app.patch("/api/team/members/:memberId/role", isAuthenticated, requireFirmAdmin, async (req: any, res) => {
    try {
      const adminUser = req.firmAdminUser;
      const { memberId } = req.params;
      const targetUser = await storage.getUser(memberId);
      if (!targetUser || targetUser.firmId !== adminUser.firmId) {
        return res.status(404).json({ message: "Team member not found" });
      }

      const schema = z.object({
        primaryRole: z.string().optional().nullable(),
        customRoleLabel: z.string().max(100).optional().nullable(),
        regulatoryDesignations: z.array(z.string()).optional(),
        reason: z.string().max(500).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });

      const newDesignations = parsed.data.regulatoryDesignations ?? targetUser.regulatoryDesignations ?? [];
      const warnings: string[] = [];

      // Designation governance: warn if unique designations are being assigned to multiple people
      if (newDesignations.length > 0) {
        const allMembers = await storage.getFirmMembers(adminUser.firmId);
        const uniqueDesignations = ["is_colp", "is_cofa", "is_mlro"] as const;
        for (const des of uniqueDesignations) {
          const alreadyHolders = allMembers.filter(
            m => m.id !== memberId && (m.regulatoryDesignations ?? []).includes(des)
          );
          if (newDesignations.includes(des) && alreadyHolders.length > 0) {
            const holderName = alreadyHolders[0].firstName
              ? `${alreadyHolders[0].firstName} ${alreadyHolders[0].lastName}`
              : alreadyHolders[0].email ?? "another member";
            const desLabel = REGULATORY_DESIGNATION_LABELS[des];
            warnings.push(`${desLabel} is already assigned to ${holderName}. Each firm should typically have only one person in this role.`);
          }
        }

        // Prevent removing is_firm_admin if this is the last one
        const currentlyFirmAdmin = (targetUser.regulatoryDesignations ?? []).includes("is_firm_admin");
        const becomingFirmAdmin = newDesignations.includes("is_firm_admin");
        if (currentlyFirmAdmin && !becomingFirmAdmin) {
          const otherAdmins = allMembers.filter(
            m => m.id !== memberId && (m.regulatoryDesignations ?? []).includes("is_firm_admin")
          );
          if (otherAdmins.length === 0) {
            return res.status(400).json({
              message: "Cannot remove Firm Administrator from the last administrator. Assign another firm admin first.",
            });
          }
        }
      }

      // Log the role change (role_change_log table + audit trail)
      await storage.createRoleChangeLog({
        userId: memberId,
        firmId: adminUser.firmId,
        changedByUserId: adminUser.id,
        previousRole: targetUser.primaryRole ?? null,
        newRole: parsed.data.primaryRole ?? null,
        previousDesignations: targetUser.regulatoryDesignations ?? [],
        newDesignations,
        previousCustomRoleLabel: targetUser.customRoleLabel ?? null,
        newCustomRoleLabel: parsed.data.customRoleLabel ?? null,
        reason: parsed.data.reason ?? null,
      });
      await storage.createAuditLog({
        eventType: "team_role_changed",
        userId: adminUser.id,
        severity: "info",
        metadata: {
          targetUserId: memberId,
          firmId: adminUser.firmId,
          previousRole: targetUser.primaryRole ?? null,
          newRole: parsed.data.primaryRole ?? null,
          previousDesignations: targetUser.regulatoryDesignations ?? [],
          newDesignations,
          reason: parsed.data.reason ?? null,
        },
      }).catch(() => {});

      const updated = await storage.updateUserFirmRole(memberId, {
        primaryRole: parsed.data.primaryRole,
        customRoleLabel: parsed.data.customRoleLabel,
        regulatoryDesignations: newDesignations,
      });
      res.json({ user: updated, warnings });
    } catch (err) {
      console.error("[Team] Error updating member role:", err);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  // Offboard a team member (firm admin only)
  app.post("/api/team/members/:memberId/offboard", isAuthenticated, requireFirmAdmin, async (req: any, res) => {
    try {
      const adminUser = req.firmAdminUser;
      const { memberId } = req.params;
      if (memberId === adminUser.id) return res.status(400).json({ message: "You cannot offboard yourself" });

      const targetUser = await storage.getUser(memberId);
      if (!targetUser || targetUser.firmId !== adminUser.firmId) {
        return res.status(404).json({ message: "Team member not found" });
      }

      // Check for open matters assigned to this member (non-archived)
      const allMemberCases = await storage.getCases(memberId, false).catch(() => []);
      const activeCaseCount = allMemberCases.length;

      const schema = z.object({
        /**
         * Optional map of caseId → new assignee userId.
         * If omitted (or partial) while active cases exist, returns 409 with case list.
         * Pass ALL cases to proceed with offboarding.
         */
        reassignments: z.record(z.string(), z.string()).optional(),
      });
      const parsed = schema.safeParse(req.body);
      const reassignments = (parsed.success && parsed.data.reassignments) || {};
      const unassignedCases = allMemberCases.filter(c => !reassignments[c.id]);

      if (activeCaseCount > 0 && unassignedCases.length > 0) {
        return res.status(409).json({
          message: `This team member has ${activeCaseCount} open matter${activeCaseCount === 1 ? "" : "s"} that must be reassigned before offboarding.`,
          activeCaseCount,
          requiresConfirmation: true,
          cases: allMemberCases.map(c => ({ id: c.id, title: c.title, matterReference: c.matterReference })),
        });
      }

      // Apply reassignments for open cases, validating new assignees belong to the same firm
      const firmMembers = await storage.getFirmMembers(adminUser.firmId);
      const firmMemberIds = new Set(firmMembers.map(m => m.id));
      for (const [caseId, newAssignee] of Object.entries(reassignments)) {
        if (newAssignee && !firmMemberIds.has(newAssignee)) {
          return res.status(400).json({ message: `Assignee ${newAssignee} does not belong to your firm` });
        }
        const targetCase = allMemberCases.find(c => c.id === caseId);
        if (targetCase) {
          await storage.updateCase(caseId, { assignedToUserId: newAssignee || null }, memberId).catch(() => {});
        }
      }

      // Ensure at least one other firm admin remains
      const otherFirmAdmins = firmMembers.filter(
        m => m.id !== memberId && (m.regulatoryDesignations ?? []).includes("is_firm_admin")
      );
      if ((targetUser.regulatoryDesignations ?? []).includes("is_firm_admin") && otherFirmAdmins.length === 0) {
        return res.status(400).json({
          message: "Cannot offboard the last firm administrator. Please assign another firm admin first.",
        });
      }

      const removed = await storage.removeUserFromFirm(memberId, new Date());
      await storage.createAuditLog({
        eventType: "team_member_offboarded",
        userId: adminUser.id,
        severity: "info",
        metadata: {
          targetUserId: memberId,
          firmId: adminUser.firmId,
          reassignmentsApplied: Object.keys(reassignments).length,
        },
      }).catch(() => {});
      res.json({ message: "Team member offboarded successfully", user: removed });
    } catch (err) {
      console.error("[Team] Error offboarding member:", err);
      res.status(500).json({ message: "Failed to offboard member" });
    }
  });

  // Send team invitation (firm admin only)
  app.post("/api/team/invite", isAuthenticated, requireFirmAdmin, async (req: any, res) => {
    try {
      const invitingUser = req.firmAdminUser;
      const userId = invitingUser.id;

      const schema = z.object({
        email: z.string().email(),
        suggestedRole: z.string().optional().nullable(),
        suggestedCustomRoleLabel: z.string().max(100).optional().nullable(),
        authProvider: z.enum(["google", "microsoft"]).optional().default("google"),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });

      const { email, suggestedRole, suggestedCustomRoleLabel, authProvider } = parsed.data;
      const firmId = invitingUser.firmId!;

      // Check for existing pending invitation
      const existingInvitations = await storage.getFirmInvitations(firmId);
      const existingPending = existingInvitations.find(
        inv => inv.email.toLowerCase() === email.toLowerCase() && inv.status === "pending"
      );
      if (existingPending) {
        return res.status(400).json({ message: "A pending invitation already exists for this email address" });
      }

      const seats = await storage.countFirmSeatUsage(firmId);
      if (seats.limit != null && seats.used >= seats.limit) {
        return res.status(403).json({
          message: `Seat limit reached (${seats.used}/${seats.limit}). Contact LegalNote to add seats.`,
          seats,
        });
      }

      const firm = await storage.getFirm(firmId);
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const invitation = await storage.createFirmInvitation({
        firmId,
        invitingUserId: userId,
        email,
        suggestedRole: suggestedRole ?? null,
        suggestedCustomRoleLabel: suggestedCustomRoleLabel ?? null,
        token,
        authProvider,
        status: "pending",
        expiresAt,
      });

      // Send email
      const invitingName = invitingUser.firstName && invitingUser.lastName
        ? `${invitingUser.firstName} ${invitingUser.lastName}`
        : invitingUser.email ?? "A team member";

      const roleLabel = suggestedRole
        ? (PRIMARY_ROLE_LABELS[suggestedRole as keyof typeof PRIMARY_ROLE_LABELS] ?? suggestedRole)
        : undefined;

      await sendInvitationEmail({
        to: email,
        invitingUserName: invitingName,
        firmName: firm?.name ?? "Your Firm",
        suggestedRole: roleLabel,
        inviteToken: token,
      });

      await storage.createAuditLog({
        eventType: "team_invitation_sent",
        userId: invitingUser.id,
        severity: "info",
        metadata: {
          invitedEmail: email,
          firmId: invitingUser.firmId,
          suggestedRole: roleLabel ?? null,
        },
      }).catch(() => {});
      res.json({ message: "Invitation sent successfully", invitation });
    } catch (error: any) {
      console.error("[Team] Error sending invitation:", error);
      res.status(500).json({ message: "Failed to send invitation" });
    }
  });

  // Get firm invitations (firm admin only)
  app.get("/api/team/invitations", isAuthenticated, requireFirmAdmin, async (req: any, res) => {
    try {
      const adminUser = req.firmAdminUser;
      const invitations = await storage.getFirmInvitations(adminUser.firmId);
      res.json(invitations);
    } catch (error: any) {
      console.error("[Team] Error getting invitations:", error);
      res.status(500).json({ message: "Failed to get invitations" });
    }
  });

  // Cancel an invitation (firm admin only)
  app.post("/api/team/invitations/:invitationId/cancel", isAuthenticated, requireFirmAdmin, async (req: any, res) => {
    try {
      const adminUser = req.firmAdminUser;
      const { invitationId } = req.params;
      const invitation = await storage.getFirmInvitation(invitationId);
      if (!invitation || invitation.firmId !== adminUser.firmId) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      if (invitation.status !== "pending") {
        return res.status(400).json({ message: "Only pending invitations can be cancelled" });
      }

      const updated = await storage.updateFirmInvitation(invitationId, { status: "cancelled" });
      res.json(updated);
    } catch (error: any) {
      console.error("[Team] Error cancelling invitation:", error);
      res.status(500).json({ message: "Failed to cancel invitation" });
    }
  });

  // Get invitation details by token (public route for the accept flow)
  app.get("/api/invite/:token", async (req: any, res) => {
    try {
      const { token } = req.params;
      const invitation = await storage.getFirmInvitationByToken(token);
      if (!invitation) return res.status(404).json({ message: "Invitation not found" });
      if (invitation.status !== "pending") {
        return res.status(400).json({ message: "This invitation is no longer valid", status: invitation.status });
      }
      if (new Date() > invitation.expiresAt) {
        await storage.updateFirmInvitation(invitation.id, { status: "expired" });
        return res.status(400).json({ message: "This invitation has expired", status: "expired" });
      }
      const firm = await storage.getFirm(invitation.firmId);
      res.json({
        email: invitation.email,
        firmName: firm?.name ?? "the firm",
        suggestedRole: invitation.suggestedRole,
        suggestedCustomRoleLabel: invitation.suggestedCustomRoleLabel,
        authProvider: invitation.authProvider ?? "google",
        expiresAt: invitation.expiresAt,
      });
    } catch (err) {
      console.error("[Invite] Error getting invitation:", err);
      res.status(500).json({ message: "Failed to get invitation" });
    }
  });

  // Accept an invitation (requires authentication — user must sign in with matching email)
  app.post("/api/invite/:token/accept", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { token } = req.params;
      const invitation = await storage.getFirmInvitationByToken(token);
      if (!invitation) return res.status(404).json({ message: "Invitation not found" });
      if (invitation.status !== "pending") {
        return res.status(400).json({ message: "This invitation is no longer valid", status: invitation.status });
      }
      if (new Date() > invitation.expiresAt) {
        await storage.updateFirmInvitation(invitation.id, { status: "expired" });
        return res.status(400).json({ message: "This invitation has expired" });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Security: authenticated user's email must match invitation email
      if (!user.email || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        return res.status(403).json({
          message: "This invitation was sent to a different email address. Please sign in with the account matching the invited email.",
        });
      }

      const requiredProvider = invitation.authProvider ?? "google";
      const identities = await storage.getAuthIdentitiesForUser(userId);
      if (!identities.some((identity) => identity.provider === requiredProvider)) {
        const providerLabel = requiredProvider === "microsoft" ? "Microsoft" : "Google";
        return res.status(403).json({
          message: `This invitation requires you to sign in with ${providerLabel}. Please sign out and sign in with ${providerLabel} using the invited email address.`,
        });
      }

      // If user already has a firm (other than the one being joined), deny
      if (user.firmId && user.firmId !== invitation.firmId) {
        return res.status(400).json({ message: "You are already a member of another firm" });
      }

      // Assign user to firm in pending_approval state (awaiting firm admin activation)
      await storage.updateUserFirmRole(userId, {
        firmId: invitation.firmId,
        inviteStatus: "pending_approval",
        primaryRole: invitation.suggestedRole ?? user.primaryRole ?? "solicitor",
        customRoleLabel: invitation.suggestedCustomRoleLabel ?? null,
        invitedAt: new Date(),
      });

      // Mark invitation as accepted
      await storage.updateFirmInvitation(invitation.id, { status: "accepted" });

      const firm = await storage.getFirm(invitation.firmId);
      res.json({
        message: "Invitation accepted. Your membership is pending approval by your firm administrator.",
        firm,
        pendingApproval: true,
      });
    } catch (err) {
      console.error("[Invite] Error accepting invitation:", err);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  // Activate a pending member (firm admin only — completes onboarding after invitation acceptance)
  app.post("/api/team/members/:memberId/activate", isAuthenticated, requireFirmAdmin, async (req: any, res) => {
    try {
      const adminUser = req.firmAdminUser;
      const { memberId } = req.params;
      const targetUser = await storage.getUser(memberId);
      if (!targetUser || targetUser.firmId !== adminUser.firmId) {
        return res.status(404).json({ message: "Team member not found" });
      }
      if (targetUser.inviteStatus !== "pending_approval") {
        return res.status(400).json({ message: "This member is not awaiting approval" });
      }

      const updated = await storage.updateUserFirmRole(memberId, { inviteStatus: "active" });
      await storage.createAuditLog({
        eventType: "team_member_activated",
        userId: adminUser.id,
        severity: "info",
        metadata: {
          targetUserId: memberId,
          firmId: adminUser.firmId,
        },
      }).catch(() => {});
      res.json({ message: "Member activated successfully", user: updated });
    } catch (err) {
      console.error("[Team] Error activating member:", err);
      res.status(500).json({ message: "Failed to activate member" });
    }
  });

  // Get role change logs for a firm (firm admin only)
  app.get("/api/team/role-logs", isAuthenticated, requireFirmAdmin, async (req: any, res) => {
    try {
      const adminUser = req.firmAdminUser;
      const logs = await storage.getFirmRoleChangeLogs(adminUser.firmId);
      res.json(logs);
    } catch (error: any) {
      console.error("[Team] Error getting role change logs:", error);
      res.status(500).json({ message: "Failed to get role change logs" });
    }
  });

  // Get available roles metadata (for dropdowns)
  app.get("/api/team/roles", isAuthenticated, async (_req: any, res) => {
    res.json({
      primaryRoles: PRIMARY_ROLES.map(role => ({ value: role, label: PRIMARY_ROLE_LABELS[role] })),
      regulatoryDesignations: REGULATORY_DESIGNATIONS.map(d => ({ value: d, label: REGULATORY_DESIGNATION_LABELS[d] })),
    });
  });

  const httpServer = createServer(app);

  return httpServer;
}
