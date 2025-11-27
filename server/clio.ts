import { db } from "./db";
import { clioConnections, clioMatterLinks, cases } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const CLIO_EU_BASE_URL = "https://eu.app.clio.com";
const CLIO_API_BASE_URL = `${CLIO_EU_BASE_URL}/api/v4`;
const CLIO_OAUTH_URL = `${CLIO_EU_BASE_URL}/oauth`;

interface ClioTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

interface ClioUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  enabled: boolean;
}

interface ClioFirm {
  id: number;
  name: string;
  time_zone: string;
  currency: string;
}

interface ClioMatter {
  id: number;
  display_number: string;
  description: string;
  status: string;
  client?: {
    id: number;
    name: string;
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  responsible_attorney?: {
    id: number;
    name: string;
    email: string;
  };
  created_at: string;
  updated_at: string;
}

interface ClioMattersResponse {
  data: ClioMatter[];
  meta: {
    paging: {
      next?: string;
      previous?: string;
    };
    records: number;
  };
}

export class ClioService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.CLIO_CLIENT_ID || "";
    this.clientSecret = process.env.CLIO_CLIENT_SECRET || "";
    
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPLIT_DOMAINS 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : 'http://localhost:5000';
    
    this.redirectUri = `${baseUrl}/api/clio/callback`;
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state: state,
    });

    return `${CLIO_OAUTH_URL}/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<ClioTokenResponse> {
    const response = await fetch(`${CLIO_OAUTH_URL}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Clio] Token exchange failed:", errorText);
      throw new Error(`Failed to exchange code for tokens: ${response.status}`);
    }

    return response.json();
  }

  async refreshAccessToken(refreshToken: string): Promise<ClioTokenResponse> {
    const response = await fetch(`${CLIO_OAUTH_URL}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Clio] Token refresh failed:", errorText);
      throw new Error(`Failed to refresh token: ${response.status}`);
    }

    return response.json();
  }

  private async makeApiRequest<T>(
    accessToken: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${CLIO_API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Clio] API request failed: ${endpoint}`, errorText);
      
      if (response.status === 401) {
        throw new Error("CLIO_TOKEN_EXPIRED");
      }
      
      throw new Error(`Clio API error: ${response.status}`);
    }

    return response.json();
  }

  async getCurrentUser(accessToken: string): Promise<{ user: ClioUser; firm: ClioFirm }> {
    const response = await this.makeApiRequest<{ data: ClioUser }>(
      accessToken,
      "/users/who_am_i?fields=id,email,first_name,last_name,enabled"
    );

    const firmResponse = await this.makeApiRequest<{ data: ClioFirm }>(
      accessToken,
      "/firms?fields=id,name,time_zone,currency"
    );

    return {
      user: response.data,
      firm: firmResponse.data,
    };
  }

  async getMatters(accessToken: string, options: {
    status?: string;
    limit?: number;
    offset?: number;
    search?: string;
  } = {}): Promise<ClioMattersResponse> {
    const params = new URLSearchParams({
      fields: "id,display_number,description,status,client{id,name,first_name,last_name,email},responsible_attorney{id,name,email},created_at,updated_at",
      order: "updated_at(desc)",
      limit: String(options.limit || 50),
    });

    if (options.status) {
      params.append("status", options.status);
    }

    if (options.offset) {
      params.append("offset", String(options.offset));
    }

    if (options.search) {
      params.append("query", options.search);
    }

    return this.makeApiRequest<ClioMattersResponse>(
      accessToken,
      `/matters?${params.toString()}`
    );
  }

  async getMatter(accessToken: string, matterId: string): Promise<ClioMatter> {
    const response = await this.makeApiRequest<{ data: ClioMatter }>(
      accessToken,
      `/matters/${matterId}?fields=id,display_number,description,status,client{id,name,first_name,last_name,email},responsible_attorney{id,name,email},created_at,updated_at`
    );

    return response.data;
  }

  async getConnection(userId: string) {
    const [connection] = await db
      .select()
      .from(clioConnections)
      .where(eq(clioConnections.userId, userId))
      .limit(1);

    return connection;
  }

  async ensureValidToken(userId: string): Promise<string | null> {
    const connection = await this.getConnection(userId);
    
    if (!connection) {
      return null;
    }

    if (connection.status !== "active") {
      return null;
    }

    const now = new Date();
    const expiresAt = new Date(connection.tokenExpiresAt);
    const bufferTime = 5 * 60 * 1000;

    if (expiresAt.getTime() - now.getTime() > bufferTime) {
      return connection.accessToken;
    }

    try {
      const tokens = await this.refreshAccessToken(connection.refreshToken);
      
      const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      
      await db
        .update(clioConnections)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(clioConnections.id, connection.id));

      return tokens.access_token;
    } catch (error) {
      console.error("[Clio] Failed to refresh token:", error);
      
      await db
        .update(clioConnections)
        .set({
          status: "expired",
          updatedAt: new Date(),
        })
        .where(eq(clioConnections.id, connection.id));

      return null;
    }
  }

  async saveConnection(
    userId: string,
    tokens: ClioTokenResponse,
    userInfo: { user: ClioUser; firm: ClioFirm }
  ): Promise<void> {
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const existing = await this.getConnection(userId);

    if (existing) {
      await db
        .update(clioConnections)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt,
          clioUserId: String(userInfo.user.id),
          clioFirmId: String(userInfo.firm.id),
          clioFirmName: userInfo.firm.name,
          clioUserEmail: userInfo.user.email,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(clioConnections.id, existing.id));
    } else {
      await db.insert(clioConnections).values({
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt,
        clioUserId: String(userInfo.user.id),
        clioFirmId: String(userInfo.firm.id),
        clioFirmName: userInfo.firm.name,
        clioUserEmail: userInfo.user.email,
        status: "active",
        syncEnabled: true,
      });
    }
  }

  async disconnectUser(userId: string): Promise<void> {
    await db
      .delete(clioMatterLinks)
      .where(eq(clioMatterLinks.userId, userId));

    await db
      .delete(clioConnections)
      .where(eq(clioConnections.userId, userId));
  }

  async linkMatterToCase(
    userId: string,
    caseId: string,
    matter: ClioMatter
  ): Promise<void> {
    const existing = await db
      .select()
      .from(clioMatterLinks)
      .where(
        and(
          eq(clioMatterLinks.userId, userId),
          eq(clioMatterLinks.clioMatterId, String(matter.id))
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(clioMatterLinks)
        .set({
          caseId,
          clioMatterNumber: matter.display_number,
          clioMatterDescription: matter.description,
          clioClientId: matter.client?.id ? String(matter.client.id) : null,
          clioClientName: matter.client?.name,
          lastSyncAt: new Date(),
        })
        .where(eq(clioMatterLinks.id, existing[0].id));
    } else {
      await db.insert(clioMatterLinks).values({
        userId,
        caseId,
        clioMatterId: String(matter.id),
        clioMatterNumber: matter.display_number,
        clioMatterDescription: matter.description,
        clioClientId: matter.client?.id ? String(matter.client.id) : null,
        clioClientName: matter.client?.name,
        syncDirection: "clio_to_legalnote",
      });
    }
  }

  async importMatterAsCase(
    userId: string,
    matter: ClioMatter
  ): Promise<string> {
    const existingLink = await db
      .select()
      .from(clioMatterLinks)
      .where(
        and(
          eq(clioMatterLinks.userId, userId),
          eq(clioMatterLinks.clioMatterId, String(matter.id))
        )
      )
      .limit(1);

    if (existingLink.length > 0 && existingLink[0].caseId) {
      return existingLink[0].caseId;
    }

    const clientName = matter.client?.name || "Unknown Client";
    const title = matter.display_number 
      ? `${matter.display_number} - ${clientName}`
      : clientName;

    const [newCase] = await db
      .insert(cases)
      .values({
        title,
        clientName,
        matterReference: matter.display_number || undefined,
        status: "pending",
        priority: "normal",
        createdBy: userId,
        notes: matter.description || undefined,
      })
      .returning();

    await this.linkMatterToCase(userId, newCase.id, matter);

    return newCase.id;
  }

  async getLinkedMatter(caseId: string): Promise<ClioMatter | null> {
    const [link] = await db
      .select()
      .from(clioMatterLinks)
      .where(eq(clioMatterLinks.caseId, caseId))
      .limit(1);

    if (!link) {
      return null;
    }

    const accessToken = await this.ensureValidToken(link.userId);
    if (!accessToken) {
      return null;
    }

    try {
      return await this.getMatter(accessToken, link.clioMatterId);
    } catch (error) {
      console.error("[Clio] Failed to fetch linked matter:", error);
      return null;
    }
  }

  async getMatterLinks(userId: string) {
    return db
      .select()
      .from(clioMatterLinks)
      .where(eq(clioMatterLinks.userId, userId));
  }

  async unlinkCase(caseId: string): Promise<void> {
    await db
      .delete(clioMatterLinks)
      .where(eq(clioMatterLinks.caseId, caseId));
  }
}

export const clioService = new ClioService();
