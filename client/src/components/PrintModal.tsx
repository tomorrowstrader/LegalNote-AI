import { useEffect, useState } from "react";
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
import { FileText, Loader2, Printer } from "lucide-react";

interface PrintModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableDocuments: {
    hasAttendanceNote: boolean;
    hasSummary: boolean;
    hasTranscript: boolean;
    hasCareLetter?: boolean;
  };
  /** Pre-select docs when the modal opens (e.g. current tab). */
  defaultSelected?: string[];
  onPrint: (selectedDocs: string[]) => Promise<boolean | void>;
}

function getDocumentLabel(type: string) {
  switch (type) {
    case "attendance_note":
      return "Attendance Note";
    case "summary":
      return "Client Letter";
    case "transcript":
      return "Full Transcript";
    case "client_care_letter":
      return "Client Care Letter";
    default:
      return type;
  }
}

export default function PrintModal({
  open,
  onOpenChange,
  availableDocuments,
  defaultSelected,
  onPrint,
}: PrintModalProps) {
  const buildDefaults = () => {
    const available = (doc: string) => {
      if (doc === "attendance_note") return availableDocuments.hasAttendanceNote;
      if (doc === "summary") return availableDocuments.hasSummary;
      if (doc === "transcript") return availableDocuments.hasTranscript;
      if (doc === "client_care_letter") return !!availableDocuments.hasCareLetter;
      return false;
    };

    if (defaultSelected && defaultSelected.length > 0) {
      const filtered = defaultSelected.filter(available);
      if (filtered.length > 0) return filtered;
    }

    if (availableDocuments.hasAttendanceNote) return ["attendance_note"];
    if (availableDocuments.hasSummary) return ["summary"];
    if (availableDocuments.hasCareLetter) return ["client_care_letter"];
    if (availableDocuments.hasTranscript) return ["transcript"];
    return [];
  };

  const [selectedDocuments, setSelectedDocuments] = useState<string[]>(buildDefaults);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedDocuments(buildDefaults());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset selection when modal opens
  }, [open, defaultSelected]);

  const toggleDocument = (docType: string) => {
    setSelectedDocuments((prev) =>
      prev.includes(docType) ? prev.filter((d) => d !== docType) : [...prev, docType],
    );
  };

  const handlePrint = async () => {
    if (selectedDocuments.length === 0) return;
    setIsPrinting(true);
    try {
      const succeeded = await onPrint(selectedDocuments);
      if (succeeded !== false) {
        onOpenChange(false);
      }
    } finally {
      setIsPrinting(false);
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && !isPrinting) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md print:hidden" data-testid="modal-print">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Print Documents
          </DialogTitle>
          <DialogDescription>
            Select which documents to include in the print preview
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            {availableDocuments.hasAttendanceNote && (
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="print-doc-attendance"
                  checked={selectedDocuments.includes("attendance_note")}
                  onCheckedChange={() => toggleDocument("attendance_note")}
                  data-testid="checkbox-print-attendance-note"
                />
                <Label
                  htmlFor="print-doc-attendance"
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
                  id="print-doc-summary"
                  checked={selectedDocuments.includes("summary")}
                  onCheckedChange={() => toggleDocument("summary")}
                  data-testid="checkbox-print-summary"
                />
                <Label
                  htmlFor="print-doc-summary"
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
                  id="print-doc-care-letter"
                  checked={selectedDocuments.includes("client_care_letter")}
                  onCheckedChange={() => toggleDocument("client_care_letter")}
                  data-testid="checkbox-print-care-letter"
                />
                <Label
                  htmlFor="print-doc-care-letter"
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
                  id="print-doc-transcript"
                  checked={selectedDocuments.includes("transcript")}
                  onCheckedChange={() => toggleDocument("transcript")}
                  data-testid="checkbox-print-transcript"
                />
                <Label
                  htmlFor="print-doc-transcript"
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
              Please select at least one document to print
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPrinting}
            data-testid="button-print-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handlePrint}
            disabled={selectedDocuments.length === 0 || isPrinting}
            data-testid="button-print-confirm"
          >
            {isPrinting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Preparing…
              </>
            ) : (
              <>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
