import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import type { Case, PracticeArea } from "@shared/schema";
import { PRACTICE_AREAS, PRACTICE_AREA_LABELS, RECORDING_TYPE_LABELS } from "@shared/schema";
import { consentScriptFor, isClientMatterKind } from "@shared/matterKinds";
import { consentScriptWording } from "@shared/consent";
import {
  defaultRecordingTypeForMatterKind,
  recordingTypesForMatterKind,
} from "@shared/recordingTypes";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

interface RecoveredMoveStatus {
  recovered: boolean;
  block: string | null;
  message: string | null;
  durationSeconds: number | null;
  expiresAt: string | null;
  hasConsentClip: boolean;
  litigationHold: boolean;
}

interface MoveResult {
  targetCaseId: string;
  holdCarried: boolean;
  consentSealed: boolean;
  consentError: string | null;
}

function recordingLength(seconds: number | null): string {
  if (!seconds) return "";
  const minutes = Math.round(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}

/** Offers to move a recording that was recovered into its own case onto the matter it belongs to. */
export function RecoveredRecordingMoveCard({ caseId }: { caseId: string }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [recordingType, setRecordingType] = useState("");
  const [practiceArea, setPracticeArea] = useState<PracticeArea | "">("");
  const [consent, setConsent] = useState<"yes" | "no" | "">("");

  const { data: status } = useQuery<RecoveredMoveStatus>({
    queryKey: [`/api/cases/${caseId}/recovered-recording`],
  });
  const { data: cases = [] } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    enabled: !!status?.recovered,
  });

  const choices = useMemo(
    () => cases.filter((item) => item.id !== caseId && !item.archived),
    [cases, caseId],
  );
  const target = choices.find((item) => item.id === targetId);
  const typeOptions = target ? recordingTypesForMatterKind(target.matterKind) : [];
  const needsPracticeArea = !!target && isClientMatterKind(target.matterKind) && !target.practiceArea;

  useEffect(() => {
    if (!target) return;
    setRecordingType((prev) =>
      recordingTypesForMatterKind(target.matterKind).includes(prev)
        ? prev
        : defaultRecordingTypeForMatterKind(target.matterKind),
    );
  }, [target?.id]);

  const script = target && recordingType
    ? consentScriptFor(target.matterKind, !!target.hasExternalAttendees, recordingType)
    : null;
  const wording = script ? consentScriptWording(script) : null;

  const moveMutation = useMutation({
    mutationFn: () =>
      apiRequest<MoveResult>("POST", `/api/cases/${caseId}/move-recovered-recording`, {
        targetCaseId: targetId,
        recordingType,
        practiceArea: needsPracticeArea ? practiceArea : undefined,
        consentConfirmed: consent === "yes",
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/") });
      setOpen(false);
      toast({
        title: "Recording moved",
        description: [
          result.consentSealed ? "Consent is sealed against this recording." : "Record consent on the matter before processing.",
          result.holdCarried ? "The litigation hold now applies to this matter too." : "",
        ].filter(Boolean).join(" "),
        variant: result.consentError ? "destructive" : undefined,
        duration: 8000,
      });
      setLocation(`/case/${result.targetCaseId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Could not move the recording",
        description: error?.message || "Nothing was moved. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!status?.recovered) return null;

  const expires = status.expiresAt ? new Date(status.expiresAt) : null;
  const canMove = !!target && !!recordingType && !!consent && (!needsPracticeArea || !!practiceArea);

  return (
    <div className="p-5 bg-card rounded-md border border-accent/50" data-testid="recovered-recording-card">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="font-semibold text-sm">This recording was recovered into its own case</p>
          <p className="text-sm text-muted-foreground">
            It did not finish saving, so LegalNote kept it here instead of on its matter. Move it to the matter it belongs to before consent is recorded or anything is produced.
            {expires && !status.litigationHold ? ` The audio is deleted on ${format(expires, "d MMM yyyy 'at' HH:mm")} unless it is under a litigation hold.` : ""}
          </p>
          {status.block && status.block !== "not_recovered" && (
            <p className="text-sm text-destructive" data-testid="recovered-recording-block">{status.message}</p>
          )}
        </div>
        {!status.block && (
          <Button size="sm" className="gap-2 shrink-0" onClick={() => setOpen(true)} data-testid="button-move-recovered">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Move to matter
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={(next) => !moveMutation.isPending && setOpen(next)}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-move-recovered">
          <DialogHeader>
            <DialogTitle>Move this recording</DialogTitle>
            <DialogDescription>
              The session and audio{status.hasConsentClip ? ", including the consent clip," : ""} move together{status.durationSeconds ? ` (${recordingLength(status.durationSeconds)})` : ""}. The move is recorded on both cases, and this case is then archived.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="move-target-matter">Matter</Label>
              <Select value={targetId || undefined} onValueChange={setTargetId}>
                <SelectTrigger id="move-target-matter" data-testid="select-move-target">
                  <SelectValue placeholder="Choose the matter" />
                </SelectTrigger>
                <SelectContent>
                  {choices.map((item) => (
                    <SelectItem key={item.id} value={item.id} className="whitespace-normal">
                      {item.title}{item.clientName ? ` · ${item.clientName}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {target && (
              <div className="space-y-1.5">
                <Label htmlFor="move-recording-type">Meeting type</Label>
                <Select value={recordingType || undefined} onValueChange={setRecordingType}>
                  <SelectTrigger id="move-recording-type" data-testid="select-move-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((type) => (
                      <SelectItem key={type} value={type}>
                        {RECORDING_TYPE_LABELS[type as keyof typeof RECORDING_TYPE_LABELS] ?? type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {needsPracticeArea && (
              <div className="space-y-1.5">
                <Label htmlFor="move-practice-area">Practice area</Label>
                <Select value={practiceArea || undefined} onValueChange={(value) => setPracticeArea(value as PracticeArea)}>
                  <SelectTrigger id="move-practice-area" data-testid="select-move-practice-area">
                    <SelectValue placeholder="This matter needs a practice area" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRACTICE_AREAS.map((area) => (
                      <SelectItem key={area} value={area}>{PRACTICE_AREA_LABELS[area]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {target && (
              <div className="space-y-2">
                <Label>Consent</Label>
                <RadioGroup value={consent} onValueChange={(value) => setConsent(value as "yes" | "no")} className="gap-2">
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="yes" id="move-consent-yes" data-testid="radio-move-consent-yes" />
                    <Label htmlFor="move-consent-yes" className="font-normal leading-snug cursor-pointer">
                      Everyone agreed to the recording when it started
                    </Label>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="no" id="move-consent-no" data-testid="radio-move-consent-no" />
                    <Label htmlFor="move-consent-no" className="font-normal leading-snug cursor-pointer">
                      Consent was not confirmed. I will record it on the matter later
                    </Label>
                  </div>
                </RadioGroup>
                {consent === "yes" && wording && (
                  <p className="text-xs text-muted-foreground">
                    This seals your confirmation of the {script === "participant" ? "participant notice" : "client consent"} wording against this recording on the matter. It cannot be changed afterwards.
                  </p>
                )}
              </div>
            )}

            {status.litigationHold && target && !target.litigationHold && (
              <p className="text-xs text-muted-foreground">
                This recording is under a litigation hold. The hold will also apply to {target.title}, so its records are kept and its share links and meeting type are locked until it is released.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={moveMutation.isPending}>Cancel</Button>
            <Button onClick={() => moveMutation.mutate()} disabled={!canMove || moveMutation.isPending} data-testid="button-confirm-move-recovered">
              {moveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Move recording"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
