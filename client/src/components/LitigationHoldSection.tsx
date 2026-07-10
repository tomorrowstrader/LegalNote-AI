import { useMemo, useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { AlertTriangle, CheckCircle2, Loader2, Lock, Shield, Unlock, X } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Case } from "@shared/schema";

const MIN_REASON_LENGTH = 10;
const RELEASE_CONFIRMATION_TEXT =
  "Releasing this litigation hold will end the preservation of audio for this matter. The associated audio recordings will be retained for a 30-day grace period, after which they will be permanently and automatically deleted in accordance with the data retention policy. This action will be recorded in the audit trail. Confirm you wish to release the hold.";

interface CaseAudioRecordingGraceState {
  id: string;
  holdReleaseGraceUntil: string | null;
  colpReviewStatus: string | null;
  deletedAt: string | null;
}

interface LitigationHoldResponse {
  success: boolean;
  litigationHold: boolean;
  message: string;
  updatedCase: Case;
  objectLock: {
    status: string;
    apply: boolean;
    total: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
  warning?: string;
}

interface LitigationHoldSectionProps {
  caseData: Case;
}

function getReasonStatus(reason: string) {
  const trimmed = reason.trim();
  return {
    trimmed,
    isValid: trimmed.length >= MIN_REASON_LENGTH,
    count: trimmed.length,
  };
}

function ReasonField({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const { count, isValid } = getReasonStatus(value);
  const isShort = count > 0 && !isValid;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        Reason <span className="text-destructive">*</span>
      </Label>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Record the legal or procedural reason for this litigation hold action..."
        rows={4}
        className="resize-none"
        data-testid={id}
      />
      <div className="flex items-center justify-between gap-3 text-xs">
        <p className={isShort || error ? "text-destructive" : "text-muted-foreground"}>
          {error || (isShort ? "Reason must be at least 10 characters." : "Provide a reason of at least 10 characters.")}
        </p>
        <p className={isValid ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
          {count}/{MIN_REASON_LENGTH} characters
        </p>
      </div>
    </div>
  );
}

function ApplyLitigationHoldDialog({
  open,
  onOpenChange,
  reason,
  onReasonChange,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  const [error, setError] = useState("");
  const { isValid } = getReasonStatus(reason);

  const handleSubmit = () => {
    if (!isValid) {
      setError("Reason must be at least 10 characters.");
      return;
    }
    setError("");
    onSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-apply-litigation-hold">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Apply Litigation Hold
          </DialogTitle>
          <DialogDescription>
            Applying a hold preserves audio for this matter and suspends automatic deletion.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <ReasonField
            id="textarea-apply-litigation-hold-reason"
            value={reason}
            onChange={(value) => {
              onReasonChange(value);
              if (error) setError("");
            }}
            error={error}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isPending}
            className="gap-1.5"
            data-testid="button-confirm-apply-litigation-hold"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Apply Hold
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReleaseLitigationHoldDialog({
  open,
  onOpenChange,
  reason,
  onReasonChange,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  const [error, setError] = useState("");
  const { isValid } = getReasonStatus(reason);

  const handleSubmit = () => {
    if (!isValid) {
      setError("Reason must be at least 10 characters.");
      return;
    }
    setError("");
    onSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-release-litigation-hold">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Unlock className="w-5 h-5" />
            Release Litigation Hold
          </DialogTitle>
          <DialogDescription>{RELEASE_CONFIRMATION_TEXT}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <ReasonField
            id="textarea-release-litigation-hold-reason"
            value={reason}
            onChange={(value) => {
              onReasonChange(value);
              if (error) setError("");
            }}
            error={error}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!isValid || isPending}
            className="gap-1.5"
            data-testid="button-confirm-release-litigation-hold"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
            Release Hold
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function LitigationHoldSection({ caseData }: LitigationHoldSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [applyReason, setApplyReason] = useState("");
  const [releaseReason, setReleaseReason] = useState("");
  const [warning, setWarning] = useState("");

  const { data: recordings = [] } = useQuery<CaseAudioRecordingGraceState[]>({
    queryKey: [`/api/cases/${caseData.id}/audio-recordings`],
    enabled: !!caseData.id,
  });

  const graceUntil = useMemo(() => {
    const graceDates = recordings
      .filter((recording) => !recording.deletedAt && recording.holdReleaseGraceUntil)
      .map((recording) => new Date(recording.holdReleaseGraceUntil as string))
      .filter((date) => date.getTime() >= Date.now());

    if (graceDates.length === 0) return null;
    return new Date(Math.max(...graceDates.map((date) => date.getTime())));
  }, [recordings]);

  const daysRemaining = graceUntil ? Math.max(0, differenceInCalendarDays(graceUntil, new Date())) : null;
  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "You"
    : null;
  const appliedByName = caseData.litigationHoldAppliedBy === user?.id ? displayName : null;

  const litigationHoldMutation = useMutation({
    mutationFn: (payload: { apply: boolean; reason: string }) =>
      apiRequest<LitigationHoldResponse>("POST", `/api/cases/${caseData.id}/litigation-hold`, payload),
    onSuccess: (response) => {
      toast({
        title: response.litigationHold ? "Litigation hold applied" : "Litigation hold released",
        description: response.message,
        duration: 6000,
      });

      if (response.warning) {
        setWarning(response.warning);
        toast({
          title: "Action completed with a warning",
          description: response.warning,
          variant: "destructive",
          duration: 10000,
        });
      } else if (response.litigationHold) {
        setWarning("");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseData.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseData.id}/audio-recordings`] });
      queryClient.invalidateQueries({ queryKey: [`/api/audio/by-case/${caseData.id}`] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("/api/audio/by-session/"),
      });

      setApplyReason("");
      setReleaseReason("");
      setShowApplyDialog(false);
      setShowReleaseDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Litigation hold update failed",
        description: error.message || "Please try again.",
        variant: "destructive",
        duration: 6000,
      });
    },
  });

  const applyHold = () => {
    const { trimmed, isValid } = getReasonStatus(applyReason);
    if (!isValid) return;
    litigationHoldMutation.mutate({ apply: true, reason: trimmed });
  };

  const releaseHold = () => {
    const { trimmed, isValid } = getReasonStatus(releaseReason);
    if (!isValid) return;
    litigationHoldMutation.mutate({ apply: false, reason: trimmed });
  };

  const hasGraceWindow = !caseData.litigationHold && !!graceUntil;

  return (
    <div className="space-y-4" data-testid="section-litigation-hold">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Litigation Hold</h3>
          {caseData.litigationHold ? (
            <Badge variant="destructive" className="gap-1">
              <Lock className="w-3 h-3" />
              Under hold
            </Badge>
          ) : hasGraceWindow ? (
            <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              Grace period
            </Badge>
          ) : (
            <Badge variant="secondary">No hold</Badge>
          )}
        </div>
      </div>

      {warning && (
        <Alert variant="destructive" data-testid="alert-litigation-hold-warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-start justify-between gap-3">
            <span>{warning}</span>
            <button
              type="button"
              onClick={() => setWarning("")}
              className="text-destructive-foreground/80 hover:text-destructive-foreground"
              aria-label="Dismiss warning"
              data-testid="button-dismiss-litigation-hold-warning"
            >
              <X className="w-4 h-4" />
            </button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            {caseData.litigationHold
              ? "Under litigation hold"
              : hasGraceWindow
              ? "Post-release grace period"
              : "No litigation hold"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {caseData.litigationHold ? (
            <>
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Audio and related matter records are preserved while this litigation hold remains in effect.
                </p>
                {caseData.litigationHoldReason && (
                  <div className="rounded-md border bg-muted/40 p-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Reason</p>
                    <p>{caseData.litigationHoldReason}</p>
                  </div>
                )}
                {caseData.litigationHoldAppliedAt && (
                  <p className="text-xs text-muted-foreground">
                    Applied on {format(new Date(caseData.litigationHoldAppliedAt), "d MMMM yyyy")}
                    {appliedByName ? ` by ${appliedByName}` : ""}
                  </p>
                )}
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowReleaseDialog(true)}
                className="gap-1.5"
                data-testid="button-open-release-litigation-hold"
              >
                <Unlock className="w-4 h-4" />
                Release Hold
              </Button>
            </>
          ) : hasGraceWindow ? (
            <>
              <Alert className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
                <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                <AlertDescription className="text-amber-900 dark:text-amber-200">
                  This matter&apos;s audio is in a 30-day post-release grace period. {daysRemaining}{" "}
                  {daysRemaining === 1 ? "day" : "days"} remaining before automatic deletion.
                </AlertDescription>
              </Alert>
              <Button
                onClick={() => setShowApplyDialog(true)}
                className="gap-1.5"
                data-testid="button-open-apply-litigation-hold-grace"
              >
                <Lock className="w-4 h-4" />
                Apply Litigation Hold
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>No litigation hold</span>
                </div>
                <p className="text-muted-foreground">
                  Automatic retention and deletion policies apply unless a hold is applied.
                </p>
              </div>
              <Button
                onClick={() => setShowApplyDialog(true)}
                className="gap-1.5"
                data-testid="button-open-apply-litigation-hold"
              >
                <Lock className="w-4 h-4" />
                Apply Litigation Hold
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <ApplyLitigationHoldDialog
        open={showApplyDialog}
        onOpenChange={setShowApplyDialog}
        reason={applyReason}
        onReasonChange={setApplyReason}
        onSubmit={applyHold}
        isPending={litigationHoldMutation.isPending}
      />

      <ReleaseLitigationHoldDialog
        open={showReleaseDialog}
        onOpenChange={setShowReleaseDialog}
        reason={releaseReason}
        onReasonChange={setReleaseReason}
        onSubmit={releaseHold}
        isPending={litigationHoldMutation.isPending}
      />
    </div>
  );
}
