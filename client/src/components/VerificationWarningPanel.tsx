import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSearch,
  Pencil,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  coerceVerificationWarnings,
  summarizeOpenVerificationWarnings,
  verificationCategoryTitle,
  type VerificationResolveDisposition,
  type VerificationWarning,
} from "@shared/verificationWarnings";
import { cn } from "@/lib/utils";

export interface VerificationWarningPanelProps {
  warnings: unknown;
  testIdPrefix: string;
  documentStatus?: string;
  isDemoMode?: boolean;
  onViewInNote: (warning: VerificationWarning) => void;
  onSearchTranscript: (warning: VerificationWarning) => void;
  onEditStatement: (warning: VerificationWarning) => void;
  onResolve: (args: {
    warningId: string;
    disposition: VerificationResolveDisposition;
    reason: string;
  }) => void;
  isResolving?: boolean;
}

function ordinalLabel(n: number): string {
  const abs = Math.abs(n);
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (abs % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

interface WarningCardProps {
  warning: VerificationWarning;
  index: number;
  testIdPrefix: string;
  canAct: boolean;
  onViewInNote: (warning: VerificationWarning) => void;
  onSearchTranscript: (warning: VerificationWarning) => void;
  onEditStatement: (warning: VerificationWarning) => void;
  onRequestResolve: (
    warning: VerificationWarning,
    disposition: VerificationResolveDisposition,
  ) => void;
}

function WarningCard({
  warning,
  index,
  testIdPrefix,
  canAct,
  onViewInNote,
  onSearchTranscript,
  onEditStatement,
  onRequestResolve,
}: WarningCardProps) {
  const resolved = !!warning.resolution;

  return (
    <div
      className={cn(
        "rounded-md border border-yellow-200/80 dark:border-yellow-800/60 bg-background/40 p-3 space-y-2",
        resolved && "opacity-70",
      )}
      data-testid={`text-verification-warning-${testIdPrefix}-${index}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-yellow-900 dark:text-yellow-200">
          {verificationCategoryTitle(warning.category)}
        </p>
        {resolved && (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            <CheckCircle2 className="w-3 h-3" />
            Reviewed
          </span>
        )}
      </div>

      {warning.documentQuote ? (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
            Statement in the note
          </p>
          <p className="text-xs text-foreground leading-relaxed">
            “{warning.documentQuote}”
          </p>
        </div>
      ) : null}

      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
          Why this was flagged
        </p>
        <p className="text-xs text-yellow-800 dark:text-yellow-300 leading-relaxed">
          {warning.explanation}
        </p>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
          Meeting record
        </p>
        {warning.transcriptQuote ? (
          <p className="text-xs text-muted-foreground leading-relaxed">
            Related passage: “{warning.transcriptQuote}”
          </p>
        ) : (
          <p className="text-xs text-muted-foreground leading-relaxed">
            No matching passage found in the meeting record.
          </p>
        )}
      </div>

      {resolved && warning.resolution && (
        <p className="text-xs text-muted-foreground">
          {warning.resolution.disposition === "confirmed_professionally_derived"
            ? "Confirmed as professionally derived"
            : "Dismissed"}
          : {warning.resolution.reason}
        </p>
      )}

      {!resolved && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {warning.documentQuote ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => onViewInNote(warning)}
              data-testid={`button-view-in-note-${testIdPrefix}-${index}`}
            >
              <Eye className="w-3 h-3" />
              View in note
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => onSearchTranscript(warning)}
            data-testid={`button-search-transcript-${testIdPrefix}-${index}`}
          >
            <FileSearch className="w-3 h-3" />
            {warning.transcriptQuote ? "View in transcript" : "Search transcript"}
          </Button>
          {canAct && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => onEditStatement(warning)}
                data-testid={`button-edit-statement-${testIdPrefix}-${index}`}
              >
                <Pencil className="w-3 h-3" />
                Edit statement
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 text-xs gap-1"
                onClick={() =>
                  onRequestResolve(warning, "confirmed_professionally_derived")
                }
                data-testid={`button-confirm-derived-${testIdPrefix}-${index}`}
              >
                <CheckCircle2 className="w-3 h-3" />
                Confirm as derived
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1"
                onClick={() => onRequestResolve(warning, "dismissed")}
                data-testid={`button-dismiss-warning-${testIdPrefix}-${index}`}
              >
                <X className="w-3 h-3" />
                Dismiss with reason
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function VerificationWarningPanel({
  warnings: rawWarnings,
  testIdPrefix,
  documentStatus,
  isDemoMode,
  onViewInNote,
  onSearchTranscript,
  onEditStatement,
  onResolve,
  isResolving,
}: VerificationWarningPanelProps) {
  const warnings = useMemo(() => coerceVerificationWarnings(rawWarnings), [rawWarnings]);
  // Always start collapsed so multiple flags do not dominate the document viewport.
  const [expanded, setExpanded] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("right");
  const [resolveTarget, setResolveTarget] = useState<{
    warning: VerificationWarning;
    disposition: VerificationResolveDisposition;
  } | null>(null);
  const [resolveReason, setResolveReason] = useState("");

  const openWarnings = warnings.filter((w) => !w.resolution);
  const resolvedWarnings = warnings.filter((w) => !!w.resolution);
  const visible = showResolved ? warnings : openWarnings.length > 0 ? openWarnings : warnings;
  const summary = summarizeOpenVerificationWarnings(warnings);
  const canAct = documentStatus === "draft" && !isDemoMode;
  const total = visible.length;
  const safeIndex = total === 0 ? 0 : Math.min(activeIndex, total - 1);
  const activeWarning = total > 0 ? visible[safeIndex] : null;
  const hasCarousel = total > 1;
  const canGoPrev = safeIndex > 0;
  const canGoNext = safeIndex < total - 1;

  useEffect(() => {
    setActiveIndex((prev) => {
      if (visible.length === 0) return 0;
      return Math.min(prev, visible.length - 1);
    });
  }, [visible.length]);

  if (warnings.length === 0) return null;

  const closeResolve = () => {
    setResolveTarget(null);
    setResolveReason("");
  };

  const goPrev = () => {
    if (!canGoPrev) return;
    setSlideDirection("left");
    setActiveIndex((i) => Math.max(0, i - 1));
  };

  const goNext = () => {
    if (!canGoNext) return;
    setSlideDirection("right");
    setActiveIndex((i) => Math.min(total - 1, i + 1));
  };

  return (
    <>
      <div
        className="mx-6 mb-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-md"
        data-testid={`panel-verification-warning-${testIdPrefix}`}
      >
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
              Solicitor Review Required
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
              {openWarnings.length > 0
                ? summary
                : `All ${warnings.length} flagged statement${warnings.length !== 1 ? "s" : ""} reviewed.`}{" "}
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="underline hover:no-underline"
                data-testid={`button-toggle-verification-warnings-${testIdPrefix}`}
              >
                {expanded ? "Hide details" : "Show details"}
              </button>
              {resolvedWarnings.length > 0 && (
                <>
                  {" · "}
                  <button
                    type="button"
                    onClick={() => setShowResolved((v) => !v)}
                    className="underline hover:no-underline"
                    data-testid={`button-toggle-resolved-warnings-${testIdPrefix}`}
                  >
                    {showResolved
                      ? "Hide resolved"
                      : `Show resolved (${resolvedWarnings.length})`}
                  </button>
                </>
              )}
            </p>

            {expanded && activeWarning && (
              <div className="mt-3 space-y-2">
                {hasCarousel && (
                  <div
                    className="flex items-center justify-between gap-2"
                    data-testid={`carousel-verification-warnings-${testIdPrefix}`}
                  >
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className={cn(
                        "h-8 px-2 gap-1 text-xs",
                        !canGoPrev && "opacity-30 pointer-events-none",
                      )}
                      disabled={!canGoPrev}
                      aria-disabled={!canGoPrev}
                      onClick={goPrev}
                      data-testid={`button-warning-prev-${testIdPrefix}`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>

                    <p className="text-xs text-yellow-800 dark:text-yellow-300 tabular-nums text-center">
                      Flag {safeIndex + 1} of {total}
                      {canGoNext ? (
                        <span className="text-muted-foreground">
                          {" · "}
                          <button
                            type="button"
                            onClick={goNext}
                            className="underline hover:no-underline text-yellow-800 dark:text-yellow-300"
                            data-testid={`button-warning-view-next-label-${testIdPrefix}`}
                          >
                            View {ordinalLabel(safeIndex + 2)}
                          </button>
                        </span>
                      ) : null}
                    </p>

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className={cn(
                        "h-8 px-2 gap-1 text-xs",
                        !canGoNext && "opacity-30 pointer-events-none",
                      )}
                      disabled={!canGoNext}
                      aria-disabled={!canGoNext}
                      onClick={goNext}
                      data-testid={`button-warning-next-${testIdPrefix}`}
                    >
                      {canGoNext ? `View ${ordinalLabel(safeIndex + 2)}` : "Next"}
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                <div className="overflow-hidden" key={`${activeWarning.id}-${safeIndex}`}>
                  <div
                    className={cn(
                      "animate-in fade-in duration-300",
                      slideDirection === "right"
                        ? "slide-in-from-right-4"
                        : "slide-in-from-left-4",
                    )}
                  >
                    <WarningCard
                      warning={activeWarning}
                      index={safeIndex}
                      testIdPrefix={testIdPrefix}
                      canAct={canAct}
                      onViewInNote={onViewInNote}
                      onSearchTranscript={onSearchTranscript}
                      onEditStatement={onEditStatement}
                      onRequestResolve={(warning, disposition) =>
                        setResolveTarget({ warning, disposition })
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!resolveTarget} onOpenChange={(open) => { if (!open) closeResolve(); }}>
        <DialogContent className="sm:max-w-md" data-testid={`dialog-resolve-warning-${testIdPrefix}`}>
          <DialogHeader>
            <DialogTitle>
              {resolveTarget?.disposition === "confirmed_professionally_derived"
                ? "Confirm as professionally derived"
                : "Dismiss verification warning"}
            </DialogTitle>
            <DialogDescription>
              {resolveTarget?.disposition === "confirmed_professionally_derived"
                ? "Record why this statement is professionally justified even though the automated check flagged it. This is stored on the document and in the audit trail."
                : "Record why this warning does not require a change to the note. This is stored on the document and in the audit trail."}
            </DialogDescription>
          </DialogHeader>
          {resolveTarget?.warning.documentQuote ? (
            <p className="text-xs text-muted-foreground border rounded-md p-2 bg-muted/40">
              “{resolveTarget.warning.documentQuote}”
            </p>
          ) : null}
          <Textarea
            value={resolveReason}
            onChange={(e) => setResolveReason(e.target.value)}
            placeholder="Your reason (required)…"
            rows={4}
            className="text-sm"
            data-testid={`input-resolve-warning-reason-${testIdPrefix}`}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={closeResolve}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!resolveReason.trim() || isResolving || !resolveTarget}
              onClick={() => {
                if (!resolveTarget) return;
                onResolve({
                  warningId: resolveTarget.warning.id,
                  disposition: resolveTarget.disposition,
                  reason: resolveReason.trim(),
                });
                closeResolve();
              }}
              data-testid={`button-confirm-resolve-warning-${testIdPrefix}`}
            >
              {isResolving ? "Saving…" : "Record decision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
