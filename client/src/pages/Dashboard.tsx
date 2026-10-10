import { useState, useMemo, useEffect } from "react";
import { FileText, Clock, CheckCircle2, FolderOpen, AlertTriangle, Search, SortAsc, Archive, AlertCircle, Mic, Keyboard, ClipboardCheck, Eye, ShieldCheck, Shield, Phone, Video, Trash2, ArchiveRestore, Loader2, X } from "lucide-react";
import { ScheduledMeetingsViewer } from "@/components/ScheduledMeetingsViewer";
import StatsCard from "@/components/StatsCard";
import CaseListView from "@/components/CaseListView";
import EmptyState from "@/components/EmptyState";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Case } from "@shared/schema";
import type { AssignableRecording } from "@shared/assignableRecording";
import { formatRecordingClock, platformLabel, recordingListenHints, sameCallCount } from "@shared/assignableRecording";
import { UnassignedRecordingQueue } from "@/components/UnassignedRecordingQueue";
import { snoozeAssignmentQueue } from "@/components/VideoBotRecoveryModal";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays, differenceInHours, isPast } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { isFeatureVisible } from "@/lib/features";
import { useBulkCaseActions } from "@/hooks/useCaseActions";

const amlComplianceVisible = isFeatureVisible("amlCompliance");
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface AttentionStats {
  audioExpiringCount: number;
}

interface ProductivityStats {
  totalCases: number;
  awaitingReview: number;
  evidenceCompletePercent: number;
  documentationRate: number;
  thisMonthCases: number;
  monthlyTrend: "up" | "down" | "neutral";
  monthlyChange: number;
}

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

