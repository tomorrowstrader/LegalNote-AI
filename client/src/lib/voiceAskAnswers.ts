import { differenceInCalendarDays, format, isPast } from "date-fns";
import {
  getDocumentTypeLabel,
  hasDocumentsAwaitingAdoption,
} from "@/lib/documentAdoption";
import type { AskTopic } from "@/lib/voiceCommandIntents";
import type { Case } from "@shared/schema";

export interface VoiceAskAction {
  label: string;
  path?: string;
  caseId?: string;
}

export interface VoiceAskCitation {
  source: "transcript" | "attendance_note" | "client_letter";
  label: string;
  path: string;
  excerpt?: string;
}

export interface VoiceAskSection {
  title: string;
  bullets: string[];
}

export interface VoiceAskAnswer {
  headline: string;
  detail?: string;
  bullets?: string[];
  sections?: VoiceAskSection[];
  actions?: VoiceAskAction[];
  citations?: VoiceAskCitation[];
}

type CaseDoc = { type: string; status: string; isActive?: boolean | null };

type ActionRow = {
  description?: string;
  title?: string;
  assignee?: string | null;
  dueDate?: string | Date | null;
  status?: string;
  completed?: boolean;
};

type UndertakingRow = {
  wording?: string;
  status?: string;
  deadline?: string | Date | null;
};

const CLIENT_DUE_SOON_DAYS = 7;

