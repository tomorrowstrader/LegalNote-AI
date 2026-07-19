import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ChevronDown,
  Briefcase,
  FileText,
  Loader2,
  X,
  ExternalLink,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import type { Case } from "@shared/schema";
import { toTitleCase } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  processing: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  review_required: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  completed: "bg-green-500/10 text-green-500 border-green-500/20",
  failed: "bg-red-500/10 text-red-500 border-red-500/20",
};

const statusIconColor = (status: string) => {
  switch (status) {
    case "pending":
      return "text-amber-500";
    case "processing":
      return "text-blue-500";
    case "review_required":
      return "text-purple-500";
    case "completed":
      return "text-emerald-500";
    case "failed":
      return "text-red-500";
    default:
      return "text-muted-foreground";
  }
};

export default function CaseQuickSwitch() {
  const [location, setLocation] = useLocation();
  const caseMatch = location.match(/\/case\/([^/]+)/);
  const currentCaseId = caseMatch ? caseMatch[1] : null;
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: cases = [], isLoading } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    enabled: open,
  });

  const { data: currentCaseData } = useQuery<Case>({
    queryKey: ["/api/cases", currentCaseId],
    enabled: !!currentCaseId,
  });

  const recentCases = cases
    .filter((c) => !c.archived)
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime()
    )
    .slice(0, 8);

  const hasScrollableList = recentCases.length > 5;

  const handleCaseSelect = (caseId: string) => {
    setLocation(`/case/${caseId}`);
    setOpen(false);
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative hidden xl:block" ref={panelRef}>
      <Button
        variant="ghost"
        size="sm"
        className="flex gap-2 text-primary-foreground/80 hover:text-primary-foreground max-w-[200px]"
        onClick={() => setOpen((o) => !o)}
        data-testid="button-case-quick-switch"
        aria-label="Recent cases"
        aria-expanded={open}
      >
        <Briefcase className="w-4 h-4 flex-shrink-0" />
        <span className="truncate hidden sm:inline">
          {currentCaseData ? currentCaseData.title : "Switch Case"}
        </span>
        <ChevronDown className="w-3 h-3 flex-shrink-0" />
      </Button>

      {open && (
        <div
          className="absolute left-0 top-full mt-2 w-[calc(100vw-1rem)] max-w-96 z-50 overflow-hidden rounded-xl border border-[#e6ddd0] bg-white shadow-2xl dark:border-border dark:bg-popover"
          data-testid="panel-recent-cases"
        >
          <div className="flex items-start justify-between gap-3 border-b border-[#e8dfd2] bg-white px-4 py-3 dark:border-border dark:bg-popover">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Recent Cases</h3>
                {recentCases.length > 0 && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    {recentCases.length}
                  </Badge>
                )}
              </div>
              {hasScrollableList && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Showing latest cases. Scroll for more.
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs px-2 gap-1"
                onClick={() => {
                  setLocation("/cases");
                  setOpen(false);
                }}
                data-testid="quick-switch-view-all"
              >
                <FolderOpen className="w-3 h-3" />
                View all
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setOpen(false)}
                aria-label="Close recent cases"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>

          <ScrollArea className="max-h-[31rem] [&_[data-radix-scroll-area-scrollbar]]:opacity-100">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : recentCases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Briefcase className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No cases found</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Your recent cases will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-2 p-3">
                {recentCases.map((caseItem) => {
                  const isCurrent = currentCaseId === caseItem.id;
                  const iconColor = statusIconColor(caseItem.status);

                  return (
                    <button
                      key={caseItem.id}
                      type="button"
                      onClick={() => handleCaseSelect(caseItem.id)}
                      className={`flex w-full min-h-20 items-start gap-3 rounded-lg border px-3 py-3 text-left shadow-sm transition-colors dark:hover:bg-accent/20 ${
                        isCurrent
                          ? "border-[#dec27b] bg-white hover:bg-[#fff8e7] dark:border-amber-500/30 dark:bg-card dark:hover:bg-amber-500/10"
                          : "border-[#e8dfd2] bg-white hover:bg-[#fbf7ef] dark:border-border dark:bg-card"
                      }`}
                      data-testid={`quick-switch-case-${caseItem.id}`}
                    >
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f4ede2] dark:bg-muted ${iconColor}`}
                      >
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-foreground leading-tight flex-1 min-w-0 truncate">
                            {caseItem.title}
                          </p>
                          {isCurrent && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                              Current
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed truncate">
                          {caseItem.clientName || "Unknown Client"}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[10px] text-muted-foreground/70">
                            {format(
                              new Date(caseItem.updatedAt || caseItem.createdAt),
                              "dd MMM yyyy"
                            )}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <ExternalLink className="w-2.5 h-2.5" />
                            Open case
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ml-auto ${STATUS_COLORS[caseItem.status] || ""}`}
                          >
                            {toTitleCase(caseItem.status)}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
