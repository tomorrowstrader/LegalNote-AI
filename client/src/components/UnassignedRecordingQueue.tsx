import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarCheck, Loader2, PlusCircle, Trash2, Video } from "lucide-react";
import type { Case } from "@shared/schema";
import {
  defaultRecordingTypeForMatterKind,
  recordingTypesForMatterKind,
} from "@shared/recordingTypes";
import {
  formatRecordingClock,
  matterChoiceLabel,
  platformLabel,
  recordingListenHints,
  sameCallCount,
  type AssignableRecording,
} from "@shared/assignableRecording";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { flushLiveBotNotesOnAssign } from "@/lib/meetingNotesDraft";
import { ImportAudioScrubber } from "@/components/ImportAudioScrubber";

const RECORDING_TYPE_LABELS: Record<string, string> = {
  full_meeting: "Client Meeting",
  telephone_call: "Telephone Call",
  file_note: "File Note",
  court_hearing: "Court Hearing",
  police_station: "Police Station",
  internal_meeting: "Internal Meeting",
};

interface UnassignedRecordingQueueProps {
  recordings: AssignableRecording[];
  initialId?: string | null;
  onNotNow: () => void;
  onFinished?: () => void;
}

export function UnassignedRecordingQueue({
  recordings,
  initialId,
  onNotNow,
  onFinished,
}: UnassignedRecordingQueueProps) {
  const { toast } = useToast();
  const finishedRef = useRef(false);
  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set());
  const [cursorId, setCursorId] = useState<string | null>(initialId ?? recordings[0]?.id ?? null);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [caseId, setCaseId] = useState("");
  const [recordingType, setRecordingType] = useState("full_meeting");
  const [newTitle, setNewTitle] = useState("");
  const [newClient, setNewClient] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

  const { data: cases = [] } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
  });

  const visible = useMemo(
    () => recordings.filter((recording) => !doneIds.has(recording.id)),
    [recordings, doneIds],
  );

  const index = Math.max(0, visible.findIndex((recording) => recording.id === cursorId));
  const current = visible[index] ?? visible[0];

  useEffect(() => {
    if (visible.length === 0 && recordings.length > 0 && !finishedRef.current) {
      finishedRef.current = true;
      onFinished?.();
    }
  }, [visible.length, recordings.length, onFinished]);

  useEffect(() => {
    if (!initialId) return;
    if (recordings.some((recording) => recording.id === initialId && !doneIds.has(initialId))) {
      setCursorId(initialId);
    }
    // Only jump when the caller opens a specific recording.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId]);

  useEffect(() => {
    if (!current) return;
    setConfirmDelete(false);
    setDeleteReason("");
    setMode("existing");
    setNewTitle("");
    setNewClient("");
    setCaseId(current.suggestedMatter?.caseId ?? "");
    setRecordingType("full_meeting");
  }, [current?.id]);

  useEffect(() => {
    if (!caseId) return;
    const matter = cases.find((item) => item.id === caseId);
    if (!matter) return;
    setRecordingType((prev) => {
      const allowed = recordingTypesForMatterKind(matter.matterKind);
      if (allowed.includes(prev)) return prev;
      return defaultRecordingTypeForMatterKind(matter.matterKind);
    });
  }, [caseId, cases, current?.id]);

  const recentMatters = useMemo(
    () =>
      [...cases]
        .filter((item) => !item.archived)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    [cases],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/recall/imports/unassigned"] });
    queryClient.invalidateQueries({ queryKey: ["/api/recall/imports/incomplete"] });
    queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
  };

  const assignMutation = useMutation({
    mutationFn: async (payload: {
      importId: string;
      caseId?: string;
      recordingType: string;
      createCase?: boolean;
      caseData?: { title: string; clientName: string };
    }) =>
      apiRequest<{ success: boolean; caseId: string; importId: string }>(
        "POST",
        `/api/recall/import/${payload.importId}/assign`,
        {
          caseId: payload.caseId,
          recordingType: payload.recordingType,
          createCase: payload.createCase,
          caseData: payload.caseData,
        },
      ),
    onSuccess: async (data, variables) => {
      if (data?.caseId && data?.importId) {
        try {
          await flushLiveBotNotesOnAssign(data.importId, data.caseId, variables.caseData?.title);
        } catch {
          // Draft stays on this device if the flush fails.
        }
      }
      invalidate();
      setDoneIds((prev) => new Set(prev).add(variables.importId));
      toast({
        title: "Recording assigned",
        description: "LegalNote is producing the attendance note.",
        duration: 4000,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Assignment failed",
        description: err?.message || "Could not assign the recording. Please try again.",
        variant: "destructive",
        duration: 4000,
      });
    },
  });

  const discardMutation = useMutation({
    mutationFn: async (payload: { importId: string; reason: string }) =>
      apiRequest("POST", `/api/recall/import/${payload.importId}/discard`, { reason: payload.reason }),
    onSuccess: (_data, payload) => {
      invalidate();
      setDoneIds((prev) => new Set(prev).add(payload.importId));
      setConfirmDelete(false);
      setDeleteReason("");
      toast({
        title: "Recording deleted",
        description: "The stored audio has been permanently deleted.",
        duration: 4000,
      });
    },
    onError: () => {
      toast({
        title: "Could not delete",
        description: "The recording is still saved. Please try again.",
        variant: "destructive",
        duration: 4000,
      });
    },
  });

  if (!current) return null;

  const when = current.meetingStartTime || current.createdAt;
  const durationLabel = formatRecordingClock(current.durationSeconds);
  const title = current.meetingTitle?.trim() || `${platformLabel(current.meetingPlatform)} call`;
  const hints = recordingListenHints(current);
  const reconnects = sameCallCount(current, recordings);
  if (reconnects > 1) {
    hints.push("This call was recorded more than once - usually a reconnect. Keep the one with the conversation and delete the others.");
  }
  const selectedCase = cases.find((item) => item.id === caseId);
  const typeOptions = recordingTypesForMatterKind(selectedCase?.matterKind ?? "client");
  const suggestedLabel = current.suggestedMatter
    ? matterChoiceLabel(current.suggestedMatter.title, current.suggestedMatter.clientName)
    : null;
  const assignLabel = mode === "new"
    ? "Create matter & process"
    : suggestedLabel && caseId === current.suggestedMatter?.caseId
      ? `Assign to ${suggestedLabel}`
      : selectedCase
        ? `Assign to ${matterChoiceLabel(selectedCase.title, selectedCase.clientName)}`
        : "Assign & process";
  const canAssign = mode === "existing"
    ? !!caseId
    : !!newTitle.trim() && !!newClient.trim();
  const deleteReasonReady = deleteReason.trim().length >= 3;
  const busy = assignMutation.isPending || discardMutation.isPending;

  const assign = () => {
    if (!canAssign || busy) return;
    if (mode === "existing") {
      assignMutation.mutate({
        importId: current.id,
        caseId,
        recordingType,
      });
      return;
    }
    assignMutation.mutate({
      importId: current.id,
      recordingType,
      createCase: true,
      caseData: { title: newTitle.trim(), clientName: newClient.trim() },
    });
  };

  return (
    <div className="space-y-4" data-testid="unassigned-recording-queue">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 pr-6">
          <Video className="h-5 w-5" />
          Check this recording
        </DialogTitle>
        <DialogDescription>
          {visible.length > 1 ? `${index + 1} of ${visible.length}. ` : ""}
          Listen through it, then file it on a matter or delete it. Empty joins and reconnects are usually silence.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">
          {when ? format(new Date(when), "d MMM yyyy, HH:mm") : "Time unknown"}
          {durationLabel ? ` · ${durationLabel}` : ""}
          {" · "}
          {platformLabel(current.meetingPlatform)}
        </p>
        {current.participantNames.length > 0 ? (
          <p className="text-xs text-muted-foreground">On the call: {current.participantNames.join(", ")}</p>
        ) : current.participantCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            {current.participantCount} {current.participantCount === 1 ? "person" : "people"} detected
          </p>
        ) : null}
      </div>

      {hints.length > 0 && (
        <ul className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          {hints.map((hint) => (
            <li key={hint} className="text-xs text-amber-800 dark:text-amber-200">{hint}</li>
          ))}
        </ul>
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-foreground">Listen</p>
        {current.hasAudio ? (
          <ImportAudioScrubber
            key={current.id}
            importId={current.id}
            knownDurationSeconds={current.durationSeconds}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            No audio was stored for this attempt. If the other person never joined, delete it.
          </p>
        )}
      </div>

      {current.suggestedMatter && (
        <button
          type="button"
          className={`flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left ${
            caseId === current.suggestedMatter.caseId && mode === "existing"
              ? "border-primary bg-primary/5"
              : "border-border"
          }`}
          onClick={() => {
            setMode("existing");
            setCaseId(current.suggestedMatter!.caseId);
          }}
          data-testid="button-suggested-matter"
        >
          <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="block text-sm font-medium">{suggestedLabel}</span>
            <span className="block text-xs text-muted-foreground">Matched from your calendar. Change it below if this attempt belongs elsewhere.</span>
          </span>
        </button>
      )}

      {recentMatters.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="queue-recent-matter">Recent matters</Label>
          <Select
            value={mode === "existing" && recentMatters.some((matter) => matter.id === caseId) ? caseId : undefined}
            onValueChange={(id) => {
              setMode("existing");
              setCaseId(id);
            }}
          >
            <SelectTrigger id="queue-recent-matter" data-testid="select-recent-matter">
              <SelectValue placeholder="Choose a recent matter" />
            </SelectTrigger>
            <SelectContent>
              {recentMatters.map((matter) => (
                <SelectItem key={matter.id} value={matter.id} className="whitespace-normal" data-testid={`option-recent-matter-${matter.id}`}>
                  {matterChoiceLabel(matter.title, matter.clientName)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex rounded-md border overflow-hidden">
        <button
          type="button"
          className={`flex-1 px-3 py-2 text-xs font-medium ${mode === "existing" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
          onClick={() => setMode("existing")}
          data-testid="button-assign-mode-existing"
        >
          Existing matter
        </button>
        <button
          type="button"
          className={`flex-1 px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 ${mode === "new" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
          onClick={() => setMode("new")}
          data-testid="button-assign-mode-new"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          New matter
        </button>
      </div>

      {mode === "existing" ? (
        <div className="space-y-1.5">
          <Label htmlFor="queue-assign-case">Matter</Label>
          <Select value={caseId || undefined} onValueChange={setCaseId}>
            <SelectTrigger id="queue-assign-case" data-testid="select-assign-case">
              <SelectValue placeholder="Search and select a matter..." />
            </SelectTrigger>
            <SelectContent>
              {cases.filter((item) => !item.archived).map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {matterChoiceLabel(item.title, item.clientName)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="queue-new-title">Matter title</Label>
            <Input
              id="queue-new-title"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="e.g. Smith v Jones - contract dispute"
              data-testid="input-new-matter-title"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="queue-new-client">Client name</Label>
            <Input
              id="queue-new-client"
              value={newClient}
              onChange={(event) => setNewClient(event.target.value)}
              placeholder="e.g. Jane Smith"
              data-testid="input-new-matter-client"
            />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="queue-recording-type">Session type</Label>
        <Select value={recordingType} onValueChange={setRecordingType}>
          <SelectTrigger id="queue-recording-type" data-testid="select-assign-recording-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((type) => (
              <SelectItem key={type} value={type}>
                {RECORDING_TYPE_LABELS[type] ?? type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {confirmDelete ? (
        <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm">Delete this recording permanently? The audio cannot be recovered.</p>
          <div className="space-y-1.5">
            <Label htmlFor="queue-delete-reason">Reason</Label>
            <Textarea
              id="queue-delete-reason"
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
              placeholder="e.g. Empty join - the other person never connected"
              rows={2}
              maxLength={500}
              data-testid="input-delete-recording-reason"
            />
            <p className="text-xs text-muted-foreground">
              This is written to the audit log. The recording was never filed on a matter, so the entry is kept against your account rather than a case file.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy || !deleteReasonReady}
              onClick={() => discardMutation.mutate({ importId: current.id, reason: deleteReason.trim() })}
              data-testid="button-confirm-delete-recording"
            >
              {discardMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete recording"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setConfirmDelete(false);
                setDeleteReason("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
            data-testid="button-delete-recording"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete recording
          </Button>
          <div className="flex gap-2">
            {visible.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => {
                  const next = visible[(index + 1) % visible.length];
                  if (next) setCursorId(next.id);
                }}
                data-testid="button-skip-recording"
              >
                Skip
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              disabled={!canAssign || busy}
              onClick={assign}
              data-testid="button-assign-confirm"
            >
              {assignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : assignLabel}
            </Button>
          </div>
        </div>
      )}

      <Button
        type="button"
        variant="ghost"
        className="w-full text-muted-foreground"
        onClick={onNotNow}
        data-testid="button-assignment-not-now"
      >
        Not now - leave {visible.length === 1 ? "it" : "them"} on the dashboard
      </Button>
    </div>
  );
}
