import { useState, useMemo, useEffect } from "react";
import { FileText, Clock, CheckCircle2, FolderOpen, AlertTriangle, Search, SortAsc, Archive, AlertCircle, Mic, Keyboard, ClipboardCheck, Eye, ShieldCheck, Shield, Phone, Video, Trash2, FolderPlus, PlusCircle, ListFilter, ArchiveRestore, Loader2, X } from "lucide-react";
import { ScheduledMeetingsViewer } from "@/components/ScheduledMeetingsViewer";
import StatsCard from "@/components/StatsCard";
import CaseListView from "@/components/CaseListView";
import EmptyState from "@/components/EmptyState";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Case, MeetingImport } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays, differenceInHours, isPast } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { isFeatureVisible } from "@/lib/features";
import { flushLiveBotNotesOnAssign } from "@/lib/meetingNotesDraft";
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
import { Label } from "@/components/ui/label";
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
  const [assignImport, setAssignImport] = useState<MeetingImport | null>(null);
  const [assignCaseId, setAssignCaseId] = useState("");
  const [assignRecordingType, setAssignRecordingType] = useState("full_meeting");
  const [assignMode, setAssignMode] = useState<"existing" | "new">("existing");
  const [newMatterTitle, setNewMatterTitle] = useState("");
  const [newMatterClient, setNewMatterClient] = useState("");
  const [discardTarget, setDiscardTarget] = useState<MeetingImport | null>(null);
  const [discardConfirmed, setDiscardConfirmed] = useState(false);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [bulkArchiveConfirmOpen, setBulkArchiveConfirmOpen] = useState(false);

  const { bulkArchiveMutation } = useBulkCaseActions({
    onSuccess: () => setSelectedCaseIds(new Set()),
  });

  const { data: cases, isLoading } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
  });

  const { data: unassignedImports } = useQuery<MeetingImport[]>({
    queryKey: ["/api/recall/imports/unassigned"],
    refetchInterval: 30000,
  });

  const assignMutation = useMutation({
    mutationFn: async ({ importId, caseId, recordingType, createCase, caseData }: {
      importId: string;
      caseId?: string;
      recordingType: string;
      createCase?: boolean;
      caseData?: { title: string; clientName: string };
    }) => apiRequest<{ success: boolean; caseId: string; importId: string }>(
      "POST",
      `/api/recall/import/${importId}/assign`,
      { caseId, recordingType, createCase, caseData },
    ),
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/recall/imports/unassigned"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      if (data?.caseId && data?.importId) {
        try {
          await flushLiveBotNotesOnAssign(
            data.importId,
            data.caseId,
            variables.caseData?.title,
          );
        } catch {
          // Draft retained locally if flush fails
        }
      }
      toast({ title: "Recording assigned", description: "The recording has been assigned and is now being processed.", duration: 4000 });
      setAssignImport(null);
      setAssignCaseId("");
      setAssignRecordingType("full_meeting");
      setAssignMode("existing");
      setNewMatterTitle("");
      setNewMatterClient("");
    },
    onError: () => {
      toast({ title: "Assignment failed", description: "Could not assign the recording. Please try again.", variant: "destructive", duration: 4000 });
    },
  });

  const discardMutation = useMutation({
    mutationFn: async (importId: string) =>
      apiRequest("POST", `/api/recall/import/${importId}/discard`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recall/imports/unassigned"] });
      setDiscardTarget(null);
      setDiscardConfirmed(false);
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
  // Greeting shows first name only — never last name, even if OAuth stuffed a full name into firstName.
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
                onClick={() => {
                  setActiveTab("active");
                  setSortBy("deadline");
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 hover-elevate"
                data-testid="attention-overdue"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="font-medium">{needsAttention.overdue.length} overdue</span>
              </button>
            )}
            {needsAttention.awaitingReviewLong.length > 0 && (
              <button
                onClick={() => {
                  setActiveTab("review");
                  setSortBy("created");
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 hover-elevate"
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

        <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StatusTab)} className="w-full">
            {/* Sticky Header with Title, Tabs, Search */}
            <div className="sticky top-0 z-10 bg-card border-b border-border p-4 sm:p-6 pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 mb-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-muted-foreground" />
                  Case Files
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

        {/* Unassigned Recordings Panel */}
        {unassignedImports && unassignedImports.length > 0 && (
          <div className="mb-6 border border-amber-500/30 bg-amber-500/5 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-500/20">
              <Video className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                {unassignedImports.length} recording{unassignedImports.length !== 1 ? 's' : ''} awaiting assignment
              </p>
            </div>
            <div className="divide-y divide-amber-500/10">
              {unassignedImports.map((imp) => (
                <div key={imp.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" data-testid={`row-unassigned-import-${imp.id}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{imp.meetingTitle || "Untitled meeting"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {imp.meetingStartTime ? format(new Date(imp.meetingStartTime), "d MMM yyyy, HH:mm") : format(new Date(imp.createdAt), "d MMM yyyy, HH:mm")}
                      {imp.durationSeconds ? ` · ${Math.round(imp.durationSeconds / 60)} min` : ""}
                      {" · "}{imp.meetingPlatform ? imp.meetingPlatform.charAt(0).toUpperCase() + imp.meetingPlatform.slice(1) : "Video call"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => { setAssignImport(imp); setAssignCaseId(""); setAssignRecordingType("full_meeting"); }}
                      data-testid={`button-assign-import-${imp.id}`}
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      Assign to matter
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => { setDiscardTarget(imp); setDiscardConfirmed(false); }}
                      disabled={discardMutation.isPending}
                      data-testid={`button-discard-import-${imp.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Meetings Section */}
        <div className="mb-6">
          <ScheduledMeetingsViewer />
        </div>
      </div>

      {/* Assign Recording Dialog */}
      <Dialog open={!!assignImport} onOpenChange={(open) => { if (!open) { setAssignImport(null); setAssignMode("existing"); setNewMatterTitle(""); setNewMatterClient(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="w-5 h-5" />
              Assign recording to a matter
            </DialogTitle>
            <DialogDescription>
              {assignImport?.meetingTitle || "Untitled meeting"} — choose which matter this recording belongs to and what type of session it was.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {/* Mode toggle */}
            <div className="flex rounded-md border overflow-hidden">
              <button
                type="button"
                className={`flex-1 px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${assignMode === "existing" ? "bg-accent text-accent-foreground" : "bg-transparent text-muted-foreground hover-elevate"}`}
                onClick={() => setAssignMode("existing")}
                data-testid="button-assign-mode-existing"
              >
                <ListFilter className="w-3.5 h-3.5" />
                Existing matter
              </button>
              <button
                type="button"
                className={`flex-1 px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${assignMode === "new" ? "bg-accent text-accent-foreground" : "bg-transparent text-muted-foreground hover-elevate"}`}
                onClick={() => setAssignMode("new")}
                data-testid="button-assign-mode-new"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Create new matter
              </button>
            </div>

            {assignMode === "existing" ? (
              <div className="space-y-2">
                <Label htmlFor="assign-case">Select matter</Label>
                <Select value={assignCaseId} onValueChange={setAssignCaseId}>
                  <SelectTrigger id="assign-case" data-testid="select-assign-case">
                    <SelectValue placeholder="Search and select a matter..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cases?.filter(c => !c.archived).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.title}{c.clientName ? ` — ${c.clientName}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="new-matter-title">Matter title <span className="text-accent">*</span></Label>
                  <Input
                    id="new-matter-title"
                    placeholder="e.g. Smith v Jones — contract dispute"
                    value={newMatterTitle}
                    onChange={(e) => setNewMatterTitle(e.target.value)}
                    data-testid="input-new-matter-title"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-matter-client">Client name <span className="text-accent">*</span></Label>
                  <Input
                    id="new-matter-client"
                    placeholder="e.g. Jane Smith"
                    value={newMatterClient}
                    onChange={(e) => setNewMatterClient(e.target.value)}
                    data-testid="input-new-matter-client"
                  />
                </div>
                <p className="text-xs text-muted-foreground">A new matter will be created and the recording will be processed against it.</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="assign-recording-type">Session type</Label>
              <Select value={assignRecordingType} onValueChange={setAssignRecordingType}>
                <SelectTrigger id="assign-recording-type" data-testid="select-assign-recording-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_meeting">Client Meeting</SelectItem>
                  <SelectItem value="telephone_call">Telephone Call</SelectItem>
                  <SelectItem value="court_hearing">Court Hearing</SelectItem>
                  <SelectItem value="police_station">Police Station</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setAssignImport(null); setAssignMode("existing"); setNewMatterTitle(""); setNewMatterClient(""); }}
                data-testid="button-assign-cancel"
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={assignMutation.isPending || (assignMode === "existing" ? !assignCaseId : !newMatterTitle.trim() || !newMatterClient.trim())}
                onClick={() => {
                  if (!assignImport) return;
                  if (assignMode === "existing" && assignCaseId) {
                    assignMutation.mutate({ importId: assignImport.id, caseId: assignCaseId, recordingType: assignRecordingType });
                  } else if (assignMode === "new" && newMatterTitle.trim()) {
                    assignMutation.mutate({
                      importId: assignImport.id,
                      recordingType: assignRecordingType,
                      createCase: true,
                      caseData: { title: newMatterTitle.trim(), clientName: newMatterClient.trim() },
                    });
                  }
                }}
                data-testid="button-assign-confirm"
              >
                {assignMutation.isPending ? "Assigning..." : "Assign & process"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discard GDPR Confirmation Dialog */}
      <Dialog open={!!discardTarget} onOpenChange={(open) => { if (!open) { setDiscardTarget(null); setDiscardConfirmed(false); } }}>
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
                onClick={() => { setDiscardTarget(null); setDiscardConfirmed(false); }}
                data-testid="button-discard-cancel"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={!discardConfirmed || discardMutation.isPending}
                onClick={() => {
                  if (discardTarget) discardMutation.mutate(discardTarget.id);
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
