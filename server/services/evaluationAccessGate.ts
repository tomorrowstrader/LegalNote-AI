import type { RequestHandler } from "express";
import { firmHasPaidAccess, isEvaluationExpired } from "@shared/evaluationAccess";
import { isLegalNotePersonnel, getAdminUserId } from "../accessAllowlist";
import { storage } from "../storage";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Mutations allowed after an evaluation period ends (billing / logout). */
function isEvaluationWriteExempt(method: string, path: string): boolean {
  if (method === "GET" && /^\/api\/logout\/?$/.test(path)) return true;
  // Firm must be able to subscribe or request invoice while read-only.
  if (
    /^\/api\/billing\/(checkout|invoice-request|boutique)\/?$/.test(path) ||
    /^\/api\/stripe\/(checkout|portal)\/?$/.test(path)
  ) {
    return true;
  }
  return false;
}

function normalizeApiPath(req: { path: string; originalUrl?: string; url?: string }): string {
  const raw = req.path || req.originalUrl || req.url || "";
  const p = raw.split("?")[0] || "";
  if (p.startsWith("/api/")) return p;
  return `/api${p.startsWith("/") ? p : `/${p}`}`;
}

export const evaluationAccessGate: RequestHandler = async (req, res, next) => {
  if (!WRITE_METHODS.has(req.method)) return next();
  if (!req.isAuthenticated?.()) return next();

  const path = normalizeApiPath(req);
  if (isEvaluationWriteExempt(req.method, path)) return next();

  const user = req.user as { claims?: { sub?: string } };
  const userId = user?.claims?.sub;
  if (!userId) return next();

  if (userId === getAdminUserId() || isLegalNotePersonnel(userId)) return next();

  try {
    const dbUser = await storage.getUser(userId);
    if (!dbUser?.firmId) return next();

    const firm = await storage.getFirm(dbUser.firmId);
    if (!firm?.isEvaluation || !firm.evaluationEndsAt) return next();
    if (firmHasPaidAccess(firm)) return next();
    if (!isEvaluationExpired(firm.evaluationEndsAt)) return next();

    return res.status(403).json({
      code: "EVALUATION_EXPIRED",
      message:
        "Your governed evaluation period has ended. You can still view existing work, but new activity is disabled. Subscribe to Boutique or request an invoice to continue.",
      evaluationEndsAt: firm.evaluationEndsAt.toISOString(),
      subscribePath: "/subscribe",
    });
  } catch (err) {
    console.error("[EVALUATION] Access gate error:", err);
    return next();
  }
};
