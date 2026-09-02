import "./logSanitize";
import express, { type Request, Response, NextFunction } from "express";
import { runMigrations } from 'stripe-replit-sync';
import crypto from "crypto";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { configureSecurityHeaders } from "./securityHeaders";
import { cleanupExpiredAudio } from "./audioCleanup";
import { ensureSystemUser } from "./systemUser";
import { initializeWorkers } from "./workers";
import { migrateClientsFromCases } from "./clientMigration";
import { backfillSessions } from "./sessionMigration";
import { migrateReasoningGapPlaceholders } from "./reasoningGapMigration";
import { migrateVerificationWarningsToJsonb } from "./verificationWarningsMigration";
import { clearScheduledMeetingGuessedRecipients } from "./clearScheduledMeetingRecipientsMigration";
import { ensureTranscriptImportsTable } from "./transcriptImportsMigration";
import { ensureEvaluationOnboardingSetupsTable } from "./evaluationOnboardingMigration";
import { ensureMeetingImportsConsentColumns } from "./meetingImportsConsentMigration";
import { ensureMeetingBookingTables } from "./meetingBookingMigration";
import { ensureMatterKindColumn } from "./matterKindMigration";
import { ensureEvaluationStartsAtColumn } from "./evaluationStartsAtMigration";
import { ensureSupportTicketsTable } from "./supportTicketsMigration";
import { getStripeSync } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import "./envValidation"; // Validate environment on startup
import { assertSealTriggersInstalled } from "./sealTriggerAssertion";
import { assertLegalMasterHashes } from "./services/legalDocumentLoader";

// Development-only fallback when AUDIT_SIGNING_KEY is unset (production gate is in envValidation).
if (!process.env.AUDIT_SIGNING_KEY && process.env.NODE_ENV !== "production") {
  process.env.AUDIT_SIGNING_KEY = crypto.randomBytes(64).toString("hex");
  console.warn(
    "[AUDIT] AUDIT_SIGNING_KEY not set — generated ephemeral dev key for this process.",
  );
}

const app = express();

// Security headers and CORS (must be first)
configureSecurityHeaders(app);

// Initialize Stripe schema and sync data
async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('[STRIPE] DATABASE_URL not set, skipping Stripe initialization');
    return;
  }

  try {
    console.log('[STRIPE] Initializing schema...');
    await runMigrations({ databaseUrl, schema: 'stripe' });
    console.log('[STRIPE] Schema ready');

    const stripeSync = await getStripeSync();

    // Set up managed webhook
    console.log('[STRIPE] Setting up managed webhook...');
    const webhookBaseUrl = process.env.APP_URL || `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const { webhook, uuid } = await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`,
      { enabled_events: ['*'], description: 'LegalNote Stripe webhook' }
    );
    console.log(`[STRIPE] Webhook configured: ${webhook.url}`);

    // Sync existing Stripe data in background
    stripeSync.syncBackfill()
      .then(() => console.log('[STRIPE] Data synced'))
      .catch((err: any) => console.error('[STRIPE] Sync error:', err));
  } catch (error) {
    console.error('[STRIPE] Initialization error:', error);
  }
}

// Initialize Stripe before setting up routes
await initStripe();

