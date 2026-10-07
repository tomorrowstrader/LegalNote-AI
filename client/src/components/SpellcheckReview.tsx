import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface SpellcheckReviewProps {
  loading: boolean;
  error: string | null;
  wordCount: number;
  index: number;
  word: string | null;
  suggestions: string[];
  /** Edit mode can replace the highlighted word. Review mode only moves to it. */
  canReplace: boolean;
  onPrev: () => void;
  onNext: () => void;
  onIgnore: () => void;
  onIgnoreAll: () => void;
  onReplace: (suggestion: string) => void;
  onClose: () => void;
}

export function SpellcheckReview({
  loading,
  error,
  wordCount,
  index,
  word,
  suggestions,
  canReplace,
  onPrev,
  onNext,
  onIgnore,
  onIgnoreAll,
  onReplace,
  onClose,
}: SpellcheckReviewProps) {
  return (
    <div
      className="border-b border-amber-300/80 bg-amber-50/90 dark:border-amber-800/60 dark:bg-amber-950/40 px-3 py-2 space-y-2"
      data-testid="panel-spellcheck"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-amber-950 dark:text-amber-100">UK English spell check</p>
          <p className="text-[11px] text-amber-900/80 dark:text-amber-200/80">
            Takes you to each word. The note is left as it is unless you choose a spelling.
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={onClose}
          data-testid="button-close-spellcheck"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {loading && (
        <p className="text-xs text-muted-foreground" data-testid="text-spellcheck-loading">Checking the note…</p>
      )}
      {error && (
        <p className="text-xs text-destructive" data-testid="text-spellcheck-error">{error}</p>
      )}
      {!loading && !error && wordCount === 0 && (
        <p className="text-xs text-muted-foreground" data-testid="text-spellcheck-clear">No spelling to review.</p>
      )}

      {!loading && !error && word && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={onPrev} disabled={wordCount < 2} data-testid="button-spellcheck-prev">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums" data-testid="text-spellcheck-position">
              {index + 1} of {wordCount}
            </span>
            <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={onNext} disabled={wordCount < 2} data-testid="button-spellcheck-next">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <span className="text-sm font-semibold" data-testid="text-spellcheck-word">{word}</span>
          </div>

          {suggestions.length > 0 ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-muted-foreground">UK spelling</span>
              {suggestions.map((suggestion) => (
                canReplace ? (
                  <Button
                    key={suggestion}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => onReplace(suggestion)}
                    data-testid={`button-spellcheck-use-${suggestion}`}
                  >
                    Use “{suggestion}”
                  </Button>
                ) : (
                  <span key={suggestion} className="text-xs font-medium" data-testid={`text-spellcheck-suggestion-${suggestion}`}>
                    {suggestion}
                  </span>
                )
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">No UK spelling to suggest. You can ignore this word.</p>
          )}

          {!canReplace && (
            <p className="text-[11px] text-muted-foreground">
              This view only takes you to the word. Edit the note if you want to change it.
            </p>
          )}

          <div className="flex items-center gap-1.5">
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onIgnore} data-testid="button-spellcheck-ignore">
              Ignore
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onIgnoreAll} data-testid="button-spellcheck-ignore-all">
              Ignore all
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
