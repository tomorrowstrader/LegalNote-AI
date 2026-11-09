import { describe, expect, it } from "vitest";
import {
  groupMatters,
  isRecoveredRecordingCase,
  matterFlag,
  matterStatus,
  sortMatters,
  type MatterListItem,
} from "./matterList";

function item(overrides: Partial<MatterListItem> = {}): MatterListItem {
  return {
    id: "m1",
    title: "Reeve v Reeve",
    clientName: "Adam Reeve",
    clientId: "c1",
    matterReference: "RV-001",
    status: "pending",
    priority: "normal",
    reviewed: false,
    archived: false,
    deadline: null,
    createdAt: "2026-11-01T10:00:00Z",
    ...overrides,
  };
}

const recovered = (overrides: Partial<MatterListItem> = {}) =>
  item({
    id: "r1",
    title: "Recovered Recording - 08/11/2026",
    clientName: "Unknown Client",
    clientId: null,
    matterReference: "REC-AB12CD34",
    ...overrides,
  });

describe("isRecoveredRecordingCase", () => {
  it("recognises an unclaimed recovered recording", () => {
    expect(isRecoveredRecordingCase(recovered())).toBe(true);
  });

  it("treats it as a matter once a client is linked", () => {
    expect(isRecoveredRecordingCase(recovered({ clientId: "c9" }))).toBe(false);
  });

  it("treats it as a matter once the client name or reference is changed", () => {
    expect(isRecoveredRecordingCase(recovered({ clientName: "Karen Whitfield" }))).toBe(false);
    expect(isRecoveredRecordingCase(recovered({ matterReference: "KW-7" }))).toBe(false);
  });

  it("does not catch a real matter for a client called Unknown Client", () => {
    expect(isRecoveredRecordingCase(item({ clientName: "Unknown Client", clientId: null }))).toBe(false);
  });
});

describe("groupMatters", () => {
  it("keeps closed matters, open matters and recovered recordings apart", () => {
    const groups = groupMatters([
      item({ id: "open" }),
      item({ id: "closed", archived: true }),
      recovered({ id: "rec" }),
      recovered({ id: "rec-closed", archived: true }),
    ]);
    expect(groups.open.map((m) => m.id)).toEqual(["open"]);
    expect(groups.recovered.map((m) => m.id)).toEqual(["rec"]);
    expect(groups.closed.map((m) => m.id)).toEqual(["closed", "rec-closed"]);
  });
});

describe("matterStatus", () => {
  it("says Signed off once reviewed, whatever the processing status", () => {
    expect(matterStatus({ status: "completed", reviewed: true })).toEqual({ label: "Signed off", tone: "done" });
  });

  it("does not call a finished but unreviewed matter complete", () => {
    expect(matterStatus({ status: "completed", reviewed: false })).toEqual({
      label: "Ready to review",
      tone: "attention",
    });
  });

  it("maps the other statuses", () => {
    expect(matterStatus({ status: "processing", reviewed: false }).label).toBe("Processing");
    expect(matterStatus({ status: "review_required", reviewed: false }).label).toBe("Needs review");
    expect(matterStatus({ status: "failed", reviewed: false }).tone).toBe("error");
    expect(matterStatus({ status: "pending", reviewed: false }).label).toBe("Pending");
  });
});

describe("matterFlag", () => {
  const now = new Date("2026-11-09T09:00:00Z");

  it("flags a passed deadline as overdue", () => {
    expect(matterFlag(item({ deadline: "2026-07-23T00:00:00Z" }), now)).toBe("overdue");
  });

  it("does not flag signed-off or closed matters", () => {
    expect(matterFlag(item({ deadline: "2026-07-23T00:00:00Z", reviewed: true }), now)).toBeNull();
    expect(matterFlag(item({ deadline: "2026-07-23T00:00:00Z", archived: true }), now)).toBeNull();
  });

  it("flags urgent and soon priorities, and nothing for normal", () => {
    expect(matterFlag(item({ priority: "urgent" }), now)).toBe("urgent");
    expect(matterFlag(item({ priority: "deadline-soon" }), now)).toBe("soon");
    expect(matterFlag(item(), now)).toBeNull();
  });
});

describe("sortMatters", () => {
  const a = item({ id: "a", clientName: "karen Whitfield", createdAt: "2026-11-03T00:00:00Z", deadline: null });
  const b = item({ id: "b", clientName: "Adam Reeve", createdAt: "2026-11-01T00:00:00Z", deadline: "2026-12-01T00:00:00Z" });
  const c = item({ id: "c", clientName: "Tyanna Davey", createdAt: "2026-11-05T00:00:00Z", deadline: "2026-11-20T00:00:00Z" });

  it("sorts newest first by default", () => {
    expect(sortMatters([a, b, c], "newest").map((m) => m.id)).toEqual(["c", "a", "b"]);
  });

  it("sorts by client ignoring case", () => {
    expect(sortMatters([a, b, c], "client").map((m) => m.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts by deadline with undated matters last", () => {
    expect(sortMatters([a, b, c], "deadline").map((m) => m.id)).toEqual(["c", "b", "a"]);
  });

  it("does not change the array it was given", () => {
    const input = [a, b, c];
    sortMatters(input, "client");
    expect(input.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });
});
