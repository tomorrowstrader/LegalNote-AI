import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FileText, FileDown, Loader2, Shield } from "lucide-react";

interface DownloadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableDocuments: {
    hasAttendanceNote: boolean;
    hasSummary: boolean;
    hasTranscript: boolean;
    hasCareLetter?: boolean;
  };
  sharedDocuments: string[];
  onDownload: (selectedDocs: string[], format: 'pdf' | 'word') => Promise<void>;
}

export default function DownloadModal({
  open,
  onOpenChange,
  availableDocuments,
  sharedDocuments,
  onDownload,
}: DownloadModalProps) {
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>(() => {
    const defaults: string[] = [];
    if (availableDocuments.hasAttendanceNote) {
      defaults.push("attendance_note");
    }
    return defaults;
  });
  const [isDownloading, setIsDownloading] = useState(false);

  const toggleDocument = (docType: string) => {
    setSelectedDocuments(prev =>
      prev.includes(docType)
        ? prev.filter(d => d !== docType)
        : [...prev, docType]
    );
  };

  const handleDownload = async (format: 'pdf' | 'word') => {
    if (selectedDocuments.length === 0) return;
    
    setIsDownloading(true);
    try {
      await onDownload(selectedDocuments, format);
      onOpenChange(false);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleClose = () => {
    if (!isDownloading) {
      const defaults: string[] = [];
      if (availableDocuments.hasAttendanceNote) {
        defaults.push("attendance_note");
      }
      setSelectedDocuments(defaults);
      onOpenChange(false);
    }
  };

  const getDocumentLabel = (type: string) => {
    switch (type) {
      case "attendance_note": return "Attendance Note";
      case "summary": return "Matter Record";
      case "transcript": return "Full Transcript";
      case "client_care_letter": return "Client Care Letter";
      default: return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="modal-download">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="w-5 h-5" />
            Download Working Copy
          </DialogTitle>
          <DialogDescription>
            Select which documents to include in your download
          </DialogDescription>
        </DialogHeader>

        {/* Master Record notice */}
        <div className="flex items-start gap-2 p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
            <span className="font-semibold">Working copy only.</span> The master record and complete audit trail remain securely held in LegalNote. This download is for reference only.
          </div>
        </div>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            {availableDocuments.hasAttendanceNote && (
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="doc-attendance"
                  checked={selectedDocuments.includes("attendance_note")}
                  onCheckedChange={() => toggleDocument("attendance_note")}
                  data-testid="checkbox-attendance-note"
                />
                <Label 
                  htmlFor="doc-attendance" 
                  className="flex items-center gap-2 cursor-pointer font-normal"
                >
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  {getDocumentLabel("attendance_note")}
                </Label>
              </div>
            )}

            {availableDocuments.hasSummary && (
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="doc-summary"
                  checked={selectedDocuments.includes("summary")}
                  onCheckedChange={() => toggleDocument("summary")}
                  data-testid="checkbox-summary"
                />
                <Label 
                  htmlFor="doc-summary" 
                  className="flex items-center gap-2 cursor-pointer font-normal"
                >
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  {getDocumentLabel("summary")}
                </Label>
              </div>
            )}

            {availableDocuments.hasCareLetter && (
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="doc-care-letter"
                  checked={selectedDocuments.includes("client_care_letter")}
                  onCheckedChange={() => toggleDocument("client_care_letter")}
                  data-testid="checkbox-care-letter"
                />
                <Label 
                  htmlFor="doc-care-letter" 
                  className="flex items-center gap-2 cursor-pointer font-normal"
                >
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  {getDocumentLabel("client_care_letter")}
                </Label>
              </div>
            )}

            {availableDocuments.hasTranscript && (
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="doc-transcript"
                  checked={selectedDocuments.includes("transcript")}
                  onCheckedChange={() => toggleDocument("transcript")}
                  data-testid="checkbox-transcript"
                />
                <Label 
                  htmlFor="doc-transcript" 
                  className="flex items-center gap-2 cursor-pointer font-normal"
                >
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  {getDocumentLabel("transcript")}
                </Label>
              </div>
            )}
          </div>

          {selectedDocuments.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Please select at least one document to download
            </p>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            onClick={() => handleDownload('pdf')}
            disabled={selectedDocuments.length === 0 || isDownloading}
            className="w-full sm:w-auto"
            data-testid="button-download-pdf"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 mr-2" />
                Download PDF
              </>
            )}
          </Button>
          <Button
            onClick={() => handleDownload('word')}
            disabled={selectedDocuments.length === 0 || isDownloading}
            variant="outline"
            className="w-full sm:w-auto"
            data-testid="button-download-word"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 mr-2" />
                Download Word
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
