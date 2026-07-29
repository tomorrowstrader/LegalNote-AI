import { describe, expect, it } from "vitest";
import {
  isClientMatterKind,
  normalizeMatterKind,
  partyLabelForMatterKind,
  requiresClientConsent,
  requiresClientForMatter,
  requiresParticipantConsent,
  requiresSealedConsentForProcessing,
} from "./matterKinds";

describe("matterKinds", () => {
  it("defaults unknown values to client", () => {
    expect(normalizeMatterKind(undefined)).toBe("client");
    expect(normalizeMatterKind("nope")).toBe("client");
    expect(normalizeMatterKind("internal")).toBe("internal");
  });

  it("collapses legacy firm into internal", () => {
    expect(normalizeMatterKind("firm")).toBe("internal");
    expect(isClientMatterKind("firm")).toBe(false);
    expect(requiresClientForMatter("firm")).toBe(false);
    expect(requiresClientConsent("firm")).toBe(false);
    expect(partyLabelForMatterKind("firm")).toBe("Non-client");
  });

  it("requires a client only for client matters", () => {
    expect(requiresClientForMatter("client")).toBe(true);
    expect(requiresClientForMatter("internal")).toBe(false);
    expect(isClientMatterKind(null)).toBe(true);
  });

  it("requires client consent only for client matters", () => {
    expect(requiresClientConsent("client")).toBe(true);
    expect(requiresClientConsent("internal")).toBe(false);
  });

  it("requires participant consent for non-client meetings with external attendees", () => {
    expect(requiresParticipantConsent("internal", true)).toBe(true);
    expect(requiresParticipantConsent("internal", false)).toBe(false);
    expect(requiresParticipantConsent("client", true)).toBe(false);
    expect(requiresSealedConsentForProcessing("internal", false)).toBe(false);
    expect(requiresSealedConsentForProcessing("internal", true)).toBe(true);
    expect(requiresSealedConsentForProcessing("client", false)).toBe(true);
  });

  it("provides display party labels for non-client matters", () => {
    expect(partyLabelForMatterKind("internal")).toBe("Non-client");
  });
});
