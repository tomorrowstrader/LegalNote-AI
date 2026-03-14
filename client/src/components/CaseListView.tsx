import { useState, useRef, useEffect, useCallback } from "react";
import { format, isPast, differenceInDays } from "date-fns";
import { Clock, CheckCircle2, AlertCircle, Loader2, Eye, ChevronRight, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Case, PRACTICE_AREA_LABELS, type PracticeArea } from "@shared/schema";
import { useLocation } from "wouter";
import CaseDetailDrawer from "./CaseDetailDrawer";

// Hook for reduced motion preference
function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

interface CaseListViewProps {
  cases: Case[];
  onCaseClick?: (caseItem: Case) => void;
  amlActivityDates?: Record<string, string>;
  complianceEnabled?: boolean;
}

type CaseStatus = "completed" | "processing" | "pending" | "review_required" | "failed";

const statusConfig: Record<CaseStatus, { color: string; label: string }> = {
  completed: { color: "bg-emerald-500", label: "Completed" },
  processing: { color: "bg-blue-500", label: "Processing" },
  pending: { color: "bg-amber-500", label: "Pending" },
  review_required: { color: "bg-orange-500", label: "Review Required" },
  failed: { color: "bg-red-500", label: "Failed" },
};

const RISK_AGEING_THRESHOLDS: Record<string, number> = {
  low: 365,
  medium: 183,
  high: 91,
};

function isRiskAgeingOverdue(caseItem: Case, amlActivityDates?: Record<string, string>): boolean {
  if (!caseItem.riskLevel || caseItem.archived || caseItem.reviewed) return false;
  const threshold = RISK_AGEING_THRESHOLDS[caseItem.riskLevel as string];
  if (!threshold) return false;
  const lastActivity = amlActivityDates?.[caseItem.id] ? new Date(amlActivityDates[caseItem.id]) : new Date(caseItem.createdAt);
  return differenceInDays(new Date(), lastActivity) > threshold;
}

function getStatusDotColor(caseItem: Case): string {
  if (caseItem.reviewed) return "bg-emerald-500";
  
  if (caseItem.deadline && isPast(new Date(caseItem.deadline))) {
    return "bg-red-500";
  }
  
  if (caseItem.priority === "urgent") return "bg-red-500";
  if (caseItem.priority === "deadline-soon") return "bg-amber-500";
  
  const status = caseItem.status as CaseStatus;
  return statusConfig[status]?.color || "bg-muted-foreground";
}

function getStatusTooltip(caseItem: Case): string {
  if (caseItem.reviewed) return "Reviewed";
  
  if (caseItem.deadline && isPast(new Date(caseItem.deadline))) {
    return "Overdue";
  }
  
  if (caseItem.priority === "urgent") return "Action Required";
  if (caseItem.priority === "deadline-soon") return "Deadline Approaching";
  
  const status = caseItem.status as CaseStatus;
  return statusConfig[status]?.label || "Unknown";
}

function getPriorityBadge(caseItem: Case) {
  if (caseItem.reviewed) {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/30 text-xs font-medium">
        Reviewed
      </Badge>
    );
  }
  
  if (caseItem.deadline && isPast(new Date(caseItem.deadline))) {
    return (
      <Badge className="bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-red-500/30 text-xs font-medium">
        Overdue
      </Badge>
    );
  }
  
  if (caseItem.priority === "urgent") {
    return (
      <Badge className="bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-red-500/30 text-xs font-medium">
        Urgent
      </Badge>
    );
  }
  
  if (caseItem.priority === "deadline-soon") {
    return (
      <Badge className="bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/30 text-xs font-medium">
        Soon
      </Badge>
    );
  }
  
  return null;
}

