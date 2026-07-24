import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Building2, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
};

export default function AdminProvisionFirmPage() {
  const { toast } = useToast();
  const [firmName, setFirmName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [seatLimit, setSeatLimit] = useState("3");
  const [evaluationEndsAt, setEvaluationEndsAt] = useState("");

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
        title: "Evaluation firm provisioned",
        description: `${firm.name} reserved for ${firm.provisionedLeadEmail}. They become firm lead on first login.`,
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
            <CardDescription>Default seat limit is 3 (lead + two invitees).</CardDescription>
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
                    <TableHead>Status</TableHead>
                    <TableHead>Provisioned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {firms.map((firm) => (
                    <TableRow key={firm.id}>
                      <TableCell className="font-medium">{firm.name}</TableCell>
                      <TableCell>{firm.provisionedLeadEmail ?? "—"}</TableCell>
                      <TableCell>{firm.seatLimit ?? "Unlimited"}</TableCell>
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
