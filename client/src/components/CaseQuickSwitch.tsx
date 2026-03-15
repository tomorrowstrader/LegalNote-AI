import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronDown, Briefcase, Clock, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { Case } from "@shared/schema";
import { toTitleCase } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  processing: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  review_required: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  completed: "bg-green-500/10 text-green-500 border-green-500/20",
  failed: "bg-red-500/10 text-red-500 border-red-500/20",
};

export default function CaseQuickSwitch() {
  const [location, setLocation] = useLocation();
  const caseMatch = location.match(/\/case\/([^/]+)/);
  const currentCaseId = caseMatch ? caseMatch[1] : null;
  const [open, setOpen] = useState(false);

  const { data: cases = [], isLoading } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    enabled: open,
  });

  const { data: currentCaseData } = useQuery<Case>({
    queryKey: ["/api/cases", currentCaseId],
    enabled: !!currentCaseId,
  });

  const recentCases = cases
    .filter(c => !c.archived)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
    .slice(0, 8);

  const handleCaseSelect = (caseId: string) => {
    setLocation(`/case/${caseId}`);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="hidden xl:flex gap-2 text-primary-foreground/80 hover:text-primary-foreground max-w-[200px]"
          data-testid="button-case-quick-switch"
        >
          <Briefcase className="w-4 h-4 flex-shrink-0" />
          <span className="truncate hidden sm:inline">
            {currentCaseData ? currentCaseData.title : "Switch Case"}
          </span>
          <ChevronDown className="w-3 h-3 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Recent Cases
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : recentCases.length === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No cases found
          </div>
        ) : (
          recentCases.map((caseItem) => (
            <DropdownMenuItem
              key={caseItem.id}
              onClick={() => handleCaseSelect(caseItem.id)}
              className={`flex flex-col items-start gap-1 py-2 cursor-pointer ${
                currentCaseId === caseItem.id ? "bg-accent/50" : ""
              }`}
              data-testid={`quick-switch-case-${caseItem.id}`}
            >
              <div className="flex items-center gap-2 w-full">
                <FileText className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                <span className="font-medium truncate flex-1">{caseItem.title}</span>
                {currentCaseId === caseItem.id && (
                  <Badge variant="outline" className="text-xs">Current</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 w-full pl-6 min-w-0">
                <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
                  {caseItem.clientName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(caseItem.updatedAt || caseItem.createdAt), "dd MMM")}
                </span>
                <Badge 
                  variant="outline" 
                  className={`text-xs ml-auto ${STATUS_COLORS[caseItem.status] || ""}`}
                >
                  {toTitleCase(caseItem.status)}
                </Badge>
              </div>
            </DropdownMenuItem>
          ))
        )}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => { setLocation("/cases"); setOpen(false); }}
          className="justify-center text-sm"
          data-testid="quick-switch-view-all"
        >
          View All Cases
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
