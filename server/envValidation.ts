/**
 * Environment variable validation for LegalNote
 * Ensures all required configuration is present before startup
 */

import { getBackblazeS3Endpoint, getResolvedBackblazeRegion } from "./backblazeConfig";

interface EnvConfig {
  required: string[];
  optional: string[];
}

const envConfig: EnvConfig = {
  required: [
    "DATABASE_URL",
    "SESSION_SECRET",
  ],
  optional: [
    "PORT",
    "NODE_ENV",
    "ALLOWED_ORIGINS", // Production CORS domains
    "ISSUER_URL", // Replit Auth (set dynamically by Replit)
    "CLIENT_ID", // Replit Auth (set dynamically by Replit)
    "CLIENT_SECRET", // Replit Auth (set dynamically by Replit)
  ],
};

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function enforceOrWarn(label: string, ok: boolean, message: string): void {
  if (ok) return;
  if (isProduction()) {
    throw new Error(message);
  }
  console.warn(`[ENV] ${label}: ${message}`);
}

function validatePrivilegedDataPath(): void {
  const checks: Array<{ label: string; ok: boolean; message: string }> = [
    {
      label: "AssemblyAI",
      ok: Boolean(process.env.ASSEMBLYAI_API_KEY?.trim()),
      message: "ASSEMBLYAI_API_KEY is required in production",
    },
    {
      label: "Backblaze endpoint",
      ok: Boolean(process.env.BACKBLAZE_S3_ENDPOINT?.trim()),
      message: "BACKBLAZE_S3_ENDPOINT is required in production",
    },
    {
      label: "Bedrock provider",
      ok: process.env.PRIVILEGED_LLM_PROVIDER?.toLowerCase() === "bedrock",
      message: 'PRIVILEGED_LLM_PROVIDER must be "bedrock" in production',
    },
    {
      label: "AWS region",
      ok: (process.env.AWS_REGION ?? "").startsWith("eu-"),
      message: 'AWS_REGION must start with "eu-" in production',
    },
  ];

  for (const check of checks) {
    enforceOrWarn(check.label, check.ok, check.message);
  }

  if (process.env.BACKBLAZE_S3_ENDPOINT?.trim()) {
    try {
      const region = getResolvedBackblazeRegion();
      enforceOrWarn(
        "Backblaze region",
        region.startsWith("eu-"),
        `Resolved Backblaze S3 region must start with "eu-"; got "${region}"`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid BACKBLAZE_S3_ENDPOINT";
      enforceOrWarn("Backblaze endpoint", false, message);
    }
  }
}

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
  if (warnings.length > 0 && isProduction()) {
    console.warn("[ENV] Missing optional environment variables:");
    warnings.forEach(key => console.warn(`  - ${key}`));
  }

  // Validate specific values
  if (process.env.NODE_ENV && !["development", "production", "test"].includes(process.env.NODE_ENV)) {
    console.warn(`[ENV] Invalid NODE_ENV value: ${process.env.NODE_ENV}`);
  }

  // Session secret should be strong in production
  if (isProduction() && process.env.SESSION_SECRET) {
    const secret = process.env.SESSION_SECRET;
    if (secret.length < 32) {
      throw new Error("SESSION_SECRET must be at least 32 characters in production");
    }
  }

  validatePrivilegedDataPath();

  // Touch endpoint helper so misconfiguration fails early when objectStorage is not yet imported
  if (process.env.BACKBLAZE_S3_ENDPOINT?.trim()) {
    getBackblazeS3Endpoint();
  }

  console.log("[ENV] Environment validation passed ✓");
}

// Validate on module load
validateEnvironment();
