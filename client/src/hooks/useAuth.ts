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
}

export function useAuth() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const designations = user?.regulatoryDesignations ?? [];

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.isAdmin ?? false,
    isWaitlisted: !user?.isAdmin && user?.waitlistStatus === "pending",
    isFirmAdmin: designations.includes("is_firm_admin"),
    isCOLP: designations.includes("is_colp"),
    isCOFA: designations.includes("is_cofa"),
    isMLRO: designations.includes("is_mlro"),
    isSupervisor: designations.includes("is_supervisor"),
  };
}
