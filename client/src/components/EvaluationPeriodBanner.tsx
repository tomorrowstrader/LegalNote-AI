import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock } from "lucide-react";
import { formatEvaluationCalendarDate } from "@shared/evaluationAccess";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

type FirmEvaluationStatus = {
  isEvaluation?: boolean;
  evaluationEndsAt?: string | null;
  evaluationExpired?: boolean;
  evaluationDaysRemaining?: number | null;
  hasPaidAccess?: boolean;
};

export default function EvaluationPeriodBanner() {
  const { isAdmin, isFirmAdmin } = useAuth();
  const { data: firm } = useQuery<FirmEvaluationStatus>({
    queryKey: ["/api/firm"],
  });

  if (isAdmin || !firm?.isEvaluation || !firm.evaluationEndsAt || firm.hasPaidAccess) {
    return null;
  }

  const endsLabel = formatEvaluationCalendarDate(firm.evaluationEndsAt, "end");
  const subscribeCta = isFirmAdmin ? (
    <Button asChild size="sm" className="shrink-0" data-testid="button-banner-subscribe">
      <Link href="/subscribe">Subscribe</Link>
    </Button>
  ) : (
    <span className="text-xs text-muted-foreground">Ask your firm admin to subscribe</span>
  );

  if (firm.evaluationExpired) {
    return (
      <div
        className="w-full border-b border-destructive/30 bg-destructive/10 px-4 py-3"
        data-testid="banner-evaluation-expired"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-start gap-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">
              Your governed evaluation ended on {endsLabel}
            </p>
            <p className="text-muted-foreground">
              You can review existing matters, but new recordings and edits are disabled.
              Continue on Boutique (£199 / seat / month) by card or invoice.
            </p>
          </div>
          {subscribeCta}
        </div>
      </div>
    );
  }

  const daysRemaining = firm.evaluationDaysRemaining ?? 0;
  const urgent = daysRemaining <= 7;

  return (
    <div
      className={`w-full border-b px-4 py-2.5 ${
        urgent
          ? "border-amber-500/40 bg-amber-500/10"
          : "border-border bg-muted/60"
      }`}
      data-testid="banner-evaluation-active"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 text-sm">
        <Clock className={`h-4 w-4 shrink-0 ${urgent ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`} />
        <p className={`min-w-0 flex-1 ${urgent ? "text-foreground" : "text-muted-foreground"}`}>
          <span className="font-medium text-foreground">Evaluation</span>
          {" · "}
          {daysRemaining === 1
            ? "1 day remaining"
            : `${daysRemaining} days remaining`}
          {" · "}
          ends {endsLabel}
          {urgent ? " · Subscribe to keep full access" : null}
        </p>
        {urgent ? subscribeCta : null}
      </div>
    </div>
  );
}
