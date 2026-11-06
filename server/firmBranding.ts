import type { Case, FirmProfile } from "@shared/schema";
import { storage, type IStorage } from "./storage";

type FirmLookupStorage = Pick<IStorage, "getUser" | "getFirmProfile">;

/**
 * The firm a matter belongs to: the case's own firm, else its creator's current firm.
 * Null means no firm, and callers must then use no firm branding - never another firm's.
 */
export async function resolveCaseFirmId(
  caseRecord: Pick<Case, "firmId" | "createdBy"> | null | undefined,
  store: FirmLookupStorage = storage,
): Promise<string | null> {
  if (!caseRecord) return null;
  if (caseRecord.firmId) return caseRecord.firmId;
  const creator = await store.getUser(caseRecord.createdBy);
  return creator?.firmId ?? null;
}

/** Letterhead and preferences for the firm that owns this matter. */
export async function getFirmProfileForCase(
  caseRecord: Pick<Case, "firmId" | "createdBy"> | null | undefined,
  store: FirmLookupStorage = storage,
): Promise<FirmProfile | undefined> {
  return store.getFirmProfile(await resolveCaseFirmId(caseRecord, store));
}

/** Letterhead and preferences for the user's own firm. */
export async function getFirmProfileForUser(
  userId: string | null | undefined,
  store: FirmLookupStorage = storage,
): Promise<FirmProfile | undefined> {
  if (!userId) return undefined;
  const user = await store.getUser(userId);
  return store.getFirmProfile(user?.firmId);
}
