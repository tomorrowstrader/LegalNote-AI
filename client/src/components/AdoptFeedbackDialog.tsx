import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { adoptFeedbackStorageKey } from "@shared/productInsights";

type Accuracy = "accurate" | "mostly" | "needs_work";
type Speed = "fast" | "fine" | "slow";

const ACCURACY_OPTIONS: { value: Accuracy; label: string }[] = [
  { value: "accurate", label: "Accurate" },
  { value: "mostly", label: "Mostly" },
  { value: "needs_work", label: "Needs work" },
];

const SPEED_OPTIONS: { value: Speed; label: string }[] = [
  { value: "fast", label: "Fast" },
  { value: "fine", label: "Fine" },
  { value: "slow", label: "Slow" },
];

interface AdoptFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  meetingDurationSeconds?: number | null;
}

export function AdoptFeedbackDialog({
  open,
  onOpenChange,
  caseId,
  meetingDurationSeconds,
}: AdoptFeedbackDialogProps) {
  const { toast } = useToast();
  const [accuracy, setAccuracy] = useState<Accuracy | null>(null);
  const [speed, setSpeed] = useState<Speed | null>(null);
  const [comment, setComment] = useState("");
  const finishedRef = useRef(false);

  const markLocal = (value: "submitted" | "dismissed") => {
    try {
      localStorage.setItem(adoptFeedbackStorageKey(caseId), value);
    } catch {
      /* ignore */
    }
  };

  const submitMutation = useMutation({
    mutationFn: async (payload: {
      accuracy?: Accuracy;
      speed?: Speed;
      comment?: string;
      dismissed?: boolean;
    }) => {
      return apiRequest("POST", "/api/product-insights/adopt-feedback", {
        caseId,
        meetingDurationSeconds: meetingDurationSeconds ?? null,
        ...payload,
      });
    },
    onSuccess: (_data, vars) => {
      finishedRef.current = true;
      markLocal(vars.dismissed ? "dismissed" : "submitted");
      onOpenChange(false);
      if (!vars.dismissed) {
        toast({
          title: "Thanks",
          description: "Your feedback helps us improve LegalNote — no client details were stored.",
          duration: 4000,
        });
      }
    },
    onError: () => {
      toast({
        title: "Couldn’t send feedback",
        description: "Please try again in a moment.",
        variant: "destructive",
        duration: 4000,
      });
    },
  });

  const handleOpenChange = (next: boolean) => {
    if (!next && open && !finishedRef.current) {
      finishedRef.current = true;
      markLocal("dismissed");
      submitMutation.mutate({ dismissed: true });
    }
    if (next) {
      finishedRef.current = false;
      setAccuracy(null);
      setSpeed(null);
      setComment("");
    }
    onOpenChange(next);
  };

  const submit = () => {
    if (!accuracy || finishedRef.current) return;
    submitMutation.mutate({
      accuracy,
      speed: speed ?? undefined,
      comment: comment.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-md"
        data-testid="dialog-adopt-feedback"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">Quick pulse</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            How was this attendance note? One tap is enough — nothing confidential is collected.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Accuracy</Label>
            <div className="grid grid-cols-3 gap-2">
              {ACCURACY_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-9",
                    accuracy === opt.value && "border-primary bg-primary/10 text-foreground",
                  )}
                  onClick={() => setAccuracy(opt.value)}
                  data-testid={`button-feedback-accuracy-${opt.value}`}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Speed of review <span className="normal-case tracking-normal">(optional)</span>
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {SPEED_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-9",
                    speed === opt.value && "border-primary bg-primary/10 text-foreground",
                  )}
                  onClick={() => setSpeed(opt.value)}
                  data-testid={`button-feedback-speed-${opt.value}`}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adopt-feedback-comment" className="text-xs text-muted-foreground uppercase tracking-wide">
              Anything else <span className="normal-case tracking-normal">(optional)</span>
            </Label>
            <Textarea
              id="adopt-feedback-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 280))}
              placeholder="Keep it general — no names or matter references"
              rows={2}
              className="resize-none text-sm"
              data-testid="input-feedback-comment"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={submitMutation.isPending}
            data-testid="button-feedback-skip"
          >
            Skip
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={!accuracy || submitMutation.isPending}
            data-testid="button-feedback-submit"
          >
            {submitMutation.isPending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
