import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db", () => ({
  db: {},
  pool: {},
}));

import { MemStorage } from "./storage";
import { getFirmProfileForCase, getFirmProfileForUser, resolveCaseFirmId } from "./firmBranding";
import { insertFirmProfileSchema, type InsertFirmProfile, type User } from "@shared/schema";

const FIRM_A = "firm-a";
const FIRM_B = "firm-b";

function profile(firmName: string, extra: Partial<InsertFirmProfile> = {}): InsertFirmProfile {
  return insertFirmProfileSchema.parse({ firmName, ...extra });
}

describe("firm profiles are scoped per firm", () => {
  let mem: MemStorage;
  let users: Map<string, Pick<User, "id" | "firmId">>;
  let store: Parameters<typeof getFirmProfileForCase>[1];

  beforeEach(async () => {
    mem = new MemStorage();
    users = new Map([
      ["user-a", { id: "user-a", firmId: FIRM_A }],
      ["user-b", { id: "user-b", firmId: FIRM_B }],
      ["user-no-firm", { id: "user-no-firm", firmId: null }],
    ]);
    store = {
      getUser: async (id: string) => users.get(id) as User | undefined,
      getFirmProfile: (firmId) => mem.getFirmProfile(firmId),
    };
    await mem.upsertFirmProfile(FIRM_A, profile("Alpha Solicitors", { sraNumber: "111111", paymentSafetyNotice: "Alpha notice" }));
  });

  it("a save by firm B leaves firm A's letterhead untouched", async () => {
    await mem.upsertFirmProfile(FIRM_B, profile("Beta Law", { sraNumber: "222222" }));
    await mem.patchFirmProfileLogoUrl(FIRM_B, "/api/firm-profile/logo/serve?key=public/logos/b.png", "user-b");

    const a = await mem.getFirmProfile(FIRM_A);
    const b = await mem.getFirmProfile(FIRM_B);
    expect(a?.firmName).toBe("Alpha Solicitors");
    expect(a?.sraNumber).toBe("111111");
    expect(a?.logoUrl ?? null).toBeNull();
    expect(a?.paymentSafetyNotice).toBe("Alpha notice");
    expect(b?.firmName).toBe("Beta Law");
    expect(b?.paymentSafetyNotice ?? null).toBeNull();
  });

  it("a user with no firm, or an unknown firm, gets no profile at all", async () => {
    expect(await getFirmProfileForUser("user-no-firm", store)).toBeUndefined();
    expect(await mem.getFirmProfile(null)).toBeUndefined();
    expect(await mem.getFirmProfile(undefined)).toBeUndefined();
    expect(await mem.getFirmProfile("firm-unknown")).toBeUndefined();
  });

  it("each user sees only their own firm's profile", async () => {
    await mem.upsertFirmProfile(FIRM_B, profile("Beta Law"));
    expect((await getFirmProfileForUser("user-a", store))?.firmName).toBe("Alpha Solicitors");
    expect((await getFirmProfileForUser("user-b", store))?.firmName).toBe("Beta Law");
  });

  it("a matter is branded by its own firm, else its creator's firm, else nothing", async () => {
    await mem.upsertFirmProfile(FIRM_B, profile("Beta Law"));

    // Case firm wins over the creator's current firm
    expect((await getFirmProfileForCase({ firmId: FIRM_B, createdBy: "user-a" }, store))?.firmName).toBe("Beta Law");
    // No case firm: follow the creator
    expect(await resolveCaseFirmId({ firmId: null, createdBy: "user-a" }, store)).toBe(FIRM_A);
    expect((await getFirmProfileForCase({ firmId: null, createdBy: "user-a" }, store))?.firmName).toBe("Alpha Solicitors");
    // Neither: no branding, and never firm A's
    expect(await getFirmProfileForCase({ firmId: null, createdBy: "user-no-firm" }, store)).toBeUndefined();
    expect(await getFirmProfileForCase(null, store)).toBeUndefined();
  });

  it("a compliance code set for one firm is stored and only verifies for that firm", async () => {
    const bcrypt = await import("bcrypt");
    await mem.setFirmComplianceCode(FIRM_B, await bcrypt.hash("beta-code", 4), "user-b");

    expect((await mem.getFirmProfile(FIRM_B))?.complianceCodeHash).toBeTruthy();
    expect(await mem.verifyFirmComplianceCode(FIRM_B, "beta-code")).toBe(true);
    expect(await mem.verifyFirmComplianceCode(FIRM_A, "beta-code")).toBe(false);
    // Setting the code did not touch firm A's letterhead
    expect((await mem.getFirmProfile(FIRM_A))?.firmName).toBe("Alpha Solicitors");
  });

  it("the public badge resolves by slug only when that firm enabled it", async () => {
    await mem.upsertFirmProfile(FIRM_B, profile("Beta Law", { complianceBadgeEnabled: true, complianceBadgeSlug: "beta-law" }));
    await mem.upsertFirmProfile(FIRM_A, profile("Alpha Solicitors", { complianceBadgeEnabled: false, complianceBadgeSlug: "alpha" }));

    expect((await mem.getFirmProfileByBadgeSlug("beta-law"))?.firmName).toBe("Beta Law");
    expect(await mem.getFirmProfileByBadgeSlug("alpha")).toBeUndefined();
  });
});

describe("insertFirmProfileSchema", () => {
  it("drops a firm id or compliance code sent in the request body", () => {
    const parsed = insertFirmProfileSchema.parse({
      firmName: "Alpha Solicitors",
      firmId: "firm-b",
      complianceCodeHash: "attacker-chosen-hash",
      complianceCodeSetBy: "user-x",
    }) as Record<string, unknown>;
    expect(parsed.firmId).toBeUndefined();
    expect(parsed.complianceCodeHash).toBeUndefined();
    expect(parsed.complianceCodeSetBy).toBeUndefined();
  });
});
