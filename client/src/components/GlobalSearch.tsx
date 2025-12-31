import { useState, useEffect } from "react";
import { Search, History, X, FileText, MessageSquare, ClipboardList } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SearchHistory } from "@shared/schema";

export default function GlobalSearch() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [documentType, setDocumentType] = useState("all");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: searchHistory } = useQuery<SearchHistory[]>({
    queryKey: ["/api/search/history"],
    enabled: historyOpen,
  });

  const clearHistoryMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/search/history"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/search/history"] });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      return;
    }
    
    const params = new URLSearchParams();
    params.set('q', searchQuery.trim());
    
    if (dateFilter && dateFilter !== 'all') {
      params.set('date', dateFilter);
    }
    
    if (statusFilter && statusFilter !== 'all') {
      params.set('status', statusFilter);
    }
    
    if (documentType && documentType !== 'all') {
      params.set('type', documentType);
    }
    
    setLocation(`/cases?${params.toString()}`);
    setMobileOpen(false);
    setHistoryOpen(false);
    setSearchQuery("");
  };

  const handleHistoryClick = (query: string) => {
    setSearchQuery(query);
    setHistoryOpen(false);
    const params = new URLSearchParams();
    params.set('q', query);
    setLocation(`/cases?${params.toString()}`);
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

  return (
    <>
      {/* Desktop search bar - visible on xl screens */}
      <form onSubmit={handleSearch} className="hidden xl:flex items-center gap-2">
        <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
          <PopoverTrigger asChild>
            <div className="relative w-[clamp(200px,20vw,320px)]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/70 z-10 pointer-events-none" />
              <Input
                type="search"
                placeholder="Search cases, clients, or content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setHistoryOpen(true)}
                className="pl-10 bg-white/90 border-white/50 text-foreground placeholder:text-muted-foreground"
                data-testid="input-global-search"
              />
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            {searchHistory && searchHistory.length > 0 ? (
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
            ) : (
              <div className="p-4 text-sm text-muted-foreground text-center">
                No recent searches
              </div>
            )}
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
      </form>

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
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Search</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search cases, clients, or content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-mobile-search"
                autoFocus
              />
            </div>
            
            {searchHistory && searchHistory.length > 0 && (
              <div className="border rounded-md">
                <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Recent Searches
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearHistoryMutation.mutate()}
                    className="text-xs"
                    data-testid="button-clear-history-mobile"
                  >
                    Clear
                  </Button>
                </div>
                <div className="max-h-32 overflow-y-auto">
                  {searchHistory.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSearchQuery(item.query);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover-elevate flex items-center justify-between"
                      data-testid={`history-item-mobile-${item.id}`}
                    >
                      <span className="truncate">{item.query}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.resultCount} results
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <SearchFilters />
            
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMobileOpen(false)}
                data-testid="button-cancel-search"
              >
                Cancel
              </Button>
              <Button type="submit" data-testid="button-submit-search">
                Search
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
