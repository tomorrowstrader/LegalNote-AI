import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, FolderOpen } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import CaseCard from "@/components/CaseCard";
import EmptyState from "@/components/EmptyState";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Case } from "@shared/schema";

export default function SavedCases() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("active");

  const { data: cases, isLoading } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
  });

  // Filter cases based on search query
  const filteredCases = (cases || []).filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.clientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // For MVP, all cases are "active" - archiving feature to be added later
  const activeCases = filteredCases;
  const archivedCases: Case[] = []; // No archived cases for MVP

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
                  {activeCases.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="archived" data-testid="tab-archived-cases">
                Archived
                <Badge variant="secondary" className="ml-2">
                  {archivedCases.length}
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
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading cases...</div>
            ) : activeCases.length > 0 ? (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {activeCases.map((caseItem) => (
                  <CaseCard 
                    key={caseItem.id} 
                    id={caseItem.id}
                    title={caseItem.title}
                    clientName={caseItem.clientName}
                    meetingDate={new Date(caseItem.createdAt).toLocaleDateString('en-GB', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                    status={caseItem.status as "pending" | "processing" | "review_required" | "completed" | "failed"}
                    createdBy={caseItem.createdBy}
                    priority={caseItem.priority as "urgent" | "deadline-soon" | "normal"}
                  />
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
          </TabsContent>

          <TabsContent value="archived" className="mt-6">
            <EmptyState
              icon={FolderOpen}
              title="Archiving coming soon"
              description="Case archiving feature will be available in a future update"
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
