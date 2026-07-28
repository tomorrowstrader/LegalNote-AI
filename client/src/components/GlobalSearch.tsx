import { useState, useEffect, useCallback } from "react";
import { Search, History, FileText, MessageSquare, ClipboardList, Clock, User, Loader2, ChevronRight, ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SearchHistory, Case } from "@shared/schema";

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

interface SearchResult {
  case: Case;
  matches: SearchMatch[];
  score: number;
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function getDocumentIcon(type: string) {
  switch (type) {
    case 'transcript':
      return <MessageSquare className="w-4 h-4 text-blue-500" />;
    case 'attendance_note':
      return <ClipboardList className="w-4 h-4 text-green-500" />;
    case 'summary':
      return <FileText className="w-4 h-4 text-purple-500" />;
    default:
      return <FileText className="w-4 h-4 text-muted-foreground" />;
  }
}

function getDocumentLabel(type: string) {
  switch (type) {
    case 'transcript':
      return 'Transcript';
    case 'attendance_note':
      return 'Attendance Note';
    case 'summary':
      return 'Summary';
    case 'case_field':
      return 'Case';
    default:
      return type;
  }
}

export default function GlobalSearch() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [documentType, setDocumentType] = useState("all");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: searchHistory } = useQuery<SearchHistory[]>({
    queryKey: ["/api/search/history"],
    enabled: resultsOpen && !debouncedQuery,
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery<SearchResult[]>({
    queryKey: ["/api/search/enhanced", debouncedQuery, documentType],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return [];
      const params = new URLSearchParams({ q: debouncedQuery.trim() });
      if (documentType !== 'all') params.set('type', documentType);
      const response = await fetch(`/api/search/enhanced?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: debouncedQuery.length >= 2,
  });

  const clearHistoryMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/search/history"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/search/history"] });
    },
  });

  const saveSearchMutation = useMutation({
    mutationFn: (data: { query: string; resultCount: number }) => 
      apiRequest("POST", "/api/search/history", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/search/history"] });
    },
  });

  const handleResultClick = useCallback((caseId: string, match: SearchMatch) => {
    // Build URL with appropriate parameters
    const params = new URLSearchParams();
    
    // Set the tab based on document type
    // Note: DocumentViewer uses 'attendance' not 'attendance_note' for tab value
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
    
    // Navigate to case detail
    const url = `/case/${caseId}${params.toString() ? '?' + params.toString() : ''}`;
    setLocation(url);
    setResultsOpen(false);
    setMobileOpen(false);
    setSearchQuery("");
    
    // Save search to history
    if (debouncedQuery) {
      saveSearchMutation.mutate({
        query: debouncedQuery,
        resultCount: searchResults?.length || 0,
      });
    }
  }, [setLocation, debouncedQuery, searchResults, saveSearchMutation]);

  const handleHistoryClick = (query: string) => {
    setSearchQuery(query);
  };

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

  const handleViewAllResults = () => {
    if (!searchQuery.trim()) return;
    
    const params = new URLSearchParams();
    params.set('q', searchQuery.trim());
    if (dateFilter !== 'all') params.set('date', dateFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (documentType !== 'all') params.set('type', documentType);
    
    setLocation(`/cases?${params.toString()}`);
    setResultsOpen(false);
    setMobileOpen(false);
    setSearchQuery("");
    
    // Save search to history
    saveSearchMutation.mutate({
      query: searchQuery.trim(),
      resultCount: searchResults?.length || 0,
    });
  };

  const SearchFilters = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="doc-type-filter">Document Type</Label>
        <Select value={documentType} onValueChange={setDocumentType}>
          <SelectTrigger id="doc-type-filter" data-testid="select-doc-type-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="transcript">Transcripts</SelectItem>
            <SelectItem value="attendance_note">Attendance Notes</SelectItem>
            <SelectItem value="summary">Summaries</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="date-filter">Date Range</Label>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger id="date-filter" data-testid="select-date-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="status-filter">Status</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger id="status-filter" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const ResultsContent = () => {
    // Show search history when no query
    if (!debouncedQuery) {
      if (searchHistory && searchHistory.length > 0) {
        return (
          <div className="py-2">
            <div className="flex items-center justify-between px-3 pb-2 border-b">
              <span className="text-sm font-medium flex items-center gap-2">
                <History className="w-4 h-4" />
                Recent Searches
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearHistoryMutation.mutate()}
                className="text-xs text-muted-foreground hover:text-foreground"
                data-testid="button-clear-history"
              >
                Clear
              </Button>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {searchHistory.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleHistoryClick(item.query)}
                  className="w-full px-3 py-2 text-left text-sm hover-elevate flex items-center justify-between group"
                  data-testid={`history-item-${item.id}`}
                >
                  <span className="truncate">{item.query}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.resultCount} results
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      }
      return (
        <div className="p-4 text-sm text-muted-foreground text-center">
          Type to search cases, transcripts, and documents...
        </div>
      );
    }

    // Show loading state
    if (searchLoading) {
      return (
        <div className="p-6 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Searching...</span>
        </div>
      );
    }

    // Show results
    if (searchResults && searchResults.length > 0) {
      return (
        <div className="py-2">
          <div className="px-3 pb-2 border-b">
            <span className="text-sm font-medium">
              {searchResults.length} case{searchResults.length !== 1 ? 's' : ''} found
            </span>
          </div>
          <ScrollArea className="max-h-80">
            {searchResults.slice(0, 5).map((result) => (
              <div key={result.case.id} className="border-b last:border-b-0">
                <div className="px-3 py-2 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate flex-1">
                      {result.case.clientName}
                    </span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {result.case.matterReference || 'No ref'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {result.case.title}
                  </p>
                </div>
                <div className="divide-y">
                  {(() => {
                    const isExpanded = expandedCases.has(result.case.id);
                    const visibleMatches = isExpanded ? result.matches : result.matches.slice(0, 3);
                    const hiddenCount = result.matches.length - 3;
                    
                    return (
                      <>
                        {visibleMatches.map((match, idx) => (
                          <button
                            key={`${match.documentType}-${match.documentId || idx}-${match.matchPosition}`}
                            type="button"
                            onClick={() => handleResultClick(result.case.id, match)}
                            className="w-full px-3 py-2 text-left hover-elevate group"
                            data-testid={`search-result-${result.case.id}-${idx}`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {getDocumentIcon(match.documentType)}
                              <span className="text-xs font-medium text-muted-foreground">
                                {getDocumentLabel(match.documentType)}
                              </span>
                              {match.timestampMs !== undefined && (
                                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatTimestamp(match.timestampMs)}
                                </Badge>
                              )}
                              {match.speaker && (
                                <Badge variant="outline" className="text-xs flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {match.speaker}
                                </Badge>
                              )}
                              <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <p className="text-sm text-foreground/90 line-clamp-2">
                              {match.snippet}
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
                            className="w-full px-3 py-2 text-left text-xs text-muted-foreground hover:text-foreground hover-elevate flex items-center gap-1"
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
              </div>
            ))}
          </ScrollArea>
          {searchResults.length > 5 && (
            <div className="px-3 py-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={handleViewAllResults}
                data-testid="button-view-all-results"
              >
                View all {searchResults.length} results
              </Button>
            </div>
          )}
        </div>
      );
    }

    // No results
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No results found for "{debouncedQuery}"
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Try different keywords or check spelling
        </p>
      </div>
    );
  };

  return (
    <>
      {/* Desktop search bar - visible on xl screens */}
      <div className="hidden xl:flex items-center gap-2">
        <Popover open={resultsOpen} onOpenChange={setResultsOpen}>
          <PopoverTrigger asChild>
            <div 
              className="relative w-[clamp(200px,20vw,320px)] cursor-text"
              onClick={() => setResultsOpen(true)}
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/60 dark:text-foreground/70 z-10 pointer-events-none" />
              <Input
                type="search"
                placeholder="Search cases, clients, or content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setResultsOpen(true)}
                onClick={(e) => {
                  e.stopPropagation();
                  setResultsOpen(true);
                }}
                className="global-search-input pl-10 border-border text-foreground placeholder:text-muted-foreground dark:border-white/50"
                data-testid="input-global-search"
              />
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-96 p-0" align="start">
            <ResultsContent />
          </PopoverContent>
        </Popover>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-foreground"
              data-testid="button-search-filters"
            >
              Filters
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <h4 className="font-medium">Search Filters</h4>
              <SearchFilters />
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Mobile/Tablet search - dialog triggered by icon button */}
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="xl:hidden text-primary-foreground"
            data-testid="button-search"
          >
            <Search className="w-5 h-5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Search</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col flex-1 min-h-0 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search cases, clients, or content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 text-left"
                data-testid="input-mobile-search"
                autoFocus
              />
            </div>
            
            <div className="flex-1 min-h-0 border rounded-md overflow-auto max-h-[40vh]">
              <ResultsContent />
            </div>
            
            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between text-muted-foreground hover:text-foreground"
                  data-testid="button-toggle-filters"
                >
                  <span className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4" />
                    Advanced Filters
                  </span>
                  {filtersOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <SearchFilters />
              </CollapsibleContent>
            </Collapsible>
            
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMobileOpen(false)}
                data-testid="button-cancel-search"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleViewAllResults}
                disabled={!searchQuery.trim()}
                data-testid="button-submit-search"
              >
                View All Results
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
