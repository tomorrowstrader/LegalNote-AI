import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Check, X } from "lucide-react";
import {
  CONSENT_DISCLAIMER_TEXT,
  PARTICIPANT_CONSENT_DISCLAIMER_TEXT,
} from "@shared/consent";

export type ConsentModalVariant = "client" | "participant";

interface ConsentModalProps {
  open: boolean;
  onConsentGiven: () => void;
  onConsentDeclined: () => void;
  /** client = solicitor–client GDPR script; participant = non-client external attendees. */
  variant?: ConsentModalVariant;
}

export default function ConsentModal({
  open,
  onConsentGiven,
  onConsentDeclined,
  variant = "client",
}: ConsentModalProps) {
  const isParticipant = variant === "participant";

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-[600px]"
        data-testid="dialog-consent"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-accent" />
            {isParticipant ? "Participant Recording Notice" : "Client Consent Required"}
          </DialogTitle>
          <DialogDescription>
            {isParticipant
              ? "Recording is now active. Read the notice below to attendees and confirm their response."
              : "Recording is now active. Read the disclaimer below to your client and confirm their response."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted p-4 rounded-lg border border-border">
            <p className="text-sm font-medium mb-2">
              {isParticipant ? "READ TO ATTENDEES:" : "READ TO CLIENT:"}
            </p>
            <p className="text-sm leading-relaxed italic">
              "{isParticipant ? PARTICIPANT_CONSENT_DISCLAIMER_TEXT : CONSENT_DISCLAIMER_TEXT}"
            </p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Important:</strong>{" "}
              {isParticipant
                ? "Attendees' verbal responses are being captured on this recording. Only confirm if you clearly heard agreement."
                : "The client's verbal response is being captured on this recording. Only click \"Client Consented\" if you clearly heard their agreement."}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onConsentDeclined}
            className="gap-2"
            data-testid="button-consent-declined"
          >
            <X className="w-4 h-4" />
            {isParticipant ? "Declined" : "Client Declined"}
          </Button>
          <Button
            onClick={onConsentGiven}
            className="bg-accent hover:bg-accent gap-2"
            data-testid="button-consent-given"
          >
            <Check className="w-4 h-4" />
            {isParticipant ? "Attendees Agreed" : "Client Consented"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
