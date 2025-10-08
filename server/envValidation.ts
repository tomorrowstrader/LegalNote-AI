/**
 * Environment variable validation for LegalNote AI
 * Ensures all required configuration is present before startup
 */

interface EnvConfig {
  required: string[];
  optional: string[];
}

const envConfig: EnvConfig = {
  required: [
    "DATABASE_URL",
    "SESSION_SECRET",
    "DEFAULT_OBJECT_STORAGE_BUCKET_ID",
  ],
  optional: [
    "PORT",
    "NODE_ENV",
    "ALLOWED_ORIGINS", // Production CORS domains
    "OPENAI_API_KEY", // AI features (not required for MVP auth testing)
    "ISSUER_URL", // Replit Auth (set dynamically by Replit)
    "CLIENT_ID", // Replit Auth (set dynamically by Replit)
    "CLIENT_SECRET", // Replit Auth (set dynamically by Replit)
  ],
};

export function validateEnvironment(): void {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const key of envConfig.required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  // Check optional but recommended variables
  for (const key of envConfig.optional) {
    if (!process.env[key] && key !== "PORT" && key !== "NODE_ENV") {
      warnings.push(key);
    }
  }

  // Report missing required variables
  if (missing.length > 0) {
    console.error("[ENV] Missing required environment variables:");
    missing.forEach(key => console.error(`  - ${key}`));
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  // Report warnings for missing optional variables
  if (warnings.length > 0 && process.env.NODE_ENV === "production") {
    console.warn("[ENV] Missing optional environment variables:");
    warnings.forEach(key => console.warn(`  - ${key}`));
  }

  // Validate specific values
  if (process.env.NODE_ENV && !["development", "production", "test"].includes(process.env.NODE_ENV)) {
    console.warn(`[ENV] Invalid NODE_ENV value: ${process.env.NODE_ENV}`);
  }

  // Session secret should be strong in production
  if (process.env.NODE_ENV === "production" && process.env.SESSION_SECRET) {
    const secret = process.env.SESSION_SECRET;
    if (secret.length < 32) {
      throw new Error("SESSION_SECRET must be at least 32 characters in production");
    }
  }

  console.log("[ENV] Environment validation passed ✓");
}

// Validate on module load
validateEnvironment();
