import fs from "fs";
import type { Express, Request, Response } from "express";

const DEBUG_LOG_PATH =
  "/Users/jazz/LegalNote AI/Codebase/Cursor Code/LegalNote-AI/.cursor/debug-95f25d.log";
const DEBUG_SESSION_ID = "95f25d";
const MAX_BUFFER = 100;
const buffer: Record<string, unknown>[] = [];

export function debugSessionLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
) {
  const entry = {
    sessionId: DEBUG_SESSION_ID,
    location,
    message,
    data,
    timestamp: Date.now(),
    hypothesisId,
    runId: "post-allowlist-open",
  };
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();
  console.log(`[DEBUG-${DEBUG_SESSION_ID}]`, JSON.stringify(entry));
  try {
    fs.appendFileSync(DEBUG_LOG_PATH, JSON.stringify(entry) + "\n");
  } catch {
    /* local path only */
  }
}

export function registerDebugSessionRoutes(app: Express) {
  app.post("/api/_debug/client-log", (req: Request, res: Response) => {
    const body = req.body ?? {};
    debugSessionLog(
      typeof body.location === "string" ? body.location : "client",
      typeof body.message === "string" ? body.message : "log",
      typeof body.data === "object" && body.data ? body.data : {},
      typeof body.hypothesisId === "string" ? body.hypothesisId : "H?",
    );
    res.sendStatus(204);
  });

  app.get("/api/_debug/client-log", (req: Request, res: Response) => {
    if (req.query.sessionId !== DEBUG_SESSION_ID) {
      return res.status(404).end();
    }
    res.json(buffer);
  });
}
