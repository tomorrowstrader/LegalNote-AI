import { useState, useEffect } from "react";
import { Share2, CheckCircle2, X, Shield, AlertTriangle, Smartphone } from "lucide-react";
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
import { queryClient } from "@/lib/queryClient";

interface ShareLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseTitle: string;
  userRole: "Partner" | "Senior Associate" | "Solicitor" | "Paralegal";
  /** Full client name from the case file — first name is prefilled as recipient name. */
  recipientName?: string;
  /** When false (internal meetings), skip the client-consent external-share gate. */
  requireClientConsent?: boolean;
  availableDocuments?: {
    hasAttendanceNote: boolean;
    hasSummary: boolean;
    hasTranscript: boolean;
    hasCareLetter?: boolean;
  };
}

function extractFirstName(fullName: string | undefined): string {
  if (!fullName?.trim()) return "";
  return fullName.trim().split(/\s+/)[0] || "";
}

function defaultSharedDocuments(availableDocuments: {
  hasAttendanceNote: boolean;
  hasSummary: boolean;
  hasTranscript: boolean;
  hasCareLetter?: boolean;
}): string[] {
  // Client Letter is the default share selection when available
  if (availableDocuments.hasSummary) return ["summary"];
  if (availableDocuments.hasAttendanceNote) return ["attendance_note"];
  if (availableDocuments.hasCareLetter) return ["client_care_letter"];
  if (availableDocuments.hasTranscript) return ["transcript"];
  return [];
}

