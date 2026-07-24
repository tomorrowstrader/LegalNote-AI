import type { ReactNode } from "react";
import { Link } from "wouter";
import { Mail } from "lucide-react";

/**
 * Shared typography for public legal pages.
 * Always pair light HSL with dashboard theme tokens so dark mode contrast stays correct.
 */
export const legalPageShellClass =
  "min-h-screen bg-[hsl(30,25%,97%)] dark:bg-background";
export const legalLinkClass =
  "text-[hsl(18,65%,45%)] dark:text-[hsl(18,70%,62%)] hover:underline";
export const legalH1Class =
  "text-4xl font-medium text-[hsl(25,30%,12%)] dark:text-foreground mb-2";
export const legalH2Class =
  "text-2xl font-medium text-[hsl(25,30%,15%)] dark:text-foreground mb-4";
export const legalH3Class =
  "text-xl font-medium text-[hsl(25,30%,15%)] dark:text-foreground mb-3 mt-6";
export const legalMutedClass =
  "text-[hsl(25,20%,45%)] dark:text-muted-foreground";
export const legalBodyClass =
  "space-y-8 text-[hsl(25,20%,30%)] dark:text-foreground";
export const legalCardClass =
  "border border-[hsl(25,15%,85%)] dark:border-border bg-white/60 dark:bg-card rounded-md";

/** Shared footer links for public legal pages */
export function LegalPageFooter() {
  return (
    <footer className="bg-[hsl(20,30%,10%)] border-t border-[hsl(20,25%,18%)]">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm text-white/40">
            © {new Date().getFullYear()} LegalNote Technologies Ltd. All rights
            reserved.
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            <Link
              href="/privacy"
              className="text-white/50 hover:text-white transition-colors"
              data-testid="link-footer-privacy"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-white/50 hover:text-white transition-colors"
              data-testid="link-footer-terms"
            >
              Terms of Service
            </Link>
            <Link
              href="/cookies"
              className="text-white/50 hover:text-white transition-colors"
              data-testid="link-footer-cookies"
            >
              Cookie Policy
            </Link>
            <Link
              href="/sub-processors"
              className="text-white/50 hover:text-white transition-colors"
              data-testid="link-footer-subprocessors"
            >
              Sub-processors
            </Link>
            <Link
              href="/dpa"
              className="text-white/50 hover:text-white transition-colors"
              data-testid="link-footer-dpa"
            >
              Data Processing Agreement
            </Link>
            <a
              href="mailto:support@legalnote.ai"
              className="flex items-center gap-2 text-white/50 hover:text-white transition-colors"
              data-testid="link-footer-contact"
            >
              <Mail className="w-4 h-4" />
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

const tableClass =
  "w-full text-left text-sm border-collapse my-4 text-[hsl(25,20%,30%)] dark:text-foreground [&_th]:border [&_td]:border [&_th]:border-[hsl(25,15%,85%)] [&_td]:border-[hsl(25,15%,85%)] dark:[&_th]:border-border dark:[&_td]:border-border [&_th]:bg-[hsl(30,20%,94%)] dark:[&_th]:bg-card [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2 [&_th]:font-medium [&_th]:text-[hsl(25,30%,15%)] dark:[&_th]:text-foreground dark:[&_td]:bg-background/40";

export function LegalTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className={tableClass}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
