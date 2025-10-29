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
  caseTitle: string;
  clientName: string;
}

export default function EmailToClientModal({
  open,
  onOpenChange,
  onSend,
  isPending = false,
  caseTitle,
  clientName,
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
            Send {clientName} secure access to their case documents for: {caseTitle}
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
              If left blank, a default professional message will be sent.
            </p>
          </div>

          <div className="bg-muted p-3 rounded-md text-sm">
            <p className="font-medium mb-1">Email will include:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Case details and matter reference</li>
              <li>Secure link to view documents</li>
              <li>Firm contact information</li>
              <li>Professional letterhead branding</li>
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
