import { Loader2, CheckCircle2, Upload, Sparkles } from "lucide-react";

export type ProcessingStep = "saving" | "uploading" | "processing" | "complete";

interface MeetingToMatterProcessingOverlayProps {
  processingStep: ProcessingStep;
}

export default function MeetingToMatterProcessingOverlay({
  processingStep,
}: MeetingToMatterProcessingOverlayProps) {
  return (
    <div className="py-8" data-testid="processing-overlay">
      <div className="flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          {processingStep === "complete" ? (
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center animate-pulse">
              <Loader2 className="w-10 h-10 text-accent animate-spin" />
            </div>
          )}
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold" data-testid="text-processing-title">
            {processingStep === "complete"
              ? "All Done!"
              : "Meeting-to-Matter™ Engine"}
          </h3>
          <p className="text-sm text-muted-foreground" data-testid="text-processing-description">
            {processingStep === "complete"
              ? "Your case is ready. Redirecting..."
              : "Please wait while we save your case and prepare your documents."}
          </p>
        </div>

        <div className="w-full max-w-xs space-y-3 pt-2">
          <div className="flex items-center gap-3">
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                processingStep === "saving" ? "bg-accent/20" : "bg-green-500/20"
              }`}
            >
              {processingStep === "saving" ? (
                <Loader2 className="w-4 h-4 text-accent animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              )}
            </div>
            <div className="flex-1">
              <p
                className={`text-sm font-medium ${
                  processingStep === "saving" ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                Saving case details
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                processingStep === "uploading"
                  ? "bg-accent/20"
                  : processingStep === "saving"
                    ? "bg-muted"
                    : "bg-green-500/20"
              }`}
            >
              {processingStep === "uploading" ? (
                <Loader2 className="w-4 h-4 text-accent animate-spin" />
              ) : processingStep === "saving" ? (
                <Upload className="w-4 h-4 text-muted-foreground" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              )}
            </div>
            <div className="flex-1">
              <p
                className={`text-sm font-medium ${
                  processingStep === "uploading"
                    ? "text-foreground"
                    : processingStep === "saving"
                      ? "text-muted-foreground"
                      : "text-muted-foreground"
                }`}
              >
                Uploading audio recording
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                processingStep === "processing"
                  ? "bg-accent/20"
                  : processingStep === "complete"
                    ? "bg-green-500/20"
                    : "bg-muted"
              }`}
            >
              {processingStep === "processing" ? (
                <Loader2 className="w-4 h-4 text-accent animate-spin" />
              ) : processingStep === "complete" ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <Sparkles className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <p
                className={`text-sm font-medium ${
                  processingStep === "processing"
                    ? "text-foreground"
                    : processingStep === "complete"
                      ? "text-muted-foreground"
                      : "text-muted-foreground"
                }`}
              >
                Activating Engine
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