async function fetchCases(): Promise<Case[]> {
  const res = await fetch("/api/cases", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load cases");
  return res.json();
}

async function fetchProductivity(): Promise<{ awaitingReview?: number }> {
  const res = await fetch("/api/dashboard/productivity-stats", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load stats");
  return res.json();
}

async function fetchAttention(): Promise<{ audioExpiringCount?: number }> {
  const res = await fetch("/api/dashboard/attention-stats", { credentials: "include" });
  if (!res.ok) return { audioExpiringCount: 0 };
  return res.json();
}

async function fetchOutstandingUndertakings(): Promise<
  Array<{ id: string; wording?: string; caseTitle?: string }>
> {
  const res = await fetch("/api/undertakings/outstanding", { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

async function fetchCaseDocuments(caseId: string): Promise<CaseDoc[]> {
  const res = await fetch(`/api/cases/${caseId}/documents`, { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

async function fetchCaseActionItems(caseId: string): Promise<ActionRow[]> {
  const res = await fetch(`/api/cases/${caseId}/action-items`, { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

async function fetchCaseUndertakings(caseId: string): Promise<UndertakingRow[]> {
  const res = await fetch(`/api/cases/${caseId}/undertakings`, { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

function isClientAssignee(assignee: string | null | undefined): boolean {
  if (!assignee) return false;
  return /\bclient\b/i.test(assignee.trim());
}

/** Approved, not completed — draft/rejected excluded. */
function isOpenApprovedAction(item: ActionRow): boolean {
  if (item.completed) return false;
  return (item.status || "").toLowerCase() === "approved";
}

function actionLabel(item: ActionRow): string {
  return (item.description || item.title || "Action").trim();
}

function formatDue(due: string | Date | null | undefined): string | null {
  if (!due) return null;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return null;
  return format(d, "dd MMM yyyy");
}

function dueTag(due: string | Date | null | undefined, now = new Date()): string | null {
  if (!due) return null;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return null;
  const days = differenceInCalendarDays(d, now);
  if (days < 0) return "OVERDUE";
  if (days === 0) return "due today";
  if (days <= CLIENT_DUE_SOON_DAYS) return `due in ${days} day${days === 1 ? "" : "s"}`;
  return `due ${format(d, "dd MMM")}`;
}

function isDueSoonOrOverdue(due: string | Date | null | undefined, now = new Date()): boolean {
  if (!due) return false;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return false;
  const days = differenceInCalendarDays(d, now);
  return days <= CLIENT_DUE_SOON_DAYS;
}

function formatActionBullet(item: ActionRow): string {
  const tag = dueTag(item.dueDate);
  const desc = actionLabel(item);
  return tag ? `${tag} — ${desc}` : desc;
}

function activeCases(cases: Case[]): Case[] {
  return cases.filter((c) => !c.archived);
}

function overdueCases(cases: Case[]): Case[] {
  return activeCases(cases).filter(
    (c) => c.deadline && isPast(new Date(c.deadline)) && !c.reviewed,
  );
}

function awaitingReviewCases(cases: Case[]): Case[] {
  return activeCases(cases).filter((c) => c.status === "completed" && !c.reviewed);
}

function labelCase(c: Case): string {
  return c.title || c.clientName || "Untitled matter";
}

/**
 * Answer bounded operational questions from live LegalNote data.
 * No legal advice — file status only.
 */
export async function answerVoiceAsk(
  topic: AskTopic,
  activeCaseId: string | null,
  question?: string,
): Promise<VoiceAskAnswer> {
  if (topic === "matter_qa") {
    return answerMatterQa(activeCaseId, question || "");
  }

  switch (topic) {
    case "awaiting_review": {
      const [cases, productivity] = await Promise.all([fetchCases(), fetchProductivity()]);
      const list = awaitingReviewCases(cases);
      const count = productivity.awaitingReview ?? list.length;
      if (count === 0) {
        return {
          headline: "Nothing awaiting review.",
          detail: "All completed matters on your list are marked reviewed.",
          actions: [{ label: "Go to dashboard", path: "/" }],
        };
      }
      return {
        headline:
          count === 1
            ? "1 matter is awaiting review."
            : `${count} matters are awaiting review.`,
        bullets: list.slice(0, 4).map(labelCase),
        actions: [
          ...(list[0] ? [{ label: "Open first", path: `/case/${list[0].id}` }] : []),
          { label: "Go to dashboard", path: "/" },
        ],
      };
    }

    case "awaiting_adoption": {
      const cases = activeCases(await fetchCases());
      const withDocs = await Promise.all(
        cases.slice(0, 40).map(async (c) => {
          const docs = await fetchCaseDocuments(c.id);
          return { case: c, waiting: hasDocumentsAwaitingAdoption(docs), docs };
        }),
      );
      const waiting = withDocs.filter((x) => x.waiting);
      if (waiting.length === 0) {
        return {
          headline: "No documents waiting for adoption.",
          detail: "Adoption-gated notes and letters on your open matters look approved.",
          actions: [{ label: "Go to dashboard", path: "/" }],
        };
      }
      return {
        headline:
          waiting.length === 1
            ? "1 matter still has documents to adopt."
            : `${waiting.length} matters still have documents to adopt.`,
        bullets: waiting.slice(0, 4).map((x) => labelCase(x.case)),
        actions: [
          {
            label: "Open first",
            path: `/case/${waiting[0].case.id}?tab=attendance`,
          },
          { label: "Go to dashboard", path: "/" },
        ],
      };
    }

    case "overdue": {
      const list = overdueCases(await fetchCases());
      if (list.length === 0) {
        return {
          headline: "No overdue matters.",
          actions: [{ label: "Go to dashboard", path: "/" }],
        };
      }
      return {
        headline:
          list.length === 1 ? "1 matter is overdue." : `${list.length} matters are overdue.`,
        bullets: list.slice(0, 4).map(labelCase),
        actions: [
          { label: "Open first", path: `/case/${list[0].id}` },
          { label: "Go to dashboard", path: "/" },
        ],
      };
    }

    case "outstanding_undertakings": {
      const list = await fetchOutstandingUndertakings();
      if (list.length === 0) {
        return {
          headline: "No outstanding undertakings.",
          actions: [{ label: "Undertakings register", path: "/undertakings" }],
        };
      }
      return {
        headline:
          list.length === 1
            ? "1 outstanding undertaking."
            : `${list.length} outstanding undertakings.`,
        bullets: list.slice(0, 4).map((u) => u.caseTitle || u.wording || "Undertaking"),
        actions: [{ label: "Open undertakings", path: "/undertakings" }],
      };
    }

    case "needs_attention": {
      const [cases, attention, undertakings] = await Promise.all([
        fetchCases(),
        fetchAttention(),
        fetchOutstandingUndertakings(),
      ]);
      const overdue = overdueCases(cases);
      const review = awaitingReviewCases(cases);
      const audio = attention.audioExpiringCount ?? 0;
      const und = undertakings.length;

      const parts: string[] = [];
      if (overdue.length) parts.push(`${overdue.length} overdue`);
      if (review.length) parts.push(`${review.length} awaiting review`);
      if (und) parts.push(`${und} outstanding undertaking${und === 1 ? "" : "s"}`);
      if (audio) parts.push(`${audio} recording${audio === 1 ? "" : "s"} expiring soon`);

      if (parts.length === 0) {
        return {
          headline: "You’re all clear — nothing needs attention right now.",
          actions: [{ label: "Go to dashboard", path: "/" }],
        };
      }

      return {
        headline: `Needs attention: ${parts.join(", ")}.`,
        bullets: [
          ...overdue.slice(0, 2).map((c) => `Overdue — ${labelCase(c)}`),
          ...review.slice(0, 2).map((c) => `Review — ${labelCase(c)}`),
        ].slice(0, 4),
        actions: [
          ...(overdue[0]
            ? [{ label: "Open overdue", path: `/case/${overdue[0].id}` }]
            : review[0]
              ? [{ label: "Open for review", path: `/case/${review[0].id}` }]
              : []),
          { label: "Go to dashboard", path: "/" },
        ],
      };
    }

    case "matter_outstanding": {
      if (!activeCaseId) {
        return {
          headline: "Open a matter first, then ask what’s outstanding on it.",
          detail: "Or ask “what needs attention?” for a cross-matter view.",
          actions: [{ label: "Go to dashboard", path: "/" }],
        };
      }

      const [docs, actions, cases, undertakings] = await Promise.all([
        fetchCaseDocuments(activeCaseId),
        fetchCaseActionItems(activeCaseId),
        fetchCases(),
        fetchCaseUndertakings(activeCaseId),
      ]);
      const matter = cases.find((c) => c.id === activeCaseId);
      const now = new Date();

      const unadopted = docs.filter(
        (d) =>
          d.isActive !== false &&
          ["attendance_note", "meeting_notes", "summary", "client_letter", "client_care_letter"].includes(
            d.type,
          ) &&
          d.status !== "approved",
      );

      const openApproved = actions.filter(isOpenApprovedAction);
      const solicitorActions = openApproved.filter((a) => !isClientAssignee(a.assignee));
      const clientActions = openApproved.filter((a) => isClientAssignee(a.assignee));
      const clientOverdueOrSoon = clientActions.filter((a) =>
        isDueSoonOrOverdue(a.dueDate, now),
      );

      const openUndertakings = undertakings.filter(
        (u) => (u.status || "").toLowerCase() === "outstanding",
      );

      const youBullets: string[] = [];
      if (matter?.deadline && isPast(new Date(matter.deadline)) && !matter.reviewed) {
        youBullets.push(`Matter deadline overdue (${formatDue(matter.deadline)})`);
      } else if (matter?.deadline && !matter.reviewed) {
        const tag = dueTag(matter.deadline, now);
        if (tag === "due today" || tag?.startsWith("due in ")) {
          youBullets.push(`Matter deadline ${tag} (${formatDue(matter.deadline)})`);
        }
      }
      if (matter && matter.status === "completed" && !matter.reviewed) {
        youBullets.push("Matter completed — not marked reviewed");
      }
      for (const d of unadopted.slice(0, 4)) {
        youBullets.push(`${getDocumentTypeLabel(d.type)} not yet adopted`);
      }
      for (const a of solicitorActions.slice(0, 5)) {
        youBullets.push(formatActionBullet(a));
      }
      for (const u of openUndertakings.slice(0, 3)) {
        const tag = dueTag(u.deadline, now);
        const wording = (u.wording || "Undertaking").trim().slice(0, 80);
        youBullets.push(tag ? `Undertaking ${tag} — ${wording}` : `Undertaking — ${wording}`);
      }

      const clientBullets = clientActions.slice(0, 6).map(formatActionBullet);

      const sections: VoiceAskSection[] = [];
      if (youBullets.length) {
        sections.push({ title: "You (solicitor)", bullets: youBullets });
      }
      if (clientBullets.length) {
        sections.push({ title: "Client", bullets: clientBullets });
      }

      const draftOnly =
        actions.some((a) => (a.status || "").toLowerCase() === "draft" && !a.completed) &&
        openApproved.length === 0;

      if (sections.length === 0) {
        return {
          headline: "Nothing outstanding on this matter from the approved checklist.",
          detail: draftOnly
            ? "There are draft action items not yet approved — review obligations if needed."
            : matter
              ? labelCase(matter)
              : undefined,
          actions: [
            { label: "Show obligations", path: `/case/${activeCaseId}?section=obligations` },
            { label: "Show documents", path: `/case/${activeCaseId}?section=documents` },
          ],
        };
      }

      const clientPrompt =
        clientOverdueOrSoon.length > 0
          ? `${clientOverdueOrSoon.length} client item${clientOverdueOrSoon.length === 1 ? "" : "s"} due soon or overdue — good moment for a friendly chase.`
          : clientBullets.length > 0
            ? "Client still has open items on the file."
            : undefined;

      const actionsOut: VoiceAskAction[] = [
        { label: "Show obligations", path: `/case/${activeCaseId}?section=obligations` },
      ];
      if (unadopted.length) {
        actionsOut.unshift({
          label: "Open for adoption",
          path: `/case/${activeCaseId}?tab=attendance`,
        });
      }
      if (clientBullets.length) {
        actionsOut.push({
          label: "Remind client",
          path: `/case/${activeCaseId}?section=obligations`,
        });
      }

      return {
        headline: "Outstanding on this matter",
        detail: [matter ? labelCase(matter) : null, clientPrompt].filter(Boolean).join(" · ") || undefined,
        sections,
        actions: actionsOut,
      };
    }

    default:
      return {
        headline: "I didn’t recognise that question.",
        actions: [{ label: "Go to dashboard", path: "/" }],
      };
  }
}

async function answerMatterQa(
  activeCaseId: string | null,
  question: string,
): Promise<VoiceAskAnswer> {
  if (!activeCaseId) {
    return {
      headline: "Open a matter first, then ask about what’s on the file.",
      detail: "Example: open the case, then ask “What was agreed on disclosure?”",
      actions: [{ label: "Go to dashboard", path: "/" }],
    };
  }

  const q = question.trim();
  if (q.length < 3) {
    return {
      headline: "Ask a fuller question about this matter’s file.",
      actions: [
        { label: "Show transcript", path: `/case/${activeCaseId}?tab=transcript` },
        { label: "Show attendance note", path: `/case/${activeCaseId}?tab=attendance` },
      ],
    };
  }

  const res = await fetch(`/api/cases/${activeCaseId}/ask`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: q }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Matter ask failed");
  }

  const data = (await res.json()) as {
    answer: string;
    refused?: boolean;
    citations?: Array<{
      source: "transcript" | "attendance_note" | "client_letter";
      label: string;
      timestampMs?: number;
      excerpt?: string;
    }>;
  };

  const citations: VoiceAskCitation[] = (data.citations || []).map((c) => {
    if (c.source === "transcript") {
      const params = new URLSearchParams({ tab: "transcript" });
      if (typeof c.timestampMs === "number") {
        params.set("timestamp", String(c.timestampMs));
      }
      return {
        source: c.source,
        label: c.label || "Transcript",
        path: `/case/${activeCaseId}?${params.toString()}`,
        excerpt: c.excerpt,
      };
    }
    if (c.source === "attendance_note") {
      return {
        source: c.source,
        label: c.label || "Attendance note",
        path: `/case/${activeCaseId}?tab=attendance`,
        excerpt: c.excerpt,
      };
    }
    return {
      source: c.source,
      label: c.label || "Client letter",
      path: `/case/${activeCaseId}?tab=summary`,
      excerpt: c.excerpt,
    };
  });

  return {
    headline: data.answer,
    detail: data.refused
      ? "File assistant only — not legal advice."
      : "Grounded in this matter’s transcript and notes.",
    citations,
    actions: [
      { label: "Open transcript", path: `/case/${activeCaseId}?tab=transcript` },
      { label: "Open attendance note", path: `/case/${activeCaseId}?tab=attendance` },
    ],
  };
}
