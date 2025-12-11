import express, { type Request, Response, NextFunction } from "express";
import { runMigrations } from 'stripe-replit-sync';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { configureSecurityHeaders } from "./securityHeaders";
import { cleanupExpiredAudio } from "./audioCleanup";
import { initializeWorkers } from "./workers";
import { getStripeSync } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import "./envValidation"; // Validate environment on startup

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
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const { webhook, uuid } = await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`,
      { enabled_events: ['*'], description: 'LegalNote AI Stripe webhook' }
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

// Now apply JSON middleware for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);
  
  // GDPR Compliance: Clean up expired audio on server startup
  await cleanupExpiredAudio();

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
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
