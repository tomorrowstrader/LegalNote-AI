import { useState, useEffect } from "react";
import { AlertTriangle, X, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Case } from "@shared/schema";

interface AmlTriggerBannerProps {
  caseData: Case;
  onAddMonitoringNote?: () => void;
}

interface AmlTrigger {
  label: string;
  category: string;
  excerpt: string;
}

export default function AmlTriggerBanner({ caseData, onAddMonitoringNote }: AmlTriggerBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const storageKey = `aml-banner-dismissed-${caseData.id}`;

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored === "true") setDismissed(true);
  }, [storageKey]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(storageKey, "true");
  };

  const metadata = caseData.aiProcessingMetadata as Record<string, any> | null;
  const triggers: AmlTrigger[] = metadata?.amlTriggers || [];

  if (dismissed || triggers.length === 0) return null;

  return (
    <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700" data-testid="aml-trigger-banner">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1.5 flex-1">
            <AlertDescription className="text-sm font-medium text-amber-800 dark:text-amber-200">
              AML-relevant language detected in transcript
            </AlertDescription>
            <div className="flex flex-wrap gap-1.5">
              {triggers.map((t, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-xs no-default-hover-elevate no-default-active-elevate border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
                  data-testid={`badge-trigger-${i}`}
                >
                  {t.label}
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Review the Compliance Thread to assess and record your AML position.
              </p>
              {onAddMonitoringNote && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAddMonitoringNote}
                  className="border-amber-400 dark:border-amber-700 text-amber-800 dark:text-amber-200"
                  data-testid="button-banner-add-note"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Monitoring Note
                </Button>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={handleDismiss}
          data-testid="button-dismiss-aml-banner"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </Alert>
  );
}
