import { useState, useEffect } from "react";
import { Share2, CheckCircle2, X, Shield, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface ShareLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseTitle: string;
  userRole: "Partner" | "Senior Associate" | "Solicitor" | "Paralegal";
}

export default function ShareLinkModal({ 
  open, 
  onOpenChange, 
  caseId,
  caseTitle,
  userRole 
}: ShareLinkModalProps) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [isExternal, setIsExternal] = useState(false);
  const [organization, setOrganization] = useState("");
  const [expiration, setExpiration] = useState("7days");
  const [accessLevel, setAccessLevel] = useState("view");
  const [password, setPassword] = useState("");
  const [clientConsent, setClientConsent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const canShareExternal = userRole === "Partner" || userRole === "Senior Associate";

  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      // Actually send the share link via API
      sendShareLinkEmail();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  const sendShareLinkEmail = async () => {
    try {
      const response = await fetch(`/api/cases/${caseId}/share-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recipientEmail,
          recipientName,
          isExternal,
          organization,
          expiration,
          accessLevel,
          password,
          clientConsent,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast({
        title: "Link Shared Successfully",
        description: `Secure link sent to ${recipientEmail}`,
        duration: 6000,
      });
      setCountdown(null);
      handleClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send secure link",
        variant: "destructive",
      });
      setCountdown(null);
      setIsSending(false);
    }
  };


  const handleShare = () => {
    if (!recipientEmail || !recipientName) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
        duration: 8000, // 8 seconds for error messages
      });
      return;
    }

    if (isExternal && !clientConsent) {
      toast({
        title: "Consent Required",
        description: "You must confirm client consent for external sharing",
        variant: "destructive",
        duration: 8000, // 8 seconds for error messages
      });
      return;
    }

    // Start 30-second countdown
    setIsSending(true);
    setCountdown(30);
  };

  const handleCancel = () => {
    if (countdown !== null) {
      setCountdown(null);
      setIsSending(false);
      toast({
        title: "Share Cancelled",
        description: "Link was not sent",
        duration: 5000, // 5 seconds for info messages
      });
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setRecipientEmail("");
    setRecipientName("");
    setIsExternal(false);
    setOrganization("");
    setExpiration("7days");
    setAccessLevel("view");
    setPassword("");
    setClientConsent(false);
    setIsSending(false);
    setCountdown(null);
    onOpenChange(false);
  };

  if (!canShareExternal && isExternal) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent data-testid="dialog-share-restricted" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-destructive" />
              Access Restricted
            </DialogTitle>
          </DialogHeader>
          <Alert className="border-destructive">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription>
              Only Partners and Senior Associates can share cases externally. Please contact a senior team member for external sharing.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button onClick={handleClose} data-testid="button-close-restricted">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (isSending && countdown !== null) {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent data-testid="dialog-share-countdown" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Sending Secure Link...</DialogTitle>
            <DialogDescription>
              The link will be sent in {countdown} seconds
            </DialogDescription>
          </DialogHeader>

          <div className="py-8 text-center">
            <div className="text-6xl font-bold text-primary mb-4">{countdown}</div>
            <p className="text-muted-foreground">
              Sending to {recipientEmail}
            </p>
          </div>

          <DialogFooter>
            <Button 
              variant="destructive" 
              onClick={handleCancel}
              className="w-full"
              data-testid="button-cancel-send"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-share-link" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Share Secure Link</DialogTitle>
          <DialogDescription>
            Share {caseTitle} with controlled access and expiration
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="recipient-email">
                Recipient Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="recipient-email"
                type="email"
                placeholder="email@example.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                data-testid="input-recipient-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipient-name">
                Recipient Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="recipient-name"
                placeholder="Full name"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                data-testid="input-recipient-name"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="external"
              checked={isExternal}
              onCheckedChange={(checked) => setIsExternal(checked as boolean)}
              disabled={!canShareExternal}
              data-testid="checkbox-external"
            />
            <Label htmlFor="external" className="font-normal">
              External to firm
              {!canShareExternal && (
                <span className="text-xs text-muted-foreground ml-2">
                  (Partners/Senior Associates only)
                </span>
              )}
            </Label>
          </div>

          {isExternal && (
            <>
              <div className="space-y-2">
                <Label htmlFor="organization">Organization</Label>
                <Input
                  id="organization"
                  placeholder="Recipient's organization"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  data-testid="input-organization"
                />
              </div>

              <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950">
                <Shield className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Client Consent Required:</strong> You must confirm client consent before sharing externally
                </AlertDescription>
              </Alert>

              <div className="flex items-start space-x-2 p-3 border rounded-md bg-card">
                <Checkbox
                  id="consent"
                  checked={clientConsent}
                  onCheckedChange={(checked) => setClientConsent(checked as boolean)}
                  data-testid="checkbox-consent"
                  className="border-2 border-foreground/40 data-[state=checked]:border-primary"
                />
                <Label htmlFor="consent" className="font-normal text-sm leading-relaxed">
                  I confirm that client consent has been obtained to share this information externally. This consent and sharing action will be recorded in the audit log.
                </Label>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expiration">Link Expiration</Label>
              <Select value={expiration} onValueChange={setExpiration}>
                <SelectTrigger id="expiration" data-testid="select-expiration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24hours">24 Hours</SelectItem>
                  <SelectItem value="7days">7 Days</SelectItem>
                  <SelectItem value="30days">30 Days</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="access">Access Level</Label>
              <Select value={accessLevel} onValueChange={setAccessLevel}>
                <SelectTrigger id="access" data-testid="select-access">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View Only</SelectItem>
                  <SelectItem value="download">View + Download</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isExternal && (
            <div className="space-y-2">
              <Label htmlFor="password">Password Protection (Optional)</Label>
              <Input
                id="password"
                type="password"
                placeholder="Set a password for extra security"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="input-password"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-share">
            Cancel
          </Button>
          <Button 
            onClick={handleShare} 
            className="bg-accent hover:bg-accent"
            disabled={!recipientEmail || !recipientName || (isExternal && !clientConsent)}
            data-testid="button-send-link"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Send Secure Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
