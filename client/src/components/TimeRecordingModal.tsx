import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface TimeRecordingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseTitle: string;
  matterReference?: string;
  durationSeconds?: number;
  sessionType?: string;
}

export default function TimeRecordingModal({
  open,
  onOpenChange,
  caseId,
  caseTitle,
  matterReference,
  durationSeconds,
  sessionType = "Meeting",
}: TimeRecordingModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const suggestedMinutes = durationSeconds ? Math.ceil(durationSeconds / 60) : 30;
  const defaultRate = user?.hourlyRate || "250";
  const defaultDescription = `${sessionType}${matterReference ? ` - ${matterReference}` : ""} - ${caseTitle}`;

  const [durationMinutes, setDurationMinutes] = useState(suggestedMinutes);
  const [description, setDescription] = useState(defaultDescription);
  const [hourlyRate, setHourlyRate] = useState(defaultRate);

  useEffect(() => {
    if (open) {
      setDurationMinutes(suggestedMinutes);
      setDescription(defaultDescription);
      setHourlyRate(user?.hourlyRate || "250");
    }
  }, [open, suggestedMinutes, defaultDescription, user?.hourlyRate]);

  const total = ((durationMinutes / 60) * parseFloat(hourlyRate || "0")).toFixed(2);

  const createMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/cases/${caseId}/time-entries`, {
        durationMinutes,
        description,
        hourlyRate,
        status: "confirmed",
        meetingSessionId: caseId,
      });
    },
    onSuccess: () => {
      toast({ title: "Time recorded", description: `${durationMinutes} minutes at £${hourlyRate}/hr recorded.` });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "time-entries"] });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to record time", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Record Billable Time
          </DialogTitle>
          <DialogDescription>
            Confirm the time spent on this session
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="time-duration">Duration (minutes)</Label>
            <Input
              id="time-duration"
              type="number"
              min={1}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
              data-testid="input-time-duration"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="time-description">Description</Label>
            <Textarea
              id="time-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              data-testid="input-time-description"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="time-rate">Hourly Rate (GBP)</Label>
            <Input
              id="time-rate"
              type="number"
              min={0}
              step="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              data-testid="input-time-rate"
            />
          </div>

          <div className="p-3 bg-muted rounded-md">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Estimated Total</span>
              <span className="font-semibold text-foreground" data-testid="text-time-total">
                £{total}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-dismiss-time"
          >
            Dismiss
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || durationMinutes < 1 || !description.trim()}
            className="bg-accent hover:bg-accent"
            data-testid="button-confirm-time"
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Confirm Time
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
