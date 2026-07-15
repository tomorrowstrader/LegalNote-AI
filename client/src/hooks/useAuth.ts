import { useQuery } from "@tanstack/react-query";

export interface User {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  /** ISO timestamp when the user confirmed their display name (locks further self-edits). */
  displayNameConfirmedAt?: string | null;
  profileImageUrl?: string;
  isAdmin?: boolean;
  waitlistStatus?: "pending" | "approved" | null;
  complianceThread?: boolean;
  hourlyRate?: string;
  firmId?: string | null;
  primaryRole?: string | null;
  customRoleLabel?: string | null;
  regulatoryDesignations?: string[];
  inviteStatus?: string | null;
  role?: string;
  accessAllowed?: boolean;
  /** How this account authenticated (from auth_identities). */
  authProviders?: ("google" | "microsoft")[];
  /** Calendar to recommend during integrations onboarding. */
  preferredCalendarProvider?: "google" | "outlook";
}

export function useAuth() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const res = await fetch("/api/auth/user", { credentials: "include" });
      if (res.status === 401) return null;
      if (res.status === 429) {
        throw new Error("429: Too many requests");
      }
      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json();
    },
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.startsWith("429:")) {
        return failureCount < 3;
      }
      return false;
    },
    retryDelay: 2000,
  });

  const designations = user?.regulatoryDesignations ?? [];
  const role = user?.role || 'solicitor';
  const isAdmin = user?.isAdmin ?? false;

  const isFirmAdmin = designations.includes("is_firm_admin");
  const isCOLP = isAdmin || designations.includes("is_colp") || role === 'colp';
  const isCOFA = designations.includes("is_cofa");
  const isMLRO = designations.includes("is_mlro");

  // Supervisor: designation OR role-based
  const isSupervisor = isAdmin || designations.includes("is_supervisor") || ['supervisor', 'partner', 'colp'].includes(role);

  // COLP dashboard access: COLP/partner/admin by role, or firm admin designation, or COFA, or managing partner
  const isColp = isCOLP;
  const isPartner = isAdmin || role === 'partner' || role === 'colp';
  const canAccessFirmCompliance = isAdmin || isFirmAdmin || isCOFA || ['colp', 'partner', 'admin', 'managing_partner'].includes(role) || designations.includes("is_colp") || user?.primaryRole === 'managing_partner';

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin,
    isWaitlisted: !isAdmin && user?.waitlistStatus === "pending",
    isFirmAdmin,
    isCOLP,
    isCOFA,
    isMLRO,
    isSupervisor,
    isColp,
    isPartner,
    canAccessFirmCompliance,
    role,
  };
}
