import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowRightLeft, Clock } from "lucide-react";
import { format } from "date-fns";

interface HandoverModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseTitle: string;
  currentAssignee?: string | null;
}

interface UserOption {
  id: string;
  firstName: string | null;
  lastName: string | null;
}

interface HandoverEvent {
  id: string;
  eventType: string;
  timestamp: string;
  metadata: {
    outgoingSolicitorId: string;
    incomingSolicitorId: string;
    incomingSolicitorName?: string;
    handoverNote?: string;
    handoverTimestamp: string;
  };
}

export default function HandoverModal({ open, onOpenChange, caseId, caseTitle, currentAssignee }: HandoverModalProps) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [handoverNote, setHandoverNote] = useState("");
  const { toast } = useToast();

  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ["/api/cases", caseId, "handover-candidates"],
    queryFn: async () => {
      const res = await fetch(`/api/cases/${caseId}/handover-candidates`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  const { data: handoverHistory = [] } = useQuery<HandoverEvent[]>({
    queryKey: ["/api/cases", caseId, "handover-history"],
    queryFn: async () => {
      const res = await fetch(`/api/cases/${caseId}/handover-history`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  const handoverMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/cases/${caseId}/handover`, {
        newFeeEarnerId: selectedUserId,
        handoverNote: handoverNote.trim(),
      });
    },
    onSuccess: () => {
      toast({
        title: "Handover completed",
        description: "Case has been transferred to the new fee earner.",
        duration: 6000,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "handover-history"] });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/audit`] });
      setSelectedUserId("");
      setHandoverNote("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Handover failed",
        description: error.message || "Failed to complete handover.",
        variant: "destructive",
        duration: 6000,
      });
    },
  });

  const availableUsers = users.filter(u => u.id !== currentAssignee);

  const getUserLabel = (user: UserOption) => {
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
    return name || user.id;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            Case Handover
          </DialogTitle>
          <DialogDescription>
            Transfer "{caseTitle}" to another fee earner. Both parties will be recorded in the audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block" data-testid="label-new-fee-earner">
              New Fee Earner
            </label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger data-testid="select-new-fee-earner">
                <SelectValue placeholder="Select a solicitor" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map(user => (
                  <SelectItem key={user.id} value={user.id} data-testid={`option-user-${user.id}`}>
                    {getUserLabel(user)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block" data-testid="label-handover-note">
              Handover Note
            </label>
            <Textarea
              value={handoverNote}
              onChange={(e) => setHandoverNote(e.target.value)}
              placeholder="Reason for handover, key notes for incoming solicitor..."
              className="resize-none"
              rows={3}
              data-testid="textarea-handover-note"
            />
          </div>

          <Button
            onClick={() => handoverMutation.mutate()}
            disabled={!selectedUserId || handoverMutation.isPending}
            className="w-full gap-2"
            data-testid="button-confirm-handover"
          >
            {handoverMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-4 h-4" />
                Complete Handover
              </>
            )}
          </Button>

          {handoverHistory.length > 0 && (
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Handover History
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {handoverHistory.map((event) => (
                  <div key={event.id} className="text-xs text-muted-foreground border rounded-md p-2" data-testid={`handover-event-${event.id}`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Badge variant="secondary" className="text-xs">Handover</Badge>
                      <span>{format(new Date(event.timestamp), "dd MMM yyyy HH:mm")}</span>
                    </div>
                    {event.metadata?.incomingSolicitorName && (
                      <p>Transferred to: {event.metadata.incomingSolicitorName}</p>
                    )}
                    {event.metadata?.handoverNote && (
                      <p className="mt-1 italic">"{event.metadata.handoverNote}"</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
