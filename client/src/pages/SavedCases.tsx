import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, FolderOpen } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import CaseCard from "@/components/CaseCard";
import EmptyState from "@/components/EmptyState";
import { useLocation } from "wouter";

export default function SavedCases() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("active");

  const mockActiveCases = [
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
      status: "processing" as const,
      createdBy: "Michael Brown",
      priority: "normal" as const,
      audioExpiresIn: 8,
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
    {
      id: "4",
      title: "Property Dispute Mediation",
      clientName: "Johnson & Associates",
      meetingDate: "8 January 2025",
      status: "completed" as const,
      createdBy: "Sarah Johnson",
      priority: "normal" as const,
    },
    {
      id: "5",
      title: "Employment Law Consultation",
      clientName: "Tech Innovations Ltd",
      meetingDate: "5 January 2025",
      status: "completed" as const,
      createdBy: "Michael Brown",
      priority: "normal" as const,
    },
  ];

  const mockArchivedCases = [
    {
      id: "a1",
      title: "Commercial Lease Agreement Review",
      clientName: "Retail Properties PLC",
      meetingDate: "15 December 2024",
      status: "completed" as const,
      createdBy: "Sarah Johnson",
      priority: "normal" as const,
    },
    {
      id: "a2",
      title: "Employment Tribunal Case",
      clientName: "Global Tech Solutions",
      meetingDate: "3 December 2024",
      status: "completed" as const,
      createdBy: "Michael Brown",
      priority: "normal" as const,
    },
  ];

  const filteredActiveCases = mockActiveCases.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.clientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredArchivedCases = mockArchivedCases.filter(
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <TabsList>
              <TabsTrigger value="active" data-testid="tab-active-cases">
                Active Cases
                <Badge variant="secondary" className="ml-2">
                  {mockActiveCases.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="archived" data-testid="tab-archived-cases">
                Archived
                <Badge variant="secondary" className="ml-2">
                  {mockArchivedCases.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <div className="relative w-full sm:w-auto sm:max-w-md">
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

          <TabsContent value="active" className="mt-6">
            {filteredActiveCases.length > 0 ? (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {filteredActiveCases.map((caseItem) => (
                  <CaseCard key={caseItem.id} {...caseItem} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FolderOpen}
                title="No active cases found"
                description={
                  searchQuery
                    ? "No active cases match your search criteria"
                    : "Start by creating your first attendance note"
                }
                actionLabel={searchQuery ? undefined : "Create New Note"}
                onAction={searchQuery ? undefined : () => setLocation('/new-note')}
              />
            )}
          </TabsContent>

          <TabsContent value="archived" className="mt-6">
            {filteredArchivedCases.length > 0 ? (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {filteredArchivedCases.map((caseItem) => (
                  <div key={caseItem.id} className="relative">
                    <CaseCard {...caseItem} />
                    <Badge className="absolute top-2 left-2 bg-muted text-muted-foreground" data-testid={`badge-archived-${caseItem.id}`}>
                      Archived
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FolderOpen}
                title="No archived cases"
                description={
                  searchQuery
                    ? "No archived cases match your search criteria"
                    : "Archived cases will appear here"
                }
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
