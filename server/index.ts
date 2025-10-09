import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { configureSecurityHeaders } from "./securityHeaders";
import { cleanupExpiredAudio } from "./audioCleanup";
import "./envValidation"; // Validate environment on startup

const app = express();

// Security headers and CORS (must be first)
configureSecurityHeaders(app);

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
