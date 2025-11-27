import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FileText } from "lucide-react";
import { insertCaseSchema } from "@shared/schema";

// Extend the base schema for the form's specific needs
const textNotesFormSchema = z.object({
  title: z.string().min(1, "Case title is required"),
  clientName: z.string().min(1, "Client name is required"),
  matterReference: z.string().optional(),
  textNotes: z.string().min(1, "Meeting notes are required"),
});

type TextNotesFormData = z.infer<typeof textNotesFormSchema>;

interface TextNotesModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { caseTitle: string; clientName: string; matterRef: string; notes: string }) => void;
}

export default function TextNotesModal({ open, onClose, onSave }: TextNotesModalProps) {
  const form = useForm<TextNotesFormData>({
    resolver: zodResolver(textNotesFormSchema),
    defaultValues: {
      title: "",
      clientName: "",
      matterReference: "",
      textNotes: "",
    },
  });

  const handleSave = (data: TextNotesFormData) => {
    // Map form data to expected format
    onSave({
      caseTitle: data.title,
      clientName: data.clientName,
      matterRef: data.matterReference || "",
      notes: data.textNotes,
    });
    form.reset();
  };

  const handleClose = () => {
    form.reset();
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
            We'll generate a professional attendance note from your text.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Case Title <span className="text-accent">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Estate Planning Consultation"
                        {...field}
                        data-testid="input-text-case-title"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Client Name <span className="text-accent">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Mrs. Catherine Williams"
                        {...field}
                        data-testid="input-text-client-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="matterReference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Matter Reference</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., MAT-2025-001"
                      {...field}
                      data-testid="input-text-matter-ref"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="textNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Meeting Notes <span className="text-accent">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Type your meeting notes here... Include key discussion points, client instructions, legal issues raised, and any action items."
                      className="min-h-[200px] resize-none"
                      {...field}
                      data-testid="textarea-meeting-notes"
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Tip: Be thorough - these notes will be used to generate your professional attendance note and summary.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                data-testid="button-cancel-text-notes"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="bg-accent hover:bg-accent"
                data-testid="button-save-text-notes"
              >
                Save & Generate Documents
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