// CRITICAL: Register Stripe webhook route BEFORE express.json()
// Webhook needs raw Buffer, not parsed JSON
app.post(
  '/api/stripe/webhook/:uuid',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!Buffer.isBuffer(req.body)) {
        console.error('[STRIPE] Webhook body is not a Buffer');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      const { uuid } = req.params;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig, uuid);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('[STRIPE] Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

// Recall.ai webhook route BEFORE express.json() for raw body signature verification
app.post(
  '/api/recall/webhook/bot-status',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const webhookSecret = process.env.RECALL_WEBHOOK_SECRET;
      let body: Record<string, unknown>;
      
      if (webhookSecret) {
        const crypto = await import("crypto");
        const signature = req.headers['x-recall-signature'] || req.headers['x-webhook-signature'];
        if (!signature) {
          return res.status(401).json({ message: "Missing webhook signature" });
        }
        
        const rawBytes = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
        const expectedSig = crypto.createHmac('sha256', webhookSecret).update(rawBytes).digest('hex');
        const sigStr = Array.isArray(signature) ? signature[0] : String(signature);
        
        const candidates = [expectedSig, `sha256=${expectedSig}`];
        const isValid = candidates.some(candidate => {
          if (sigStr.length !== candidate.length) return false;
          try {
            return crypto.timingSafeEqual(Buffer.from(sigStr, 'utf8'), Buffer.from(candidate, 'utf8'));
          } catch {
            return false;
          }
        });
        if (!isValid) {
          return res.status(401).json({ message: "Invalid webhook signature" });
        }
        body = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
      } else if (process.env.NODE_ENV === 'production') {
        return res.status(503).json({ message: "Webhook secret not configured" });
      } else {
        console.warn('[RECALL_WEBHOOK] No RECALL_WEBHOOK_SECRET configured — verification skipped (dev only)');
        body = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
      }
      
      const { bot_id, status } = body;
      if (!bot_id || !status) {
        return res.status(400).json({ message: "bot_id and status are required" });
      }
      
      console.log(`[RECALL_WEBHOOK] Bot ${bot_id} status changed to: ${status}`);
      
      const { storage } = await import("./storage");
      
      const meeting = await storage.getScheduledMeetingByBotId(String(bot_id));
      if (!meeting) {
        console.log(`[RECALL_WEBHOOK] No meeting found for bot ${bot_id}`);
        return res.json({ received: true });
      }
      
      await storage.updateScheduledMeeting(meeting.id, { botStatus: String(status) });
      
      if (status === 'done') {
        await storage.updateScheduledMeeting(meeting.id, {
          botStatus: 'done',
          status: 'completed',
        });
        
        if (meeting.caseId && !meeting.meetingImportId) {
          try {
            const { recallService } = await import("./services/recallService");
            const consentApproved = meeting.consentStatus === 'approved';
            const meetingImport = await recallService.startMeetingImport(
              meeting.userId,
              String(bot_id),
              meeting.caseId,
              consentApproved,
              meeting.preConsentEmailId || undefined,
            );
            await storage.updateScheduledMeeting(meeting.id, {
              meetingImportId: meetingImport.id,
            });
            console.log(`[RECALL_WEBHOOK] Auto-filed recording to case ${meeting.caseId}, import ${meetingImport.id}`);
          } catch (fileErr) {
            console.error(`[RECALL_WEBHOOK] Auto-file failed for meeting ${meeting.id}:`, fileErr);
          }
        } else if (meeting.meetingImportId) {
          console.log(`[RECALL_WEBHOOK] Meeting ${meeting.id} already has import ${meeting.meetingImportId}, skipping`);
        }
        
        await storage.createAuditLog({
          eventType: 'meeting_recording_completed',
          userId: meeting.userId,
          caseId: meeting.caseId || undefined,
          ipAddress: 'server-process',
          metadata: { meetingId: meeting.id, botId: bot_id, meetingTitle: meeting.title, autoFiled: !!meeting.caseId },
          severity: 'info',
        });
      } else if (status === 'failed') {
        await storage.updateScheduledMeeting(meeting.id, { botStatus: 'failed' });
        await storage.createAuditLog({
          eventType: 'meeting_recording_failed',
          userId: meeting.userId,
          caseId: meeting.caseId || undefined,
          ipAddress: 'server-process',
          metadata: { meetingId: meeting.id, botId: bot_id, meetingTitle: meeting.title },
          severity: 'warning',
        });
      }
      
      res.json({ received: true });
    } catch (error) {
      console.error('[RECALL_WEBHOOK] Error:', error);
      res.status(500).json({ message: 'Webhook processing error' });
    }
  }
);

// Now apply JSON middleware for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await assertSealTriggersInstalled();
  // Same boot-gate pattern as seal triggers: refuse to start if masters diverge
  // from the hashes acceptance will bind to (clause 18.4 / 12.4).
  assertLegalMasterHashes();

  const server = await registerRoutes(app);

  await ensureSystemUser();

  // GDPR Compliance: Clean up expired audio on server startup
  await cleanupExpiredAudio();

  // Backfill client records from existing cases (idempotent)
  await migrateClientsFromCases();

  // Backfill meeting sessions for existing cases (idempotent)
  await backfillSessions();

  // Replace any legacy visible placeholder text with HTML comment markers (idempotent)
  await migrateReasoningGapPlaceholders();
  await migrateVerificationWarningsToJsonb();

  // Ensure transcript upload/import table exists (idempotent)
  await ensureTranscriptImportsTable();

  // Ensure evaluation onboarding setup table exists (idempotent)
  await ensureEvaluationOnboardingSetupsTable();

  // Ensure live Recall meeting imports have consent-tracking columns (idempotent)
  await ensureMeetingImportsConsentColumns();

  // Ensure propose-times booking tables exist (idempotent)
  await ensureMeetingBookingTables();

  // Ensure cases.matter_kind for internal / firm meetings (idempotent)
  await ensureMatterKindColumn();

  await ensureEvaluationStartsAtColumn();

  await ensureSupportTicketsTable();

  // Remove calendar-scraped consent recipients (solicitor must choose explicitly)
  await clearScheduledMeetingGuessedRecipients();

  // Initialize background job workers
  initializeWorkers();

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const isDevelopment = process.env.NODE_ENV === "development";
    
    // Sanitize error message in production
    let message = err.message || "Internal Server Error";
    
    // In production, don't leak internal error details
    if (!isDevelopment && status === 500) {
      message = "Internal Server Error";
      // Log full error details securely (not to client)
      console.error('[ERROR]', {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        error: err.message,
        stack: err.stack,
        userId: (req as any).user?.claims?.sub,
      });
    }

    res.status(status).json({ 
      message,
      // Only include error ID in production for tracking
      ...(isDevelopment ? {} : { errorId: Date.now().toString(36) })
    });
    
    // Don't throw in production to prevent process crash
    if (isDevelopment) {
      throw err;
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: process.platform !== 'darwin',
  }, () => {
    log(`serving on port ${port}`);
  });
})();
