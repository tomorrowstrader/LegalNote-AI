/**
 * Rules for the Matters list: which matters are open, closed, or recovered
 * recordings still waiting for a matter, how each one's status reads in plain
 * words, and how the list sorts.
 */

export interface MatterListItem {
  id: string;
  title: string;
  clientName: string;
  clientId?: string | null;
  matterReference?: string | null;
  status: string;
  priority?: string | null;
  reviewed: boolean;
  archived: boolean;
  deadline?: Date | string | null;
  createdAt: Date | string;
}

/** The placeholders the upload recovery gives a recording that did not finish saving. */
export const RECOVERED_CLIENT_NAME = "Unknown Client";
export const RECOVERED_REFERENCE_PREFIX = "REC-";

/**
 * A recovered recording that nobody has claimed yet. Once someone links a
 * client, renames the client, or changes the reference, it is a matter like
 * any other.
 */
export function isRecoveredRecordingCase(item: MatterListItem): boolean {
  return (
    !item.clientId &&
    item.clientName === RECOVERED_CLIENT_NAME &&
    (item.matterReference ?? "").startsWith(RECOVERED_REFERENCE_PREFIX)
  );
}

export interface MatterGroups<T extends MatterListItem> {
  open: T[];
  closed: T[];
  /** Open recovered recordings. They are kept out of `open`. */
  recovered: T[];
}

export function groupMatters<T extends MatterListItem>(items: T[]): MatterGroups<T> {
  const groups: MatterGroups<T> = { open: [], closed: [], recovered: [] };
  for (const item of items) {
    if (item.archived) groups.closed.push(item);
    else if (isRecoveredRecordingCase(item)) groups.recovered.push(item);
    else groups.open.push(item);
  }
  return groups;
}

export type MatterStatusTone = "neutral" | "working" | "attention" | "done" | "error";

export interface MatterStatus {
  label: string;
  tone: MatterStatusTone;
}

/** The single status a solicitor sees for a matter. */
export function matterStatus(item: Pick<MatterListItem, "status" | "reviewed">): MatterStatus {
  if (item.reviewed) return { label: "Signed off", tone: "done" };
  switch (item.status) {
    case "processing":
      return { label: "Processing", tone: "working" };
    case "review_required":
      return { label: "Needs review", tone: "attention" };
    case "completed":
      return { label: "Ready to review", tone: "attention" };
    case "failed":
      return { label: "Failed", tone: "error" };
    case "pending":
      return { label: "Pending", tone: "neutral" };
    default:
      return { label: "Unknown", tone: "neutral" };
  }
}

export type MatterFlag = "overdue" | "urgent" | "soon";

export const MATTER_FLAG_LABELS: Record<MatterFlag, string> = {
  overdue: "Overdue",
  urgent: "Urgent",
  soon: "Soon",
};

/** An urgency flag, shown only when there is something to flag. */
export function matterFlag(
  item: Pick<MatterListItem, "reviewed" | "archived" | "deadline" | "priority">,
  now: Date = new Date(),
): MatterFlag | null {
  if (item.reviewed || item.archived) return null;
  if (item.deadline && new Date(item.deadline).getTime() < now.getTime()) return "overdue";
  if (item.priority === "urgent") return "urgent";
  if (item.priority === "deadline-soon") return "soon";
  return null;
}

export type MatterSort = "newest" | "client" | "deadline";

export const MATTER_SORT_LABELS: Record<MatterSort, string> = {
  newest: "Newest first",
  client: "Client A–Z",
  deadline: "Deadline",
};

function time(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Returns a new array. Matters without a deadline go last when sorting by deadline. */
export function sortMatters<T extends MatterListItem>(items: T[], sort: MatterSort): T[] {
  const copy = [...items];
  const newest = (a: T, b: T) => (time(b.createdAt) ?? 0) - (time(a.createdAt) ?? 0);
  if (sort === "client") {
    return copy.sort(
      (a, b) =>
        a.clientName.localeCompare(b.clientName, "en-GB", { sensitivity: "base" }) || newest(a, b),
    );
  }
  if (sort === "deadline") {
    return copy.sort((a, b) => {
      const da = time(a.deadline);
      const db = time(b.deadline);
      if (da === null && db === null) return newest(a, b);
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db || newest(a, b);
    });
  }
  return copy.sort(newest);
}
