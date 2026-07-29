import { describe, expect, it } from "vitest";
import {
  isClientMatterKind,
  normalizeMatterKind,
  partyLabelForMatterKind,
  requiresClientForMatter,
} from "./matterKinds";

describe("matterKinds", () => {
  it("defaults unknown values to client", () => {
    expect(normalizeMatterKind(undefined)).toBe("client");
    expect(normalizeMatterKind("nope")).toBe("client");
    expect(normalizeMatterKind("internal")).toBe("internal");
  });

  it("requires a client only for client matters", () => {
    expect(requiresClientForMatter("client")).toBe(true);
    expect(requiresClientForMatter("internal")).toBe(false);
    expect(requiresClientForMatter("firm")).toBe(false);
    expect(isClientMatterKind(null)).toBe(true);
  });

  it("provides display party labels for non-client matters", () => {
    expect(partyLabelForMatterKind("internal")).toBe("Internal");
    expect(partyLabelForMatterKind("firm")).toBe("Firm");
  });
});
