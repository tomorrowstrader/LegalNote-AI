import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Loader2 } from "lucide-react";

interface EmailToClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (email: string, message: string) => void;
  isPending?: boolean;
  /** @deprecated Kept for call-site compatibility; not shown in email for GDPR. */
  caseTitle?: string;
  /** @deprecated Kept for call-site compatibility; not shown in email for GDPR. */
  clientName?: string;
}

export default function EmailToClientModal({
  open,
  onOpenChange,
  onSend,
  isPending = false,
}: EmailToClientModalProps) {
  const [email, setEmail] = useState("");
  const [customMessage, setCustomMessage] = useState("");

  const handleSend = () => {
    if (!email.trim()) return;
    onSend(email, customMessage);
  };

  const handleClose = () => {
    if (!isPending) {
      setEmail("");
      setCustomMessage("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email Case Documents to Client
          </DialogTitle>
          <DialogDescription>
            Send a secure access link for these documents. No case or client details are included in the email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Client Email Address *</Label>
            <Input
              id="email"
              type="email"
              placeholder="client@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
              data-testid="input-client-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Custom Message (Optional)</Label>
            <Textarea
              id="message"
              placeholder="Add a personal message to include in the email..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              disabled={isPending}
              rows={4}
              className="resize-none"
              data-testid="textarea-custom-message"
            />
            <p className="text-xs text-muted-foreground">
              Do not include names, matter references, or other personal data in this message.
            </p>
          </div>

          <div className="bg-muted p-3 rounded-md text-sm">
            <p className="font-medium mb-1">Email will include:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>A secure link to view documents</li>
              <li>An automated access notice (no case details)</li>
              <li>Your optional personal message</li>
              <li>Firm contact information (if configured)</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isPending}
            data-testid="button-cancel-email"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!email.trim() || isPending}
            data-testid="button-send-email"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
