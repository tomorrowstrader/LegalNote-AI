import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { Building2, CheckCircle2, XCircle, Clock } from "lucide-react";

interface InviteDetails {
  email: string;
  firmName: string;
  suggestedRole: string | null;
  suggestedCustomRoleLabel: string | null;
  expiresAt: string;
}

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [accepted, setAccepted] = useState(false);

  const { data: invite, isLoading, error } = useQuery<InviteDetails>({
    queryKey: ["/api/invite", token],
    queryFn: () => fetch(`/api/invite/${token}`).then(r => {
      if (!r.ok) return r.json().then(d => Promise.reject(new Error(d.message ?? "Invalid invitation")));
      return r.json();
    }),
    enabled: !!token,
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/invite/${token}/accept`, {}),
    onSuccess: () => {
      setAccepted(true);
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      // Redirect to login, then back here after auth
      const returnUrl = encodeURIComponent(`/invite/accept/${token}`);
      setLocation(`/login?returnTo=${returnUrl}`);
    }
  }, [authLoading, isAuthenticated, token, setLocation]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Request submitted</h2>
            <p className="text-muted-foreground mb-2">
              Your request to join <strong>{invite?.firmName ?? "the firm"}</strong> has been received.
            </p>
            <p className="text-muted-foreground text-sm mb-6">
              A firm administrator will review and activate your account. You will have full access once approved.
            </p>
            <Button onClick={() => setLocation("/")} data-testid="button-go-to-dashboard">
              Continue to LegalNote
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invitation not found</h2>
            <p className="text-muted-foreground mb-6">
              {(error as Error).message || "This invitation link is invalid or has expired."}
            </p>
            <Button variant="outline" onClick={() => setLocation("/")} data-testid="button-go-home">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invite) return null;

  const PRIMARY_ROLES: Record<string, string> = {
    managing_partner: "Managing Partner",
    partner: "Partner",
    legal_director: "Legal Director",
    senior_solicitor: "Senior Solicitor",
    solicitor: "Solicitor",
    associate: "Associate",
    trainee_solicitor: "Trainee Solicitor",
    legal_executive: "Legal Executive (CILEx)",
    consultant: "Consultant Solicitor",
    paralegal: "Paralegal",
    licensed_conveyancer: "Licensed Conveyancer",
    costs_lawyer: "Costs Lawyer",
    practice_manager: "Practice Manager",
    compliance_manager: "Compliance Manager",
    accounts_finance: "Accounts and Finance",
    legal_secretary: "Legal Secretary",
    firm_admin_only: "Firm Administrator",
    custom: "Custom",
  };

  const roleLabel = invite.suggestedRole
    ? (invite.suggestedRole === "custom"
      ? invite.suggestedCustomRoleLabel || "Custom"
      : PRIMARY_ROLES[invite.suggestedRole] ?? invite.suggestedRole)
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md" data-testid="card-invite-accept">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-8 w-8 text-muted-foreground" />
            <div>
              <CardTitle>Team Invitation</CardTitle>
              <CardDescription>You have been invited to join a firm</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Firm</p>
              <p className="font-medium" data-testid="text-invite-firm">{invite.firmName}</p>
            </div>
            {roleLabel && (
              <div>
                <p className="text-sm text-muted-foreground">Suggested Role</p>
                <Badge variant="secondary" data-testid="text-invite-role">{roleLabel}</Badge>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Expires {new Date(invite.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
              data-testid="button-accept-invite"
            >
              {acceptMutation.isPending ? "Accepting..." : "Accept Invitation"}
            </Button>
            <Button variant="outline" onClick={() => setLocation("/")} data-testid="button-decline-invite">
              Decline
            </Button>
          </div>

          {acceptMutation.isError && (
            <p className="text-sm text-destructive">
              {(acceptMutation.error as Error)?.message || "Failed to accept invitation. Please try again."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
