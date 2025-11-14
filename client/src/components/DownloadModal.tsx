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
import { FileText, FileDown, Loader2 } from "lucide-react";

interface DownloadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableDocuments: {
    hasAttendanceNote: boolean;
    hasLegalOpinion: boolean;
    hasSummary: boolean;
    hasTranscript: boolean;
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
    if (availableDocuments.hasAttendanceNote && sharedDocuments.includes("attendance_note")) {
      defaults.push("attendance_note");
    }
    if (availableDocuments.hasLegalOpinion && sharedDocuments.includes("legal_opinion")) {
      defaults.push("legal_opinion");
    }
    if (availableDocuments.hasSummary && sharedDocuments.includes("summary")) {
      defaults.push("summary");
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
      if (availableDocuments.hasAttendanceNote && sharedDocuments.includes("attendance_note")) {
        defaults.push("attendance_note");
      }
      if (availableDocuments.hasLegalOpinion && sharedDocuments.includes("legal_opinion")) {
        defaults.push("legal_opinion");
      }
      if (availableDocuments.hasSummary && sharedDocuments.includes("summary")) {
        defaults.push("summary");
      }
      setSelectedDocuments(defaults);
      onOpenChange(false);
    }
  };

  const getDocumentLabel = (type: string) => {
    switch (type) {
      case "attendance_note": return "Attendance Note";
      case "legal_opinion": return "Legal Opinion";
      case "summary": return "Summary";
      case "transcript": return "Full Transcript";
      default: return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="modal-download">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="w-5 h-5" />
            Download Documents
          </DialogTitle>
          <DialogDescription>
            Select which documents to include in your download
          </DialogDescription>
        </DialogHeader>

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

            {availableDocuments.hasLegalOpinion && (
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="doc-opinion"
                  checked={selectedDocuments.includes("legal_opinion")}
                  onCheckedChange={() => toggleDocument("legal_opinion")}
                  data-testid="checkbox-legal-opinion"
                />
                <Label 
                  htmlFor="doc-opinion" 
                  className="flex items-center gap-2 cursor-pointer font-normal"
                >
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  {getDocumentLabel("legal_opinion")}
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
