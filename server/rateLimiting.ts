import rateLimit from "express-rate-limit";

/**
 * Rate limiting configuration for LegalNote
 * Protects against abuse and DoS attacks with proper IPv6 support
 */

// General API rate limit — per-user when session exists, per-IP otherwise.
// Dashboard + polling can exceed 100/15min on a single IP during normal use.
export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req: any) => (req.user?.claims?.sub ? 500 : 100),
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req: any) => req.user?.claims?.sub || req.ip || "unknown",
});

// Case creation rate limit: 50 cases per hour per user
export const caseCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each user to 50 case creations per hour
  message: "Case creation limit exceeded. Maximum 50 cases per hour allowed",
  standardHeaders: true,
  legacyHeaders: false,
  // Use user ID as key (authenticated users only, so no IP fallback needed)
  keyGenerator: (req: any) => {
    return req.user?.claims?.sub || "unauthenticated";
  },
  skip: (req: any) => !req.user, // Skip rate limiting for unauthenticated (auth handles this)
});

// Presigned URL rate limit: 100 URLs per hour per user
// Prevents abuse of object storage generation
export const presignedUrlLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // Limit each user to 100 presigned URLs per hour
  message: "Upload URL generation limit exceeded. Please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    return req.user?.claims?.sub || "unauthenticated";
  },
  skip: (req: any) => !req.user,
});

// Audio upload/update rate limit: 60 uploads per hour per user
export const audioUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 60, // Limit each user to 60 audio uploads per hour
  message: "Audio upload limit exceeded. Maximum 60 uploads per hour allowed",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    return req.user?.claims?.sub || "unauthenticated";
  },
  skip: (req: any) => !req.user,
});

// Auth endpoint rate limit: Stricter to prevent brute force
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 auth requests per 15 minutes
  message: "Too many authentication attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful auth
  // Use default IP-based keyGenerator (handles IPv6 correctly)
});

/**
 * IP limiter for GET /api/auth/user — must run BEFORE isAuthenticated.
 * /api/auth/user is exempt from generalApiLimiter (a 429 there logs the SPA out),
 * so this is the throttle for unauthenticated floods against session/DB lookups.
 * Ceiling is high: this route is cheap and the SPA only hits it a few times per
 * session; shared office NATs must not trip it during normal use.
 */
export const authUserIpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60/min/IP — ~1/sec sustained; far above legitimate SPA use
  message: "Too many authentication identity checks, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all hits including 401 probes
});

// Strict rate limit for expensive operations
export const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each user to 10 requests per minute
  message: "Rate limit exceeded. Please slow down your requests",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    return req.user?.claims?.sub || "unauthenticated";
  },
  skip: (req: any) => !req.user,
});

// Demo TTS rate limit: 30 requests per hour per IP (public endpoint)
export const demoTtsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 TTS requests per hour per IP
  message: "TTS rate limit exceeded. Please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// Polling endpoint rate limit: Very lenient for status checks
export const pollingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // Allow 120 requests per minute (2 per second)
  message: "Polling rate limit exceeded. Please reduce request frequency",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    return req.user?.claims?.sub || "unauthenticated";
  },
  skip: (req: any) => !req.user,
});
