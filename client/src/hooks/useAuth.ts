import { useQuery } from "@tanstack/react-query";

export interface User {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
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
}

export function useAuth() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
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

  // COLP dashboard access: COLP/partner/admin by role, or firm admin designation
  const isColp = isCOLP;
  const isPartner = isAdmin || role === 'partner' || role === 'colp';
  const canAccessFirmCompliance = isAdmin || isFirmAdmin || ['colp', 'partner', 'admin'].includes(role) || designations.includes("is_colp");

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
