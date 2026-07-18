import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, FileSearch, Pencil, RefreshCw, X } from "lucide-react";
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
  onProduceCorrectedVersion: (warning: VerificationWarning) => void;
  onResolve: (args: {
    warningId: string;
    disposition: VerificationResolveDisposition;
    reason: string;
  }) => void;
  isResolving?: boolean;
}

export function VerificationWarningPanel({
  warnings: rawWarnings,
  testIdPrefix,
  documentStatus,
  isDemoMode,
  onViewInNote,
  onSearchTranscript,
  onEditStatement,
  onProduceCorrectedVersion,
  onResolve,
  isResolving,
}: VerificationWarningPanelProps) {
  const warnings = useMemo(() => coerceVerificationWarnings(rawWarnings), [rawWarnings]);
  const [expanded, setExpanded] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
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

  if (warnings.length === 0) return null;

  const closeResolve = () => {
    setResolveTarget(null);
    setResolveReason("");
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

            {expanded && (
              <ul className="mt-3 space-y-3">
                {visible.map((warning, i) => {
                  const resolved = !!warning.resolution;
                  return (
                    <li
                      key={warning.id}
                      className={cn(
                        "rounded-md border border-yellow-200/80 dark:border-yellow-800/60 bg-background/40 p-3 space-y-2",
                        resolved && "opacity-70",
                      )}
                      data-testid={`text-verification-warning-${testIdPrefix}-${i}`}
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
                              data-testid={`button-view-in-note-${testIdPrefix}-${i}`}
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
                            data-testid={`button-search-transcript-${testIdPrefix}-${i}`}
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
                                data-testid={`button-edit-statement-${testIdPrefix}-${i}`}
                              >
                                <Pencil className="w-3 h-3" />
                                Edit statement
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1"
                                onClick={() => onProduceCorrectedVersion(warning)}
                                data-testid={`button-produce-from-warning-${testIdPrefix}-${i}`}
                              >
                                <RefreshCw className="w-3 h-3" />
                                Produce corrected version
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="h-7 text-xs gap-1"
                                onClick={() =>
                                  setResolveTarget({
                                    warning,
                                    disposition: "confirmed_professionally_derived",
                                  })
                                }
                                data-testid={`button-confirm-derived-${testIdPrefix}-${i}`}
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Confirm as derived
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs gap-1"
                                onClick={() =>
                                  setResolveTarget({
                                    warning,
                                    disposition: "dismissed",
                                  })
                                }
                                data-testid={`button-dismiss-warning-${testIdPrefix}-${i}`}
                              >
                                <X className="w-3 h-3" />
                                Dismiss with reason
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
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
