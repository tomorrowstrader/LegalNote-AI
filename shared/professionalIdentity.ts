import { PRIMARY_ROLE_LABELS, type PrimaryRole } from "./schema";

/** How a client should be told who sent a link, email, or text. Never a job title. */
export function clientFacingSender(input: {
  firmName?: string | null;
  personName?: string | null;
}): { phrase: string; capitalised: string } {
  const firm = input.firmName?.trim();
  if (firm) return { phrase: firm, capitalised: firm };
  const person = input.personName?.trim();
  if (person) return { phrase: person, capitalised: person };
  return {
    phrase: "the person who sent this",
    capitalised: "The person who sent this",
  };
}

/**
 * Role title for a note header. Uses the team role only.
 * The legacy users.role default of "solicitor" is not a title.
 */
export function noteRoleTitle(user: {
  primaryRole?: string | null;
  customRoleLabel?: string | null;
}): string | null {
  if (user.primaryRole === "custom") {
    const custom = user.customRoleLabel?.trim();
    return custom || null;
  }
  if (user.primaryRole && user.primaryRole in PRIMARY_ROLE_LABELS) {
    return PRIMARY_ROLE_LABELS[user.primaryRole as PrimaryRole];
  }
  return null;
}

/** Label for the professional's side of a client-matter action list. */
export function professionalActionLabel(title: string | null | undefined, personName?: string | null): string {
  const role = title?.trim();
  if (role && /solicitor/i.test(role)) return "Solicitor";
  if (role) return role;
  const name = personName?.trim();
  if (name) return name;
  return "Fee earner";
}
