import { OAuth2Client } from 'google-auth-library';
import { ConfidentialClientApplication, AuthorizationUrlRequest, AuthorizationCodeRequest } from '@azure/msal-node';
import type { IStorage } from './storage';
import type { InsertCalendarIntegration } from '@shared/schema';

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
 * Note: MSAL doesn't directly expose refresh tokens - they're managed internally
 * We store the access token and expiry, relying on MSAL's cache for refresh
 */
export async function exchangeMicrosoftCode(client: ConfidentialClientApplication, code: string, redirectUri: string) {
  const tokenRequest: AuthorizationCodeRequest = {
    code,
    scopes: MICROSOFT_SCOPES,
    redirectUri,
  };

  const response = await client.acquireTokenByCode(tokenRequest);
  
  if (!response || !response.accessToken) {
    throw new Error('No access token received from Microsoft');
  }

  // MSAL manages refresh tokens internally, we store what's available
  return {
    accessToken: response.accessToken,
    refreshToken: null, // MSAL handles refresh internally
    expiresAt: response.expiresOn ? new Date(response.expiresOn) : null,
    email: response.account?.username || null,
  };
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
 * Refresh Microsoft OAuth access token
 * Note: For MSAL, we should use silent token acquisition with the account
 * This is a simplified version - in production, you'd want to implement proper MSAL caching
 */
export async function refreshMicrosoftToken(refreshToken: string, baseUrl: string) {
  // MSAL refresh token handling requires account context
  // For now, throw error indicating token refresh needs re-authentication
  // In a production system, you'd implement proper MSAL token cache
  throw new Error('Microsoft token refresh requires re-authentication. Please reconnect your Outlook calendar.');
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
 * Generate a random state parameter for CSRF protection
 */
export function generateOAuthState(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
