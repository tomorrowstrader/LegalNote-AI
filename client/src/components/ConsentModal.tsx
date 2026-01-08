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

interface ConsentModalProps {
  open: boolean;
  onConsentGiven: () => void;
  onConsentDeclined: () => void;
}

export default function ConsentModal({ 
  open, 
  onConsentGiven, 
  onConsentDeclined 
}: ConsentModalProps) {
  const disclaimerScript = `I'm recording this meeting to create accurate attendance notes and evidence proper client care. The audio stays confidential in your case file only, used by me or my direct team if needed, and the audio is deleted after 7 days. Do you consent?`;

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
            Client Consent Required
          </DialogTitle>
          <DialogDescription>
            Recording is now active. Read the disclaimer below to your client and confirm their response.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-muted p-4 rounded-lg border border-border">
            <p className="text-sm font-medium mb-2">READ TO CLIENT:</p>
            <p className="text-sm leading-relaxed italic">
              "{disclaimerScript}"
            </p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Important:</strong> The client's verbal response is being captured on this recording. 
              Only click "Client Consented" if you clearly heard their agreement.
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
            Client Declined
          </Button>
          <Button
            onClick={onConsentGiven}
            className="bg-accent hover:bg-accent gap-2"
            data-testid="button-consent-given"
          >
            <Check className="w-4 h-4" />
            Client Consented
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
