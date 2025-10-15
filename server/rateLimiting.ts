import rateLimit from "express-rate-limit";

/**
 * Rate limiting configuration for LegalNote AI
 * Protects against abuse and DoS attacks with proper IPv6 support
 */

// General API rate limit: 100 requests per 15 minutes per IP
export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false,
  // Use default IP-based keyGenerator (handles IPv6 correctly)
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
