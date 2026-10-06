import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface CorrectionProposal {
  id: string;
  original: string;
  replacement: string;
  reason: string;
}

type CorrectionMode = "selection" | "fact" | "replace";

interface NoteCorrectionPanelProps {
  caseId: string;
  documentId: string;
  selectedText: string;
  onClose: () => void;
  onProposed: (proposals: CorrectionProposal[], unplacedCount: number) => void;
}

export function NoteCorrectionPanel({
  caseId,
  documentId,
  selectedText,
  onClose,
  onProposed,
}: NoteCorrectionPanelProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<CorrectionMode>(selectedText.trim().length >= 8 ? "selection" : "fact");
  const [instruction, setInstruction] = useState("");
  const [find, setFind] = useState("");
  const [replaceWith, setReplaceWith] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (selectedText.trim().length >= 8) setMode("selection");
  }, [selectedText]);

  const submit = async () => {
    setPending(true);
    try {
      const result = await apiRequest<{
        proposals: CorrectionProposal[];
        unplacedCount: number;
      }>("POST", `/api/cases/${caseId}/documents/${documentId}/note-corrections`, {
        mode,
        instruction: mode === "replace" ? undefined : instruction,
        selectedText: mode === "selection" ? selectedText : undefined,
        find: mode === "replace" ? find : undefined,
        replaceWith: mode === "replace" ? replaceWith : undefined,
      });
      if (!result.proposals.length) {
        toast({
          title: mode === "replace" ? "That name is not in the note" : "No change to make",
          description: mode === "replace"
            ? "A name inside a longer word is left as it is."
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

      {mode === "replace" ? (
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
          disabled={pending || (mode === "selection" && selectedText.trim().length < 8)}
          data-testid="button-propose-correction"
        >
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Propose changes"}
        </Button>
      </div>
    </div>
  );
}
