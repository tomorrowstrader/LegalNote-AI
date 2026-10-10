import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Search, FolderOpen, PlusCircle, Loader2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Case, Client, MatterKind } from "@shared/schema";
import { MATTER_KIND_LABELS } from "@shared/schema";
import { isClientMatterKind, partyLabelForMatterKind } from "@shared/matterKinds";

interface CaseSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (caseItem: Case) => void;
  title?: string;
  description?: string;
  /** When true (default), show “Create new matter” for flows that need a case first. */
  allowCreate?: boolean;
}

export default function CaseSelectorModal({
  open,
  onOpenChange,
  onSelect,
  title = "Select a Case",
  description = "Which case is this call about?",
  allowCreate = true,
}: CaseSelectorModalProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [newCaseClient, setNewCaseClient] = useState("");
  const [newCaseMatterKind, setNewCaseMatterKind] = useState<MatterKind>("client");
  const [newCaseHasExternalAttendees, setNewCaseHasExternalAttendees] = useState(false);

  const { data: cases, isLoading } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    enabled: open,
  });

  const resetCreateForm = () => {
    setIsCreating(false);
    setNewCaseTitle("");
    setNewCaseClient("");
    setNewCaseMatterKind("client");
    setNewCaseHasExternalAttendees(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSearch("");
      resetCreateForm();
    }
    onOpenChange(next);
  };

  const createCaseMutation = useMutation({
    mutationFn: async () => {
      const titleTrimmed = newCaseTitle.trim();
      const clientTrimmed = newCaseClient.trim();
      const matterKind = newCaseMatterKind;
      const isClientMatter = isClientMatterKind(matterKind);

      if (!titleTrimmed) {
        throw new Error("Matter title is required");
      }
      if (isClientMatter && !clientTrimmed) {
        throw new Error("Client name is required");
      }

      if (isClientMatter) {
        const client = await apiRequest<Client>("POST", "/api/clients", {
          name: clientTrimmed,
        });
        return apiRequest<Case>("POST", "/api/cases", {
          title: titleTrimmed,
          clientId: client.id,
          clientName: clientTrimmed,
          matterKind: "client",
          sourceType: "audio",
          status: "pending",
          priority: "normal",
          conflictCheckCompleted: false,
          conflictCheckNote: "Deferred - matter opened from capture selector",
          practiceArea: "corporate_commercial",
          instructionStatus: "enquiry",
        });
      }

      return apiRequest<Case>("POST", "/api/cases", {
        title: titleTrimmed,
        clientName: partyLabelForMatterKind(matterKind),
        matterKind,
        hasExternalAttendees: newCaseHasExternalAttendees,
        sourceType: "audio",
        status: "pending",
        priority: "normal",
        conflictCheckCompleted: false,
      });
    },
    onSuccess: (newCase) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      resetCreateForm();
      onSelect(newCase);
      onOpenChange(false);
      toast({
        title: "Matter created",
        description: `"${newCase.title}" is ready - continue with your capture.`,
      });
    },
    onError: (error: Error) => {
      const raw = error.message || "";
      const withoutStatus = raw.replace(/^\d{3}:\s*/, "");
      let display = withoutStatus;
      try {
        const parsed = JSON.parse(withoutStatus);
        if (parsed?.message) display = parsed.message;
      } catch {
        // use as-is
      }
      toast({
        title: "Could not create matter",
        description: display || "Please try again.",
        variant: "destructive",
      });
    },
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[70vh] overflow-hidden flex flex-col" data-testid="dialog-case-selector">
        <DialogHeader>
          <DialogTitle>{isCreating ? "Create new matter" : title}</DialogTitle>
          <DialogDescription>
            {isCreating
              ? "Open a matter for this capture, then continue."
              : description}
          </DialogDescription>
        </DialogHeader>

        {isCreating ? (
          <div className="flex flex-col gap-3 overflow-y-auto py-1" data-testid="case-selector-create-form">
            <div className="flex flex-col gap-1.5">
              <Label>Matter type</Label>
              <RadioGroup
                value={newCaseMatterKind}
                onValueChange={(v) => {
                  const next = v as MatterKind;
                  setNewCaseMatterKind(next);
                  if (isClientMatterKind(next)) setNewCaseHasExternalAttendees(false);
                }}
                className="flex flex-col gap-2"
              >
                {(Object.entries(MATTER_KIND_LABELS) as [MatterKind, string][]).map(([value, label]) => (
                  <div key={value} className="flex items-center gap-2">
                    <RadioGroupItem value={value} id={`selector-kind-${value}`} />
                    <Label htmlFor={`selector-kind-${value}`} className="cursor-pointer font-normal">
                      {label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            {!isClientMatterKind(newCaseMatterKind) && (
              <div className="flex items-start gap-2">
                <Checkbox
                  id="selector-external-attendees"
                  checked={newCaseHasExternalAttendees}
                  onCheckedChange={(checked) => setNewCaseHasExternalAttendees(checked === true)}
                  data-testid="checkbox-selector-external-attendees"
                />
                <Label htmlFor="selector-external-attendees" className="cursor-pointer font-normal text-sm leading-snug">
                  External attendees present (outside the firm)
                </Label>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="selector-new-case-title">
                {isClientMatterKind(newCaseMatterKind) ? "Matter name" : "Meeting title"}
              </Label>
              <Input
                id="selector-new-case-title"
                placeholder={
                  isClientMatterKind(newCaseMatterKind)
                    ? "e.g. Smith v Jones - Conveyancing"
                    : "e.g. Sample transcript test"
                }
                value={newCaseTitle}
                onChange={(e) => setNewCaseTitle(e.target.value)}
                data-testid="input-selector-new-case-title"
              />
            </div>
            {isClientMatterKind(newCaseMatterKind) && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="selector-new-case-client">Client name</Label>
                <Input
                  id="selector-new-case-client"
                  placeholder="e.g. Mr James Smith"
                  value={newCaseClient}
                  onChange={(e) => setNewCaseClient(e.target.value)}
                  data-testid="input-selector-new-case-client"
                />
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={resetCreateForm}
                disabled={createCaseMutation.isPending}
                data-testid="button-selector-create-back"
              >
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={
                  !newCaseTitle.trim() ||
                  (isClientMatterKind(newCaseMatterKind) && !newCaseClient.trim()) ||
                  createCaseMutation.isPending
                }
                onClick={() => createCaseMutation.mutate()}
                data-testid="button-selector-create-continue"
              >
                {createCaseMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Create & continue"
                )}
              </Button>
            </div>
          </div>
        ) : (
          <>
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
                  {allowCreate && !search && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Create a new matter to continue.
                    </p>
                  )}
                </div>
              )}
            </div>

            {allowCreate && (
              <div className="border-t pt-3">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setIsCreating(true)}
                  data-testid="button-case-selector-create"
                >
                  <PlusCircle className="h-4 w-4" />
                  Create new matter
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
