import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Share2, ChevronLeft, Printer } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { DemoLeadMatter } from "@/data/demoData";

interface DemoDocumentViewerProps {
  matter: DemoLeadMatter;
  onBack: () => void;
}

export function DemoDocumentViewer({ matter, onBack }: DemoDocumentViewerProps) {
  const { toast } = useToast();

  const showDemoToast = (action: string) => {
    toast({
      title: "Demo only",
      description: `${action} is not functional in the demo. In your live LegalNote environment, this would export a formatted PDF.`,
      duration: 3000,
    });
  };

  const noteLines = matter.attendanceNoteBody.split("\n");

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      {/* Breadcrumb + toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <button onClick={onBack} className="hover:text-foreground transition-colors">Case Detail</button>
          <span>/</span>
          <span className="text-foreground font-medium">Attendance Note</span>
        </div>
        <div className="flex flex-wrap gap-2" data-testid="document-toolbar" data-demo-target="document-toolbar">
          <Button
            variant="outline"
            size="sm"
            onClick={() => showDemoToast("Export PDF")}
            data-testid="button-export-pdf"
            title="Demo only"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => showDemoToast("Export Word")}
            data-testid="button-export-word"
            title="Demo only"
          >
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Export Word
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => showDemoToast("Share")}
            data-testid="button-share-document"
            title="Demo only"
          >
            <Share2 className="w-3.5 h-3.5 mr-1.5" />
            Share
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => showDemoToast("Print")}
            data-testid="button-print-document"
            title="Demo only"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Print
          </Button>
        </div>
      </div>

      {/* AI generation notice */}
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground" data-testid="ai-generation-notice">
        <FileText className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
        <span>
          This attendance note was produced automatically from a {matter.transcriptDuration ?? "recorded"} recording &mdash; no manual typing required. Reviewed and approved by {matter.solicitor}.
        </span>
        <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700 flex-shrink-0 ml-auto">
          Approved
        </Badge>
      </div>

      {/* A4 Document */}
      <div className="flex justify-center">
        <div
          className="w-full max-w-3xl bg-white dark:bg-zinc-950 border border-border shadow-sm rounded-md overflow-hidden"
          data-testid="document-a4-frame"
          style={{ minHeight: "1100px" }}
        >
          {/* Letterhead */}
          <div className="border-b border-border px-10 py-7 bg-muted/20">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <span className="font-bold text-lg">{matter.firmName}</span>
                </div>
                <p className="text-xs text-muted-foreground">Solicitors &amp; Commissioners for Oaths</p>
              </div>
              <div className="text-right space-y-0.5">
                <p className="text-xs text-muted-foreground">Matter Ref: <span className="font-mono text-foreground">{matter.ref}</span></p>
                <p className="text-xs text-muted-foreground">Solicitor: {matter.solicitor}</p>
                <p className="text-xs text-muted-foreground">Date: {format(parseISO(matter.openedDate), "d MMMM yyyy")}</p>
              </div>
            </div>
          </div>

          {/* Document body */}
          <div className="px-10 py-8" data-testid="attendance-note-body" data-demo-target="attendance-note-body">
            <div className="prose dark:prose-invert max-w-none text-sm">
              {noteLines.map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={i} className="h-3" />;
                if (trimmed === "---") return <hr key={i} className="border-border my-4" />;
                if (trimmed.startsWith("ATTENDANCE NOTE")) {
                  return (
                    <h1 key={i} className="text-2xl font-bold text-center mb-6 tracking-wide">
                      {trimmed}
                    </h1>
                  );
                }
                if (
                  trimmed.match(/^(PURPOSE OF MEETING|BACKGROUND|KEY DISCUSSION POINTS|ACTION POINTS)$/) ||
                  trimmed.match(/^\d+\.\s+[A-Z]/)
                ) {
                  return (
                    <h3 key={i} className="text-sm font-bold mt-5 mb-2 uppercase tracking-wide text-muted-foreground">
                      {trimmed}
                    </h3>
                  );
                }
                if (trimmed.match(/^(Client:|Solicitor:)$/)) {
                  return <p key={i} className="text-sm font-semibold mt-3 mb-1">{trimmed}</p>;
                }
                if (trimmed.startsWith("- ")) {
                  return (
                    <p key={i} className="text-sm text-foreground/90 leading-relaxed pl-4 mb-1">
                      &bull; {trimmed.slice(2)}
                    </p>
                  );
                }
                if (trimmed.startsWith("Matter Reference:") || trimmed.startsWith("Matter:") || trimmed.startsWith("Solicitor:") || trimmed.startsWith("Date:") || trimmed.startsWith("Duration:") || trimmed.startsWith("Attendees:")) {
                  const [label, ...rest] = trimmed.split(":");
                  return (
                    <p key={i} className="text-sm leading-relaxed">
                      <span className="font-semibold">{label}:</span>{rest.join(":")}
                    </p>
                  );
                }
                return (
                  <p key={i} className="text-sm text-foreground/90 leading-relaxed mb-1.5">
                    {trimmed}
                  </p>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border px-10 py-4 bg-muted/10 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
            <span>Generated by LegalNote &mdash; Tamper-evident &middot; HMAC-SHA256 signed</span>
            <span>Page 1 of 1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
