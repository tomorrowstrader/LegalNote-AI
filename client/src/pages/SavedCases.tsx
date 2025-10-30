import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import CaseCard from "@/components/CaseCard";
import EmptyState from "@/components/EmptyState";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Case } from "@shared/schema";

export default function SavedCases() {
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  // Read search query from URL on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlQuery = params.get('q');
    if (urlQuery) {
      setSearchQuery(urlQuery);
    }
  }, [location]);

  // Use search API when there's a query, otherwise get all cases
  const { data: cases, isLoading } = useQuery<Case[]>({
    queryKey: searchQuery ? [`/api/search?q=${encodeURIComponent(searchQuery)}`] : ["/api/cases"],
  });

  // TODO: Re-implement archiving feature post-MVP
  const activeCases = cases || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-foreground mb-1">Saved Cases</h1>
          <p className="text-sm text-muted-foreground">
            Browse and search all your case documentation
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-medium text-foreground">Active Cases</h2>
              <Badge variant="secondary">
                {activeCases.length}
              </Badge>
            </div>

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
                  deadline={caseItem.deadline ? new Date(caseItem.deadline).toISOString() : null}
                  reviewed={caseItem.reviewed}
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
        </div>
      </div>
    </div>
  );
}