type StatusTab = "active" | "review" | "completed" | "archived";
type SortOption = "deadline" | "created" | "client" | "priority";
type StatsRange = "7d" | "30d" | "all";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<StatusTab>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("deadline");
  const [statsRange, setStatsRange] = useState<StatsRange>("all");
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueInitialId, setQueueInitialId] = useState<string | null>(null);
  const [discardTarget, setDiscardTarget] = useState<AssignableRecording | null>(null);
  const [discardConfirmed, setDiscardConfirmed] = useState(false);
  const [discardReason, setDiscardReason] = useState("");
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [bulkArchiveConfirmOpen, setBulkArchiveConfirmOpen] = useState(false);
  const [spotlight, setSpotlight] = useState<{
    ids: string[];
    token: number;
    tone: "overdue" | "review";
    message: string;
  } | null>(null);

  const { bulkArchiveMutation } = useBulkCaseActions({
    onSuccess: () => setSelectedCaseIds(new Set()),
  });

  const { data: cases, isLoading } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
  });

  const { data: unassignedImports } = useQuery<AssignableRecording[]>({
    queryKey: ["/api/recall/imports/unassigned"],
    refetchInterval: 30000,
  });

  const openAssignmentQueue = (importId?: string) => {
    setQueueInitialId(importId ?? unassignedImports?.[0]?.id ?? null);
    setQueueOpen(true);
  };

  const discardMutation = useMutation({
    mutationFn: async (payload: { importId: string; reason: string }) =>
      apiRequest("POST", `/api/recall/import/${payload.importId}/discard`, { reason: payload.reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recall/imports/unassigned"] });
      setDiscardTarget(null);
      setDiscardConfirmed(false);
      setDiscardReason("");
      toast({ title: "Recording discarded", description: "The recording and its stored audio have been permanently deleted.", duration: 4000 });
    },
    onError: () => {
      toast({ title: "Discard failed", description: "Could not discard the recording. Please try again.", variant: "destructive", duration: 4000 });
    },
  });

  const { data: attentionStats } = useQuery<AttentionStats>({
    queryKey: ["/api/dashboard/attention-stats"],
  });

  const riskCaseIds = useMemo(() => {
    if (!cases) return [];
    return cases.filter(c => c.riskLevel && !c.archived && !c.reviewed).map(c => c.id);
  }, [cases]);

  const { data: amlActivityDates } = useQuery<Record<string, string>>({
    queryKey: ["/api/aml-activity-dates", riskCaseIds],
    queryFn: () => apiRequest("POST", "/api/aml-activity-dates", { caseIds: riskCaseIds }),
    enabled: amlComplianceVisible && riskCaseIds.length > 0 && !!user?.complianceThread,
  });

  const { data: productivityStats } = useQuery<ProductivityStats>({
    queryKey: ["/api/dashboard/productivity-stats", statsRange],
    queryFn: async () => {
      const params = statsRange !== "all" ? `?range=${statsRange}` : "";
      const res = await fetch(`/api/dashboard/productivity-stats${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const greeting = getTimeBasedGreeting();
  // Greeting shows first name only - never last name, even if OAuth stuffed a full name into firstName.
  const firstName =
    user?.firstName?.trim().split(/\s+/)[0] ||
    user?.email?.split('@')[0] ||
    'there';

  const productivityInsight = useMemo(() => {
    if (!productivityStats) return null;
    const awaitingReview = productivityStats.awaitingReview ?? 0;
    if (awaitingReview > 0) {
      return `You have ${awaitingReview} case${awaitingReview === 1 ? '' : 's'} ready for review`;
    }
    const audioExpiring = attentionStats?.audioExpiringCount ?? 0;
    if (audioExpiring > 0) {
      return `${audioExpiring} recording${audioExpiring === 1 ? '' : 's'} expiring soon`;
    }
    const evidenceComplete = productivityStats.evidenceCompletePercent ?? 100;
    if (evidenceComplete < 100) {
      return `${evidenceComplete}% of cases are fully protected`;
    }
    return "All caught up today";
  }, [productivityStats, attentionStats]);

  const needsAttention = useMemo(() => {
    if (!cases) return { overdue: [], awaitingReviewLong: [], allClear: true };
    
    const now = new Date();
    
    const overdue = cases.filter(c => 
      c.deadline && 
      isPast(new Date(c.deadline)) && 
      !c.reviewed && 
      !c.archived
    );
    
    const awaitingReviewLong = cases.filter(c => {
      if (c.status !== "completed" || c.reviewed || c.archived) return false;
      const daysSinceCreated = differenceInDays(now, new Date(c.createdAt));
      return daysSinceCreated >= 2;
    });
    
    const audioExpiring = attentionStats?.audioExpiringCount || 0;

    const RISK_THRESHOLDS: Record<string, number> = { low: 365, medium: 183, high: 91 };
    const amlReviewDue = amlComplianceVisible && user?.complianceThread ? cases.filter(c => {
      if (!c.riskLevel || c.archived || c.reviewed) return false;
      const threshold = RISK_THRESHOLDS[c.riskLevel as string];
      if (!threshold) return false;
      const lastActivity = amlActivityDates?.[c.id] ? new Date(amlActivityDates[c.id]) : new Date(c.createdAt);
      return differenceInDays(now, lastActivity) > threshold;
    }) : [];
    
    const allClear = overdue.length === 0 && awaitingReviewLong.length === 0 && audioExpiring === 0 && amlReviewDue.length === 0;
    
    return { overdue, awaitingReviewLong, audioExpiring, amlReviewDue, allClear };
  }, [cases, attentionStats, amlActivityDates]);

  const transformCase = (caseItem: Case) => {
    const creatorName = user?.firstName && user?.lastName 
      ? `${user.firstName} ${user.lastName}` 
      : user?.email?.split('@')[0] || 'You';
    
    return {
      id: caseItem.id,
      title: caseItem.title,
      clientName: caseItem.clientName,
      meetingDate: format(new Date(caseItem.createdAt), "d MMMM yyyy"),
      status: caseItem.status as "pending" | "processing" | "completed",
      deadline: caseItem.deadline ? new Date(caseItem.deadline).toISOString() : null,
      createdBy: creatorName,
      priority: caseItem.priority as "urgent" | "deadline-soon" | "normal",
      reviewed: caseItem.reviewed,
    };
  };

  const categorizedCases = useMemo(() => {
    if (!cases) return { active: [], review: [], completed: [], archived: [] };
    
    return {
      active: cases.filter(c => 
        c.status !== "completed" && 
        !c.reviewed && 
        !c.archived
      ),
      review: cases.filter(c => 
        c.status === "completed" && 
        !c.reviewed && 
        !c.archived
      ),
      completed: cases.filter(c => 
        c.reviewed === true && 
        !c.archived
      ),
      archived: cases.filter(c => c.archived === true),
    };
  }, [cases]);

  useEffect(() => {
    if (!spotlight) return;
    const timer = window.setTimeout(() => setSpotlight(null), 3600);
    return () => window.clearTimeout(timer);
  }, [spotlight?.token]);

  const revealAttention = (targets: Case[], tone: "overdue" | "review") => {
    if (!targets.length) return;

    const activeIds = new Set(categorizedCases.active.map((c) => c.id));
    const reviewIds = new Set(categorizedCases.review.map((c) => c.id));
    const inActive = targets.filter((c) => activeIds.has(c.id));
    const inReview = targets.filter((c) => reviewIds.has(c.id));

    let tab: StatusTab = tone === "review" ? "review" : "active";
    let visible = tone === "review" ? inReview : inActive;
    if (tone === "overdue") {
      if (inActive.length === 0 && inReview.length > 0) {
        tab = "review";
        visible = inReview;
      } else {
        tab = "active";
        visible = inActive.length > 0 ? inActive : targets;
      }
    }
    if (visible.length === 0) visible = targets;

    const ordered = [...visible].sort((a, b) => {
      const aTime = a.deadline ? new Date(a.deadline).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.deadline ? new Date(b.deadline).getTime() : Number.POSITIVE_INFINITY;
      if (aTime !== bTime) return aTime - bTime;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const names = ordered.map((c) => c.clientName || c.title);
    const shown = names.slice(0, 3).join(", ");
    const extra = names.length > 3 ? ` and ${names.length - 3} more` : "";
    const label = tone === "overdue" ? "Overdue" : "Awaiting review";

    setSearchQuery("");
    setActiveTab(tab);
    setSortBy(tone === "overdue" ? "deadline" : "created");
    setSpotlight((prev) => ({
      ids: ordered.map((c) => c.id),
      token: (prev?.token ?? 0) + 1,
      tone,
      message: `${label}: ${shown}${extra}. Highlighted in the case list.`,
    }));
  };

  const filteredAndSortedCases = useMemo(() => {
    let filtered = categorizedCases[activeTab] || [];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.title.toLowerCase().includes(query) ||
        c.clientName.toLowerCase().includes(query) ||
        (c.matterReference && c.matterReference.toLowerCase().includes(query))
      );
    }
    
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "deadline":
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        case "created":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "client":
          return a.clientName.localeCompare(b.clientName);
        case "priority":
          const priorityOrder = { urgent: 0, "deadline-soon": 1, normal: 2 };
          return (priorityOrder[a.priority as keyof typeof priorityOrder] || 2) - 
                 (priorityOrder[b.priority as keyof typeof priorityOrder] || 2);
        default:
          return 0;
      }
    });
    
    return sorted;
  }, [categorizedCases, activeTab, searchQuery, sortBy]);

  const tabCounts = useMemo(() => ({
    active: categorizedCases.active.length,
    review: categorizedCases.review.length,
    completed: categorizedCases.completed.length,
    archived: categorizedCases.archived.length,
  }), [categorizedCases]);

  useEffect(() => {
    setSelectedCaseIds(new Set());
  }, [activeTab, searchQuery]);

  const priorityCasesCount = cases?.filter(c => 
    c.priority === "urgent" || c.priority === "deadline-soon"
  ).length || 0;

  const getEmptyStateForTab = (tab: StatusTab) => {
    switch (tab) {
      case "active":
        return {
          icon: FolderOpen,
          title: "No active cases",
          description: "Start by creating your first attendance note from a meeting recording",
          actionLabel: "Capture",
          onAction: () => setLocation('/capture'),
        };
      case "review":
        return {
          icon: CheckCircle2,
          title: "No cases awaiting review",
          description: "Cases ready for your final review will appear here",
        };
      case "completed":
        return {
          icon: CheckCircle2,
          title: "No completed cases",
          description: "Cases you've marked as reviewed will appear here",
        };
      case "archived":
        return {
          icon: Archive,
          title: "No archived cases",
          description: "Archived cases will appear here",
        };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
          <div className="flex items-center justify-between gap-4 mb-8">
            <div className="flex-1 min-w-0">
              <Skeleton className="h-9 w-64 mb-2" />
              <Skeleton className="h-5 w-48" />
            </div>
            <Skeleton className="h-10 w-28" />
          </div>

          <div className="grid gap-4 sm:gap-5 grid-cols-2 lg:grid-cols-4 mb-8 sm:mb-10">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-28 sm:h-32" />
            ))}
          </div>

          <Skeleton className="h-12 w-full mb-6" />

          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex-1 min-w-0" data-testid="dashboard-welcome-header">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {greeting}, {firstName}
            </h1>
            {productivityInsight && (
              <p className="text-sm text-muted-foreground mt-1">
                {productivityInsight}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1.5 rounded-md border border-border/50">
                <Keyboard className="w-3 h-3" />
                <span>Press</span>
                <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[10px] font-mono font-medium">Ctrl</kbd>
                <span>+</span>
                <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[10px] font-mono font-medium">L</kbd>
                <span>to record</span>
              </div>
              <Button
                onClick={() => setLocation('/capture')}
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold gap-2 shadow-md"
                data-testid="button-capture"
              >
                <Mic className="w-4 h-4" />
                <span className="hidden sm:inline">Capture</span>
                <span className="sm:hidden">Capture</span>
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLocation('/capture?mode=join')}
                className="text-xs text-muted-foreground flex items-center gap-1"
                data-testid="button-join-meeting-dashboard"
              >
                <Video className="w-3 h-3" />
                Join Meeting
              </button>
              <button
                onClick={() => setLocation('/capture?mode=phone')}
                className="text-xs text-muted-foreground flex items-center gap-1"
                data-testid="button-log-call-dashboard"
              >
                <Phone className="w-3 h-3" />
                Log a Call
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground">Overview</span>
          <div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5 border border-border/50">
            {([
              { value: "7d", label: "Last 7 days" },
              { value: "30d", label: "Last 30 days" },
              { value: "all", label: "All time" },
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatsRange(opt.value)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  statsRange === opt.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
                data-testid={`button-stats-range-${opt.value}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:gap-5 grid-cols-2 lg:grid-cols-4 mb-6">
          {/* ORIGINAL: containerClassName="bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800" */}
          {/* ORIGINAL: iconCircleClassName="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300" */}
          <StatsCard
            title="Total Cases"
            value={productivityStats?.totalCases ?? 0}
            icon={FileText}
            description={`${productivityStats?.thisMonthCases ?? 0} this month`}
            variant="ring"
            ringColor="primary"
            containerClassName="border-l-[3px] border-l-slate-400 dark:border-l-slate-500 border-slate-200 dark:border-slate-800"
            iconCircleClassName="text-slate-600 dark:text-slate-300"
          />
          {/* ORIGINAL: containerClassName="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900" */}
          {/* ORIGINAL: iconCircleClassName="bg-amber-200 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300" */}
          <StatsCard
            title="Awaiting Review"
            value={productivityStats?.awaitingReview ?? 0}
            icon={Eye}
            description="ready for sign-off"
            variant="ring"
            ringColor="amber"
            containerClassName="border-l-[3px] border-l-amber-500 dark:border-l-amber-400 border-amber-200 dark:border-amber-900"
            iconCircleClassName="text-amber-600 dark:text-amber-300"
          />
          {/* ORIGINAL: containerClassName="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900" */}
          {/* ORIGINAL: iconCircleClassName="bg-emerald-200 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300" */}
          <StatsCard
            title="Defensibility Ready"
            value={productivityStats?.evidenceCompletePercent ?? 0}
            icon={ShieldCheck}
            suffix="%"
            description="protected & audit-ready"
            variant="ring"
            ringColor="emerald"
            containerClassName="border-l-[3px] border-l-emerald-500 dark:border-l-emerald-400 border-emerald-200 dark:border-emerald-900"
            iconCircleClassName="text-emerald-600 dark:text-emerald-300"
          />
          {/* ORIGINAL: containerClassName="bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900" */}
          {/* ORIGINAL: iconCircleClassName="bg-sky-200 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300" */}
          <StatsCard
            title="Documentation"
            value={productivityStats?.documentationRate ?? 0}
            icon={ClipboardCheck}
            suffix="%"
            description="cases with attendance notes"
            variant="ring"
            ringColor="blue"
            containerClassName="border-l-[3px] border-l-sky-500 dark:border-l-sky-400 border-sky-200 dark:border-sky-900"
            iconCircleClassName="text-sky-600 dark:text-sky-300"
          />
        </div>

        {/* Needs Attention Notification Bar */}
        {!needsAttention.allClear && (
          <div className="mb-6 flex items-center gap-2 flex-wrap text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              Needs attention:
            </span>
            {needsAttention.overdue.length > 0 && (
              <button
                type="button"
                onClick={() => revealAttention(needsAttention.overdue, "overdue")}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 hover-elevate"
                aria-label={`Show ${needsAttention.overdue.length} overdue ${needsAttention.overdue.length === 1 ? "matter" : "matters"} in the case list`}
                data-testid="attention-overdue"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="font-medium">{needsAttention.overdue.length} overdue</span>
              </button>
            )}
            {needsAttention.awaitingReviewLong.length > 0 && (
              <button
                type="button"
                onClick={() => revealAttention(needsAttention.awaitingReviewLong, "review")}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 hover-elevate"
                aria-label={`Show ${needsAttention.awaitingReviewLong.length} ${needsAttention.awaitingReviewLong.length === 1 ? "matter" : "matters"} awaiting review in the case list`}
                data-testid="attention-review"
              >
                <Clock className="w-3.5 h-3.5" />
                <span className="font-medium">{needsAttention.awaitingReviewLong.length} awaiting review</span>
              </button>
            )}
            {needsAttention.audioExpiring > 0 && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-300"
                data-testid="attention-audio"
              >
                <Mic className="w-3.5 h-3.5" />
                <span className="font-medium">{needsAttention.audioExpiring} audio expiring</span>
              </span>
            )}
            {amlComplianceVisible && needsAttention.amlReviewDue.length > 0 && (
              <button
                onClick={() => {
                  const first = needsAttention.amlReviewDue[0];
                  if (first) setLocation(`/case/${first.id}?tab=compliance`);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 cursor-pointer"
                data-testid="attention-aml-review"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="font-medium">{needsAttention.amlReviewDue.length} AML review due</span>
              </button>
            )}
          </div>
        )}

        {/* Unassigned Recordings - above Case Files so assignment isn't buried */}
        {unassignedImports && unassignedImports.length > 0 && (
          <div className="mb-6 border border-amber-500/30 bg-amber-500/5 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-500/20">
              <Video className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                {unassignedImports.length} recording{unassignedImports.length !== 1 ? 's' : ''} awaiting assignment
              </p>
            </div>
            <div className="divide-y divide-amber-500/10">
              {unassignedImports.map((imp) => {
                const when = imp.meetingStartTime || imp.createdAt;
                const durationLabel = formatRecordingClock(imp.durationSeconds);
                const hints = recordingListenHints(imp);
                const reconnects = sameCallCount(imp, unassignedImports);
                return (
                <div key={imp.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" data-testid={`row-unassigned-import-${imp.id}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{imp.meetingTitle || `${platformLabel(imp.meetingPlatform)} call`}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {when ? format(new Date(when), "d MMM yyyy, HH:mm") : "Time unknown"}
                      {durationLabel ? ` · ${durationLabel}` : ""}
                      {" · "}{platformLabel(imp.meetingPlatform)}
                      {((imp.participantNames ?? []).length > 0) ? ` · ${imp.participantNames.join(", ")}` : ""}
                    </p>
                    {(hints.length > 0 || reconnects > 1 || imp.suggestedMatter) && (
                      <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                        {reconnects > 1 ? "Reconnect attempt. " : ""}
                        {hints.length > 0 ? `${hints.join(" ")} ` : ""}
                        {imp.suggestedMatter ? `Calendar match: ${imp.suggestedMatter.clientName || imp.suggestedMatter.title}.` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => openAssignmentQueue(imp.id)}
                      data-testid={`button-assign-import-${imp.id}`}
                    >
                      <Video className="w-3.5 h-3.5" />
                      Listen & assign
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => { setDiscardTarget(imp); setDiscardConfirmed(false); setDiscardReason(""); }}
                      disabled={discardMutation.isPending}
                      data-testid={`button-discard-import-${imp.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        <div id="case-files" className="bg-card border border-border rounded-lg overflow-hidden mb-6 scroll-mt-4">
          <p className="sr-only" aria-live="polite" data-testid="attention-spotlight-status">
            {spotlight?.message ?? ""}
          </p>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StatusTab)} className="w-full">
            {/* Sticky Header with Title, Tabs, Search */}
            <div className="sticky top-0 z-10 bg-card border-b border-border p-4 sm:p-6 pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 mb-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 flex-wrap">
                  <FolderOpen className="w-5 h-5 text-muted-foreground" />
                  Case Files
                  {unassignedImports && unassignedImports.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 border-amber-500/40 text-amber-800 dark:text-amber-200"
                      onClick={() => openAssignmentQueue()}
                      data-testid="button-recordings-to-assign"
                    >
                      {unassignedImports.length} to assign
                    </Button>
                  )}
                </h2>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64 min-w-0">
                    <Input
                      placeholder="Search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-3 bg-background"
                      data-testid="input-search-cases"
                    />
                  </div>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                    <SelectTrigger className="w-[130px] sm:w-[140px] shrink-0 bg-background" data-testid="select-sort">
                      <SortAsc className="w-4 h-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deadline">Deadline</SelectItem>
                      <SelectItem value="created">Date Created</SelectItem>
                      <SelectItem value="client">Client Name</SelectItem>
                      <SelectItem value="priority">Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <TabsList className="bg-muted/50 p-1 h-auto flex-wrap justify-start">
                <TabsTrigger 
                  value="active" 
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 px-3 py-2"
                  data-testid="tab-active"
                >
                  <Clock className="w-4 h-4" />
                  <span>Active</span>
                  {tabCounts.active > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                      {tabCounts.active}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="review" 
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 px-3 py-2"
                  data-testid="tab-review"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span className="hidden sm:inline">Awaiting Review</span>
                  <span className="sm:hidden">Review</span>
                  {tabCounts.review > 0 && (
                    <Badge variant="default" className="ml-1 h-5 min-w-5 px-1.5 text-xs bg-amber-500 text-white">
                      {tabCounts.review}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="completed" 
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 px-3 py-2"
                  data-testid="tab-completed"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Completed</span>
                  {tabCounts.completed > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                      {tabCounts.completed}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="archived" 
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 px-3 py-2"
                  data-testid="tab-archived"
                >
                  <Archive className="w-4 h-4" />
                  <span>Archived</span>
                  {tabCounts.archived > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                      {tabCounts.archived}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Scrollable Case List */}
            <div className="max-h-[400px] overflow-y-auto p-4 sm:px-6">
              {filteredAndSortedCases.length > 0 ? (
                <>
                  <div className="flex items-center justify-between gap-3 mb-3 min-h-9">
                    {selectedCaseIds.size > 0 ? (
                      <div className="flex flex-wrap items-center gap-2" data-testid="bulk-actions-bar">
                        <span className="text-sm font-medium text-foreground">
                          {selectedCaseIds.size} selected
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-muted-foreground"
                          onClick={() => setSelectedCaseIds(new Set())}
                          data-testid="button-clear-selection"
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          Clear
                        </Button>
                        {activeTab === "archived" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            disabled={bulkArchiveMutation.isPending}
                            onClick={() => {
                              bulkArchiveMutation.mutate({
                                caseIds: Array.from(selectedCaseIds),
                                archived: false,
                              });
                            }}
                            data-testid="button-bulk-restore"
                          >
                            {bulkArchiveMutation.isPending ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <ArchiveRestore className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            Restore
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            disabled={bulkArchiveMutation.isPending}
                            onClick={() => setBulkArchiveConfirmOpen(true)}
                            data-testid="button-bulk-archive"
                          >
                            {bulkArchiveMutation.isPending ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <Archive className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            Archive
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Showing {filteredAndSortedCases.length} {filteredAndSortedCases.length === 1 ? 'case' : 'cases'}
                        {searchQuery && ` matching "${searchQuery}"`}
                      </p>
                    )}
                  </div>
                  <CaseListView
                    cases={filteredAndSortedCases}
                    amlActivityDates={amlActivityDates}
                    complianceEnabled={amlComplianceVisible && !!user?.complianceThread}
                    selectionEnabled
                    selectedIds={selectedCaseIds}
                    onSelectionChange={setSelectedCaseIds}
                    spotlightIds={spotlight?.ids}
                    spotlightToken={spotlight?.token}
                    spotlightTone={spotlight?.tone}
                  />
                </>
              ) : searchQuery ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Search className="w-12 h-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-1">No results found</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    No cases match "{searchQuery}" in this category. Try a different search term or check other tabs.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4"
                    onClick={() => setSearchQuery("")}
                  >
                    Clear search
                  </Button>
                </div>
              ) : (
                <EmptyState {...getEmptyStateForTab(activeTab)} />
              )}
            </div>
          </Tabs>
        </div>

        {/* Upcoming Meetings Section */}
        <div className="mb-6">
          <ScheduledMeetingsViewer />
        </div>
      </div>

      {/* Listen, then assign or delete. Closing leaves the recordings on the dashboard. */}
      <Dialog
        open={queueOpen && !!unassignedImports?.length}
        onOpenChange={(open) => {
          if (!open) {
            snoozeAssignmentQueue();
            setQueueOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-xl" data-testid="dialog-assign-recording-queue">
          {unassignedImports && unassignedImports.length > 0 && (
            <UnassignedRecordingQueue
              key={queueInitialId ?? "first"}
              recordings={unassignedImports}
              initialId={queueInitialId}
              onNotNow={() => {
                snoozeAssignmentQueue();
                setQueueOpen(false);
              }}
              onFinished={() => setQueueOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Discard GDPR Confirmation Dialog */}
      <Dialog open={!!discardTarget} onOpenChange={(open) => { if (!open) { setDiscardTarget(null); setDiscardConfirmed(false); setDiscardReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Discard recording
            </DialogTitle>
            <DialogDescription>
              This will permanently delete the stored audio recording. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              <p className="font-medium">{discardTarget?.meetingTitle || "Untitled meeting"}</p>
              <p className="text-xs mt-0.5 opacity-80">
                {discardTarget?.meetingStartTime
                  ? format(new Date(discardTarget.meetingStartTime), "d MMM yyyy, HH:mm")
                  : discardTarget ? format(new Date(discardTarget.createdAt), "d MMM yyyy, HH:mm") : ""}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="discard-reason">Reason</Label>
              <Textarea
                id="discard-reason"
                value={discardReason}
                onChange={(event) => setDiscardReason(event.target.value)}
                placeholder="e.g. Empty join - the other person never connected"
                rows={2}
                maxLength={500}
                data-testid="input-discard-reason"
              />
              <p className="text-xs text-muted-foreground">
                This is written to the audit log. The recording was never filed on a matter, so the entry is kept against your account rather than a case file.
              </p>
            </div>
            <label className="flex items-start gap-3 cursor-pointer" htmlFor="discard-confirm-check">
              <input
                id="discard-confirm-check"
                type="checkbox"
                checked={discardConfirmed}
                onChange={(e) => setDiscardConfirmed(e.target.checked)}
                className="mt-0.5 shrink-0"
                data-testid="checkbox-discard-confirm"
              />
              <span className="text-sm text-foreground">
                I confirm I want to permanently delete this recording and its audio. This cannot be recovered.
              </span>
            </label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setDiscardTarget(null); setDiscardConfirmed(false); setDiscardReason(""); }}
                data-testid="button-discard-cancel"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={!discardConfirmed || discardReason.trim().length < 3 || discardMutation.isPending}
                onClick={() => {
                  if (discardTarget) discardMutation.mutate({ importId: discardTarget.id, reason: discardReason.trim() });
                }}
                data-testid="button-discard-confirm"
              >
                {discardMutation.isPending ? "Deleting..." : "Delete permanently"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={bulkArchiveConfirmOpen} onOpenChange={setBulkArchiveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Archive {selectedCaseIds.size} {selectedCaseIds.size === 1 ? "case" : "cases"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Selected cases will move to the Archived tab. You can restore them later from there.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-bulk-archive-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-bulk-archive-confirm"
              onClick={() => {
                bulkArchiveMutation.mutate({
                  caseIds: Array.from(selectedCaseIds),
                  archived: true,
                });
              }}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
