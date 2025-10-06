import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle } from "lucide-react";

interface ConsentFormProps {
  onConsentChange?: (hasConsent: boolean, consentText: string) => void;
}

export default function ConsentForm({ onConsentChange }: ConsentFormProps) {
  const [consentGiven, setConsentGiven] = useState(false);
  const [consentText, setConsentText] = useState("");

  const handleConsentToggle = (checked: boolean) => {
    setConsentGiven(checked);
    onConsentChange?.(checked, consentText);
  };

  const handleTextChange = (value: string) => {
    setConsentText(value);
    onConsentChange?.(consentGiven, value);
  };

  return (
    <div className="space-y-4" data-testid="form-consent">
      <div className="flex items-center justify-between p-4 bg-muted rounded-md">
        <div className="flex items-start gap-3 flex-1">
          <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
          <div className="flex-1">
            <Label htmlFor="consent-toggle" className="text-sm font-medium">
              Client Consent Required
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Confirm client consent has been obtained before recording
            </p>
          </div>
        </div>
        <Switch
          id="consent-toggle"
          checked={consentGiven}
          onCheckedChange={handleConsentToggle}
          data-testid="switch-consent"
        />
      </div>

      {consentGiven && (
        <div className="space-y-2">
          <Label htmlFor="consent-details" className="text-sm font-medium">
            Consent Details <span className="text-accent">*</span>
          </Label>
          <Textarea
            id="consent-details"
            placeholder="Enter consent details, including client name and confirmation of permission to record..."
            value={consentText}
            onChange={(e) => handleTextChange(e.target.value)}
            className="min-h-24"
            data-testid="textarea-consent-details"
          />
          <p className="text-xs text-muted-foreground">
            This information will be logged with the case for GDPR compliance
          </p>
        </div>
      )}
    </div>
  );
}
