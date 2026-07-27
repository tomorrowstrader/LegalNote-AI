import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Building2, Loader2, Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getApiErrorMessage } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

type EvaluationFirm = {
  id: string;
  name: string;
  seatLimit: number | null;
  isEvaluation: boolean;
  provisionedLeadEmail: string | null;
  provisionedLeadUserId: string | null;
  provisionedAt: string | null;
  evaluationEndsAt: string | null;
  createdAt: string;
  wasUpdate?: boolean;
};

type LoginInviteResult = {
  success: boolean;
  message: string;
  firmId: string;
  firmName: string;
  email: string;
  alreadyClaimed?: boolean;
};

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function AdminProvisionFirmPage() {
  const { toast } = useToast();
  const [firmName, setFirmName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [seatLimit, setSeatLimit] = useState("3");
  const [evaluationEndsAt, setEvaluationEndsAt] = useState("");
  const [inviteFirmId, setInviteFirmId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteEndsAt, setInviteEndsAt] = useState("");
  const [sendingFirmId, setSendingFirmId] = useState<string | null>(null);

  const { isLoading: accessLoading, error: accessError, data: firms = [] } = useQuery<EvaluationFirm[]>({
    queryKey: ["/api/admin/evaluation-firms"],
  });

  const provisionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<EvaluationFirm>("POST", "/api/admin/evaluation-firms", {
        firmName: firmName.trim(),
        leadEmail: leadEmail.trim(),
        seatLimit: Number(seatLimit),
        evaluationEndsAt: evaluationEndsAt || null,
      });
    },
    onSuccess: (firm) => {
      toast({
        title: firm.wasUpdate ? "Evaluation firm updated" : "Evaluation firm provisioned",
        description: firm.wasUpdate
          ? `${firm.name} details updated for ${firm.provisionedLeadEmail}. Use “Send login invite” below to email them again.`
          : `${firm.name} reserved for ${firm.provisionedLeadEmail}. They become firm lead on first login.`,
      });
      setFirmName("");
      setLeadEmail("");
      setSeatLimit("3");
      setEvaluationEndsAt("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/evaluation-firms"] });
    },
    onError: (error) => {
      toast({
        title: "Provision failed",
        description: getApiErrorMessage(error, "Could not provision evaluation firm."),
        variant: "destructive",
      });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (payload: {
      firmId?: string;
      email?: string;
      evaluationEndsAt?: string | null;
    }) => {
      return apiRequest<LoginInviteResult>(
        "POST",
        "/api/admin/evaluation-firms/send-login-invite",
        payload,
      );
    },
    onSuccess: (result) => {
      setSendingFirmId(null);
      toast({
        title: "Login invite sent",
        description: result.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/evaluation-firms"] });
    },
    onError: (error) => {
      setSendingFirmId(null);
      toast({
        title: "Invite failed",
        description: getApiErrorMessage(error, "Could not send login invite."),
        variant: "destructive",
      });
    },
  });

  const sendInvite = (
    payload: { firmId?: string; email?: string; evaluationEndsAt?: string | null },
    firmIdForSpinner?: string,
  ) => {
    if (firmIdForSpinner) setSendingFirmId(firmIdForSpinner);
    inviteMutation.mutate(payload);
  };

  if (accessLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (accessError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>Platform admin access is required to provision evaluation firms.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const awaitingFirms = firms.filter((f) => f.provisionedLeadEmail && !f.provisionedLeadUserId);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/admin" className="text-muted-foreground hover:underline">
            Admin
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground">Provision evaluation firm</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            Provision evaluation firm
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reserve a firm and seat limit for a lead email before their onboarding call. On first login they become firm admin with Team access.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>New evaluation firm</CardTitle>
            <CardDescription>
              Default seat limit is 3 (lead + two invitees). Re-submitting the same lead email updates an
              existing reservation that is still awaiting first login (e.g. to correct the end date).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="firmName">Firm name</Label>
              <Input
                id="firmName"
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
                placeholder="e.g. Shah & Co Solicitors"
                data-testid="input-eval-firm-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leadEmail">Lead email</Label>
              <Input
                id="leadEmail"
                type="email"
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                placeholder="shak@firm.co.uk"
                data-testid="input-eval-lead-email"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="seatLimit">Seat limit</Label>
                <Input
                  id="seatLimit"
                  type="number"
                  min={1}
                  max={500}
                  value={seatLimit}
                  onChange={(e) => setSeatLimit(e.target.value)}
                  data-testid="input-eval-seat-limit"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="evaluationEndsAt">Evaluation end (optional)</Label>
                <Input
                  id="evaluationEndsAt"
                  type="date"
                  value={evaluationEndsAt}
                  onChange={(e) => setEvaluationEndsAt(e.target.value)}
                  data-testid="input-eval-ends-at"
                />
              </div>
            </div>
            <Button
              onClick={() => provisionMutation.mutate()}
              disabled={
                provisionMutation.isPending ||
                !firmName.trim() ||
                !leadEmail.trim() ||
                !Number(seatLimit)
              }
              data-testid="button-provision-eval-firm"
            >
              {provisionMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Provisioning…
                </>
              ) : (
                "Provision firm"
              )}
            </Button>
          </CardContent>
        </Card>

        <Card data-testid="card-send-login-invite">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Send first-login invite
            </CardTitle>
            <CardDescription>
              Email a provisioned governed-evaluation lead a branded invite to sign in for the first time.
              They must use the exact reserved email with Google or Microsoft. You can correct the evaluation
              end date here before sending — it updates the firm and appears in the email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invite-firm">Select provisioned firm</Label>
                <Select
                  value={inviteFirmId || undefined}
                  onValueChange={(value) => {
                    setInviteFirmId(value);
                    const match = firms.find((f) => f.id === value);
                    if (match?.provisionedLeadEmail) setInviteEmail(match.provisionedLeadEmail);
                    setInviteEndsAt(toDateInputValue(match?.evaluationEndsAt));
                  }}
                >
                  <SelectTrigger id="invite-firm" data-testid="select-invite-firm">
                    <SelectValue placeholder="Choose a firm…" />
                  </SelectTrigger>
                  <SelectContent>
                    {firms.filter((f) => f.provisionedLeadEmail).map((firm) => (
                      <SelectItem key={firm.id} value={firm.id}>
                        {firm.name} — {firm.provisionedLeadEmail}
                        {firm.provisionedLeadUserId ? " (active)" : " (awaiting login)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email">Or enter lead email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value);
                    setInviteFirmId("");
                    const match = firms.find(
                      (f) =>
                        f.provisionedLeadEmail &&
                        f.provisionedLeadEmail.toLowerCase() === e.target.value.trim().toLowerCase(),
                    );
                    setInviteEndsAt(toDateInputValue(match?.evaluationEndsAt));
                  }}
                  placeholder="shak.inayat@penngroup.co.uk"
                  data-testid="input-invite-login-email"
                />
              </div>
            </div>
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="invite-ends-at">Evaluation end (optional)</Label>
              <Input
                id="invite-ends-at"
                type="date"
                value={inviteEndsAt}
                onChange={(e) => setInviteEndsAt(e.target.value)}
                data-testid="input-invite-ends-at"
              />
            </div>
            <Button
              onClick={() => {
                const endsPayload = inviteEndsAt ? { evaluationEndsAt: inviteEndsAt } : {};
                if (inviteFirmId) sendInvite({ firmId: inviteFirmId, ...endsPayload }, inviteFirmId);
                else if (inviteEmail.trim()) sendInvite({ email: inviteEmail.trim(), ...endsPayload });
              }}
              disabled={
                inviteMutation.isPending ||
                (!inviteFirmId && !inviteEmail.trim())
              }
              data-testid="button-send-login-invite"
            >
              {inviteMutation.isPending && !sendingFirmId ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending…
                </>
              ) : (
                "Send login invite"
              )}
            </Button>
            {awaitingFirms.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {awaitingFirms.length} firm{awaitingFirms.length === 1 ? "" : "s"} still awaiting first login.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evaluation firms</CardTitle>
            <CardDescription>Awaiting login vs active after the lead has signed in.</CardDescription>
          </CardHeader>
          <CardContent>
            {firms.length === 0 ? (
              <p className="text-sm text-muted-foreground">No evaluation firms provisioned yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firm</TableHead>
                    <TableHead>Lead email</TableHead>
                    <TableHead>Seats</TableHead>
                    <TableHead>Ends</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Provisioned</TableHead>
                    <TableHead className="text-right">Invite</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {firms.map((firm) => (
                    <TableRow key={firm.id}>
                      <TableCell className="font-medium">{firm.name}</TableCell>
                      <TableCell>{firm.provisionedLeadEmail ?? "—"}</TableCell>
                      <TableCell>{firm.seatLimit ?? "Unlimited"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {firm.evaluationEndsAt
                          ? format(new Date(firm.evaluationEndsAt), "dd MMM yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {firm.provisionedLeadUserId ? (
                          <Badge variant="default">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Awaiting login</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {firm.provisionedAt
                          ? format(new Date(firm.provisionedAt), "dd MMM yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!firm.provisionedLeadEmail || inviteMutation.isPending}
                          onClick={() => sendInvite({ firmId: firm.id }, firm.id)}
                          data-testid={`button-invite-firm-${firm.id}`}
                        >
                          {sendingFirmId === firm.id && inviteMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            "Send invite"
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
