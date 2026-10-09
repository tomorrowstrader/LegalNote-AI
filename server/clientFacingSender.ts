import { clientFacingSender } from "@shared/professionalIdentity";
import { storage } from "./storage";

/** Firm name, else the user's name, else a title-free fallback. */
export async function senderLabelForUser(userId: string): Promise<{ phrase: string; capitalised: string }> {
  const user = await storage.getUser(userId);
  const firm = user?.firmId
    ? await storage.getFirmProfile(user.firmId)
    : await storage.getFirmProfile();
  const personName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || null;
  return clientFacingSender({
    firmName: firm?.firmName,
    personName,
  });
}
