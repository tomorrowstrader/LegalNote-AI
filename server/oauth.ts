import { OAuth2Client } from 'google-auth-library';
import { ConfidentialClientApplication, AuthorizationUrlRequest, AuthorizationCodeRequest } from '@azure/msal-node';
import type { IStorage } from './storage';
import type { InsertCalendarIntegration } from '@shared/schema';
import crypto from 'crypto';

// OAuth scopes for calendar access
const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/calendar.events'];
const MICROSOFT_SCOPES = ['Calendars.ReadWrite', 'offline_access'];

// OAuth redirect URIs (will be constructed from environment or request origin)
const getRedirectUri = (provider: 'google' | 'outlook', baseUrl: string) => {
  return `${baseUrl}/api/calendar/callback/${provider}`;
};

/**
 * Initialize Google OAuth2 Client
 */
export function createGoogleOAuthClient(baseUrl: string): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  }

  const redirectUri = getRedirectUri('google', baseUrl);
  
  return new OAuth2Client({
    clientId,
    clientSecret,
    redirectUri,
  });
}

/**
 * Initialize Microsoft OAuth Client (MSAL)
 */
export function createMicrosoftOAuthClient(baseUrl: string): ConfidentialClientApplication {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common'; // 'common' allows work/school and personal accounts
  
  if (!clientId || !clientSecret) {
    throw new Error('Microsoft OAuth credentials not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET');
  }

  const redirectUri = getRedirectUri('outlook', baseUrl);
  
  return new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
  });
}

/**
 * Generate Google OAuth authorization URL
 */
export function getGoogleAuthUrl(client: OAuth2Client, state: string): string {
  const authUrl = client.generateAuthUrl({
    access_type: 'offline', // Request refresh token
    scope: GOOGLE_SCOPES,
    state, // CSRF protection
    prompt: 'consent', // Force consent screen to ensure refresh token
  });
  
  return authUrl;
}

/**
 * Generate Microsoft OAuth authorization URL
 */
export async function getMicrosoftAuthUrl(client: ConfidentialClientApplication, redirectUri: string, state: string): Promise<string> {
  const authCodeUrlParameters: AuthorizationUrlRequest = {
    scopes: MICROSOFT_SCOPES,
    redirectUri,
    state, // CSRF protection
    prompt: 'consent', // Force consent to ensure refresh token
  };

  const authUrl = await client.getAuthCodeUrl(authCodeUrlParameters);
  return authUrl;
}

/**
 * Exchange Google OAuth code for tokens
 */
export async function exchangeGoogleCode(client: OAuth2Client, code: string) {
  const { tokens } = await client.getToken(code);
  
  if (!tokens.access_token) {
    throw new Error('No access token received from Google');
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || null,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    email: null, // Will be fetched separately if needed
  };
}

/**
 * Exchange Microsoft OAuth code for tokens
 * Note: We use direct token endpoint call to get refresh token instead of MSAL
 * because MSAL's token cache is not persistent across requests
 */
export async function exchangeMicrosoftCode(client: ConfidentialClientApplication, code: string, redirectUri: string) {
  // Use direct token endpoint to get refresh token
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
  
  if (!clientId || !clientSecret) {
    throw new Error('Microsoft OAuth credentials not configured');
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    scope: MICROSOFT_SCOPES.join(' '),
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Microsoft token exchange failed: ${errorData.error_description || errorData.error}`);
  }

  const data = await response.json();
  
  if (!data.access_token) {
    throw new Error('No access token received from Microsoft');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null, // Persist refresh token for later use
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    email: data.id_token ? extractEmailFromJWT(data.id_token) : null,
  };
}

/**
 * Helper to extract email from JWT id_token (simple base64 decode)
 */
function extractEmailFromJWT(idToken: string): string | null {
  try {
    const payload = idToken.split('.')[1];
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
    return decoded.preferred_username || decoded.email || decoded.upn || null;
  } catch (error) {
    return null;
  }
}

/**
 * Refresh Google OAuth access token using refresh token
 */
export async function refreshGoogleToken(refreshToken: string, baseUrl: string) {
  const client = createGoogleOAuthClient(baseUrl);
  client.setCredentials({ refresh_token: refreshToken });
  
  const { credentials } = await client.refreshAccessToken();
  
  if (!credentials.access_token) {
    throw new Error('Failed to refresh Google access token');
  }

  return {
    accessToken: credentials.access_token,
    refreshToken: credentials.refresh_token || refreshToken, // Use new refresh token if provided
    expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
  };
}

/**
 * Refresh Microsoft OAuth access token using refresh token
 */
export async function refreshMicrosoftToken(refreshToken: string, baseUrl: string) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
  
  if (!clientId || !clientSecret) {
    throw new Error('Microsoft OAuth credentials not configured');
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: MICROSOFT_SCOPES.join(' '),
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Microsoft token refresh failed: ${errorData.error_description || errorData.error}`);
  }

  const data = await response.json();
  
  if (!data.access_token) {
    throw new Error('No access token received from Microsoft');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // Use new refresh token if provided, otherwise keep old one
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
  };
}

