import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, ClipboardCheck, User, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SupervisionSignoff {
  id: string;
  caseId: string;
  supervisorUserId: string;
  supervisorName: string;
  supervisorRole: string;
  signoffDate: string;
  reviewNotes: string;
  createdAt: string;
}

interface SupervisionSectionProps {
  caseId: string;
}

export default function SupervisionSection({ caseId }: SupervisionSectionProps) {
  const { user, isSupervisor } = useAuth();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [signoffDate, setSignoffDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [reviewNotes, setReviewNotes] = useState("");

  const { data: signoffs = [], isLoading } = useQuery<SupervisionSignoff[]>({
    queryKey: [`/api/cases/${caseId}/supervision-signoffs`],
    enabled: !!caseId,
  });

  const createSignoffMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/cases/${caseId}/supervision-signoffs`, {
      signoffDate: new Date(signoffDate).toISOString(),
      reviewNotes,
    }),
    onSuccess: () => {
      toast({ title: "Sign-off recorded", description: "Supervision sign-off has been recorded on this matter." });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/supervision-signoffs`] });
      setReviewNotes("");
      setSignoffDate(format(new Date(), "yyyy-MM-dd"));
      setShowForm(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to record sign-off",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewNotes.trim()) return;
    createSignoffMutation.mutate();
  };

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'You'
    : 'You';

  const roleLabel = (role: string) => {
    const labels: Record<string, string> = {
      supervisor: "Supervisor",
      partner: "Partner",
      colp: "COLP",
      admin: "Admin",
      solicitor: "Solicitor",
    };
    return labels[role] || role;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="section-supervision">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold" data-testid="heading-supervision">Supervision</h3>
          {signoffs.length > 0 && (
            <Badge variant="secondary" data-testid="badge-signoff-count">{signoffs.length} sign-off{signoffs.length !== 1 ? "s" : ""}</Badge>
          )}
        </div>
        {isSupervisor && !showForm && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowForm(true)}
            data-testid="button-record-signoff"
          >
            <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" />
            Record Sign-off
          </Button>
        )}
      </div>

      {isSupervisor && showForm && (
        <Card data-testid="card-signoff-form">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Record Supervision Sign-off</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Supervisor</Label>
                  <p className="text-sm font-medium" data-testid="text-supervisor-name">{displayName}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signoff-date" className="text-xs text-muted-foreground">Sign-off Date</Label>
                  <Input
                    id="signoff-date"
                    type="date"
                    value={signoffDate}
                    onChange={e => setSignoffDate(e.target.value)}
                    max={format(new Date(), "yyyy-MM-dd")}
                    required
                    data-testid="input-signoff-date"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="review-notes" className="text-xs text-muted-foreground">
                  Review Notes <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="review-notes"
                  placeholder="Summarise what was reviewed, any issues noted, and any directions given to the fee earner..."
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  rows={4}
                  required
                  data-testid="textarea-review-notes"
                />
                <p className="text-xs text-muted-foreground">Required. This note forms part of the permanent audit record for this matter.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!reviewNotes.trim() || createSignoffMutation.isPending}
                  data-testid="button-submit-signoff"
                >
                  {createSignoffMutation.isPending ? "Recording..." : "Record Sign-off"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => { setShowForm(false); setReviewNotes(""); }}
                  data-testid="button-cancel-signoff"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {signoffs.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="text-no-signoffs">
          No supervision sign-offs have been recorded for this matter.
          {!isSupervisor && " Supervision sign-offs must be recorded by a supervisor, partner, or COLP."}
        </p>
      ) : (
        <div className="space-y-2" data-testid="list-signoffs">
          {signoffs.map(signoff => (
            <Card key={signoff.id} data-testid={`card-signoff-${signoff.id}`}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium" data-testid={`text-signoff-supervisor-${signoff.id}`}>
                      {signoff.supervisorName}
                    </span>
                    <Badge variant="outline" className="text-xs" data-testid={`badge-signoff-role-${signoff.id}`}>
                      {roleLabel(signoff.supervisorRole)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span data-testid={`text-signoff-date-${signoff.id}`}>
                      {format(new Date(signoff.signoffDate), "d MMM yyyy")}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap" data-testid={`text-signoff-notes-${signoff.id}`}>
                  {signoff.reviewNotes}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
