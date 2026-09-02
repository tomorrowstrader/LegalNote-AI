import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock } from "lucide-react";
import { formatEvaluationCalendarDate } from "@shared/evaluationAccess";
import { useAuth } from "@/hooks/useAuth";

type FirmEvaluationStatus = {
  isEvaluation?: boolean;
  evaluationEndsAt?: string | null;
  evaluationExpired?: boolean;
  evaluationDaysRemaining?: number | null;
};

export default function EvaluationPeriodBanner() {
  const { isAdmin } = useAuth();
  const { data: firm } = useQuery<FirmEvaluationStatus>({
    queryKey: ["/api/firm"],
  });

  if (isAdmin || !firm?.isEvaluation || !firm.evaluationEndsAt) {
    return null;
  }

  const endsLabel = formatEvaluationCalendarDate(firm.evaluationEndsAt, "end");

  if (firm.evaluationExpired) {
    return (
      <div
        className="w-full border-b border-destructive/30 bg-destructive/10 px-4 py-3"
        data-testid="banner-evaluation-expired"
      >
        <div className="mx-auto flex max-w-6xl items-start gap-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-foreground">
              Your governed evaluation ended on {endsLabel}
            </p>
            <p className="text-muted-foreground">
              You can review existing matters, but new recordings and edits are disabled. Contact{" "}
              <a href="mailto:jazz.dennis@legalnote.ai" className="underline hover:text-foreground">
                jazz.dennis@legalnote.ai
              </a>{" "}
              to extend or subscribe.
            </p>
          </div>
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
      <div className="mx-auto flex max-w-6xl items-center gap-2 text-sm">
        <Clock className={`h-4 w-4 shrink-0 ${urgent ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`} />
        <p className={urgent ? "text-foreground" : "text-muted-foreground"}>
          <span className="font-medium text-foreground">Evaluation</span>
          {" · "}
          {daysRemaining === 1
            ? "1 day remaining"
            : `${daysRemaining} days remaining`}
          {" · "}
          ends {endsLabel}
        </p>
      </div>
    </div>
  );
}