/**
 * Check if token is expired or expiring soon (within 5 minutes)
 */
export function isTokenExpiringSoon(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
  
  return expiresAt <= fiveMinutesFromNow;
}

/**
 * Automatically refresh token if needed and update in storage
 */
export async function ensureFreshToken(
  storage: IStorage,
  userId: string,
  provider: 'google' | 'outlook',
  baseUrl: string
): Promise<string> {
  const connection = await storage.getCalendarIntegration(userId, provider);
  
  if (!connection) {
    throw new Error(`No ${provider} calendar connection found for user`);
  }

  // Check if token needs refresh
  if (connection.expiresAt && isTokenExpiringSoon(connection.expiresAt)) {
    // Handle Google token refresh
    if (provider === 'google') {
      if (!connection.refreshToken) {
        throw new Error('Cannot refresh Google token - no refresh token available');
      }

      const newTokens = await refreshGoogleToken(connection.refreshToken, baseUrl);

      // Update storage with new tokens
      const updatedConnection: InsertCalendarIntegration = {
        userId: connection.userId,
        provider: 'google',
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken || connection.refreshToken,
        expiresAt: newTokens.expiresAt || undefined,
        calendarId: connection.calendarId || undefined,
        email: connection.email || undefined,
      };

      await storage.saveCalendarIntegration(updatedConnection);
      return newTokens.accessToken;
    } else {
      // Microsoft/Outlook token refresh requires re-authentication
      throw new Error('Outlook calendar token has expired. Please reconnect your Outlook calendar in Settings.');
    }
  }

  // Token is still valid
  return connection.accessToken;
}

/**
 * OAuth state payload that can include sync context
 */
export interface OAuthStatePayload {
  userId: string;
  provider: 'google' | 'outlook';
  popup: boolean;
  nonce: string;
  createdAt: number;
  // Optional sync context for auto-sync after OAuth
  syncContext?: {
    caseId: number;
    deadline: string; // ISO date string
  };
}

/**
 * Generate a cryptographically secure random nonce
 */
export function generateSecureNonce(): string {
  return crypto.randomBytes(16).toString('base64url');
}

/**
 * Sign OAuth state payload using HMAC
 */
export function signOAuthState(payload: OAuthStatePayload): string {
  const secret = process.env.SESSION_SECRET || 'default-oauth-secret-change-in-production';
  
  // JSON stringify the payload
  const payloadJson = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadJson).toString('base64url');
  
  // Create HMAC signature
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadBase64);
  const signature = hmac.digest('base64url');
  
  // Return signed token: payload.signature
  return `${payloadBase64}.${signature}`;
}

/**
 * Verify and decode OAuth state token
 */
export function verifyOAuthState(signedToken: string): OAuthStatePayload | null {
  try {
    const secret = process.env.SESSION_SECRET || 'default-oauth-secret-change-in-production';
    
    // Split token into payload and signature
    const parts = signedToken.split('.');
    if (parts.length !== 2) {
      return null;
    }
    
    const [payloadBase64, signature] = parts;
    
    // Verify signature
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payloadBase64);
    const expectedSignature = hmac.digest('base64url');
    
    if (signature !== expectedSignature) {
      console.error('OAuth state signature mismatch');
      return null;
    }
    
    // Decode payload
    const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    const payload: OAuthStatePayload = JSON.parse(payloadJson);
    
    // Verify token age (expire after 10 minutes)
    const tenMinutes = 10 * 60 * 1000;
    if (Date.now() - payload.createdAt > tenMinutes) {
      console.error('OAuth state expired');
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error('Failed to verify OAuth state:', error);
    return null;
  }
}

/**
 * Generate a random state parameter for CSRF protection (legacy - use signOAuthState instead)
 * @deprecated Use signOAuthState for better security
 */
export function generateOAuthState(): string {
  return crypto.randomBytes(16).toString('base64url');
}
