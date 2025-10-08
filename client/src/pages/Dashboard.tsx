import { FileText, Clock, CheckCircle2, FolderOpen } from "lucide-react";
import StatsCard from "@/components/StatsCard";
import CaseCard from "@/components/CaseCard";
import EmptyState from "@/components/EmptyState";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const [, setLocation] = useLocation();

  const priorityCases = [
    {
      id: "p1",
      title: "Urgent Litigation Response",
      clientName: "Smith Enterprises Ltd",
      meetingDate: "15 January 2025",
      status: "pending" as const,
      createdBy: "Sarah Johnson",
      priority: "urgent" as const,
      audioExpiresIn: 4,
    },
    {
      id: "p2",
      title: "Property Settlement Deadline",
      clientName: "Mrs. Rebecca Thompson",
      meetingDate: "14 January 2025",
      status: "processing" as const,
      createdBy: "Michael Brown",
      priority: "deadline-soon" as const,
      audioExpiresIn: 18,
    },
  ];

  const mockCases = [
    {
      id: "1",
      title: "Estate Planning Consultation",
      clientName: "Mrs. Catherine Williams",
      meetingDate: "14 January 2025",
      status: "completed" as const,
      createdBy: "Sarah Johnson",
      priority: "normal" as const,
    },
    {
      id: "2",
      title: "Contract Review Meeting",
      clientName: "ABC Corporation Ltd",
      meetingDate: "12 January 2025",
      status: "completed" as const,
      createdBy: "Michael Brown",
      priority: "normal" as const,
    },
    {
      id: "3",
      title: "Family Law Initial Consultation",
      clientName: "Mr. David Thompson",
      meetingDate: "10 January 2025",
      status: "completed" as const,
      createdBy: "Emma Davis",
      priority: "normal" as const,
    },
  ];

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
            value={42}
            icon={FileText}
            description="+3 this week"
          />
          <StatsCard
            title="This Month"
            value={12}
            icon={Clock}
          />
          <StatsCard
            title="Completed"
            value={37}
            icon={CheckCircle2}
            description="88% success rate"
          />
        </div>

        {priorityCases.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Priority Cases</h2>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {priorityCases.map((caseItem) => (
                <CaseCard key={caseItem.id} {...caseItem} />
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Cases</h2>
          {mockCases.length > 0 ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {mockCases.map((caseItem) => (
                <CaseCard key={caseItem.id} {...caseItem} />
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
