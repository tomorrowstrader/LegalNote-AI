import crypto from "crypto";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import * as client from "openid-client";
import { Strategy as MicrosoftStrategy } from "openid-client/passport";
import session from "express-session";
import type { Express, RequestHandler, Request, Response } from "express";
import connectPg from "connect-pg-simple";
import { AuthEmailCollisionError, AuthEmailRequiredError, storage } from "./storage";

const SESSION_TTL = 4 * 60 * 60 * 1000;
const MICROSOFT_LOGIN_SCOPES = "openid profile email https://graph.microsoft.com/User.Read";

/** Reject open redirects — only same-origin relative paths are allowed. */
function sanitizeReturnTo(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  let path = value;
  try {
    if (value.includes("%")) {
      const decoded = decodeURIComponent(value);
      if (decoded !== value) path = decoded;
    }
  } catch {
    return null;
  }
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//")) return null;
  if (path.includes("://")) return null;
  if (path.includes("\\")) return null;
  return path;
}

function storeOAuthReturnTo(req: Request): void {
  const returnTo = sanitizeReturnTo(req.query.returnTo);
  if (returnTo) {
    (req.session as { oauthReturnTo?: string }).oauthReturnTo = returnTo;
  }
}

function consumeOAuthReturnTo(req: Request): string {
  const stored = (req.session as { oauthReturnTo?: string }).oauthReturnTo;
  delete (req.session as { oauthReturnTo?: string }).oauthReturnTo;
  return sanitizeReturnTo(stored) ?? "/";
}

function startOAuthWithReturnTo(
  req: Request,
  res: Response,
  next: (err?: unknown) => void,
  authenticate: (req: Request, res: Response, next: (err?: unknown) => void) => void,
) {
  storeOAuthReturnTo(req);
  req.session.save((saveErr) => {
    if (saveErr) return next(saveErr);
    authenticate(req, res, next);
  });
}

/**
 * Comma-separated user IDs and/or emails.
 * Only enforced when ACCESS_ALLOWLIST_ENFORCE=true.
 * Otherwise all authenticated users are allowed (invite + waitlist still apply).
 */
export function getAccessAllowlist(): Set<string> {
  const raw = process.env.ACCESS_ALLOWLIST || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAccessAllowlistEnforced(): boolean {
  return process.env.ACCESS_ALLOWLIST_ENFORCE === "true";
}

export function getAdminUserId(): string {
  return process.env.ADMIN_USER_ID || "48381245";
}

export function isUserAccessAllowed(userId: string, email?: string | null): boolean {
  if (userId === getAdminUserId()) return true;
  // Allowlist is opt-in lockdown. Without ENFORCE, invite/waitlist are the gates.
  if (!isAccessAllowlistEnforced()) return true;
  const allowlist = getAccessAllowlist();
  if (allowlist.size === 0) return true;
  if (allowlist.has(userId.toLowerCase())) return true;
  const normalizedEmail = email?.trim().toLowerCase();
  return !!normalizedEmail && allowlist.has(normalizedEmail);
}

/**
 * Paths that may proceed past the allowlist after a valid session exists.
 * Everything else that uses isAuthenticated is denied with 403.
 * Logout is not listed — it never uses isAuthenticated.
 */
function isAllowlistExemptPath(method: string, path: string): boolean {
  if (path === "/api/auth/user") return true;
  // Invite accept: POST /api/invite/:token/accept
  if (method === "POST" && /^\/api\/invite\/[^/]+\/accept\/?$/.test(path)) {
    return true;
  }
  return false;
}

export function getSession() {
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: SESSION_TTL / 1000,
    tableName: "sessions",
  });
  const isProduction = process.env.NODE_ENV === "production" || !!process.env.REPLIT_DOMAINS;
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: SESSION_TTL,
    },
  });
}

async function upsertGoogleUser(profile: any) {
  const email = profile.emails?.[0]?.value || null;
  const firstName = profile.name?.givenName || null;
  const lastName = profile.name?.familyName || null;
  const profileImageUrl = profile.photos?.[0]?.value || null;

  return storage.resolveGoogleAuthUser({
    providerUserId: profile.id,
    email,
    firstName,
    lastName,
    profileImageUrl,
  });
}

