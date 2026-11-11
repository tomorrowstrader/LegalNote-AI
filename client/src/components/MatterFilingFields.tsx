import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Case, PracticeArea } from "@shared/schema";
import { PRACTICE_AREAS, PRACTICE_AREA_LABELS, RECORDING_TYPE_LABELS } from "@shared/schema";
import { consentScriptFor, isClientMatterKind } from "@shared/matterKinds";
import { consentScriptWording } from "@shared/consent";
import {
  defaultRecordingTypeForMatterKind,
  recordingTypesForMatterKind,
} from "@shared/recordingTypes";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** State for choosing the matter, meeting type, practice area and consent answer for a recording. */
export function useMatterFilingForm(options: { enabled: boolean; excludeCaseId?: string; initialConsent?: "yes" | "no" | "" }) {
  const [targetId, setTargetId] = useState("");
  const [recordingType, setRecordingType] = useState("");
  const [practiceArea, setPracticeArea] = useState<PracticeArea | "">("");
  const [consent, setConsent] = useState<"yes" | "no" | "">(options.initialConsent ?? "");

  const { data: cases = [] } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    enabled: options.enabled,
  });

  const choices = useMemo(
    () => cases.filter((item) => item.id !== options.excludeCaseId && !item.archived),
    [cases, options.excludeCaseId],
  );
  const target = choices.find((item) => item.id === targetId);
  const needsPracticeArea = !!target && isClientMatterKind(target.matterKind) && !target.practiceArea;

  useEffect(() => {
    if (!target) return;
    setRecordingType((prev) =>
      recordingTypesForMatterKind(target.matterKind).includes(prev)
        ? prev
        : defaultRecordingTypeForMatterKind(target.matterKind),
    );
  }, [target?.id]);

  const reset = () => {
    setTargetId("");
    setRecordingType("");
    setPracticeArea("");
    setConsent(options.initialConsent ?? "");
  };

  return {
    targetId, setTargetId,
    recordingType, setRecordingType,
    practiceArea, setPracticeArea,
    consent, setConsent,
    choices, target, needsPracticeArea,
    ready: !!target && !!recordingType && !!consent && (!needsPracticeArea || !!practiceArea),
    payload: () => ({
      targetCaseId: targetId,
      recordingType,
      practiceArea: needsPracticeArea ? practiceArea : undefined,
      consentConfirmed: consent === "yes",
    }),
    reset,
  };
}

export type MatterFilingForm = ReturnType<typeof useMatterFilingForm>;

export function MatterFilingFields({
  form,
  idPrefix,
  consentNote,
}: {
  form: MatterFilingForm;
  idPrefix: string;
  /** What a "yes" seals, when it is not the matter's own script. */
  consentNote?: string;
}) {
  const { target, recordingType } = form;
  const typeOptions = target ? recordingTypesForMatterKind(target.matterKind) : [];
  const script = target && recordingType
    ? consentScriptFor(target.matterKind, !!target.hasExternalAttendees, recordingType)
    : null;
  const wording = script ? consentScriptWording(script) : null;

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-target-matter`}>Matter</Label>
        <Select value={form.targetId || undefined} onValueChange={form.setTargetId}>
          <SelectTrigger id={`${idPrefix}-target-matter`} data-testid={`select-${idPrefix}-target`}>
            <SelectValue placeholder="Choose the matter" />
          </SelectTrigger>
          <SelectContent>
            {form.choices.map((item) => (
              <SelectItem key={item.id} value={item.id} className="whitespace-normal">
                {item.title}{item.clientName ? ` · ${item.clientName}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {target && (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-recording-type`}>Meeting type</Label>
          <Select value={recordingType || undefined} onValueChange={form.setRecordingType}>
            <SelectTrigger id={`${idPrefix}-recording-type`} data-testid={`select-${idPrefix}-type`}>
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

      {form.needsPracticeArea && (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-practice-area`}>Practice area</Label>
          <Select value={form.practiceArea || undefined} onValueChange={(value) => form.setPracticeArea(value as PracticeArea)}>
            <SelectTrigger id={`${idPrefix}-practice-area`} data-testid={`select-${idPrefix}-practice-area`}>
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
          <RadioGroup value={form.consent} onValueChange={(value) => form.setConsent(value as "yes" | "no")} className="gap-2">
            <div className="flex items-start gap-2">
              <RadioGroupItem value="yes" id={`${idPrefix}-consent-yes`} data-testid={`radio-${idPrefix}-consent-yes`} />
              <Label htmlFor={`${idPrefix}-consent-yes`} className="font-normal leading-snug cursor-pointer">
                Everyone agreed to the recording when it started
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="no" id={`${idPrefix}-consent-no`} data-testid={`radio-${idPrefix}-consent-no`} />
              <Label htmlFor={`${idPrefix}-consent-no`} className="font-normal leading-snug cursor-pointer">
                Consent was not confirmed. I will record it on the matter later
              </Label>
            </div>
          </RadioGroup>
          {form.consent === "yes" && consentNote && (
            <p className="text-xs text-muted-foreground">{consentNote}</p>
          )}
          {form.consent === "yes" && !consentNote && wording && (
            <p className="text-xs text-muted-foreground">
              This seals your confirmation of the {script === "participant" ? "participant notice" : "client consent"} wording against this recording on the matter. It cannot be changed afterwards.
            </p>
          )}
        </div>
      )}
    </>
  );
}
