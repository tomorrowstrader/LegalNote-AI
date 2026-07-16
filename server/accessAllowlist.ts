/**
 * Invite-only access allowlist (static env gate).
 * Prefer emails over provider subject IDs so Google and Microsoft for the same
 * person both match (Microsoft creates a different users.id).
 */

export function getAccessAllowlist(): Set<string> {
  const raw = process.env.ACCESS_ALLOWLIST || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAccessAllowlistEnforced(): boolean {
  return process.env.ACCESS_ALLOWLIST_ENFORCE === "true";
}

export function getAdminUserId(): string {
  return process.env.ADMIN_USER_ID || "48381245";
}

/**
 * LegalNote platform personnel (processor staff), distinct from firm-admin.
 * ADMIN_USER_ID is always included. Optional LEGALNOTE_PERSONNEL_USER_IDS
 * accepts a comma-separated list of additional staff user IDs.
 */
export function getLegalNotePersonnelUserIds(): Set<string> {
  const ids = new Set<string>([getAdminUserId()]);
  const raw = process.env.LEGALNOTE_PERSONNEL_USER_IDS || "";
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (id) ids.add(id);
  }
  return ids;
}

/** True only for LegalNote Technologies staff — not Controllers' firm-admins. */
export function isLegalNotePersonnel(userId: string): boolean {
  return getLegalNotePersonnelUserIds().has(userId);
}

/** Static allowlist / admin only — no DB lookups. */
export function isUserOnStaticAllowlist(userId: string, email?: string | null): boolean {
  if (userId === getAdminUserId()) return true;
  const allowlist = getAccessAllowlist();
  if (allowlist.has(userId.toLowerCase())) return true;
  const normalizedEmail = email?.trim().toLowerCase();
  return !!normalizedEmail && allowlist.has(normalizedEmail);
}

/**
 * Sync gate used when invite-only is off, or as a fast path when on.
 * When ENFORCE=true this is fail-closed for non-admin users not on the static list;
 * use resolveUserAccessAllowed for waitlist-approved / firm-member paths.
 */
export function isUserAccessAllowed(userId: string, email?: string | null): boolean {
  if (!isAccessAllowlistEnforced()) return true;
  return isUserOnStaticAllowlist(userId, email);
}
