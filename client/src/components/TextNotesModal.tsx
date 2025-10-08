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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText } from "lucide-react";

interface TextNotesModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { caseTitle: string; clientName: string; matterRef: string; notes: string }) => void;
}

export default function TextNotesModal({ open, onClose, onSave }: TextNotesModalProps) {
  const [caseTitle, setCaseTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [matterRef, setMatterRef] = useState("");
  const [notes, setNotes] = useState("");

  const handleSave = () => {
    onSave({ caseTitle, clientName, matterRef, notes });
    // Reset form
    setCaseTitle("");
    setClientName("");
    setMatterRef("");
    setNotes("");
  };

  const handleClose = () => {
    setCaseTitle("");
    setClientName("");
    setMatterRef("");
    setNotes("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px]" data-testid="dialog-text-notes">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            Recording Consent Declined - Text Notes
          </DialogTitle>
          <DialogDescription>
            Since recording consent was declined, you can manually type your meeting notes below. 
            We'll still generate attendance notes and legal opinions from your text.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="text-case-title">
                Case Title <span className="text-accent">*</span>
              </Label>
              <Input
                id="text-case-title"
                placeholder="e.g., Estate Planning Consultation"
                value={caseTitle}
                onChange={(e) => setCaseTitle(e.target.value)}
                data-testid="input-text-case-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="text-client-name">
                Client Name <span className="text-accent">*</span>
              </Label>
              <Input
                id="text-client-name"
                placeholder="e.g., Mrs. Catherine Williams"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                data-testid="input-text-client-name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="text-matter-ref">Matter Reference</Label>
            <Input
              id="text-matter-ref"
              placeholder="e.g., MAT-2025-001"
              value={matterRef}
              onChange={(e) => setMatterRef(e.target.value)}
              data-testid="input-text-matter-ref"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="text-notes">
              Meeting Notes <span className="text-accent">*</span>
            </Label>
            <Textarea
              id="text-notes"
              placeholder="Type your meeting notes here... Include key discussion points, client instructions, legal issues raised, and any action items."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[200px] resize-none"
              data-testid="textarea-meeting-notes"
            />
            <p className="text-xs text-muted-foreground">
              Tip: Be thorough - these notes will be used to generate your attendance note and legal opinion.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            data-testid="button-cancel-text-notes"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!caseTitle || !clientName || !notes}
            className="bg-accent hover:bg-accent"
            data-testid="button-save-text-notes"
          >
            Save & Generate Documents
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
