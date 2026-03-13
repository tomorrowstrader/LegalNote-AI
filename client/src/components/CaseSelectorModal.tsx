import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, FolderOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import type { Case } from "@shared/schema";

interface CaseSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (caseItem: Case) => void;
  title?: string;
  description?: string;
}

export default function CaseSelectorModal({
  open,
  onOpenChange,
  onSelect,
  title = "Select a Case",
  description = "Which case is this call about?",
}: CaseSelectorModalProps) {
  const [search, setSearch] = useState("");

  const { data: cases, isLoading } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    enabled: open,
  });

  const activeCases = (cases || []).filter(c => !c.archived);

  const filtered = search.trim()
    ? activeCases.filter(c =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.clientName.toLowerCase().includes(search.toLowerCase()) ||
        (c.matterReference && c.matterReference.toLowerCase().includes(search.toLowerCase()))
      )
    : activeCases;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[70vh] overflow-hidden flex flex-col" data-testid="dialog-case-selector">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search cases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-case-selector-search"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 -mx-6 px-6 py-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : filtered.length > 0 ? (
            filtered.map(c => (
              <Card
                key={c.id}
                className="cursor-pointer hover-elevate"
                onClick={() => {
                  onSelect(c);
                  onOpenChange(false);
                }}
                data-testid={`case-selector-item-${c.id}`}
              >
                <CardContent className="p-3">
                  <div className="text-sm font-medium">{c.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {c.clientName}
                    {c.matterReference && <span className="ml-2">Ref: {c.matterReference}</span>}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FolderOpen className="w-10 h-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {search ? `No cases match "${search}"` : "No active cases found"}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