export default function ShareLinkModal({ 
  open, 
  onOpenChange, 
  caseId,
  caseTitle,
  userRole,
  recipientName: defaultRecipientName,
  requireClientConsent = true,
  availableDocuments = {
    hasAttendanceNote: true,
    hasSummary: true,
    hasTranscript: true,
    hasCareLetter: false,
  }
}: ShareLinkModalProps) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState(() => extractFirstName(defaultRecipientName));
  const [isExternal, setIsExternal] = useState(false);
  const [organization, setOrganization] = useState("");
  const [expiration, setExpiration] = useState("7days");
  const [accessLevel, setAccessLevel] = useState("view");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [clientConsent, setClientConsent] = useState(false);
  const [smsProtection, setSmsProtection] = useState(false);
  const [smsPhoneNumber, setSmsPhoneNumber] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [pendingSharePayload, setPendingSharePayload] = useState<Record<string, unknown> | null>(null);
  const [sharedDocuments, setSharedDocuments] = useState<string[]>(() =>
    defaultSharedDocuments(availableDocuments)
  );
  const { toast } = useToast();
  const { user } = useAuth();

  const canShareExternal = userRole === "Partner" || userRole === "Senior Associate";

  // Prefill first name and default docs whenever the modal opens
  useEffect(() => {
    if (!open) return;
    setRecipientName(extractFirstName(defaultRecipientName));
    setSharedDocuments(defaultSharedDocuments(availableDocuments));
  }, [open, defaultRecipientName, availableDocuments.hasAttendanceNote, availableDocuments.hasSummary, availableDocuments.hasTranscript, availableDocuments.hasCareLetter]);

  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      // Send with the payload snapshotted when Share was clicked (avoids stale state)
      void sendShareLinkEmail(pendingSharePayload);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  const sendShareLinkEmail = async (payload: Record<string, unknown> | null) => {
    if (!payload) {
      setCountdown(null);
      setIsSending(false);
      toast({
        title: "Error",
        description: "Share details were lost. Please try again.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/cases/${caseId}/share-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        let message = text || "Failed to send secure link";
        try {
          const parsed = JSON.parse(text);
          if (parsed?.message && typeof parsed.message === "string") {
            message = parsed.message;
          }
        } catch {
          // keep raw text
        }
        throw new Error(message);
      }

      toast({
        title: "Link Shared Successfully",
        description: `Secure link sent to ${payload.recipientEmail}`,
        duration: 6000,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/share-links`] });
      setCountdown(null);
      setPendingSharePayload(null);
      handleClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send secure link",
        variant: "destructive",
      });
      setCountdown(null);
      setPendingSharePayload(null);
      setIsSending(false);
    }
  };


  const handleShare = () => {
    if (!recipientEmail || !recipientName) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
        duration: 8000,
      });
      return;
    }

    if (sharedDocuments.length === 0) {
      toast({
        title: "No Documents Selected",
        description: "Please select at least one document to share",
        variant: "destructive",
        duration: 8000,
      });
      return;
    }

    if (isExternal && requireClientConsent && !clientConsent) {
      toast({
        title: "Consent Required",
        description: "You must confirm client consent for external sharing",
        variant: "destructive",
        duration: 8000,
      });
      return;
    }

    if (smsProtection && !smsPhoneNumber) {
      toast({
        title: "Phone Number Required",
        description: "Please provide a phone number for SMS verification",
        variant: "destructive",
        duration: 8000,
      });
      return;
    }

    const trimmedPassword = password.trim();
    if (trimmedPassword || confirmPassword.trim()) {
      if (trimmedPassword.length < 4) {
        toast({
          title: "Password Too Short",
          description: "Use at least 4 characters for the share password",
          variant: "destructive",
          duration: 8000,
        });
        return;
      }
      if (trimmedPassword !== confirmPassword.trim()) {
        toast({
          title: "Passwords Do Not Match",
          description: "Re-enter the same password in both fields",
          variant: "destructive",
          duration: 8000,
        });
        return;
      }
    }

    // Snapshot form values now so the countdown send cannot use stale/empty fields
    setPendingSharePayload({
      recipientEmail,
      recipientName,
      isExternal,
      organization,
      expiration,
      accessLevel,
      password: trimmedPassword || undefined,
      clientConsent,
      smsProtection,
      smsPhoneNumber: smsProtection ? smsPhoneNumber : undefined,
      customMessage: customMessage.trim() || undefined,
      sharedDocuments,
    });

    // Start 3-second countdown
    setIsSending(true);
    setCountdown(3);
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
    setRecipientName(extractFirstName(defaultRecipientName));
    setIsExternal(false);
    setOrganization("");
    setExpiration("7days");
    setAccessLevel("view");
    setPassword("");
    setConfirmPassword("");
    setClientConsent(false);
    setSmsProtection(false);
    setSmsPhoneNumber("");
    setCustomMessage("");
    setIsSending(false);
    setCountdown(null);
    setPendingSharePayload(null);
    setSharedDocuments(defaultSharedDocuments(availableDocuments));
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
            <div className="text-6xl font-bold text-foreground mb-4">{countdown}</div>
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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col" data-testid="dialog-share-link" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Share Secure Link</DialogTitle>
          <DialogDescription>
            Share {caseTitle} with controlled access and expiration
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto flex-1" data-testid="secure-share-modal-fields">
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
                placeholder="First name"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                data-testid="input-recipient-name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-message">
              Personal Message (Optional)
            </Label>
            <Textarea
              id="custom-message"
              placeholder="Add a personal message that will be included in the email to the recipient..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={3}
              className="resize-none"
              data-testid="input-custom-message"
            />
            <p className="text-xs text-muted-foreground">
              This message appears in the email. Do not include names, matter references, or other personal or case-specific data — those stay inside the secure link.
            </p>
          </div>

          <div className="space-y-3 border rounded-md p-4 bg-card">
            <Label className="text-base font-medium">Select Documents to Share</Label>
            <p className="text-sm text-muted-foreground">Choose which documents the recipient can access</p>
            <div className="space-y-3">
              {availableDocuments.hasSummary && (
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="doc-summary"
                    checked={sharedDocuments.includes("summary")}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSharedDocuments([...sharedDocuments, "summary"]);
                      } else {
                        setSharedDocuments(sharedDocuments.filter(d => d !== "summary"));
                      }
                    }}
                    data-testid="checkbox-client-letter"
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="doc-summary" className="font-normal">Client Letter</Label>
                    <p className="text-xs text-muted-foreground">Client-facing letter prepared from the attendance note</p>
                  </div>
                </div>
              )}
              {availableDocuments.hasAttendanceNote && (
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="doc-attendance-note"
                    checked={sharedDocuments.includes("attendance_note")}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSharedDocuments([...sharedDocuments, "attendance_note"]);
                      } else {
                        setSharedDocuments(sharedDocuments.filter(d => d !== "attendance_note"));
                      }
                    }}
                    data-testid="checkbox-attendance-note"
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="doc-attendance-note" className="font-normal">Attendance Note</Label>
                    <p className="text-xs text-muted-foreground">Professional summary of the meeting</p>
                  </div>
                </div>
              )}
              {availableDocuments.hasTranscript && (
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="doc-transcript"
                    checked={sharedDocuments.includes("transcript")}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSharedDocuments([...sharedDocuments, "transcript"]);
                      } else {
                        setSharedDocuments(sharedDocuments.filter(d => d !== "transcript"));
                      }
                    }}
                    data-testid="checkbox-transcript"
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="doc-transcript" className="font-normal flex items-center gap-2">
                      Transcript
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Raw conversation transcript. Consider sharing the Attendance Note instead for a professional matter record.
                    </p>
                  </div>
                </div>
              )}
              {availableDocuments.hasCareLetter && (
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="doc-care-letter"
                    checked={sharedDocuments.includes("client_care_letter")}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSharedDocuments([...sharedDocuments, "client_care_letter"]);
                      } else {
                        setSharedDocuments(sharedDocuments.filter(d => d !== "client_care_letter"));
                      }
                    }}
                    data-testid="checkbox-care-letter"
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="doc-care-letter" className="font-normal">Client Care Letter</Label>
                    <p className="text-xs text-muted-foreground">Engagement terms and client care information</p>
                  </div>
                </div>
              )}
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

          {isExternal && requireClientConsent && (
            <>
              <div className="space-y-2">
                <Label htmlFor="organization">Organization (optional)</Label>
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
          {isExternal && !requireClientConsent && (
            <div className="space-y-2">
              <Label htmlFor="organization">Organization (optional)</Label>
              <Input
                id="organization"
                placeholder="Recipient's organization"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                data-testid="input-organization"
              />
            </div>
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

          <div className="space-y-2">
            <Label htmlFor="password">Password Protection (Optional)</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Set a password for extra security"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="input-password"
            />
            {(password.trim().length > 0 || confirmPassword.trim().length > 0) && (
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  data-testid="input-confirm-password"
                />
              </div>
            )}
          </div>

          <div className="border-t pt-4" data-testid="secure-share-sms-section">
            <div className="flex items-center space-x-2 mb-3">
              <Checkbox
                id="sms-protection"
                checked={smsProtection}
                onCheckedChange={(checked) => setSmsProtection(checked as boolean)}
                data-testid="checkbox-sms-protection"
              />
              <Label htmlFor="sms-protection" className="font-normal flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Require SMS verification (extra security)
              </Label>
            </div>

            {smsProtection && (
              <div className="space-y-3 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="sms-phone">
                    Recipient Mobile Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="sms-phone"
                    type="tel"
                    placeholder="+447xxx... or 07xxx..."
                    value={smsPhoneNumber}
                    onChange={(e) => setSmsPhoneNumber(e.target.value)}
                    data-testid="input-sms-phone"
                  />
                  <p className="text-xs text-muted-foreground">
                    UK mobile number in international (+447xxx...) or national (07xxx...) format
                  </p>
                </div>
                <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
                  <Smartphone className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                    Recipient will receive a 6-digit verification code via SMS before accessing the documents.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 border-t pt-4 mt-auto bg-card">
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-share">
            Cancel
          </Button>
          <Button 
            onClick={handleShare} 
            className="bg-accent hover:bg-accent"
            disabled={!recipientEmail || !recipientName || (isExternal && requireClientConsent && !clientConsent) || (smsProtection && !smsPhoneNumber)}
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