function getCallbackURL(): string {
  const domains = process.env.REPLIT_DOMAINS?.split(",") || [];
  if (domains.length > 0) {
    return `https://${domains[0]}/api/auth/google/callback`;
  }
  const port = process.env.PORT || "5000";
  return process.env.APP_URL
    ? `${process.env.APP_URL}/api/auth/google/callback`
    : `http://localhost:${port}/api/auth/google/callback`;
}

function getMicrosoftLoginCallbackURL(): string {
  const domains = process.env.REPLIT_DOMAINS?.split(",") || [];
  if (domains.length > 0) {
    return `https://${domains[0]}/api/auth/microsoft/callback`;
  }
  const port = process.env.PORT || "5000";
  return process.env.APP_URL
    ? `${process.env.APP_URL}/api/auth/microsoft/callback`
    : `http://localhost:${port}/api/auth/microsoft/callback`;
}

function buildSessionUser(user: {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}) {
  return {
    claims: {
      sub: user.id,
      email: user.email ?? null,
      first_name: user.firstName ?? null,
      last_name: user.lastName ?? null,
      profile_image_url: user.profileImageUrl ?? null,
    },
    expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL / 1000,
  };
}

function completeOAuthLogin(
  req: Request,
  res: Response,
  authenticatedUser?: Express.User | false,
) {
  const redirectPath = consumeOAuthReturnTo(req);
  const sessionUser =
    authenticatedUser && typeof authenticatedUser === "object"
      ? authenticatedUser
      : req.user;
  if (!sessionUser) {
    console.error("[AUTH] OAuth callback completed with no authenticated user");
    return res.redirect("/login?error=session_error");
  }

  // Passport ≥0.6 regenerates the session inside logIn. Do not call
  // req.session.regenerate() first — that races with Passport and can
  // leave a cookie for an empty session → /api/auth/user 401 after redirect.
  req.logIn(sessionUser, (loginErr) => {
    if (loginErr) {
      console.error("[AUTH] Login failed:", loginErr);
      return res.redirect("/login?error=session_error");
    }
    res.redirect(redirectPath);
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientID || !clientSecret) {
    console.warn("[AUTH] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set — Google OAuth disabled");
  } else {
    const callbackURL = getCallbackURL();
    console.log(`[AUTH] Google OAuth configured with callback: ${callbackURL}`);

    passport.use(
      new GoogleStrategy(
        {
          clientID,
          clientSecret,
          callbackURL,
          scope: ["openid", "email", "profile"],
          state: true,
        },
        async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
          try {
            const user = await upsertGoogleUser(profile);
            done(null, buildSessionUser({
              id: user.id,
              email: user.email || profile.emails?.[0]?.value || null,
              firstName: user.firstName || profile.name?.givenName || null,
              lastName: user.lastName || profile.name?.familyName || null,
              profileImageUrl: user.profileImageUrl || profile.photos?.[0]?.value || null,
            }));
          } catch (error) {
            done(error, null);
          }
        }
      )
    );
  }

  const microsoftClientId = process.env.MICROSOFT_LOGIN_CLIENT_ID;
  const microsoftClientSecret = process.env.MICROSOFT_LOGIN_CLIENT_SECRET;
  const microsoftTenantId = process.env.MICROSOFT_LOGIN_TENANT_ID || "common";

  if (!microsoftClientId || !microsoftClientSecret) {
    console.warn(
      "[AUTH] MICROSOFT_LOGIN_CLIENT_ID or MICROSOFT_LOGIN_CLIENT_SECRET not set — Microsoft login disabled",
    );
  } else {
    const microsoftCallbackURL = getMicrosoftLoginCallbackURL();
    console.log(`[AUTH] Microsoft login configured with callback: ${microsoftCallbackURL}`);

    const microsoftConfig = await client.discovery(
      new URL(`https://login.microsoftonline.com/${microsoftTenantId}/v2.0`),
      microsoftClientId,
      { redirect_uris: [microsoftCallbackURL] },
      client.ClientSecretPost(microsoftClientSecret),
    );

    passport.use(
      "microsoft",
      new MicrosoftStrategy(
        {
          config: microsoftConfig,
          callbackURL: microsoftCallbackURL,
          scope: MICROSOFT_LOGIN_SCOPES,
          name: "microsoft",
        },
        async (tokens, done) => {
          try {
            const claims = tokens.claims();
            const providerUserId = typeof claims?.oid === "string" ? claims.oid : null;
            if (!providerUserId) {
              throw new Error("Microsoft login missing oid claim");
            }

            const rawEmail =
              (typeof claims?.email === "string" && claims.email) ||
              (typeof claims?.preferred_username === "string" && claims.preferred_username) ||
              (typeof claims?.upn === "string" && claims.upn) ||
              null;

            const user = await storage.resolveMicrosoftAuthUser({
              providerUserId,
              email: rawEmail,
              firstName: typeof claims?.given_name === "string" ? claims.given_name : null,
              lastName: typeof claims?.family_name === "string" ? claims.family_name : null,
              profileImageUrl: null,
            });

            done(null, buildSessionUser({
              id: user.id,
              email: user.email ?? rawEmail,
              firstName: user.firstName,
              lastName: user.lastName,
              profileImageUrl: user.profileImageUrl,
            }));
          } catch (error) {
            done(error, null);
          }
        },
      ),
    );
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (_req, res) => {
    if (process.env.PREVIEW_MODE === "true") {
      return res.redirect("/?preview_blocked=true");
    }
    res.redirect("/login");
  });

  app.get("/api/auth/google", (req, res, next) => {
    if (process.env.PREVIEW_MODE === "true") {
      return res.redirect("/?preview_blocked=true");
    }
    startOAuthWithReturnTo(req, res, next, (req, res, next) => {
      passport.authenticate("google", {
        scope: ["openid", "email", "profile"],
        prompt: "select_account",
      })(req, res, next);
    });
  });

  app.get("/api/auth/google/callback", (req, res, next) => {
    passport.authenticate("google", {
      failureRedirect: "/login?error=auth_failed",
    })(req, res, (err: unknown, user?: Express.User | false) => {
      if (err instanceof AuthEmailCollisionError) {
        return res.redirect("/login?error=email_already_registered");
      }
      if (err) return next(err);
      if (!user) return res.redirect("/login?error=auth_failed");
      completeOAuthLogin(req, res, user);
    });
  });

  app.get("/api/auth/microsoft", (req, res, next) => {
    if (process.env.PREVIEW_MODE === "true") {
      return res.redirect("/?preview_blocked=true");
    }
    if (!process.env.MICROSOFT_LOGIN_CLIENT_ID || !process.env.MICROSOFT_LOGIN_CLIENT_SECRET) {
      return res.redirect("/login?error=auth_failed");
    }
    startOAuthWithReturnTo(req, res, next, (req, res, next) => {
      passport.authenticate("microsoft")(req, res, next);
    });
  });

  app.get("/api/auth/microsoft/callback", (req, res, next) => {
    passport.authenticate("microsoft", {
      failureRedirect: "/login?error=auth_failed",
    })(req, res, (err: unknown, user?: Express.User | false) => {
      if (err instanceof AuthEmailCollisionError) {
        return res.redirect("/login?error=email_already_registered");
      }
      if (err instanceof AuthEmailRequiredError) {
        return res.redirect("/login?error=email_required");
      }
      if (err) return next(err);
      if (!user) return res.redirect("/login?error=auth_failed");
      completeOAuthLogin(req, res, user);
    });
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy((err) => {
        if (err) {
          console.error("[AUTH] Session destroy error:", err);
        }
        res.clearCookie("connect.sid");
        res.redirect("/");
      });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (process.env.PREVIEW_MODE === "true") {
    return res.status(401).json({ message: "Preview mode - authentication disabled" });
  }

  const user = req.user as any;

  if (!req.isAuthenticated() || !user?.claims?.sub) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (user.expires_at && now > user.expires_at) {
    return res.status(401).json({ message: "Session expired" });
  }

  const userId = user.claims.sub as string;
  const email = typeof user.claims?.email === "string" ? user.claims.email : null;
  if (
    !isAllowlistExemptPath(req.method, req.path) &&
    !isUserAccessAllowed(userId, email)
  ) {
    return res.status(403).json({
      message: "Access denied",
      code: "NOT_ALLOWLISTED",
    });
  }

  return next();
};
