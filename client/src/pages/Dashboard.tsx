import { FileText, Clock, CheckCircle2, FolderOpen, AlertTriangle } from "lucide-react";
import StatsCard from "@/components/StatsCard";
import CaseCard from "@/components/CaseCard";
import EmptyState from "@/components/EmptyState";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Case } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: cases, isLoading } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
  });

  const priorityCases = cases?.filter(c => 
    c.priority === "urgent" || c.priority === "deadline-soon"
  ) || [];
  
  const recentCases = cases?.filter(c => 
    c.priority === "normal"
  ) || [];

  const totalCases = cases?.length || 0;
  const actionedCases = cases?.filter(c => c.status === "completed" || c.reviewed === true).length || 0;
  const thisMonthCases = cases?.filter(c => {
    const caseDate = new Date(c.createdAt);
    const now = new Date();
    return caseDate.getMonth() === now.getMonth() && 
           caseDate.getFullYear() === now.getFullYear();
  }).length || 0;
  
  const successRate = totalCases > 0 
    ? Math.round((actionedCases / totalCases) * 100) 
    : 0;

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
          <div className="flex items-center justify-between gap-4 mb-8">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Premium, modern Legal Compliance AI Dashboard
              </p>
            </div>
            <Skeleton className="h-10 w-28" />
          </div>

          <div className="grid gap-4 sm:gap-5 grid-cols-2 lg:grid-cols-4 mb-8 sm:mb-10">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-28 sm:h-32" />
            ))}
          </div>

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
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Premium, modern Legal Compliance AI Dashboard
            </p>
          </div>
          <Button
            onClick={() => setLocation('/new-note')}
            className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold gap-2 flex-shrink-0 shadow-md"
            data-testid="button-new-note"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">New Note</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>

        <div className="grid gap-4 sm:gap-5 grid-cols-2 lg:grid-cols-4 mb-8 sm:mb-10">
          <StatsCard
            title="Total Cases"
            value={totalCases}
            icon={FileText}
            description={`${thisMonthCases} this month`}
          />
          <StatsCard
            title="This Month"
            value={thisMonthCases}
            icon={Clock}
          />
          <StatsCard
            title="Actioned"
            value={actionedCases}
            icon={CheckCircle2}
            description={`${successRate}% of total cases`}
          />
          <StatsCard
            title="Priority Cases"
            value={priorityCases.length > 0 ? priorityCases.length : "—"}
            icon={AlertTriangle}
          />
        </div>

        {priorityCases.length > 0 && (
          <section className="mb-8 sm:mb-10">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4">Priority Cases</h2>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {priorityCases.map((caseItem) => (
                <CaseCard key={caseItem.id} {...transformCase(caseItem)} />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4">Recent Cases</h2>
          {recentCases.length > 0 ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {recentCases.map((caseItem) => (
                <CaseCard key={caseItem.id} {...transformCase(caseItem)} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FolderOpen}
              title="No cases yet"
              description="Start by creating your first attendance note from a meeting recording"
              actionLabel="Create New Note"
              onAction={() => setLocation('/new-note')}
            />
          )}
        </section>
      </div>
    </div>
  );
}
