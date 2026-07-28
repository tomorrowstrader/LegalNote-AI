import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Shield, UserPlus, X, Loader2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Client } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const RECENT_CLIENT_LIMIT = 8;

interface ClientNameAutocompleteProps {
  id?: string;
  selectedClient: Client | null;
  onSelect: (client: Client) => void;
  onClear: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
}

function AmlBadge({ level }: { level: string }) {
  return (
    <Badge
      variant={level === "high" ? "destructive" : level === "medium" ? "secondary" : "outline"}
      className="text-xs shrink-0"
    >
      <Shield className="w-3 h-3 mr-1" />
      {level.toUpperCase()}
    </Badge>
  );
}

export default function ClientNameAutocomplete({
  id,
  selectedClient,
  onSelect,
  onClear,
  disabled = false,
  placeholder = "Search existing clients or type a new name...",
  className,
  "data-testid": testId = "input-client-name",
}: ClientNameAutocompleteProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const trimmed = query.trim();
  const searching = trimmed.length >= 1;

  const { data: recentClients = [], isFetching: loadingRecent } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: open && !selectedClient && !searching,
  });

  const { data: searchResults = [], isFetching: loadingSearch } = useQuery<Client[]>({
    queryKey: [`/api/clients/search?q=${encodeURIComponent(trimmed)}`],
    enabled: open && !selectedClient && searching,
  });

  const results = searching
    ? searchResults
    : recentClients.slice(0, RECENT_CLIENT_LIMIT);

  const isFetching = searching ? loadingSearch : loadingRecent;
  const showCreate =
    searching &&
    !results.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());

  const optionCount = results.length + (showCreate ? 1 : 0);

  useEffect(() => {
    setHighlightIndex(0);
  }, [trimmed, open, results.length, showCreate]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest<Client>("POST", "/api/clients", { name });
    },
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      onSelect(client);
      setQuery("");
      setOpen(false);
    },
  });

  const handleSelect = (client: Client) => {
    onSelect(client);
    setQuery("");
    setOpen(false);
  };

  const handleClear = () => {
    onClear();
    setQuery("");
    setOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    setOpen(true);
    if (selectedClient) {
      onClear();
    }
  };

  const activateHighlighted = () => {
    if (optionCount === 0) return;
    if (highlightIndex < results.length) {
      handleSelect(results[highlightIndex]);
      return;
    }
    if (showCreate && trimmed) {
      createMutation.mutate(trimmed);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      e.preventDefault();
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (optionCount === 0 ? 0 : (i + 1) % optionCount));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) =>
        optionCount === 0 ? 0 : (i - 1 + optionCount) % optionCount,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      activateHighlighted();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  if (selectedClient) {
    return (
      <div className={cn("flex items-center gap-2 p-2 border rounded-md bg-muted/30", className)}>
        <span className="text-sm font-medium flex-1 truncate" data-testid="text-selected-client">
          {selectedClient.name}
        </span>
        {selectedClient.amlRiskLevel && <AmlBadge level={selectedClient.amlRiskLevel} />}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClear}
          disabled={disabled}
          data-testid="button-clear-client"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Input
        ref={inputRef}
        id={inputId}
        placeholder={placeholder}
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${inputId}-listbox`}
        aria-autocomplete="list"
        data-testid={testId}
      />
      {open && (
        <div
          id={`${inputId}-listbox`}
          role="listbox"
          className="absolute z-[100] top-full left-0 right-0 mt-1 border rounded-md bg-popover shadow-md max-h-56 overflow-y-auto"
          data-testid="dropdown-client-search"
        >
          {isFetching && results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Searching clients…
            </div>
          ) : results.length > 0 ? (
            results.map((c, index) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={highlightIndex === index}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover-elevate flex items-center justify-between gap-2",
                  highlightIndex === index && "bg-muted",
                )}
                onMouseEnter={() => setHighlightIndex(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(c)}
                data-testid={`option-client-${c.id}`}
              >
                <span className="truncate">{c.name}</span>
                {c.amlRiskLevel && (
                  <Badge
                    variant={
                      c.amlRiskLevel === "high"
                        ? "destructive"
                        : c.amlRiskLevel === "medium"
                          ? "secondary"
                          : "outline"
                    }
                    className="text-xs shrink-0"
                  >
                    {c.amlRiskLevel.toUpperCase()}
                  </Badge>
                )}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              {searching ? "No matching clients" : "No clients yet — type a name to add one"}
            </div>
          )}
          {showCreate && (
            <button
              type="button"
              role="option"
              aria-selected={highlightIndex === results.length}
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover-elevate flex items-center gap-2 border-t",
                highlightIndex === results.length && "bg-muted",
              )}
              onMouseEnter={() => setHighlightIndex(results.length)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => createMutation.mutate(trimmed)}
              disabled={createMutation.isPending}
              data-testid="button-create-client-inline"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              <span>
                {createMutation.isPending
                  ? "Creating…"
                  : `Add "${trimmed}" as new client`}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
