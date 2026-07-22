import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Display-only markdown renderer for legal masters / snapshots.
 * Does not alter the underlying string — hashing still binds to raw bytes.
 */
export function LegalAgreementMarkdown({
  text,
  className,
  "data-testid": testId,
}: {
  text: string;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <div
      className={
        className ??
        "border border-[hsl(25,15%,85%)] dark:border-border bg-white/60 dark:bg-card rounded-md p-6 max-h-[50vh] overflow-y-auto mb-6 text-sm leading-relaxed text-[hsl(25,20%,30%)] dark:text-foreground"
      }
      data-testid={testId}
    >
      <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-medium prose-headings:text-[hsl(25,30%,15%)] dark:prose-headings:text-foreground prose-p:text-[hsl(25,20%,30%)] dark:prose-p:text-foreground prose-strong:text-[hsl(25,30%,12%)] dark:prose-strong:text-foreground prose-table:text-sm prose-th:border prose-td:border prose-th:border-[hsl(25,15%,85%)] dark:prose-th:border-border prose-td:border-[hsl(25,15%,85%)] dark:prose-td:border-border prose-th:px-3 prose-td:px-3 prose-th:py-2 prose-td:py-2">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    </div>
  );
}
