import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  emptyMeetingCast,
  parseMeetingCast,
  type MeetingCast,
} from "@shared/meetingCast";

interface MeetingCastFieldsProps {
  value: MeetingCast;
  onChange: (next: MeetingCast) => void;
  matterClientName?: string;
  disabled?: boolean;
}

export function meetingCastFromUnknown(value: unknown): MeetingCast {
  return parseMeetingCast(value) ?? emptyMeetingCast();
}

export function MeetingCastFields({
  value,
  onChange,
  matterClientName,
  disabled,
}: MeetingCastFieldsProps) {
  const patch = (partial: Partial<MeetingCast>) => onChange({ ...value, ...partial });

  return (
    <div className="space-y-3" data-testid="meeting-cast-fields">
      <div>
        <p className="text-sm font-medium">Who was in this meeting</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          The note is written from this. Leave it when you gave the advice and the client was there.
          It applies when the note is produced. A note already on the file is corrected on the document.
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          checked={value.adviserIsFeeEarner}
          onCheckedChange={(checked) => patch({ adviserIsFeeEarner: checked === true })}
          disabled={disabled}
          data-testid="checkbox-cast-adviser-is-me"
          className="mt-0.5"
        />
        <span>I gave the advice</span>
      </label>

      {!value.adviserIsFeeEarner && (
        <div className="space-y-1.5">
          <Label htmlFor="cast-adviser-name">Who gave the advice</Label>
          <Input
            id="cast-adviser-name"
            value={value.adviserName}
            onChange={(event) => patch({ adviserName: event.target.value })}
            placeholder="Name of the adviser"
            disabled={disabled}
            data-testid="input-cast-adviser-name"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="cast-client-name">Client</Label>
        <Input
          id="cast-client-name"
          value={value.clientName}
          onChange={(event) => patch({ clientName: event.target.value })}
          placeholder={matterClientName ? `Matter client: ${matterClientName}` : "Client name, if it is not the matter client"}
          disabled={disabled}
          data-testid="input-cast-client-name"
        />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          checked={value.clientPresent}
          onCheckedChange={(checked) => patch({ clientPresent: checked === true })}
          disabled={disabled}
          data-testid="checkbox-cast-client-present"
          className="mt-0.5"
        />
        <span>The client was present</span>
      </label>

      {!value.clientPresent && (
        <div className="space-y-1.5">
          <Label htmlFor="cast-representative-name">Who attended for the client</Label>
          <Input
            id="cast-representative-name"
            value={value.representativeName}
            onChange={(event) => patch({ representativeName: event.target.value })}
            placeholder="Name of the person who attended"
            disabled={disabled}
            data-testid="input-cast-representative-name"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="cast-attendees">Anyone else present <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Input
          id="cast-attendees"
          value={value.attendees}
          onChange={(event) => patch({ attendees: event.target.value })}
          placeholder="Other people in the meeting"
          disabled={disabled}
          data-testid="input-cast-attendees"
        />
      </div>
    </div>
  );
}
