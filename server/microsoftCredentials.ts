/**
 * Shared Microsoft OAuth credential resolution and validation.
 * Catches the common Azure misconfiguration of using the Secret ID (UUID)
 * instead of the Secret Value in environment variables.
 */

const AZURE_SECRET_ID_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MicrosoftCredentialIssue =
  | 'missing'
  | 'looks_like_secret_id'
  | 'too_short';

export interface MicrosoftCredentialDiagnostics {
  configured: boolean;
  clientId: string | null;
  tenantId: string;
  secretSource: 'MICROSOFT_CLIENT_SECRET' | 'MICROSOFT_LOGIN_CLIENT_SECRET' | null;
  issue: MicrosoftCredentialIssue | null;
  issueDetail: string | null;
}

function normalizeEnvValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function validateClientSecret(secret: string): MicrosoftCredentialIssue | null {
  if (secret.length < 8) return 'too_short';
  if (AZURE_SECRET_ID_UUID.test(secret)) return 'looks_like_secret_id';
  return null;
}

function issueMessage(issue: MicrosoftCredentialIssue): string {
  switch (issue) {
    case 'looks_like_secret_id':
      return (
        'The Microsoft client secret looks like an Azure Secret ID (UUID). ' +
        'Use the secret Value shown once when creating the client secret in Azure Portal ' +
        '(Certificates & secrets → Client secrets → Value column), not the Secret ID.'
      );
    case 'too_short':
      return 'The Microsoft client secret is too short to be valid.';
    case 'missing':
      return 'Microsoft OAuth client secret is not configured.';
  }
}

export function diagnoseMicrosoftCredentials(): MicrosoftCredentialDiagnostics {
  const clientId =
    normalizeEnvValue(process.env.MICROSOFT_CLIENT_ID) ||
    normalizeEnvValue(process.env.MICROSOFT_LOGIN_CLIENT_ID) ||
    null;
  const tenantId =
    normalizeEnvValue(process.env.MICROSOFT_TENANT_ID) ||
    normalizeEnvValue(process.env.MICROSOFT_LOGIN_TENANT_ID) ||
    'common';

  const candidates: Array<{
    source: 'MICROSOFT_CLIENT_SECRET' | 'MICROSOFT_LOGIN_CLIENT_SECRET';
    value: string | undefined;
  }> = [
    { source: 'MICROSOFT_CLIENT_SECRET', value: normalizeEnvValue(process.env.MICROSOFT_CLIENT_SECRET) },
    {
      source: 'MICROSOFT_LOGIN_CLIENT_SECRET',
      value: normalizeEnvValue(process.env.MICROSOFT_LOGIN_CLIENT_SECRET),
    },
  ];

  for (const candidate of candidates) {
    if (!candidate.value) continue;
    const issue = validateClientSecret(candidate.value);
    if (!issue) {
      return {
        configured: Boolean(clientId),
        clientId,
        tenantId,
        secretSource: candidate.source,
        issue: clientId ? null : 'missing',
        issueDetail: clientId ? null : 'MICROSOFT_CLIENT_ID or MICROSOFT_LOGIN_CLIENT_ID is not set.',
      };
    }
    // Keep scanning — a bad MICROSOFT_CLIENT_SECRET should not block a valid LOGIN secret
  }

  const firstPresent = candidates.find((c) => c.value);
  if (!clientId && !firstPresent?.value) {
    return {
      configured: false,
      clientId: null,
      tenantId,
      secretSource: null,
      issue: 'missing',
      issueDetail: issueMessage('missing'),
    };
  }

  if (firstPresent?.value) {
    const issue = validateClientSecret(firstPresent.value)!;
    return {
      configured: false,
      clientId,
      tenantId,
      secretSource: firstPresent.source,
      issue,
      issueDetail: issueMessage(issue),
    };
  }

  return {
    configured: false,
    clientId,
    tenantId,
    secretSource: null,
    issue: 'missing',
    issueDetail: 'MICROSOFT_CLIENT_SECRET or MICROSOFT_LOGIN_CLIENT_SECRET is not set.',
  };
}

export function getMicrosoftCalendarCredentials(): {
  clientId: string;
  clientSecret: string;
  tenantId: string;
} {
  const diagnosis = diagnoseMicrosoftCredentials();

  if (!diagnosis.clientId || !diagnosis.secretSource || diagnosis.issue) {
    throw new Error(
      diagnosis.issueDetail ||
        'Microsoft OAuth credentials not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET (or MICROSOFT_LOGIN_* equivalents).',
    );
  }

  const clientSecret =
    diagnosis.secretSource === 'MICROSOFT_CLIENT_SECRET'
      ? normalizeEnvValue(process.env.MICROSOFT_CLIENT_SECRET)!
      : normalizeEnvValue(process.env.MICROSOFT_LOGIN_CLIENT_SECRET)!;

  return {
    clientId: diagnosis.clientId,
    clientSecret,
    tenantId: diagnosis.tenantId,
  };
}

/** Map raw Azure OAuth errors to stable codes safe to show in the browser. */
export function mapMicrosoftOAuthErrorCode(message: string): string {
  const known = new Set([
    'invalid_client_secret',
    'redirect_uri_mismatch',
    'invalid_scope',
    'token_exchange_failed',
  ]);
  if (known.has(message)) return message;

  const lower = message.toLowerCase();
  if (lower.includes('aadsts7000215') || lower.includes('invalid client secret')) {
    return 'invalid_client_secret';
  }
  if (lower.includes('redirect_uri') || lower.includes('aadsts50011')) {
    return 'redirect_uri_mismatch';
  }
  if (lower.includes('aadsts650053') || lower.includes('scope')) {
    return 'invalid_scope';
  }
  return 'token_exchange_failed';
}
