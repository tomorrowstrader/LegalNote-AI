import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { MeetingBookingProposal, MeetingBookingSlot } from "@shared/schema";
import { apiRequest, queryClient, getApiErrorMessage } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type ProposalWithSlots = MeetingBookingProposal & {
  slots: MeetingBookingSlot[];
};

type NewSlotDraft = {
  id: string;
  date: string;
  startTime: string;
};

function newSlotDraft(date = format(new Date(), "yyyy-MM-dd")): NewSlotDraft {
  return {
    id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date,
    startTime: "",
  };
}

type EditBookingProposalDialogProps = {
  proposal: ProposalWithSlots | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function EditBookingProposalDialog({
  proposal,
  open,
  onOpenChange,
}: EditBookingProposalDialogProps) {
  const { toast } = useToast();
  const [keptSlotIds, setKeptSlotIds] = useState<string[]>([]);
  const [newSlots, setNewSlots] = useState<NewSlotDraft[]>([]);
  const [notifyClient, setNotifyClient] = useState(true);

  const availableSlots = useMemo(
    () => (proposal?.slots || []).filter((s) => s.status === "available"),
    [proposal],
  );

  useEffect(() => {
    if (!open || !proposal) return;
    setKeptSlotIds(availableSlots.map((s) => s.id));
    setNewSlots([]);
    setNotifyClient(true);
  }, [open, proposal, availableSlots]);

  const totalOptions = keptSlotIds.length + newSlots.length;
  const canRemoveExisting = totalOptions > 2;
  const canAddNew = totalOptions < 5;

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!proposal) throw new Error("No proposal selected");

      const removeSlotIds = availableSlots
        .filter((s) => !keptSlotIds.includes(s.id))
        .map((s) => s.id);

      const addSlots = newSlots
        .filter((s) => s.date && s.startTime)
        .map((s) => ({
          startsAt: new Date(`${s.date}T${s.startTime}`).toISOString(),
        }));

      if (removeSlotIds.length === 0 && addSlots.length === 0) {
        throw new Error("Change at least one time option before saving");
      }

      if (keptSlotIds.length + addSlots.length < 2) {
        throw new Error("At least 2 time options must remain");
      }

      for (const slot of newSlots) {
        if (!slot.date || !slot.startTime) {
          throw new Error("Complete the date and start time for each new option");
        }
        const startsAt = new Date(`${slot.date}T${slot.startTime}`);
        if (isNaN(startsAt.getTime()) || startsAt <= new Date()) {
          throw new Error("All new times must be in the future");
        }
      }

      return apiRequest("PATCH", `/api/meeting-booking-proposals/${proposal.id}/slots`, {
        removeSlotIds: removeSlotIds.length > 0 ? removeSlotIds : undefined,
        addSlots: addSlots.length > 0 ? addSlots : undefined,
        notifyClient,
      });
    },
    onSuccess: () => {
      toast({
        title: "Meeting options updated",
        description: notifyClient
          ? "The client will receive an email with the updated times."
          : "The booking link now shows the updated times.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/meeting-booking-proposals"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Could not update options",
        description: getApiErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  if (!proposal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit meeting options</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Remove or add times for <strong>{proposal.clientEmail}</strong>. The same booking link
            stays valid — the client will see the updated options when they open it.
          </p>

          <div className="space-y-2">
            <Label>Current options</Label>
            {availableSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No available times left.</p>
            ) : (
              <div className="space-y-2">
                {availableSlots.map((slot) => {
                  const kept = keptSlotIds.includes(slot.id);
                  const start = new Date(slot.startsAt);
                  const end = new Date(slot.endsAt);
                  return (
                    <div
                      key={slot.id}
                      className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 ${
                        kept ? "bg-background" : "bg-muted/40 opacity-60"
                      }`}
                      data-testid={`edit-slot-${slot.id}`}
                    >
                      <div className="min-w-0 text-sm">
                        <div className="font-medium">{format(start, "EEE d MMM yyyy")}</div>
                        <div className="text-muted-foreground">
                          {format(start, "HH:mm")} – {format(end, "HH:mm")}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={kept && !canRemoveExisting}
                        onClick={() =>
                          setKeptSlotIds((prev) =>
                            kept ? prev.filter((id) => id !== slot.id) : [...prev, slot.id],
                          )
                        }
                        aria-label={kept ? "Remove this time option" : "Restore this time option"}
                        data-testid={`button-toggle-slot-${slot.id}`}
                      >
                        <Trash2 className={`w-4 h-4 ${kept ? "" : "opacity-40"}`} />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>New options</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canAddNew}
                onClick={() =>
                  setNewSlots((prev) => {
                    const lastExisting = availableSlots[availableSlots.length - 1];
                    const fallbackDate = lastExisting
                      ? format(new Date(lastExisting.startsAt), "yyyy-MM-dd")
                      : format(new Date(), "yyyy-MM-dd");
                    return [...prev, newSlotDraft(prev[prev.length - 1]?.date || fallbackDate)];
                  })
                }
                data-testid="button-add-edit-slot"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add time
              </Button>
            </div>
            {newSlots.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Add a new time if you want to offer more options ({totalOptions}/5).
              </p>
            ) : (
              <div className="space-y-2">
                {newSlots.map((slot, index) => (
                  <div
                    key={slot.id}
                    className="grid grid-cols-[1fr_auto_auto] gap-2 items-end"
                    data-testid={`row-edit-new-slot-${index}`}
                  >
                    <div className="space-y-1.5 min-w-0">
                      <Label className="text-xs text-muted-foreground">Date</Label>
                      <Input
                        type="date"
                        value={slot.date}
                        min={format(new Date(), "yyyy-MM-dd")}
                        onChange={(e) =>
                          setNewSlots((prev) =>
                            prev.map((s) =>
                              s.id === slot.id ? { ...s, date: e.target.value } : s,
                            ),
                          )
                        }
                        data-testid={`input-edit-new-date-${index}`}
                      />
                    </div>
                    <div className="space-y-1.5 w-[7.5rem]">
                      <Label className="text-xs text-muted-foreground">Start</Label>
                      <Input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) =>
                          setNewSlots((prev) =>
                            prev.map((s) =>
                              s.id === slot.id ? { ...s, startTime: e.target.value } : s,
                            ),
                          )
                        }
                        data-testid={`input-edit-new-start-${index}`}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setNewSlots((prev) => prev.filter((s) => s.id !== slot.id))}
                      aria-label="Remove new time option"
                      data-testid={`button-remove-edit-new-slot-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-md border bg-muted/20 p-3">
            <Checkbox
              id="notify-client-updated"
              checked={notifyClient}
              onCheckedChange={(checked) => setNotifyClient(checked === true)}
              data-testid="checkbox-notify-client-updated"
            />
            <div className="space-y-1">
              <Label htmlFor="notify-client-updated" className="text-sm font-normal cursor-pointer">
                Email client about updated options
              </Label>
              <p className="text-xs text-muted-foreground">
                Sends a short update with the current times and the same booking link.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            data-testid="button-save-booking-options"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
