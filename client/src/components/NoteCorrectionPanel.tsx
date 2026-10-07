import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MeetingCastFields } from "@/components/MeetingCastFields";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { emptyMeetingCast, type MeetingCast } from "@shared/meetingCast";
import { noteRoleError, type NoteRole } from "@shared/noteCorrections";

export interface CorrectionProposal {
  id: string;
  original: string;
  replacement: string;
  reason: string;
  placement?: "replace" | "before";
}

type CorrectionMode = "selection" | "fact" | "replace" | "role";

interface NoteCorrectionPanelProps {
  caseId: string;
  documentId: string;
  selectedText: string;
  /** True when the matter is already instructed. An enquiry opens unticked. */
  instructionsAlreadyTaken?: boolean;
  onClose: () => void;
  onProposed: (proposals: CorrectionProposal[], unplacedCount: number) => void;
}

export function NoteCorrectionPanel({
  caseId,
  documentId,
  selectedText,
  instructionsAlreadyTaken = false,
  onClose,
  onProposed,
}: NoteCorrectionPanelProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<CorrectionMode>(selectedText.trim().length >= 8 ? "selection" : "fact");
  const [instruction, setInstruction] = useState("");
  const [find, setFind] = useState("");
  const [replaceWith, setReplaceWith] = useState("");
  const [instructionsTaken, setInstructionsTaken] = useState(instructionsAlreadyTaken);
  const [cast, setCast] = useState<MeetingCast>(emptyMeetingCast);
  const [pending, setPending] = useState(false);

  const role: NoteRole = {
    clientName: cast.clientName,
    instructionsTaken,
    clientPresent: cast.clientPresent,
    representativeName: cast.clientPresent ? "" : cast.representativeName,
    adviserIsFeeEarner: cast.adviserIsFeeEarner,
    adviserName: cast.adviserIsFeeEarner ? "" : cast.adviserName,
    attendees: cast.attendees,
  };
  const roleError = mode === "role" ? noteRoleError(role) : null;

  useEffect(() => {
    if (selectedText.trim().length >= 8) setMode("selection");
  }, [selectedText]);

  const submit = async () => {
    if (roleError) return;
    setPending(true);
    try {
      const result = await apiRequest<{
        proposals: CorrectionProposal[];
        unplacedCount: number;
      }>("POST", `/api/cases/${caseId}/documents/${documentId}/note-corrections`, {
        mode,
        instruction: mode === "replace" || mode === "role" ? undefined : instruction,
        selectedText: mode === "selection" ? selectedText : undefined,
        find: mode === "replace" ? find : undefined,
        replaceWith: mode === "replace" ? replaceWith : undefined,
        role: mode === "role" ? role : undefined,
      });
      if (!result.proposals.length) {
        toast({
          title: mode === "replace" ? "That name is not in the note" : "No change to make",
          description: mode === "replace"
            ? "A name inside a longer word is left as it is."
            : mode === "role"
              ? "The note already reflects who it is about."
              : "The note already says that, or the passage could not be revised on its own.",
        });
        return;
      }
      onProposed(result.proposals, result.unplacedCount);
    } catch (error: any) {
      toast({
        title: "Could not propose the correction",
        description: error?.message || "Try again.",
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-6 mb-4 rounded-md border border-border bg-muted/30 p-4 space-y-3" data-testid="note-correction-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Correct this note</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            The rest of the note stays as it is. Each change comes back for you to accept.
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onClose} data-testid="button-close-correction">
          Close
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ["selection", "Selected passage"],
          ["fact", "A fact"],
          ["replace", "A name"],
          ["role", "Who this note is about"],
        ] as const).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={mode === value ? "default" : "outline"}
            onClick={() => setMode(value)}
            data-testid={`button-correction-mode-${value}`}
          >
            {label}
          </Button>
        ))}
      </div>

      {mode === "selection" && (
        selectedText.trim().length >= 8 ? (
          <blockquote className="text-sm border-l-2 border-border pl-3 text-foreground/90 whitespace-pre-wrap" data-testid="text-correction-selection">
            {selectedText.trim()}
          </blockquote>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="text-correction-select-prompt">
            Highlight a passage in the note, then ask for changes in the bar on the selection.
          </p>
        )
      )}

      {mode === "role" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            A sentence is added at the start of what was discussed, and each change comes back for you to accept. Until instructions have been taken, “the client” becomes “the prospective client”. A client care letter is left as it is.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={instructionsTaken}
              onCheckedChange={(checked) => setInstructionsTaken(checked === true)}
              disabled={pending}
              data-testid="checkbox-correction-instructions-taken"
              className="mt-0.5"
            />
            <span>
              Instructions have been taken
              <span className="block text-xs text-muted-foreground mt-0.5">
                Until they have, the note calls them the prospective client.
              </span>
            </span>
          </label>
          <MeetingCastFields
            value={cast}
            onChange={setCast}
            hideIntro
            idPrefix="correction-"
            disabled={pending}
            clientLabel={instructionsTaken ? "Client" : "Prospective client"}
            clientPlaceholder={instructionsTaken ? "Name of the client" : "Name of the prospective client"}
            presentLabel={instructionsTaken ? "The client was present" : "The prospective client was present"}
            representativeLabel={instructionsTaken ? "Who attended for the client" : "Who attended and spoke on their behalf"}
          />
          {roleError && (
            <p className="text-xs text-muted-foreground" data-testid="text-correction-role-error">{roleError}</p>
          )}
        </div>
      ) : mode === "replace" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="correction-find">Find</Label>
            <Input
              id="correction-find"
              value={find}
              onChange={(event) => setFind(event.target.value)}
              placeholder="Jon"
              data-testid="input-correction-find"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="correction-replace">Replace with</Label>
            <Input
              id="correction-replace"
              value={replaceWith}
              onChange={(event) => setReplaceWith(event.target.value)}
              placeholder="John"
              data-testid="input-correction-replace"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="correction-instruction">
            {mode === "selection" ? "What should change" : "The correction"}
          </Label>
          <Textarea
            id="correction-instruction"
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder={mode === "selection"
              ? "Record that the person who attended was speaking for the client, who was not at the meeting."
              : "The client was not present. The person who attended spoke on their behalf and is not the client."}
            className="min-h-[88px]"
            data-testid="input-correction-instruction"
          />
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={pending || (mode === "selection" && selectedText.trim().length < 8) || roleError !== null}
          data-testid="button-propose-correction"
        >
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Propose changes"}
        </Button>
      </div>
    </div>
  );
}
