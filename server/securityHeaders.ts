import helmet from "helmet";
import cors from "cors";
import type { Express } from "express";

/**
 * Security headers and CORS configuration for LegalNote
 * Implements defense-in-depth protection against common web vulnerabilities
 */

export function configureSecurityHeaders(app: Express) {
  const isDevelopment = process.env.NODE_ENV === "development";
  
  // Production domains (from environment variable)
  const productionDomains = process.env.ALLOWED_ORIGINS?.split(',') || [];

  // CORS configuration
  const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Development: Allow all origins (safe for local development)
      if (isDevelopment) {
        return callback(null, true);
      }

      // Allow requests with no origin (health checks, server-to-server, mobile apps, curl)
      // Health check requests from deployment platforms don't send origin headers
      if (!origin) {
        return callback(null, true);
      }

      // Build allowed origins list for production
      const allowedOrigins = [
        /\.replit\.dev$/,
        /\.replit\.app$/,
        /^https:\/\/legalnote\.ai$/,
        /^https:\/\/www\.legalnote\.ai$/,
      ];

      // Add production domains
      productionDomains.forEach(domain => {
        allowedOrigins.push(new RegExp(`^${domain.replace(/\./g, '\\.')}$`));
      });

      const isAllowed = allowedOrigins.some(pattern => pattern.test(origin || ''));
      
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Allow cookies for session-based auth
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400, // 24 hours
  };

  app.use(cors(corsOptions));

  // Build CSP directives based on environment
  const cspDirectives: any = {
    defaultSrc: ["'self'"],
    scriptSrc: isDevelopment 
      ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] // Vite requires these in dev
      : ["'self'"], // Production: strict
    styleSrc: isDevelopment
      ? ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"] // Dev allows inline
      : ["'self'", "https://fonts.googleapis.com"], // Production: no unsafe-inline
    fontSrc: [
      "'self'",
      "https://fonts.gstatic.com",
    ],
    imgSrc: [
      "'self'",
      "data:",
      "blob:",
      "https:", // Allow images from CDNs
    ],
    connectSrc: isDevelopment
      ? [
          "'self'",
          "https://*.replit.dev",
          "https://*.replit.app",
          "ws://*.replit.dev", // Vite HMR websocket
          "wss://*.replit.dev",
        ]
      : [
          "'self'",
          "https://*.replit.app",
          "https://legalnote.ai",
          "https://www.legalnote.ai",
        ],
    objectSrc: ["'none'"],
    mediaSrc: [
      "'self'",
      "blob:",
      "https://*.storage.googleapis.com", // Object storage audio
    ],
    frameSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"], // Prevent clickjacking
  };

  // Add upgrade-insecure-requests only in production
  if (!isDevelopment) {
    cspDirectives.upgradeInsecureRequests = [];
  }

  // Helmet security headers
  app.use(
    helmet({
      // Content Security Policy
      contentSecurityPolicy: {
        directives: cspDirectives,
      },

      // Strict Transport Security (HTTPS enforcement) - only in production
      hsts: isDevelopment ? false : {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },

      // Prevent MIME type sniffing
      noSniff: true,

      // XSS Protection (legacy, but doesn't hurt)
      xssFilter: true,

      // Disable X-Powered-By header
      hidePoweredBy: true,

      // Referrer Policy
      referrerPolicy: {
        policy: "strict-origin-when-cross-origin",
      },

      // Permissions Policy (formerly Feature Policy)
      permittedCrossDomainPolicies: {
        permittedPolicies: "none",
      },
    })
  );

  // Override frame-blocking headers for demo routes so the demo-generator preview iframe works (same-origin)
  app.use((req, res, next) => {
    if (req.path.startsWith('/demo/')) {
      // Allow same-origin iframe embedding for demo pages (frame-ancestors)
      const csp = res.getHeader('Content-Security-Policy') as string || '';
      if (csp) {
        res.setHeader('Content-Security-Policy', csp.replace(/frame-ancestors [^;]+/, "frame-ancestors 'self'"));
      }
    } else if (req.path === '/demo-generator' || req.path.startsWith('/demo-generator?')) {
      // Allow the demo-generator page to render same-origin iframes (frame-src)
      const csp = res.getHeader('Content-Security-Policy') as string || '';
      if (csp) {
        res.setHeader('Content-Security-Policy', csp.replace(/frame-src [^;]+/, "frame-src 'self'"));
      }
    }
    next();
  });

  // Additional security headers not covered by Helmet
  app.use((req, res, next) => {
    // Prevent clickjacking — allow demo pages to be embedded same-origin (for demo-generator preview)
    if (!req.path.startsWith('/demo/')) {
      res.setHeader('X-Frame-Options', 'DENY');
    }
    
    // Browser feature permissions
    res.setHeader('Permissions-Policy', 
      'geolocation=(), microphone=(self), camera=(), payment=(), usb=()'
    );
    
    next();
  });

  // CSRF protection note:
  // Session-based CSRF is handled by SameSite=Strict cookie attribute
  // in replitAuth.ts session configuration
  // No additional CSRF token middleware needed for same-site requests
}
