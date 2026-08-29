import { describe, expect, it } from "vitest";
import {
  documentMatchesSharedType,
  getUnadoptedSharedDocumentTypes,
} from "./shareDocumentTypes";

describe("shareDocumentTypes", () => {
  it("matches client letter aliases", () => {
    expect(documentMatchesSharedType("client_letter", "summary")).toBe(true);
    expect(documentMatchesSharedType("attendance_note", "meeting_notes")).toBe(true);
  });

  it("flags unadopted selected documents", () => {
    const unadopted = getUnadoptedSharedDocumentTypes(
      ["summary", "attendance_note"],
      [
        { type: "client_letter", status: "draft", isActive: true },
        { type: "attendance_note", status: "approved", isActive: true },
      ],
    );
    expect(unadopted).toEqual(["summary"]);
  });
});
