import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search, FolderOpen, FileText, MessageSquare, ClipboardList, Clock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import CaseCard from "@/components/CaseCard";
import EmptyState from "@/components/EmptyState";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Case } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SearchMatch {
  documentType: 'transcript' | 'attendance_note' | 'summary' | 'case_field';
  documentId?: string;
  fieldName?: string;
  snippet: string;
  matchPosition: number;
  createdAt?: string;
  timestampMs?: number;
  speaker?: string;
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

interface SearchResultWithMatches {
  case: Case;
  matches: SearchMatch[];
  score: number;
}

export default function SavedCases() {
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [documentType, setDocumentType] = useState("all");
  const lastSavedQuery = useRef<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlQuery = params.get('q');
    const urlType = params.get('type');
    if (urlQuery) {
      setSearchQuery(urlQuery);
    }
    if (urlType) {
      setDocumentType(urlType);
    }
  }, [location]);

  const { data: cases, isLoading: casesLoading } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    enabled: !searchQuery,
  });

  const { data: enhancedResults, isLoading: searchLoading } = useQuery<SearchResultWithMatches[]>({
    queryKey: ["/api/search/enhanced", searchQuery, documentType],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const params = new URLSearchParams();
      params.set('q', searchQuery.trim());
      if (documentType !== 'all') {
        params.set('type', documentType);
      }
      const response = await fetch(`/api/search/enhanced?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: !!searchQuery.trim(),
  });

  const saveSearchMutation = useMutation({
    mutationFn: (data: { query: string; resultCount: number }) =>
      apiRequest("POST", "/api/search/history", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/search/history"] });
    },
  });

  useEffect(() => {
    const query = searchQuery.trim();
    if (query && enhancedResults && query !== lastSavedQuery.current) {
      lastSavedQuery.current = query;
      saveSearchMutation.mutate({
        query,
        resultCount: enhancedResults.length,
      });
    }
  }, [searchQuery, enhancedResults]);

  const isLoading = casesLoading || searchLoading;
  const activeCases = searchQuery.trim()
    ? (enhancedResults?.map(r => r.case) || [])
    : (cases || []);

  const getMatchIcon = (type: string) => {
    switch (type) {
      case 'transcript':
        return <MessageSquare className="w-3 h-3" />;
      case 'attendance_note':
        return <ClipboardList className="w-3 h-3" />;
      case 'summary':
        return <FileText className="w-3 h-3" />;
      default:
        return <FileText className="w-3 h-3" />;
    }
  };

  const handleMatchClick = useCallback((caseId: string, match: SearchMatch) => {
    const params = new URLSearchParams();
    
    if (match.documentType === 'transcript') {
      params.set('tab', 'transcript');
      if (match.timestampMs !== undefined) {
        params.set('timestamp', match.timestampMs.toString());
      }
    } else if (match.documentType === 'attendance_note') {
      params.set('tab', 'attendance');
    } else if (match.documentType === 'summary') {
      params.set('tab', 'summary');
    }
    
    const url = `/case/${caseId}${params.toString() ? '?' + params.toString() : ''}`;
    setLocation(url);
  }, [setLocation]);

  const getMatchLabel = (type: string, fieldName?: string) => {
    switch (type) {
      case 'transcript':
        return 'Transcript';
      case 'attendance_note':
        return 'Attendance Note';
      case 'summary':
        return 'Summary';
      case 'case_field':
        return fieldName ? fieldName.replace(/([A-Z])/g, ' $1').trim() : 'Case';
      default:
        return type;
    }
  };

  const highlightMatch = (snippet: string, query: string) => {
    if (!query) return snippet;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = snippet.split(regex);
    const queryLower = query.toLowerCase();
    return parts.map((part, i) => 
      part.toLowerCase() === queryLower ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

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
              <h2 className="text-lg font-medium text-foreground">
                {searchQuery ? "Search Results" : "Active Cases"}
              </h2>
              <Badge variant="secondary">
                {activeCases.length}
              </Badge>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-auto sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search cases by title, client, or content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full sm:w-80"
                  data-testid="input-search-cases"
                />
              </div>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger className="w-full sm:w-40" data-testid="select-doc-type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="transcript">Transcripts</SelectItem>
                  <SelectItem value="attendance_note">Attendance Notes</SelectItem>
                  <SelectItem value="summary">Summaries</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading cases...</div>
          ) : activeCases.length > 0 ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {searchQuery.trim() && enhancedResults ? (
                enhancedResults.map((result) => (
                  <div key={result.case.id} className="space-y-2">
                    <CaseCard 
                      id={result.case.id}
                      title={result.case.title}
                      clientName={result.case.clientName}
                      meetingDate={new Date(result.case.createdAt).toLocaleDateString('en-GB', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                      status={result.case.status as "pending" | "processing" | "review_required" | "completed" | "failed"}
                      createdBy={result.case.createdBy}
                      priority={result.case.priority as "urgent" | "deadline-soon" | "normal"}
                      deadline={result.case.deadline ? new Date(result.case.deadline).toISOString() : null}
                      reviewed={result.case.reviewed}
                    />
                    {result.matches.length > 0 && (
                      <div className="bg-muted/50 rounded-md p-2 space-y-1">
                        <div className="text-xs font-medium text-muted-foreground px-2 py-1">
                          {result.matches.length} match{result.matches.length !== 1 ? 'es' : ''} found
                        </div>
                        {result.matches.slice(0, 3).map((match, idx) => (
                          <button
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMatchClick(result.case.id, match);
                            }}
                            className="w-full text-left px-2 py-1.5 rounded hover-elevate group cursor-pointer"
                            data-testid={`match-result-${result.case.id}-${idx}`}
                          >
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                              {getMatchIcon(match.documentType)}
                              <span>{getMatchLabel(match.documentType, match.fieldName)}</span>
                              {match.timestampMs !== undefined && (
                                <Badge variant="secondary" className="text-[10px] py-0 px-1 flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  {formatTimestamp(match.timestampMs)}
                                </Badge>
                              )}
                              <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <p className="text-foreground/80 text-xs leading-relaxed line-clamp-2">
                              {highlightMatch(match.snippet, searchQuery)}
                            </p>
                          </button>
                        ))}
                        {result.matches.length > 3 && (
                          <div className="text-xs text-muted-foreground px-2 py-1">
                            +{result.matches.length - 3} more matches
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                activeCases.map((caseItem) => (
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
                ))
              )}
            </div>
          ) : (
            <EmptyState
              icon={FolderOpen}
              title="No cases found"
              description={
                searchQuery
                  ? "No cases match your search criteria. Try different keywords or filters."
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
