import { describe, expect, it } from "vitest";
import { clientFacingSender, noteRoleTitle, professionalActionLabel } from "./professionalIdentity";

describe("clientFacingSender", () => {
  it("prefers the firm name over a job title", () => {
    expect(clientFacingSender({ firmName: "North & Co", personName: "Ada" }).phrase).toBe("North & Co");
  });

  it("uses the person when the firm is unset", () => {
    expect(clientFacingSender({ personName: "Ada Khan" }).capitalised).toBe("Ada Khan");
  });

  it("does not invent a solicitor", () => {
    expect(clientFacingSender({}).phrase).toBe("the person who sent this");
  });
});

describe("noteRoleTitle", () => {
  it("does not treat a missing team role as solicitor", () => {
    expect(noteRoleTitle({ primaryRole: null })).toBeNull();
  });

  it("uses a barrister role when set", () => {
    expect(noteRoleTitle({ primaryRole: "barrister" })).toBe("Barrister");
  });
});

describe("professionalActionLabel", () => {
  it("keeps Solicitor only for a solicitor role", () => {
    expect(professionalActionLabel("Senior Solicitor")).toBe("Solicitor");
    expect(professionalActionLabel("Practice Manager")).toBe("Practice Manager");
    expect(professionalActionLabel(null, "Priya Shah")).toBe("Priya Shah");
  });
});
