import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface SetPriorityDeadlineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseTitle: string;
  currentPriority?: string;
  currentDeadline?: string | null;
}

export default function SetPriorityDeadlineModal({ 
  open, 
  onOpenChange, 
  caseId,
  caseTitle,
  currentPriority = "normal",
  currentDeadline = null
}: SetPriorityDeadlineModalProps) {
  const [priority, setPriority] = useState<string>(currentPriority);
  const [deadline, setDeadline] = useState<Date | undefined>(
    currentDeadline ? new Date(currentDeadline) : undefined
  );
  const [notes, setNotes] = useState("");
  const [showCalendarSyncDialog, setShowCalendarSyncDialog] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Initialize form values when modal opens
  useEffect(() => {
    if (open) {
      setPriority(currentPriority);
      setDeadline(currentDeadline ? new Date(currentDeadline) : undefined);
      setNotes("");
    }
  }, [open, currentPriority, currentDeadline]);

  const priorityOptions = [
    { value: "urgent", label: "Urgent - Action Required", color: "text-destructive" },
    { value: "deadline-soon", label: "Deadline Approaching", color: "text-amber-600" },
    { value: "normal", label: "Normal Priority", color: "text-green-600" },
  ];

  const updateCaseMutation = useMutation({
    mutationFn: async (data: { priority: string; deadline: string | null; textNotes?: string }) => {
      const res = await fetch(`/api/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to update case');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId] });
      
      toast({
        title: "Priority & Deadline Updated",
        description: deadline 
          ? `Deadline set to ${format(deadline, 'PPP')}`
          : "Priority updated successfully",
        duration: 3000,
      });
      
      onOpenChange(false);
      
      if (deadline) {
        setShowCalendarSyncDialog(true);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update priority and deadline",
        variant: "destructive",
      });
    }
  });

  const handleSave = () => {
    if (!priority) {
      toast({
        title: "Priority Required",
        description: "Please select a priority level",
        variant: "destructive",
      });
      return;
    }
    
    updateCaseMutation.mutate({
      priority,
      deadline: deadline ? deadline.toISOString() : null,
      textNotes: notes || undefined,
    });
  };

  const handleCancel = () => {
    setPriority("");
    setDeadline(undefined);
    setNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-set-priority-deadline" onClick={(e) => e.stopPropagation()}>
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
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
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
                  onSelect={(date) => {
                    setDeadline(date);
                    setCalendarOpen(false);
                  }}
                  initialFocus
                  data-testid="calendar-deadline"
                />
              </PopoverContent>
            </Popover>
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
            disabled={!priority || updateCaseMutation.isPending}
            className="bg-accent hover:bg-accent"
            data-testid="button-save-priority"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {updateCaseMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={showCalendarSyncDialog} onOpenChange={setShowCalendarSyncDialog}>
        <AlertDialogContent data-testid="dialog-calendar-sync">
          <AlertDialogHeader>
            <AlertDialogTitle>Sync to Calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to sync this deadline to your Google Calendar or Outlook calendar? 
              You can also sync it later from Settings → Calendar Connections.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-sync-later">Maybe Later</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setShowCalendarSyncDialog(false);
                setLocation('/settings');
              }}
              data-testid="button-sync-now"
            >
              Sync to Calendar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
