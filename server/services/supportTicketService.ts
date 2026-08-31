import { randomBytes } from "crypto";
import type { SupportTicket, User } from "@shared/schema";
import type { SupportTicketCreateBody, SupportTicketPreviewBody } from "@shared/schema";
import {
  supportCategoryLabel,
  supportSeverityLabel,
  type SupportTicketCategory,
  type SupportTicketSeverity,
} from "@shared/supportTickets";
import { privilegedComplete } from "./llm/privilegedComplete";
import { storage } from "../storage";

export interface SupportTicketAiPreview {
  title: string;
  summary: string;
  polishedDescription: string;
}

export interface SupportTicketSafeContext {
  userEmail: string | null;
  firmName: string | null;
  pageUrl?: string;
  userAgent?: string;
  case?: { id: string; title: string; status: string; matterReference: string | null };
  calendarIntegrations: Array<{
    provider: string;
    email: string | null;
    connectedAt: string;
    lastSyncAt: string | null;
  }>;
  recentMeetingImports: Array<{
    id: string;
    status: string;
    botStatus: string | null;
    meetingPlatform: string;
    errorMessage: string | null;
    createdAt: string;
  }>;
  importCounts: { pending: number; failedLast7Days: number };
}

function ticketRef(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const suffix = randomBytes(2).toString("hex").toUpperCase();
  return `LN-${y}${m}${day}-${suffix}`;
}

function truncate(text: string | null | undefined, max: number): string | null {
  if (!text) return null;
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

export async function gatherSupportTicketContext(params: {
  user: User;
  caseId?: string | null;
  pageUrl?: string;
  userAgent?: string;
}): Promise<SupportTicketSafeContext> {
  const { user, caseId, pageUrl, userAgent } = params;
  let firmName: string | null = null;
  if (user.firmId) {
    const firm = await storage.getFirm(user.firmId);
    firmName = firm?.name ?? null;
  }

  let caseSummary: SupportTicketSafeContext["case"];
  if (caseId) {
    const caseRecord = await storage.getCase(caseId, user.id);
    if (caseRecord) {
      caseSummary = {
        id: caseRecord.id,
        title: caseRecord.title,
        status: caseRecord.status,
        matterReference: caseRecord.matterReference ?? null,
      };
    }
  }

  const integrations = await storage.getUserCalendarIntegrations(user.id);
  const calendarIntegrations = integrations.map((i) => ({
    provider: i.provider,
    email: i.email ?? null,
    connectedAt: i.connectedAt.toISOString(),
    lastSyncAt: i.lastSyncAt ? i.lastSyncAt.toISOString() : null,
  }));

  const imports = await storage.getMeetingImportsByUser(user.id);
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentMeetingImports = imports.slice(0, 5).map((imp) => ({
    id: imp.id,
    status: imp.status,
    botStatus: imp.botStatus ?? null,
    meetingPlatform: imp.meetingPlatform,
    errorMessage: truncate(imp.errorMessage, 200),
    createdAt: imp.createdAt.toISOString(),
  }));

  const pending = imports.filter((i) => ["pending", "downloading", "transcribing", "live"].includes(i.status)).length;
  const failedLast7Days = imports.filter(
    (i) => i.status === "failed" && i.createdAt.getTime() >= sevenDaysAgo,
  ).length;

  return {
    userEmail: user.email ?? null,
    firmName,
    pageUrl,
    userAgent,
    case: caseSummary,
    calendarIntegrations,
    recentMeetingImports,
    importCounts: { pending, failedLast7Days },
  };
}

export async function polishSupportTicketWithAi(
  body: SupportTicketPreviewBody,
): Promise<SupportTicketAiPreview> {
  const category = supportCategoryLabel(body.category);
  const severity = supportSeverityLabel(body.severity);

  const completion = await privilegedComplete({
    systemPrompt: `You help LegalNote support staff triage in-app tickets from UK solicitors.
Return JSON only with keys: title (max 120 chars), summary (2-4 sentences for support staff), polishedDescription (clear user-facing problem statement, UK English, no invented facts).
Do not include client names, meeting URLs, or transcript content. Preserve the user's meaning.`,
    userPrompt: `Category: ${category}
Severity: ${severity}

User description:
${body.description}`,
    maxTokens: 600,
    temperature: 0.2,
    responseFormat: "json_object",
  });

  try {
    const parsed = JSON.parse(completion.content) as Partial<SupportTicketAiPreview>;
    const title = (parsed.title || "Support request").trim().slice(0, 200);
    const summary = (parsed.summary || body.description).trim().slice(0, 2000);
    const polishedDescription = (parsed.polishedDescription || body.description).trim().slice(0, 8000);
    return { title, summary, polishedDescription };
  } catch {
    const fallback = body.description.trim();
    return {
      title: `${category} — ${severity}`.slice(0, 200),
      summary: fallback.slice(0, 2000),
      polishedDescription: fallback,
    };
  }
}

export async function createSupportTicketRecord(params: {
  user: User;
  body: SupportTicketCreateBody;
  rawTranscript?: string;
  screenshotPath?: string | null;
}): Promise<SupportTicket> {
  const { user, body, rawTranscript, screenshotPath } = params;
  const contextMetadata = await gatherSupportTicketContext({
    user,
    caseId: body.caseId ?? undefined,
    pageUrl: body.pageUrl,
    userAgent: body.userAgent,
  });

  let title = body.title?.trim();
  let description = body.polishedDescription?.trim() || body.description.trim();
  let aiSummary = body.aiSummary?.trim();

  if (!title || !aiSummary) {
    const ai = await polishSupportTicketWithAi({
      category: body.category,
      severity: body.severity,
      description: body.description,
    });
    title = title || ai.title;
    description = body.polishedDescription?.trim() || ai.polishedDescription;
    aiSummary = aiSummary || ai.summary;
  }

  if (body.caseId) {
    const caseRecord = await storage.getCase(body.caseId, user.id);
    if (!caseRecord) {
      throw new Error("CASE_NOT_FOUND");
    }
  }

  return storage.createSupportTicket({
    ticketRef: ticketRef(),
    userId: user.id,
    firmId: user.firmId ?? null,
    caseId: body.caseId ?? null,
    category: body.category,
    severity: body.severity,
    title,
    description,
    rawTranscript: rawTranscript ?? null,
    aiSummary: aiSummary ?? null,
    status: "open",
    screenshotPath: screenshotPath ?? null,
    contextMetadata,
    adminNotes: null,
    resolvedAt: null,
    resolvedBy: null,
  });
}

export type SupportTicketWithUser = SupportTicket & {
  userEmail: string | null;
  userName: string | null;
  firmName: string | null;
};

export function severitySortWeight(severity: string): number {
  switch (severity) {
    case "blocked":
      return 0;
    case "annoying":
      return 1;
    default:
      return 2;
  }
}

export function categoryFromId(id: string): SupportTicketCategory | "other" {
  const allowed: SupportTicketCategory[] = [
    "record_meeting",
    "livebot",
    "share",
    "calendar",
    "documents",
    "login",
    "other",
  ];
  return (allowed.includes(id as SupportTicketCategory) ? id : "other") as SupportTicketCategory;
}

export function severityFromId(id: string): SupportTicketSeverity {
  if (id === "blocked" || id === "annoying" || id === "question") return id;
  return "question";
}
