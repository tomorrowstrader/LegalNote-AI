import { FileText, Clock, CheckCircle2, FolderOpen } from "lucide-react";
import StatsCard from "@/components/StatsCard";
import CaseCard from "@/components/CaseCard";
import EmptyState from "@/components/EmptyState";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Case } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function Dashboard() {
  const [, setLocation] = useLocation();

  const { data: cases, isLoading } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
  });

  // Separate priority cases from regular cases
  const priorityCases = cases?.filter(c => 
    c.priority === "urgent" || c.priority === "deadline-soon"
  ) || [];
  
  const recentCases = cases?.filter(c => 
    c.priority === "normal"
  ) || [];

  // Calculate stats from real data
  const totalCases = cases?.length || 0;
  const completedCases = cases?.filter(c => c.status === "completed").length || 0;
  const thisMonthCases = cases?.filter(c => {
    const caseDate = new Date(c.createdAt);
    const now = new Date();
    return caseDate.getMonth() === now.getMonth() && 
           caseDate.getFullYear() === now.getFullYear();
  }).length || 0;
  
  const successRate = totalCases > 0 
    ? Math.round((completedCases / totalCases) * 100) 
    : 0;

  // Transform Case data to CaseCard props format
  const transformCase = (caseItem: Case) => ({
    id: caseItem.id,
    title: caseItem.title,
    clientName: caseItem.clientName,
    meetingDate: format(new Date(caseItem.createdAt), "d MMMM yyyy"),
    status: caseItem.status as "pending" | "processing" | "completed",
    createdBy: "Solicitor", // TODO: Get from user relationship
    priority: caseItem.priority as "urgent" | "deadline-soon" | "normal",
    // TODO: Calculate audio expiry from audioRecordings table
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your case documentation and attendance notes
              </p>
            </div>
            <Button
              onClick={() => setLocation('/new-note')}
              className="bg-accent hover:bg-accent gap-2"
              data-testid="button-new-note"
            >
              <FileText className="w-4 h-4" />
              New Note
            </Button>
          </div>

          <div className="grid gap-6 grid-cols-1 md:grid-cols-3 mb-8">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>

          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your case documentation and attendance notes
            </p>
          </div>
          <Button
            onClick={() => setLocation('/new-note')}
            className="bg-accent hover:bg-accent gap-2"
            data-testid="button-new-note"
          >
            <FileText className="w-4 h-4" />
            New Note
          </Button>
        </div>

        <div className="grid gap-6 grid-cols-1 md:grid-cols-3 mb-8">
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
            title="Completed"
            value={completedCases}
            icon={CheckCircle2}
            description={`${successRate}% success rate`}
          />
        </div>

        {priorityCases.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Priority Cases</h2>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {priorityCases.map((caseItem) => (
                <CaseCard key={caseItem.id} {...transformCase(caseItem)} />
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Cases</h2>
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
        </div>
      </div>
    </div>
  );
}
