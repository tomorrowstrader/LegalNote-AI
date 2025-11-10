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
import SyncCalendarModal from "@/components/SyncCalendarModal";

interface SetPriorityDeadlineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseTitle: string;
  currentPriority?: string;
  currentDeadline?: string | null;
  currentDeadlineIsAllDay?: boolean;
}

export default function SetPriorityDeadlineModal({ 
  open, 
  onOpenChange, 
  caseId,
  caseTitle,
  currentPriority = "normal",
  currentDeadline = null,
  currentDeadlineIsAllDay = false
}: SetPriorityDeadlineModalProps) {
  const [priority, setPriority] = useState<string>(currentPriority);
  const [deadline, setDeadline] = useState<Date | undefined>(
    currentDeadline ? new Date(currentDeadline) : undefined
  );
  const [deadlineTime, setDeadlineTime] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [showSyncCalendarModal, setShowSyncCalendarModal] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { toast } = useToast();
  
  // Initialize form values when modal opens
  useEffect(() => {
    if (open) {
      setPriority(currentPriority);
      
      if (currentDeadline) {
        const date = new Date(currentDeadline);
        setDeadline(date);
        
        // Use explicit deadlineIsAllDay flag instead of inferring from timestamp
        if (!currentDeadlineIsAllDay) {
          // Timed deadline - show time in local timezone
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          setDeadlineTime(`${hours}:${minutes}`);
        } else {
          // All-day deadline - no time
          setDeadlineTime("");
        }
      } else {
        setDeadline(undefined);
        setDeadlineTime("");
      }
      
      setNotes("");
    }
  }, [open, currentPriority, currentDeadline, currentDeadlineIsAllDay]);

  const priorityOptions = [
    { value: "urgent", label: "Urgent - Action Required", color: "text-destructive" },
    { value: "deadline-soon", label: "Deadline Approaching", color: "text-amber-600" },
    { value: "normal", label: "Normal Priority", color: "text-green-600" },
  ];

  const updateCaseMutation = useMutation({
    mutationFn: async (data: { priority: string; deadline: string | null; deadlineIsAllDay?: boolean; textNotes?: string }) => {
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
      
      // Open calendar sync modal after a brief delay to ensure parent modal closes first
      if (deadline) {
        setTimeout(() => {
          setShowSyncCalendarModal(true);
        }, 300);
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
    
    // Combine date and time if both are set
    let finalDeadline: Date | null = null;
    const isAllDay = !deadlineTime; // All-day if no time is specified
    
    if (deadline) {
      finalDeadline = new Date(deadline);
      if (deadlineTime) {
        const [hours, minutes] = deadlineTime.split(':').map(Number);
        finalDeadline.setHours(hours, minutes, 0, 0);
      }
      // If no time specified, it will remain as a date-only (all-day event)
    }
    
    updateCaseMutation.mutate({
      priority,
      deadline: finalDeadline ? finalDeadline.toISOString() : null,
      deadlineIsAllDay: finalDeadline ? isAllDay : undefined,
      textNotes: notes || undefined,
    });
  };

  const handleCancel = () => {
    setPriority("");
    setDeadline(undefined);
    setDeadlineTime("");
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

          {deadline && (
            <div className="space-y-2">
              <Label htmlFor="deadline-time">Time (Optional)</Label>
              <Select value={deadlineTime} onValueChange={setDeadlineTime}>
                <SelectTrigger id="deadline-time" data-testid="select-deadline-time">
                  <SelectValue placeholder="All day (no specific time)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All day (no specific time)</SelectItem>
                  {Array.from({ length: 24 }, (_, hour) => {
                    const times = [0, 30].map(min => {
                      const h = hour.toString().padStart(2, '0');
                      const m = min.toString().padStart(2, '0');
                      const timeValue = `${h}:${m}`;
                      const displayTime = new Date(2000, 0, 1, hour, min).toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit',
                        hour12: true 
                      });
                      return (
                        <SelectItem key={timeValue} value={timeValue}>
                          {displayTime}
                        </SelectItem>
                      );
                    });
                    return times;
                  }).flat()}
                </SelectContent>
              </Select>
            </div>
          )}

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

      <SyncCalendarModal
        open={showSyncCalendarModal}
        onOpenChange={setShowSyncCalendarModal}
        caseId={caseId}
        caseTitle={caseTitle}
        deadline={deadline?.toISOString() || null}
        priority={priority}
        notes={notes}
        isAllDay={!deadlineTime}
      />
    </Dialog>
  );
}
