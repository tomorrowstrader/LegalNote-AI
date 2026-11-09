import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Search, FolderOpen, FileText, MessageSquare, ClipboardList, Clock, ChevronRight, ChevronDown, ChevronUp, AudioLines } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  groupMatters,
  sortMatters,
  MATTER_SORT_LABELS,
  type MatterSort,
} from "@shared/matterList";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import CaseListView from "@/components/CaseListView";
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
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"open" | "closed">("open");
  const [sort, setSort] = useState<MatterSort>("newest");
  const [showRecovered, setShowRecovered] = useState(false);

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
  const isSearching = !!searchQuery.trim();
  const groups = useMemo(() => groupMatters(cases ?? []), [cases]);
  const listedMatters = useMemo(
    () => sortMatters(view === "open" ? groups.open : groups.closed, sort),
    [groups, view, sort],
  );
  const recoveredMatters = useMemo(() => sortMatters(groups.recovered, "newest"), [groups]);
  const searchResults = enhancedResults ?? [];

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

  const toggleExpandedCase = useCallback((caseId: string) => {
    setExpandedCases(prev => {
      const next = new Set(prev);
      if (next.has(caseId)) {
        next.delete(caseId);
      } else {
        next.add(caseId);
      }
      return next;
    });
  }, []);

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
          <h1 className="text-3xl font-semibold text-foreground mb-1">Matters</h1>
          <p className="text-sm text-muted-foreground">
            Find and open any matter, open or closed
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {isSearching ? (
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-medium text-foreground">Search results</h2>
                <Badge variant="secondary">{searchResults.length}</Badge>
              </div>
            ) : (
              <Tabs value={view} onValueChange={(v) => setView(v as "open" | "closed")}>
                <TabsList>
                  <TabsTrigger value="open" className="gap-2" data-testid="tab-matters-open">
                    Open
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">{groups.open.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="closed" className="gap-2" data-testid="tab-matters-closed">
                    Closed
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">{groups.closed.length}</Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-auto sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by client, matter or what was said..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full sm:w-80"
                  data-testid="input-search-cases"
                />
              </div>
              {isSearching ? (
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger className="w-full sm:w-44" data-testid="select-doc-type">
                    <SelectValue placeholder="Everywhere" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Everywhere</SelectItem>
                    <SelectItem value="transcript">Transcripts</SelectItem>
                    <SelectItem value="attendance_note">Attendance notes</SelectItem>
                    <SelectItem value="summary">Summaries</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Select value={sort} onValueChange={(v) => setSort(v as MatterSort)}>
                  <SelectTrigger className="w-full sm:w-44" data-testid="select-matter-sort" aria-label="Sort matters">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(MATTER_SORT_LABELS) as MatterSort[]).map((key) => (
                      <SelectItem key={key} value={key}>{MATTER_SORT_LABELS[key]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {!isSearching && view === "open" && recoveredMatters.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5" data-testid="panel-recovered-recordings">
              <button
                type="button"
                onClick={() => setShowRecovered((v) => !v)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                aria-expanded={showRecovered}
                data-testid="button-toggle-recovered"
              >
                <AudioLines className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                <span className="text-sm text-foreground">
                  <span className="font-medium">
                    {recoveredMatters.length} recovered recording{recoveredMatters.length === 1 ? "" : "s"}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    need{recoveredMatters.length === 1 ? "s" : ""} moving to the matter{recoveredMatters.length === 1 ? "" : "s"} they belong to
                  </span>
                </span>
                {showRecovered ? (
                  <ChevronUp className="w-4 h-4 ml-auto text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-auto text-muted-foreground" />
                )}
              </button>
              {showRecovered && (
                <ul className="border-t border-amber-500/20 divide-y divide-amber-500/10">
                  {recoveredMatters.map((rec) => (
                    <li key={rec.id}>
                      <button
                        type="button"
                        onClick={() => setLocation(`/case/${rec.id}`)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-amber-500/10 transition-colors"
                        data-testid={`row-recovered-${rec.id}`}
                      >
                        <span className="text-sm text-foreground">
                          Recorded {format(new Date(rec.createdAt), "d MMM yyyy, HH:mm")}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">Open to move</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading matters...</div>
          ) : isSearching ? (
            searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <div key={result.case.id} className="space-y-1">
                      <button
                        onClick={() => setLocation(`/case/${result.case.id}`)}
                        className="w-full text-left hover:bg-muted/50 transition-colors duration-150 grid grid-cols-[auto_1fr_auto] sm:grid-cols-[1fr_1fr_100px] gap-3 px-4 py-2.5 items-center rounded-lg border border-border bg-card"
                        data-testid={`row-search-result-${result.case.id}`}
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate text-sm">
                            {result.case.clientName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate sm:hidden mt-0.5">
                            {result.case.title}
                          </p>
                        </div>
                        <div className="hidden sm:block min-w-0">
                          <p className="text-sm text-muted-foreground truncate">
                            {result.case.title}
                          </p>
                        </div>
                        <div className="flex items-center justify-end gap-1.5">
                          {result.case.archived && (
                            <Badge variant="outline" className="text-xs" data-testid={`badge-closed-${result.case.id}`}>
                              Closed
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {result.matches.length} match{result.matches.length !== 1 ? 'es' : ''}
                          </Badge>
                        </div>
                      </button>
                      {result.matches.length > 0 && (
                        <div className="bg-muted/50 rounded-md p-2 space-y-1 ml-4">
                          {(() => {
                            const isExpanded = expandedCases.has(result.case.id);
                            const visibleMatches = isExpanded ? result.matches : result.matches.slice(0, 3);
                            const hiddenCount = result.matches.length - 3;
                            
                            return (
                              <>
                                {visibleMatches.map((match, idx) => (
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
                                {hiddenCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleExpandedCase(result.case.id);
                                    }}
                                    className="w-full px-2 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground hover-elevate flex items-center gap-1"
                                    data-testid={`toggle-matches-${result.case.id}`}
                                  >
                                    {isExpanded ? (
                                      <>
                                        <ChevronUp className="w-3 h-3" />
                                        Show fewer matches
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="w-3 h-3" />
                                        +{hiddenCount} more match{hiddenCount !== 1 ? 'es' : ''}
                                      </>
                                    )}
                                  </button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
            ) : (
              <EmptyState
                icon={FolderOpen}
                title="No matters found"
                description="Nothing matches that search, in open or closed matters. Try a client name, a matter reference or a word that was said."
              />
            )
          ) : listedMatters.length > 0 ? (
            <CaseListView cases={listedMatters} />
          ) : view === "closed" ? (
            <EmptyState
              icon={FolderOpen}
              title="No closed matters"
              description="Matters archived from the dashboard appear here, and stay searchable."
            />
          ) : (
            <EmptyState
              icon={FolderOpen}
              title="No open matters"
              description="Start by capturing your first meeting"
              actionLabel="Capture"
              onAction={() => setLocation('/capture')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
