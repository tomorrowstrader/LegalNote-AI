import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  Quote,
  ShieldAlert,
  X,
} from "lucide-react";
import { format, isPast } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Undertaking } from "@shared/schema";

interface UndertakingsViewerProps {
  caseId: string;
  hasTranscript: boolean;
}

interface UndertakingCandidate {
  wording: string;
  speaker: string | null;
  sourceQuote: string;
  deadline: string | null;
  meetingSessionId?: string;
}

export default function UndertakingsViewer({ caseId, hasTranscript }: UndertakingsViewerProps) {
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCandidatesModal, setShowCandidatesModal] = useState(false);
  const [selectedUndertaking, setSelectedUndertaking] = useState<Undertaking | null>(null);
  const [dischargeNote, setDischargeNote] = useState("");
  const [newWording, setNewWording] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [dismissedQuotes, setDismissedQuotes] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const { data: undertakings = [], isLoading } = useQuery<Undertaking[]>({
    queryKey: [`/api/cases/${caseId}/undertakings`],
  });

  const { data: processingStatus } = useQuery<{
    processingMetadata: {
      undertakingCandidates?: UndertakingCandidate[];
      dismissedUndertakingQuotes?: string[];
    };
  }>({
    queryKey: [`/api/cases/${caseId}/processing-status`],
    enabled: !!caseId,
  });

  const candidates = processingStatus?.processingMetadata?.undertakingCandidates || [];
  const persistedDismissals = new Set(processingStatus?.processingMetadata?.dismissedUndertakingQuotes || []);

  const unconfirmedCandidates = candidates.filter(c => {
    if (dismissedQuotes.has(c.sourceQuote) || persistedDismissals.has(c.sourceQuote)) return false;
    return !undertakings.some(u => u.sourceQuote === c.sourceQuote);
  });

  const dismissMutation = useMutation({
    mutationFn: async (sourceQuote: string) => {
      return await apiRequest("PATCH", `/api/cases/${caseId}/processing-status`, {
        dismissedUndertakingQuote: sourceQuote,
      });
    },
    onSuccess: (_data, sourceQuote) => {
      setDismissedQuotes(prev => new Set(prev).add(sourceQuote));
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/processing-status`] });
      toast({ title: "Candidate dismissed", description: "This candidate will not reappear." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to dismiss", description: error.message, variant: "destructive" });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (candidate: UndertakingCandidate & { editedWording?: string }) => {
      return await apiRequest("POST", `/api/cases/${caseId}/undertakings`, {
        wording: candidate.editedWording || candidate.wording,
        speaker: candidate.speaker,
        sourceQuote: candidate.sourceQuote,
        deadline: candidate.deadline,
        meetingSessionId: candidate.meetingSessionId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/undertakings`] });
      toast({ title: "Undertaking confirmed", description: "Added to the undertakings register." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to confirm", description: error.message, variant: "destructive" });
    },
  });

  const dischargeMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      return await apiRequest("PATCH", `/api/undertakings/${id}`, {
        status: "discharged",
        dischargeNote: note,
      });
    },
    onSuccess: () => {
      setShowDischargeModal(false);
      setSelectedUndertaking(null);
      setDischargeNote("");
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/undertakings`] });
      toast({ title: "Undertaking discharged", description: "Audit trail entry created." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to discharge", description: error.message, variant: "destructive" });
    },
  });

  const addManualMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/cases/${caseId}/undertakings`, {
        wording: newWording,
        deadline: newDeadline || null,
      });
    },
    onSuccess: () => {
      setShowAddModal(false);
      setNewWording("");
      setNewDeadline("");
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/undertakings`] });
      toast({ title: "Undertaking added" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add", description: error.message, variant: "destructive" });
    },
  });

  const outstanding = undertakings.filter(u => u.status === "outstanding");
  const discharged = undertakings.filter(u => u.status === "discharged");
  const varied = undertakings.filter(u => u.status === "varied");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {outstanding.length > 0 && (
            <Badge variant="secondary" className="text-xs" data-testid="badge-outstanding-count">
              {outstanding.length} outstanding
            </Badge>
          )}
          {discharged.length > 0 && (
            <Badge variant="outline" className="text-xs" data-testid="badge-discharged-count">
              {discharged.length} discharged
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {unconfirmedCandidates.length > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowCandidatesModal(true)}
              className="gap-2"
              data-testid="button-review-candidates"
            >
              <ShieldAlert className="w-4 h-4" />
              Review {unconfirmedCandidates.length} Detected
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="gap-2"
            data-testid="button-add-undertaking"
          >
            <Plus className="w-4 h-4" />
            Add Manually
          </Button>
        </div>
      </div>

      {undertakings.length === 0 && unconfirmedCandidates.length === 0 && (
        <p className="text-sm text-muted-foreground italic py-4" data-testid="text-no-undertakings">
          No undertakings recorded for this matter. Undertakings will be detected automatically when transcripts are processed.
        </p>
      )}

      {outstanding.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Outstanding</h4>
          {outstanding.map(u => (
            <UndertakingCard
              key={u.id}
              undertaking={u}
              onDischarge={() => {
                setSelectedUndertaking(u);
                setShowDischargeModal(true);
              }}
            />
          ))}
        </div>
      )}

      {discharged.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Discharged</h4>
          {discharged.map(u => (
            <UndertakingCard key={u.id} undertaking={u} />
          ))}
        </div>
      )}

      {varied.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Varied</h4>
          {varied.map(u => (
            <UndertakingCard key={u.id} undertaking={u} />
          ))}
        </div>
      )}

      <Dialog open={showDischargeModal} onOpenChange={setShowDischargeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discharge Undertaking</DialogTitle>
            <DialogDescription>
              Confirm that this undertaking has been fulfilled. This creates an audit trail entry.
            </DialogDescription>
          </DialogHeader>
          {selectedUndertaking && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-md text-sm">
                {selectedUndertaking.wording}
              </div>
              <div>
                <label className="text-sm font-medium">Discharge note</label>
                <Textarea
                  value={dischargeNote}
                  onChange={e => setDischargeNote(e.target.value)}
                  placeholder="Describe how this undertaking was fulfilled..."
                  className="mt-1"
                  data-testid="input-discharge-note"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDischargeModal(false)} data-testid="button-cancel-discharge">
              Cancel
            </Button>
            <Button
              onClick={() => selectedUndertaking && dischargeMutation.mutate({ id: selectedUndertaking.id, note: dischargeNote })}
              disabled={dischargeMutation.isPending}
              data-testid="button-confirm-discharge"
            >
              {dischargeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Discharge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Undertaking</DialogTitle>
            <DialogDescription>
              Manually record an undertaking for this matter.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Undertaking wording</label>
              <Textarea
                value={newWording}
                onChange={e => setNewWording(e.target.value)}
                placeholder="We undertake to..."
                className="mt-1"
                data-testid="input-undertaking-wording"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Deadline (optional)</label>
              <Input
                type="date"
                value={newDeadline}
                onChange={e => setNewDeadline(e.target.value)}
                className="mt-1"
                data-testid="input-undertaking-deadline"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)} data-testid="button-cancel-add">
              Cancel
            </Button>
            <Button
              onClick={() => addManualMutation.mutate()}
              disabled={addManualMutation.isPending || !newWording.trim()}
              data-testid="button-confirm-add"
            >
              {addManualMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Undertaking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CandidatesReviewModal
        open={showCandidatesModal}
        onOpenChange={setShowCandidatesModal}
        candidates={unconfirmedCandidates}
        onConfirm={(candidate, editedWording) => {
          confirmMutation.mutate({ ...candidate, editedWording });
        }}
        onDismiss={(candidate) => {
          dismissMutation.mutate(candidate.sourceQuote);
        }}
        isPending={confirmMutation.isPending}
        isDismissPending={dismissMutation.isPending}
      />
    </div>
  );
}

function UndertakingCard({ undertaking, onDischarge }: { undertaking: Undertaking; onDischarge?: () => void }) {
  const isOverdue = undertaking.status === "outstanding" && undertaking.deadline && isPast(new Date(undertaking.deadline));

  return (
    <Card className={isOverdue ? "border-destructive" : ""} data-testid={`undertaking-card-${undertaking.id}`}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium flex-1">{undertaking.wording}</p>
          <div className="flex items-center gap-2 flex-shrink-0">
            {undertaking.status === "outstanding" && isOverdue && (
              <Badge variant="destructive" className="text-xs" data-testid={`badge-overdue-${undertaking.id}`}>
                <AlertTriangle className="w-3 h-3 mr-1" />
                Overdue
              </Badge>
            )}
            {undertaking.status === "outstanding" && !isOverdue && (
              <Badge variant="secondary" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                Outstanding
              </Badge>
            )}
            {undertaking.status === "discharged" && (
              <Badge variant="outline" className="text-xs">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Discharged
              </Badge>
            )}
            {undertaking.status === "varied" && (
              <Badge variant="outline" className="text-xs">Varied</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {undertaking.dateGiven && (
            <span>Given: {format(new Date(undertaking.dateGiven), "dd MMM yyyy")}</span>
          )}
          {undertaking.deadline && (
            <span className={isOverdue ? "text-destructive font-medium" : ""}>
              Deadline: {format(new Date(undertaking.deadline), "dd MMM yyyy")}
            </span>
          )}
          {undertaking.speaker && (
            <span>By: {undertaking.speaker}</span>
          )}
        </div>

        {undertaking.sourceQuote && (
          <div className="flex items-start gap-2 mt-2 p-2 bg-muted rounded-md">
            <Quote className="w-3 h-3 mt-0.5 text-muted-foreground flex-shrink-0" />
            <p className="text-xs text-muted-foreground italic">{undertaking.sourceQuote}</p>
          </div>
        )}

        {undertaking.status === "discharged" && undertaking.dischargeNote && (
          <div className="text-xs text-muted-foreground mt-1">
            <span className="font-medium">Discharge note:</span> {undertaking.dischargeNote}
          </div>
        )}

        {undertaking.status === "outstanding" && onDischarge && (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onDischarge}
              className="gap-2"
              data-testid={`button-discharge-${undertaking.id}`}
            >
              <CheckCircle2 className="w-3 h-3" />
              Discharge
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CandidatesReviewModal({
  open,
  onOpenChange,
  candidates,
  onConfirm,
  onDismiss,
  isPending,
  isDismissPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: UndertakingCandidate[];
  onConfirm: (candidate: UndertakingCandidate, editedWording?: string) => void;
  onDismiss: (candidate: UndertakingCandidate) => void;
  isPending: boolean;
  isDismissPending: boolean;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedWording, setEditedWording] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Detected Undertakings</DialogTitle>
          <DialogDescription>
            AI has identified potential undertakings in the transcript. Review each and confirm, edit, or dismiss.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {candidates.map((candidate, index) => (
            <Card key={candidate.sourceQuote || index} data-testid={`candidate-card-${index}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-2 p-2 bg-muted rounded-md">
                  <Quote className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <p className="text-sm italic text-muted-foreground">{candidate.sourceQuote}</p>
                </div>

                {editingIndex === index ? (
                  <Textarea
                    value={editedWording}
                    onChange={e => setEditedWording(e.target.value)}
                    className="text-sm"
                    data-testid={`input-edit-candidate-${index}`}
                  />
                ) : (
                  <p className="text-sm font-medium">{candidate.wording}</p>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {candidate.speaker && <span>Speaker: {candidate.speaker}</span>}
                  {candidate.deadline && <span>Deadline: {candidate.deadline}</span>}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    onClick={() => {
                      const wording = editingIndex === index ? editedWording : undefined;
                      onConfirm(candidate, wording);
                      setEditingIndex(null);
                    }}
                    disabled={isPending}
                    data-testid={`button-confirm-candidate-${index}`}
                  >
                    {isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                    Confirm
                  </Button>
                  {editingIndex === index ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingIndex(null)}
                      data-testid={`button-cancel-edit-${index}`}
                    >
                      Cancel Edit
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingIndex(index);
                        setEditedWording(candidate.wording);
                      }}
                      data-testid={`button-edit-candidate-${index}`}
                    >
                      Edit
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDismiss(candidate)}
                    disabled={isDismissPending}
                    className="gap-1"
                    data-testid={`button-dismiss-candidate-${index}`}
                  >
                    {isDismissPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                    Dismiss
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {candidates.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-candidates">
              All candidates have been reviewed.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-candidates">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
