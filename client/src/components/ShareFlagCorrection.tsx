import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Flag, Loader2 } from "lucide-react";
import { apiRequest, getApiErrorMessage } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Category = "correction" | "clarification" | "other";

interface ShareFlagCorrectionProps {
  linkId: string;
  activeDocumentId?: string | null;
  activeDocumentType?: string | null;
  className?: string;
}

export function ShareFlagCorrection({
  linkId,
  activeDocumentId,
  activeDocumentType,
  className,
}: ShareFlagCorrectionProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [category, setCategory] = useState<Category>("correction");

  useEffect(() => {
    if (!open) return;
    const selection = window.getSelection()?.toString()?.trim() || "";
    if (selection) setSelectedText(selection.slice(0, 2000));
  }, [open]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/share/${linkId}/feedback`, {
        message: message.trim(),
        selectedText: selectedText.trim() || undefined,
        category,
        documentId: activeDocumentId || undefined,
        documentType: activeDocumentType || undefined,
      });
    },
    onSuccess: () => {
      setOpen(false);
      setMessage("");
      setSelectedText("");
      setCategory("correction");
      toast({
        title: "Correction sent",
        description: "Your solicitor has been notified. The document itself is not changed.",
        duration: 5000,
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Could not send",
        description: getApiErrorMessage(error, "Please try again or contact your solicitor directly."),
        variant: "destructive",
        duration: 6000,
      });
    },
  });

  return (
    <>
      <div className={cn("flex justify-end", className)}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setOpen(true)}
          data-testid="button-flag-correction"
        >
          <Flag className="w-3.5 h-3.5" />
          Flag a correction
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-flag-correction">
          <DialogHeader>
            <DialogTitle>Flag a correction</DialogTitle>
            <DialogDescription className="leading-relaxed">
              Tell your solicitor if a date or detail looks wrong. This notifies them only — it does not edit the document.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="correction-category">Type</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger id="correction-category" data-testid="select-correction-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[80]">
                  <SelectItem value="correction">Correction</SelectItem>
                  <SelectItem value="clarification">Clarification</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="correction-quote">
                Quoted text <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="correction-quote"
                value={selectedText}
                onChange={(e) => setSelectedText(e.target.value.slice(0, 2000))}
                placeholder="Select text in the document first, or paste the passage here"
                rows={2}
                className="resize-none text-sm"
                data-testid="input-correction-quote"
              />
              <p className="text-[11px] text-muted-foreground">
                Tip: highlight the passage in the note, then open this form — the quote fills in automatically.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="correction-message">What should be corrected?</Label>
              <Textarea
                id="correction-message"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
                placeholder="e.g. The marriage date should be 14 March 2012, not 2011"
                rows={3}
                className="resize-none text-sm"
                data-testid="input-correction-message"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => submitMutation.mutate()}
              disabled={!message.trim() || submitMutation.isPending}
              data-testid="button-submit-correction"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending…
                </>
              ) : (
                "Send to solicitor"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
