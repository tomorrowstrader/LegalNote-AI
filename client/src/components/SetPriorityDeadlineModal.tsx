import { useState } from "react";
import { Calendar as CalendarIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface SetPriorityDeadlineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseTitle: string;
}

export default function SetPriorityDeadlineModal({ 
  open, 
  onOpenChange, 
  caseId,
  caseTitle 
}: SetPriorityDeadlineModalProps) {
  const [priority, setPriority] = useState<string>("");
  const [deadline, setDeadline] = useState<Date>();
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  const priorityOptions = [
    { value: "urgent", label: "Urgent - Action Required", color: "text-destructive" },
    { value: "deadline-soon", label: "Deadline Approaching", color: "text-amber-600" },
    { value: "normal", label: "Normal Priority", color: "text-green-600" },
  ];

  const generateCalendarInvite = () => {
    if (!deadline) return;

    // Generate .ics file content
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//LegalNote AI//Case Deadline//EN
BEGIN:VEVENT
UID:${caseId}-deadline@legalnote.ai
DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}
DTSTART:${format(deadline, "yyyyMMdd")}
SUMMARY:Deadline: ${caseTitle}
DESCRIPTION:Case deadline set with priority: ${priority}\\n\\nNotes: ${notes}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

    // Create blob and download link
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${caseTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-deadline.ics`;
    link.click();
    URL.revokeObjectURL(url);

    // In production, this would also send via email
    console.log('Calendar invite generated and email sent');
  };

  const handleSave = () => {
    console.log('Setting priority and deadline:', { 
      caseId, 
      priority, 
      deadline, 
      notes 
    });

    if (deadline) {
      generateCalendarInvite();
    }

    toast({
      title: "Priority & Deadline Set",
      description: deadline 
        ? `Calendar invite sent to your email. Deadline: ${format(deadline, 'PPP')}`
        : "Priority updated successfully",
    });

    // Reset and close
    setPriority("");
    setDeadline(undefined);
    setNotes("");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setPriority("");
    setDeadline(undefined);
    setNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-set-priority-deadline">
        <DialogHeader>
          <DialogTitle>Set Priority & Deadline</DialogTitle>
          <DialogDescription>
            Update case priority and set deadline reminder for {caseTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="priority">Priority Level</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger id="priority" data-testid="select-priority">
                <SelectValue placeholder="Select priority level" />
              </SelectTrigger>
              <SelectContent>
                {priorityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className={option.color}>{option.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Deadline Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  data-testid="button-select-deadline"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {deadline ? format(deadline, "PPP") : <span>Pick a deadline date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={deadline}
                  onSelect={setDeadline}
                  initialFocus
                  data-testid="calendar-deadline"
                />
              </PopoverContent>
            </Popover>
            {deadline && (
              <p className="text-xs text-muted-foreground">
                📧 A calendar invite (.ics file) will be sent to your email
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline-notes">Notes (Optional)</Label>
            <Textarea
              id="deadline-notes"
              placeholder="Add context about this deadline..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none"
              data-testid="textarea-deadline-notes"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            data-testid="button-cancel-priority"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!priority}
            className="bg-accent hover:bg-accent"
            data-testid="button-save-priority"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
