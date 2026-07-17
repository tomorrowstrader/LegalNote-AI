import fs from "fs";
import * as docusignModule from "docusign-esign";
import {
  buildDpaDocxBase64,
  DPA_ANCHORS,
  masterDpaDocxExists,
} from "./dpaDocumentPrep";

// docusign-esign is CJS; under Node ESM the classes live on the default export.
// @types expose named exports that do not match the runtime shape.
const docusign = (
  (docusignModule as { default?: typeof docusignModule }).default ??
  docusignModule
) as {
  ApiClient: new () => {
    setBasePath(path: string): void;
    setOAuthBasePath(path: string): void;
    addDefaultHeader(header: string, value: string): void;
    requestJWTUserToken(
      clientId: string,
      userId: string,
      scopes: string[],
      rsaPrivateKey: Buffer,
      expiresIn: number,
    ): Promise<{ body: { access_token: string } }>;
  };
  EnvelopesApi: new (apiClient: unknown) => {
    createEnvelope(
      accountId: string,
      opts: { envelopeDefinition: unknown },
    ): Promise<{ envelopeId?: string }>;
    createRecipientView(
      accountId: string,
      envelopeId: string,
      opts: { recipientViewRequest: unknown },
    ): Promise<{ url?: string }>;
  };
};

/** Recipient role for the controller / Firm signer (embedded). */
export const DPA_SIGNER_RECIPIENT_ID = "1";

export interface DpaEnvelopeInput {
  firmName: string;
  sraNumber?: string;
  signerName: string;
  signerTitle: string;
  email: string;
  clientUserId: string;
}

export interface DpaSigningSession {
  envelopeId: string;
  signingUrl: string;
}

type CachedToken = { accessToken: string; expiresAtMs: number };

let cachedToken: CachedToken | null = null;

function isDpaSigningConfigured(): boolean {
  return (
    process.env.DPA_SIGNING_ENABLED === "true" &&
    Boolean(process.env.DOCUSIGN_INTEGRATION_KEY) &&
    Boolean(process.env.DOCUSIGN_USER_ID) &&
    Boolean(process.env.DOCUSIGN_ACCOUNT_ID) &&
    masterDpaDocxExists() &&
    Boolean(
      process.env.DOCUSIGN_RSA_PRIVATE_KEY ||
        process.env.DOCUSIGN_RSA_PRIVATE_KEY_PATH,
    )
  );
}

export function assertDpaSigningReady(): void {
  if (process.env.DPA_SIGNING_ENABLED !== "true") {
    const err = new Error(
      "DPA signing is not enabled. Set DPA_SIGNING_ENABLED=true after counsel sign-off and DocuSign setup.",
    );
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }
  if (!isDpaSigningConfigured()) {
    const err = new Error(
      "DocuSign is not fully configured. Check DOCUSIGN_* environment variables and that the master DPA .docx is present.",
    );
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }
}

function getPrivateKey(): Buffer {
  const keyPath = process.env.DOCUSIGN_RSA_PRIVATE_KEY_PATH;
  if (keyPath) {
    return fs.readFileSync(keyPath);
  }
  const key = process.env.DOCUSIGN_RSA_PRIVATE_KEY;
  if (!key) {
    throw new Error("DOCUSIGN_RSA_PRIVATE_KEY or DOCUSIGN_RSA_PRIVATE_KEY_PATH is required");
  }
  // Railway / env UIs often store either real newlines or literal \n; strip wrapping quotes.
  const normalized = key
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");
  return Buffer.from(normalized);
}

function getApiClient() {
  const apiClient = new docusign.ApiClient();
  const basePath =
    process.env.DOCUSIGN_BASE_PATH || "https://demo.docusign.net/restapi";
  const oauthBasePath =
    process.env.DOCUSIGN_OAUTH_BASE_PATH || "account-d.docusign.com";
  apiClient.setBasePath(basePath);
  apiClient.setOAuthBasePath(oauthBasePath);
  return apiClient;
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs > now + 60_000) {
    return cachedToken.accessToken;
  }

  const apiClient = getApiClient();
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY!;
  const userId = process.env.DOCUSIGN_USER_ID!;
  const scopes = ["signature", "impersonation"];
  const expiresIn = 3600;

  try {
    const results = await apiClient.requestJWTUserToken(
      integrationKey,
      userId,
      scopes,
      getPrivateKey(),
      expiresIn,
    );
    const accessToken = results?.body?.access_token as string | undefined;
    if (!accessToken) {
      throw new Error("DocuSign JWT auth succeeded but returned no access token");
    }
    cachedToken = {
      accessToken,
      expiresAtMs: now + expiresIn * 1000,
    };
    return accessToken;
  } catch (error: unknown) {
    let message = "";
    if (error && typeof error === "object" && "response" in error) {
      const body = (error as { response?: { body?: unknown; text?: string } }).response?.body;
      const text = (error as { response?: { text?: string } }).response?.text;
      if (body !== undefined) {
        message = typeof body === "string" ? body : JSON.stringify(body);
      } else if (typeof text === "string") {
        message = text;
      }
    }
    if (!message) {
      message = error instanceof Error ? error.message : String(error);
    }
    if (message.includes("consent_required")) {
      const oauthHost =
        process.env.DOCUSIGN_OAUTH_BASE_PATH || "account-d.docusign.com";
      const consentUrl = `https://${oauthHost}/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${integrationKey}&redirect_uri=https://www.docusign.com`;
      const err = new Error(
        `DocuSign JWT consent required. An admin must grant consent once: ${consentUrl}`,
      );
      (err as Error & { statusCode?: number }).statusCode = 503;
      throw err;
    }
    const err = new Error(
      message || "DocuSign authentication failed. Check DOCUSIGN_* environment variables and JWT consent.",
    );
    (err as Error & { statusCode?: number }).statusCode = 502;
    throw err;
  }
}

