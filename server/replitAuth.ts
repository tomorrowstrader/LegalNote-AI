import crypto from "crypto";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const SESSION_TTL = 4 * 60 * 60 * 1000;

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

  await storage.upsertUser({
    id: profile.id,
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
  return `http://localhost:${port}/api/auth/google/callback`;
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
            await upsertGoogleUser(profile);
            const sessionUser = {
              claims: {
                sub: profile.id,
                email: profile.emails?.[0]?.value || null,
                first_name: profile.name?.givenName || null,
                last_name: profile.name?.familyName || null,
                profile_image_url: profile.photos?.[0]?.value || null,
              },
              expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL / 1000,
            };
            done(null, sessionUser);
          } catch (error) {
            done(error, null);
          }
        }
      )
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
    passport.authenticate("google", {
      scope: ["openid", "email", "profile"],
      prompt: "select_account",
    })(req, res, next);
  });

  app.get("/api/auth/google/callback", (req, res, next) => {
    passport.authenticate("google", {
      failureRedirect: "/login?error=auth_failed",
    })(req, res, (err?: any) => {
      if (err) return next(err);
      req.session.regenerate((regenerateErr) => {
        if (regenerateErr) {
          console.error("[AUTH] Session regeneration failed:", regenerateErr);
          return res.redirect("/login?error=session_error");
        }
        req.logIn(req.user!, (loginErr) => {
          if (loginErr) {
            console.error("[AUTH] Login after regeneration failed:", loginErr);
            return res.redirect("/login?error=session_error");
          }
          res.redirect("/");
        });
      });
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

  return next();
};
