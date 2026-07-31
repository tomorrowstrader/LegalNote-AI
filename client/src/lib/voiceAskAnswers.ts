import { isPast } from "date-fns";
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

export interface VoiceAskAnswer {
  headline: string;
  detail?: string;
  bullets?: string[];
  actions?: VoiceAskAction[];
}

type CaseDoc = { type: string; status: string; isActive?: boolean | null };

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

async function fetchCaseActionItems(
  caseId: string,
): Promise<Array<{ status?: string; description?: string; title?: string }>> {
  const res = await fetch(`/api/cases/${caseId}/action-items`, { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
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
): Promise<VoiceAskAnswer> {
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

      const [docs, actions, cases] = await Promise.all([
        fetchCaseDocuments(activeCaseId),
        fetchCaseActionItems(activeCaseId),
        fetchCases(),
      ]);
      const matter = cases.find((c) => c.id === activeCaseId);
      const unadopted = docs.filter(
        (d) =>
          d.isActive !== false &&
          ["attendance_note", "meeting_notes", "summary", "client_letter", "client_care_letter"].includes(
            d.type,
          ) &&
          d.status !== "approved",
      );
      const openActions = actions.filter(
        (a) => a.status !== "completed" && a.status !== "done" && a.status !== "cancelled",
      );
      const overdue =
        matter?.deadline && isPast(new Date(matter.deadline)) && !matter.reviewed;

      const bullets: string[] = [];
      if (overdue) bullets.push("Deadline is overdue");
      if (matter && matter.status === "completed" && !matter.reviewed) {
        bullets.push("Matter is completed but not marked reviewed");
      }
      for (const d of unadopted.slice(0, 3)) {
        bullets.push(`${getDocumentTypeLabel(d.type)} not yet adopted`);
      }
      if (openActions.length) {
        bullets.push(
          `${openActions.length} open action item${openActions.length === 1 ? "" : "s"}`,
        );
      }

      if (bullets.length === 0) {
        return {
          headline: "Nothing outstanding on this matter from the file checklist.",
          detail: matter ? labelCase(matter) : undefined,
          actions: [
            { label: "Show documents", path: `/case/${activeCaseId}?section=documents` },
            { label: "Show obligations", path: `/case/${activeCaseId}?section=obligations` },
          ],
        };
      }

      return {
        headline: "Here’s what’s outstanding on this matter:",
        detail: matter ? labelCase(matter) : undefined,
        bullets,
        actions: [
          unadopted.length
            ? { label: "Open for adoption", path: `/case/${activeCaseId}?tab=attendance` }
            : { label: "Show obligations", path: `/case/${activeCaseId}?section=obligations` },
          { label: "Show documents", path: `/case/${activeCaseId}?section=documents` },
        ],
      };
    }
  }
}