async function getAuthenticatedApiClient() {
  const apiClient = getApiClient();
  const token = await getAccessToken();
  apiClient.addDefaultHeader("Authorization", `Bearer ${token}`);
  return apiClient;
}

function extractDocuSignErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return error instanceof Error ? error.message : String(error);
  }
  const withResponse = error as {
    response?: { body?: unknown; text?: string };
    message?: string;
  };
  const body = withResponse.response?.body;
  if (body && typeof body === "object") {
    const b = body as { message?: string; errorCode?: string; error?: string };
    if (b.message) {
      return b.errorCode ? `${b.errorCode}: ${b.message}` : b.message;
    }
    if (b.error) return String(b.error);
  }
  if (typeof withResponse.response?.text === "string" && withResponse.response.text) {
    return withResponse.response.text.slice(0, 500);
  }
  if (typeof withResponse.message === "string") return withResponse.message;
  return "DocuSign request failed";
}

export async function createDpaEnvelope(
  input: DpaEnvelopeInput,
): Promise<{ envelopeId: string }> {
  assertDpaSigningReady();

  const { documentBase64, fileName } = await buildDpaDocxBase64({
    firmName: input.firmName,
    sraNumber: input.sraNumber || "—",
    signerName: input.signerName,
    signerTitle: input.signerTitle,
  });

  const apiClient = await getAuthenticatedApiClient();
  const envelopesApi = new docusign.EnvelopesApi(apiClient);
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID!;

  const envelopeDefinition = {
    emailSubject: "LegalNote Data Processing Agreement — please sign",
    documents: [
      {
        documentBase64,
        name: fileName,
        fileExtension: "docx",
        documentId: "1",
      },
    ],
    recipients: {
      signers: [
        {
          email: input.email,
          name: input.signerName,
          recipientId: DPA_SIGNER_RECIPIENT_ID,
          routingOrder: "1",
          clientUserId: input.clientUserId,
          tabs: {
            signHereTabs: [
              {
                anchorString: DPA_ANCHORS.firmSignature,
                anchorUnits: "pixels",
                anchorXOffset: "0",
                anchorYOffset: "0",
                anchorIgnoreIfNotPresent: "false",
              },
            ],
            dateSignedTabs: [
              {
                anchorString: DPA_ANCHORS.firmDate,
                anchorUnits: "pixels",
                anchorXOffset: "0",
                anchorYOffset: "0",
                anchorIgnoreIfNotPresent: "false",
              },
            ],
          },
        },
      ],
    },
    status: "sent",
  };

  try {
    const result = await envelopesApi.createEnvelope(accountId, {
      envelopeDefinition,
    });

    if (!result.envelopeId) {
      throw new Error("DocuSign did not return an envelope ID");
    }

    return { envelopeId: result.envelopeId };
  } catch (error: unknown) {
    const message = extractDocuSignErrorMessage(error);
    const err = new Error(message);
    (err as Error & { statusCode?: number }).statusCode = 502;
    throw err;
  }
}

export async function createRecipientView(args: {
  envelopeId: string;
  signerName: string;
  email: string;
  clientUserId: string;
  returnUrl: string;
}): Promise<string> {
  assertDpaSigningReady();

  const apiClient = await getAuthenticatedApiClient();
  const envelopesApi = new docusign.EnvelopesApi(apiClient);
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID!;

  const viewRequest = {
    authenticationMethod: "none",
    clientUserId: args.clientUserId,
    recipientId: DPA_SIGNER_RECIPIENT_ID,
    returnUrl: args.returnUrl,
    userName: args.signerName,
    email: args.email,
  };

  try {
    const view = await envelopesApi.createRecipientView(accountId, args.envelopeId, {
      recipientViewRequest: viewRequest,
    });

    if (!view.url) {
      throw new Error("DocuSign did not return a recipient view URL");
    }

    return view.url;
  } catch (error: unknown) {
    const message = extractDocuSignErrorMessage(error);
    const err = new Error(message);
    (err as Error & { statusCode?: number }).statusCode = 502;
    throw err;
  }
}

export async function startDpaSigningSession(
  input: DpaEnvelopeInput,
  returnUrl: string,
): Promise<DpaSigningSession> {
  const { envelopeId } = await createDpaEnvelope(input);
  const signingUrl = await createRecipientView({
    envelopeId,
    signerName: input.signerName,
    email: input.email,
    clientUserId: input.clientUserId,
    returnUrl,
  });
  return { envelopeId, signingUrl };
}

export { isDpaSigningConfigured };
