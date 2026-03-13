import { useState, useMemo } from "react";
import { FileText, Clock, CheckCircle2, FolderOpen, AlertTriangle, Search, SortAsc, Archive, AlertCircle, Mic, Keyboard, ClipboardCheck, Eye, ShieldCheck, Phone } from "lucide-react";
import { ScheduledMeetingsViewer } from "@/components/ScheduledMeetingsViewer";
import StatsCard from "@/components/StatsCard";
import CaseListView from "@/components/CaseListView";
import EmptyState from "@/components/EmptyState";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import type { Case } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays, differenceInHours, isPast } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import CaseSelectorModal from "@/components/CaseSelectorModal";
import LogCallModal from "@/components/LogCallModal";

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

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<StatusTab>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("deadline");
  const [showCaseSelector, setShowCaseSelector] = useState(false);
  const [logCallCase, setLogCallCase] = useState<Case | null>(null);

  const { data: cases, isLoading } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
  });

  const { data: attentionStats } = useQuery<AttentionStats>({
    queryKey: ["/api/dashboard/attention-stats"],
  });

  const { data: productivityStats } = useQuery<ProductivityStats>({
    queryKey: ["/api/dashboard/productivity-stats"],
  });

  const greeting = getTimeBasedGreeting();
  const firstName = user?.firstName || user?.email?.split('@')[0] || 'there';

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
    
    const allClear = overdue.length === 0 && awaitingReviewLong.length === 0 && audioExpiring === 0;
    
    return { overdue, awaitingReviewLong, audioExpiring, allClear };
  }, [cases, attentionStats]);

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
          actionLabel: "Create New Note",
          onAction: () => setLocation('/new-note'),
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
          <div className="flex-1 min-w-0">
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
                <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[10px] font-mono font-medium">L</kbd>
                <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[10px] font-mono font-medium">L</kbd>
                <span>to record</span>
              </div>
              <Button
                onClick={() => setLocation('/new-note')}
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold gap-2 shadow-md"
                data-testid="button-new-note"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">New Note</span>
                <span className="sm:hidden">New</span>
              </Button>
            </div>
            <button
              onClick={() => setShowCaseSelector(true)}
              className="text-xs text-muted-foreground flex items-center gap-1"
              data-testid="button-log-call-dashboard"
            >
              <Phone className="w-3 h-3" />
              Log a Call
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:gap-5 grid-cols-2 lg:grid-cols-4 mb-6">
          <StatsCard
            title="Total Cases"
            value={productivityStats?.totalCases ?? 0}
            icon={FileText}
            description={`${productivityStats?.thisMonthCases ?? 0} this month`}
            variant="ring"
            ringColor="primary"
          />
          <StatsCard
            title="Awaiting Review"
            value={productivityStats?.awaitingReview ?? 0}
            icon={Eye}
            description="ready for sign-off"
            variant="ring"
            ringColor="amber"
          />
          <StatsCard
            title="Defensibility Ready"
            value={productivityStats?.evidenceCompletePercent ?? 0}
            icon={ShieldCheck}
            suffix="%"
            description="protected & audit-ready"
            variant="ring"
            ringColor="emerald"
          />
          <StatsCard
            title="Documentation"
            value={productivityStats?.documentationRate ?? 0}
            icon={ClipboardCheck}
            suffix="%"
            description="cases with attendance notes"
            variant="ring"
            ringColor="blue"
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
          </div>
        )}

        <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StatusTab)} className="w-full">
            {/* Sticky Header with Title, Tabs, Search */}
            <div className="sticky top-0 z-10 bg-card border-b border-border p-4 sm:p-6 pb-4">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-muted-foreground" />
                  Case Files
                </h2>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 sm:w-64">
                    <Input
                      placeholder="Search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-3 bg-background"
                      data-testid="input-search-cases"
                    />
                  </div>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                    <SelectTrigger className="w-[140px] bg-background" data-testid="select-sort">
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
                  <span className="hidden xs:inline">Awaiting Review</span>
                  <span className="xs:hidden">Review</span>
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
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">
                      Showing {filteredAndSortedCases.length} {filteredAndSortedCases.length === 1 ? 'case' : 'cases'}
                      {searchQuery && ` matching "${searchQuery}"`}
                    </p>
                  </div>
                  <CaseListView cases={filteredAndSortedCases} />
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

      <CaseSelectorModal
        open={showCaseSelector}
        onOpenChange={setShowCaseSelector}
        onSelect={(caseItem) => setLogCallCase(caseItem)}
        title="Log a Phone Call"
        description="Which case is this call about?"
      />

      {logCallCase && (
        <LogCallModal
          open={!!logCallCase}
          onOpenChange={(open) => { if (!open) setLogCallCase(null); }}
          caseId={logCallCase.id}
          caseTitle={logCallCase.title}
          clientName={logCallCase.clientName}
          matterReference={logCallCase.matterReference || undefined}
        />
      )}
    </div>
  );
}
