import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, FolderOpen } from "lucide-react";
import CaseCard from "@/components/CaseCard";
import EmptyState from "@/components/EmptyState";
import { useLocation } from "wouter";

export default function SavedCases() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const mockCases = [
    {
      id: "1",
      title: "Estate Planning Consultation",
      clientName: "Mrs. Catherine Williams",
      meetingDate: "14 January 2025",
      status: "completed" as const,
      createdBy: "Sarah Johnson",
    },
    {
      id: "2",
      title: "Contract Review Meeting",
      clientName: "ABC Corporation Ltd",
      meetingDate: "12 January 2025",
      status: "processing" as const,
      createdBy: "Michael Brown",
    },
    {
      id: "3",
      title: "Family Law Initial Consultation",
      clientName: "Mr. David Thompson",
      meetingDate: "10 January 2025",
      status: "completed" as const,
      createdBy: "Emma Davis",
    },
    {
      id: "4",
      title: "Property Dispute Mediation",
      clientName: "Johnson & Associates",
      meetingDate: "8 January 2025",
      status: "completed" as const,
      createdBy: "Sarah Johnson",
    },
    {
      id: "5",
      title: "Employment Law Consultation",
      clientName: "Tech Innovations Ltd",
      meetingDate: "5 January 2025",
      status: "completed" as const,
      createdBy: "Michael Brown",
    },
  ];

  const filteredCases = mockCases.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.clientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-foreground mb-1">Saved Cases</h1>
          <p className="text-sm text-muted-foreground">
            Browse and search all your case documentation
          </p>
        </div>

        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search cases by title or client name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-cases"
            />
          </div>
        </div>

        {filteredCases.length > 0 ? (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredCases.map((caseItem) => (
              <CaseCard key={caseItem.id} {...caseItem} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FolderOpen}
            title="No cases found"
            description={
              searchQuery
                ? "No cases match your search criteria"
                : "Start by creating your first attendance note"
            }
            actionLabel={searchQuery ? undefined : "Create New Note"}
            onAction={searchQuery ? undefined : () => setLocation('/new-note')}
          />
        )}
      </div>
    </div>
  );
}
