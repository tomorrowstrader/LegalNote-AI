import type { ReactNode } from "react";
import { Link } from "wouter";
import { Mail } from "lucide-react";

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
  "w-full text-left text-sm border-collapse my-4 [&_th]:border [&_td]:border [&_th]:border-[hsl(25,15%,85%)] [&_td]:border-[hsl(25,15%,85%)] [&_th]:bg-[hsl(30,20%,94%)] [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2 [&_th]:font-medium [&_th]:text-[hsl(25,30%,15%)]";

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
