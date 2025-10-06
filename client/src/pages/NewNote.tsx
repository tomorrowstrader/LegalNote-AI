import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ConsentForm from "@/components/ConsentForm";
import AudioRecorder from "@/components/AudioRecorder";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

export default function NewNote() {
  const [, setLocation] = useLocation();
  const [caseTitle, setCaseTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [hasConsent, setHasConsent] = useState(false);
  const [consentText, setConsentText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConsentChange = (consent: boolean, text: string) => {
    setHasConsent(consent);
    setConsentText(text);
  };

  const handleRecordingComplete = (file: File) => {
    console.log('Processing recording...', file);
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setLocation('/case/1');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
        <Button
          variant="ghost"
          onClick={() => setLocation('/')}
          className="mb-6 gap-2"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Create New Note</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Record or upload audio to generate attendance notes and legal opinions
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Case Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="case-title">
                  Case Title <span className="text-accent">*</span>
                </Label>
                <Input
                  id="case-title"
                  placeholder="e.g., Estate Planning Consultation"
                  value={caseTitle}
                  onChange={(e) => setCaseTitle(e.target.value)}
                  data-testid="input-case-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-name">
                  Client Name <span className="text-accent">*</span>
                </Label>
                <Input
                  id="client-name"
                  placeholder="e.g., Mrs. Catherine Williams"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  data-testid="input-client-name"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Client Consent</CardTitle>
            </CardHeader>
            <CardContent>
              <ConsentForm onConsentChange={handleConsentChange} />
            </CardContent>
          </Card>

          {hasConsent && consentText && (
            <>
              <AudioRecorder
                onRecordingComplete={handleRecordingComplete}
                onFileUpload={handleRecordingComplete}
              />

              {isProcessing && (
                <Card>
                  <CardContent className="p-8">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-12 h-12 text-primary animate-spin" />
                      <div className="text-center">
                        <p className="font-medium">Processing Audio</p>
                        <p className="text-sm text-muted-foreground">
                          Transcribing and generating documentation...
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
