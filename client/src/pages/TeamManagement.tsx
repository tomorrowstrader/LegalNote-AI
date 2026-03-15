import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Shield, Mail, Calendar, Briefcase } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { format } from "date-fns";

interface UserStats {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  totalCases: number;
  successfulCases: number;
  failedCases: number;
  totalCostsUSD: number;
  lastActivity: string | null;
  joinedDate: string;
  isAdmin?: boolean;
}

export default function TeamManagement() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      setLocation("/");
    }
  }, [authLoading, isAdmin, setLocation]);

  const { data: teamMembers, isLoading } = useQuery<UserStats[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAdmin === true,
  });

  if (authLoading || !isAdmin) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-5xl mx-auto">
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-72 mb-8" />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-5xl mx-auto">
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-72 mb-8" />
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold mb-2 flex items-center gap-2" data-testid="heading-team">
            <Users className="w-7 h-7 text-muted-foreground" />
            Team Management
          </h1>
          <p className="text-muted-foreground">
            View and manage firm members
          </p>
        </div>

        <Card data-testid="card-team-list">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Firm Members
              </span>
              {teamMembers && (
                <Badge variant="outline">{teamMembers.length} member{teamMembers.length !== 1 ? "s" : ""}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!teamMembers || teamMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="text-no-members">
                <Users className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">No team members found</p>
                <p className="text-xs text-muted-foreground">Team members will appear here once they sign up.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {teamMembers.map((member) => {
                  const displayName = member.firstName && member.lastName
                    ? `${member.firstName} ${member.lastName}`
                    : member.email || member.userId.slice(0, 8);

                  return (
                    <div
                      key={member.userId}
                      className="flex items-center gap-4 p-4 rounded-md border bg-card"
                      data-testid={`team-member-${member.userId}`}
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                        {(member.firstName?.[0] || member.email?.[0] || "?").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-medium" data-testid={`text-name-${member.userId}`}>
                            {displayName}
                          </span>
                          <Badge
                            variant={member.isAdmin ? "default" : "secondary"}
                            data-testid={`badge-role-${member.userId}`}
                          >
                            {member.isAdmin ? "Admin" : "Solicitor"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          {member.email && (
                            <span className="flex items-center gap-1" data-testid={`text-email-${member.userId}`}>
                              <Mail className="w-3 h-3" />
                              {member.email}
                            </span>
                          )}
                          <span className="flex items-center gap-1" data-testid={`text-joined-${member.userId}`}>
                            <Calendar className="w-3 h-3" />
                            Joined {format(new Date(member.joinedDate), "d MMM yyyy")}
                          </span>
                          <span className="flex items-center gap-1" data-testid={`text-cases-${member.userId}`}>
                            <Briefcase className="w-3 h-3" />
                            {member.totalCases} case{member.totalCases !== 1 ? "s" : ""}
                          </span>
                          {member.lastActivity && (
                            <span className="text-muted-foreground/70">
                              Last active {format(new Date(member.lastActivity), "d MMM yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
