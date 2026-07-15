import type { Express, Request, Response } from "express";

type ClientDebugEntry = {
  id: string;
  receivedAt: number;
  sessionId?: string;
  location?: string;
  message?: string;
  hypothesisId?: string;
  runId?: string;
  data?: Record<string, unknown>;
  userAgent?: string;
  path?: string;
};

const MAX_ENTRIES = 200;
const ring: ClientDebugEntry[] = [];

function pushEntry(entry: ClientDebugEntry) {
  ring.push(entry);
  if (ring.length > MAX_ENTRIES) ring.splice(0, ring.length - MAX_ENTRIES);
}

/** In-memory client crash/debug buffer for production white-screen debugging. */
export function registerClientDebugLogRoutes(app: Express) {
  app.post("/api/_debug/client-log", (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      pushEntry({
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        receivedAt: Date.now(),
        sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
        location: typeof body.location === "string" ? body.location : undefined,
        message: typeof body.message === "string" ? body.message : undefined,
        hypothesisId: typeof body.hypothesisId === "string" ? body.hypothesisId : undefined,
        runId: typeof body.runId === "string" ? body.runId : undefined,
        data: body.data && typeof body.data === "object" ? body.data : undefined,
        userAgent: req.get("user-agent") || undefined,
        path: typeof body.path === "string" ? body.path : undefined,
      });
      res.status(204).end();
    } catch {
      res.status(204).end();
    }
  });

  app.get("/api/_debug/client-log", (_req: Request, res: Response) => {
    res.json({
      count: ring.length,
      entries: ring.slice(-100),
    });
  });
}