export default function CaseListView({ cases, amlActivityDates, complianceEnabled }: CaseListViewProps) {
  const [, setLocation] = useLocation();
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const prefersReducedMotion = useReducedMotion();

  const handleRowClick = useCallback((caseItem: Case, index: number) => {
    setSelectedCase(caseItem);
    setFocusedIndex(index);
    setIsDrawerOpen(true);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (cases.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = prev < cases.length - 1 ? prev + 1 : prev;
          rowRefs.current[next]?.focus();
          return next;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = prev > 0 ? prev - 1 : 0;
          rowRefs.current[next]?.focus();
          return next;
        });
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < cases.length) {
          handleRowClick(cases[focusedIndex], focusedIndex);
        }
        break;
      case "Escape":
        if (isDrawerOpen) {
          e.preventDefault();
          setIsDrawerOpen(false);
        }
        break;
    }
  }, [cases, focusedIndex, isDrawerOpen, handleRowClick]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    };
    
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isDrawerOpen]);

  if (cases.length === 0) {
    return null;
  }

  return (
    <>
      <div 
        ref={listRef}
        className="divide-y divide-border rounded-lg border border-border bg-card overflow-hidden"
        role="listbox"
        aria-label="Case list"
        onKeyDown={handleKeyDown}
      >
        {/* Header row */}
        <div className="hidden sm:grid sm:grid-cols-[auto_1fr_1fr_minmax(0,140px)_100px_100px_32px] gap-3 px-4 py-2.5 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <div className="w-3"></div>
          <div>Client</div>
          <div>Case Title</div>
          <div>Practice Area</div>
          <div>Deadline</div>
          <div>Priority</div>
          <div></div>
        </div>

        {/* Case rows */}
        {cases.map((caseItem, index) => {
          const statusColor = getStatusDotColor(caseItem);
          const statusTooltip = getStatusTooltip(caseItem);
          const priorityBadge = getPriorityBadge(caseItem);
          const isSelected = selectedCase?.id === caseItem.id && isDrawerOpen;
          const isFocused = focusedIndex === index;

          return (
            <motion.button
              key={caseItem.id}
              ref={el => rowRefs.current[index] = el}
              onClick={() => handleRowClick(caseItem, index)}
              initial={prefersReducedMotion ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ 
                duration: 0.2, 
                delay: prefersReducedMotion ? 0 : index * 0.03,
                ease: "easeOut"
              }}
              className={cn(
                "w-full text-left transition-colors duration-150",
                "hover:bg-muted/50 focus:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/50",
                "grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_1fr_minmax(0,140px)_100px_100px_32px] gap-2 sm:gap-3 px-4 py-2.5",
                isSelected && "bg-primary/5 border-l-2 border-l-primary",
                isFocused && !isSelected && "bg-muted/30"
              )}
              role="option"
              aria-selected={isSelected}
              data-testid={`row-case-${caseItem.id}`}
            >
              {/* Status indicator */}
              <div className="flex items-center justify-center pt-0.5" title={statusTooltip}>
                <span className={cn(
                  "w-2.5 h-2.5 rounded-full ring-2 ring-background shadow-sm transition-transform duration-150",
                  statusColor,
                  (caseItem.status === "processing") && "animate-pulse"
                )} />
              </div>

              {/* Client name */}
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate text-sm">
                  {caseItem.clientName}
                </p>
                {/* Mobile: show case title below client */}
                <p className="text-xs text-muted-foreground truncate sm:hidden mt-0.5">
                  {caseItem.title}
                </p>
              </div>

              {/* Case title - desktop only */}
              <div className="hidden sm:block min-w-0">
                <p className="text-sm text-muted-foreground truncate">
                  {caseItem.title}
                </p>
              </div>

              {/* Practice area - desktop only */}
              <div className="hidden sm:flex items-center min-w-0">
                {caseItem.practiceArea ? (
                  <Badge variant="outline" className="text-[11px] truncate max-w-full no-default-hover-elevate no-default-active-elevate" data-testid={`badge-practice-${caseItem.id}`}>
                    {PRACTICE_AREA_LABELS[caseItem.practiceArea as PracticeArea] || caseItem.practiceArea}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground/50 text-xs">—</span>
                )}
              </div>

              {/* Deadline */}
              <div className="hidden sm:flex items-center text-sm text-muted-foreground">
                {caseItem.deadline ? (
                  <span className={cn(
                    isPast(new Date(caseItem.deadline)) && !caseItem.reviewed && "text-red-600 dark:text-red-400 font-medium"
                  )}>
                    {format(new Date(caseItem.deadline), "d MMM")}
                  </span>
                ) : (
                  <span className="text-muted-foreground/50">—</span>
                )}
              </div>

              {/* Priority badge */}
              <div className="hidden sm:flex items-center gap-1.5">
                {priorityBadge || <span className="text-muted-foreground/50 text-xs">Normal</span>}
                {complianceEnabled && caseItem.riskLevel && (
                  <Badge className={cn(
                    "text-xs no-default-hover-elevate no-default-active-elevate",
                    caseItem.riskLevel === "high" && "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
                    caseItem.riskLevel === "medium" && "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
                    caseItem.riskLevel === "low" && "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
                  )} data-testid={`badge-risk-${caseItem.id}`}>
                    {(caseItem.riskLevel as string).charAt(0).toUpperCase()}
                  </Badge>
                )}
                {complianceEnabled && isRiskAgeingOverdue(caseItem, amlActivityDates) && (
                  <Badge
                    className="text-xs cursor-pointer bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocation(`/case/${caseItem.id}?tab=compliance`);
                    }}
                    data-testid={`badge-aml-overdue-${caseItem.id}`}
                  >
                    <Shield className="w-3 h-3 mr-0.5" />
                    AML Review
                  </Badge>
                )}
              </div>

              {/* Arrow indicator + mobile badge */}
              <div className="flex items-center gap-2 justify-end">
                {/* Mobile priority badge */}
                <div className="sm:hidden">
                  {priorityBadge}
                </div>
                <ChevronRight className={cn(
                  "w-4 h-4 text-muted-foreground/50 transition-transform duration-150",
                  isSelected && "text-primary transform translate-x-0.5"
                )} />
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Case Detail Drawer */}
      <CaseDetailDrawer
        caseItem={selectedCase}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
      />
    </>
  );
}
