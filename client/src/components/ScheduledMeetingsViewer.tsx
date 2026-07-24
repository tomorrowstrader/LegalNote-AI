import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getApiErrorMessage } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Calendar, 
  Clock, 
  Video, 
  Mail, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Bot,
  Send,
  Loader2,
  Users,
  Briefcase,
  Ban,
  CalendarClock,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  CalendarPlus,
  Radio,
  Pencil,
} from "lucide-react";
import { format, formatDistanceToNow, isToday, isTomorrow, isPast, addDays, startOfDay } from "date-fns";
import { useState, useMemo, useEffect } from "react";
import type { ScheduledMeeting, Case } from "@shared/schema";
import ConfigurationErrorModal from "@/components/ConfigurationErrorModal";
import ScheduleMeetingModal from "@/components/ScheduleMeetingModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { isFeatureVisible } from "@/lib/features";
import { getSafeHttpsMeetingUrl } from "@/lib/meetingUrl";
import { LiveBotModal } from "@/components/LiveBotModal";

/** Keep meetings visible this long after start for late logins (must match server). */
const LATE_JOIN_GRACE_MS = 15 * 60 * 1000;

type MeetingAttendee = { email: string; name?: string; responseStatus?: string };

type MeetingTimeTab = "today" | "tomorrow" | "next7" | "later";

const MEETING_TABS: { value: MeetingTimeTab; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "next7", label: "Next 7 days" },
  { value: "later", label: "Later" },
];

function isMeetingInProgress(meeting: ScheduledMeeting, now = Date.now()): boolean {
  if (meeting.status !== "scheduled") return false;
  const start = new Date(meeting.startTime).getTime();
  return start <= now && now < start + LATE_JOIN_GRACE_MS;
}

function categorizeMeeting(meeting: ScheduledMeeting): MeetingTimeTab {
  const start = new Date(meeting.startTime);
  if (isToday(start)) return "today";
  if (isTomorrow(start)) return "tomorrow";
  const endOfNext7 = startOfDay(addDays(new Date(), 7));
  // Inclusive of day 7: anything after tomorrow through end of day +7
  if (start <= endOfNext7) return "next7";
  return "later";
}

function pickDefaultMeetingTab(meetings: ScheduledMeeting[]): MeetingTimeTab {
  const counts = { today: 0, tomorrow: 0, next7: 0, later: 0 };
  for (const m of meetings) {
    counts[categorizeMeeting(m)] += 1;
  }
  if (counts.today > 0) return "today";
  if (counts.tomorrow > 0) return "tomorrow";
  if (counts.next7 > 0) return "next7";
  if (counts.later > 0) return "later";
  return "today";
}

function useIsDesktop(breakpointPx = 768) {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(`(min-width: ${breakpointPx}px)`).matches : true,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${breakpointPx}px)`);
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [breakpointPx]);

  return isDesktop;
}

function getMeetingAttendees(meeting: ScheduledMeeting): MeetingAttendee[] {
  if (!Array.isArray(meeting.attendees)) return [];
  return meeting.attendees.filter(
    (a): a is MeetingAttendee =>
      typeof a === "object" &&
      a !== null &&
      typeof (a as MeetingAttendee).email === "string" &&
      (a as MeetingAttendee).email.length > 0,
  );
}

const calendarAutoRecordVisible = isFeatureVisible("calendarAutoRecord");

function getConsentStatusBadge(status: string) {
  switch (status) {
    case 'approved':
      return <Badge variant="default" className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" /> Consented</Badge>;
    case 'declined':
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Declined</Badge>;
    case 'reschedule_requested':
      return <Badge variant="secondary" className="bg-amber-500 text-white"><Clock className="w-3 h-3 mr-1" /> Reschedule Requested</Badge>;
    case 'sent':
      return <Badge variant="secondary"><Mail className="w-3 h-3 mr-1" /> Sent</Badge>;
    case 'expired':
      return <Badge variant="outline"><AlertCircle className="w-3 h-3 mr-1" /> Expired</Badge>;
    default:
      return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
  }
}

function getBotStatusBadge(status: string | null) {
  if (!status) return null;
  
  switch (status) {
    case 'in_call':
      return <Badge className="bg-blue-600"><Bot className="w-3 h-3 mr-1" /> Recording</Badge>;
    case 'joining':
      return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Joining</Badge>;
    case 'waiting':
      return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" /> Waiting</Badge>;
    case 'done':
      return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" /> Complete</Badge>;
    case 'failed':
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
    default:
      return null;
  }
}

function getMeetingStatusBadge(status: string) {
  switch (status) {
    case 'cancelled':
      return <Badge variant="destructive"><Ban className="w-3 h-3 mr-1" /> Cancelled</Badge>;
    case 'rescheduled':
      return <Badge variant="secondary"><CalendarClock className="w-3 h-3 mr-1" /> Rescheduled</Badge>;
    case 'completed':
      return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>;
    default:
      return null;
  }
}

/** Prefer detected platform; otherwise default Meet/Teams from the linked calendar OAuth account. */
function resolveMeetingPlatform(
  meeting: ScheduledMeeting,
): "zoom" | "teams" | "meet" | "webex" | null {
  const p = meeting.meetingPlatform;
  if (p === "zoom" || p === "teams" || p === "meet" || p === "webex") return p;
  if (meeting.calendarProvider === "outlook") return "teams";
  if (meeting.calendarProvider === "google") return "meet";
  return null;
}

function getPlatformIcon(platform: string | null) {
  switch (platform) {
    case "zoom":
      return (
        <Badge variant="outline" className="text-xs">
          Zoom
        </Badge>
      );
    case "teams":
      return (
        <Badge variant="outline" className="text-xs">
          Microsoft Teams
        </Badge>
      );
    case "meet":
      return (
        <Badge variant="outline" className="text-xs">
          Google Meet
        </Badge>
      );
    case "webex":
      return (
        <Badge variant="outline" className="text-xs">
          Webex
        </Badge>
      );
    default:
      return null;
  }
}

function CasePickerDialog({ 
  meeting, 
  open, 
  onOpenChange 
}: { 
  meeting: ScheduledMeeting; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: cases = [] } = useQuery<Case[]>({
    queryKey: ['/api/cases'],
    enabled: open,
  });
  
  const filteredCases = cases.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.title.toLowerCase().includes(q) || 
           c.clientName.toLowerCase().includes(q) ||
           (c.matterReference && c.matterReference.toLowerCase().includes(q));
  });
  
  const linkCaseMutation = useMutation({
    mutationFn: async (caseId: string | null) => {
      return apiRequest('PATCH', `/api/scheduled-meetings/${meeting.id}`, { caseId });
    },
    onSuccess: () => {
      toast({ title: "Case linked successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-meetings'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to link case", description: error.message, variant: "destructive" });
    },
  });
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-case-picker">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            Link to Case
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search cases..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-case-search"
            />
          </div>
          
          {meeting.caseId && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => linkCaseMutation.mutate(null)}
              disabled={linkCaseMutation.isPending}
              data-testid="button-unlink-case"
            >
              <X className="w-3 h-3 mr-1" />
              Unlink Current Case
            </Button>
          )}
          
          <div className="max-h-60 overflow-y-auto space-y-2">
            {filteredCases.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No cases found</p>
            ) : (
              filteredCases.map(c => (
                <button
                  key={c.id}
                  className={`w-full text-left p-3 rounded-md border transition-colors hover-elevate ${
                    meeting.caseId === c.id ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => linkCaseMutation.mutate(c.id)}
                  disabled={linkCaseMutation.isPending}
                  data-testid={`button-select-case-${c.id}`}
                >
                  <p className="font-medium text-sm truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground">{c.clientName}</p>
                  {c.matterReference && (
                    <p className="text-xs text-muted-foreground">Ref: {c.matterReference}</p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CancelMeetingDialog({
  meeting,
  open,
  onOpenChange,
}: {
  meeting: ScheduledMeeting;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  
  const cancelMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/scheduled-meetings/${meeting.id}/cancel`, { reason });
    },
    onSuccess: () => {
      toast({ title: "Meeting cancelled" });
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-meetings'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to cancel meeting", description: error.message, variant: "destructive" });
    },
  });
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-cancel-meeting">
        <DialogHeader>
          <DialogTitle>Cancel Meeting</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to cancel <span className="font-medium text-foreground">{meeting.title}</span>?
          </p>
          <div>
            <Label>Reason (optional)</Label>
            <Textarea
              placeholder="Reason for cancellation..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              data-testid="input-cancel-reason"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-dismiss">
            Keep Meeting
          </Button>
          <Button
            variant="destructive"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
            data-testid="button-confirm-cancel"
          >
            {cancelMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Ban className="w-4 h-4 mr-1" />}
            Cancel Meeting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditMeetingDialog({
  meeting,
  open,
  onOpenChange,
}: {
  meeting: ScheduledMeeting;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(meeting.title);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  useEffect(() => {
    if (!open) return;
    const start = new Date(meeting.startTime);
    setTitle(meeting.title);
    setNewDate(format(start, "yyyy-MM-dd"));
    setNewTime(format(start, "HH:mm"));
  }, [open, meeting]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        throw new Error("Title is required");
      }
      if (!newDate || !newTime) {
        throw new Error("Date and time are required");
      }

      const newStartTime = new Date(`${newDate}T${newTime}`);
      if (isNaN(newStartTime.getTime())) {
        throw new Error("Invalid date or time");
      }

      const originalStart = new Date(meeting.startTime);
      const timeChanged = newStartTime.getTime() !== originalStart.getTime();
      const titleChanged = trimmedTitle !== meeting.title;

      if (!timeChanged && !titleChanged) {
        throw new Error("No changes to save");
      }

      if (timeChanged) {
        if (newStartTime <= new Date()) {
          throw new Error("Start time must be in the future");
        }
        const endTimeDiff = meeting.endTime
          ? new Date(meeting.endTime).getTime() - originalStart.getTime()
          : 60 * 60 * 1000;
        const newEndTime = new Date(newStartTime.getTime() + endTimeDiff);
        return apiRequest("POST", `/api/scheduled-meetings/${meeting.id}/reschedule`, {
          newStartTime: newStartTime.toISOString(),
          newEndTime: newEndTime.toISOString(),
          ...(titleChanged ? { title: trimmedTitle } : {}),
        });
      }

      return apiRequest("PATCH", `/api/scheduled-meetings/${meeting.id}`, {
        title: trimmedTitle,
      });
    },
    onSuccess: () => {
      toast({ title: "Meeting updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-meetings"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update meeting",
        description: getApiErrorMessage(error, error.message),
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-edit-meeting">
        <DialogHeader>
          <DialogTitle>Edit Meeting</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label htmlFor="edit-meeting-title">Title</Label>
            <Input
              id="edit-meeting-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="input-edit-meeting-title"
            />
          </div>
          <div>
            <Label htmlFor="edit-meeting-date">Date</Label>
            <Input
              id="edit-meeting-date"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              min={format(new Date(), "yyyy-MM-dd")}
              data-testid="input-edit-meeting-date"
            />
          </div>
          <div>
            <Label htmlFor="edit-meeting-time">Time</Label>
            <Input
              id="edit-meeting-time"
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              data-testid="input-edit-meeting-time"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-edit-meeting-dismiss"
          >
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !title.trim() || !newDate || !newTime}
            data-testid="button-confirm-edit-meeting"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <CalendarClock className="w-4 h-4 mr-1" />
            )}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MeetingCard({ meeting, onUpdate }: { meeting: ScheduledMeeting; onUpdate: () => void }) {
  const { toast } = useToast();
  const [showRecipientDialog, setShowRecipientDialog] = useState(false);
  const [selectedAttendeeEmail, setSelectedAttendeeEmail] = useState('');
  const [showCaseDialog, setShowCaseDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showLiveBotModal, setShowLiveBotModal] = useState(false);

  const attendees = getMeetingAttendees(meeting);
  const safeJoinUrl = getSafeHttpsMeetingUrl(meeting.meetingUrl);
  
  const startTime = new Date(meeting.startTime);
  const inProgress = isMeetingInProgress(meeting);
  const isMeetingSoon =
    !inProgress && !isPast(startTime) && startTime.getTime() - Date.now() < 30 * 60 * 1000;
  const isActive = meeting.status === 'scheduled';
  
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<ScheduledMeeting>) => {
      return apiRequest('PATCH', `/api/scheduled-meetings/${meeting.id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-meetings'] });
      onUpdate();
    },
  });
  
  const sendConsentMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/scheduled-meetings/${meeting.id}/send-consent`);
    },
    onSuccess: () => {
      toast({ title: "Consent email sent", description: "The client will receive a consent request." });
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-meetings'] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to send consent", description: error.message, variant: "destructive" });
    },
  });
  
  const deployBotMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/scheduled-meetings/${meeting.id}/deploy-bot`);
    },
    onSuccess: () => {
      toast({ title: "Bot deployed", description: "The recording bot is joining the meeting." });
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-meetings'] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to deploy bot", description: error.message, variant: "destructive" });
    },
  });
  
  const handleToggleAutoRecord = (enabled: boolean) => {
    updateMutation.mutate({ autoRecordEnabled: enabled });
  };

  const openRecipientDialog = () => {
    setSelectedAttendeeEmail(meeting.clientEmail || '');
    setShowRecipientDialog(true);
  };

  const handleConfirmRecipient = () => {
    const attendee = attendees.find((a) => a.email === selectedAttendeeEmail);
    if (!attendee) {
      toast({
        title: "Select a recipient",
        description: "Choose an attendee from the meeting invite.",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate({
      clientEmail: attendee.email,
      clientName: attendee.name || attendee.email,
    });
    setShowRecipientDialog(false);
  };

  const { data: linkedCase } = useQuery<Case>({
    queryKey: ['/api/cases', meeting.caseId],
    queryFn: () => fetch(`/api/cases/${meeting.caseId}`).then(r => r.ok ? r.json() : null),
    enabled: !!meeting.caseId,
  });
  
  return (
    <>
      <Card
        className={`${
          inProgress && isActive
            ? "border-emerald-500/70 shadow-sm ring-1 ring-emerald-500/20"
            : isMeetingSoon && isActive
              ? "border-primary"
              : ""
        } ${!isActive ? "opacity-75" : ""}`}
        data-testid={`meeting-card-${meeting.id}`}
      >
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate" data-testid={`meeting-title-${meeting.id}`}>{meeting.title}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 flex-wrap">
                  <Calendar className="w-4 h-4 flex-shrink-0" />
                  <span>
                    {isToday(startTime) ? 'Today' : isTomorrow(startTime) ? 'Tomorrow' : format(startTime, 'EEE, MMM d')}
                    {' at '}
                    {format(startTime, 'h:mm a')}
                  </span>
                  {inProgress && isActive ? (
                    <span className="text-xs text-emerald-700 dark:text-emerald-400">
                      (scheduled start {formatDistanceToNow(startTime, { addSuffix: true })})
                    </span>
                  ) : !isPast(startTime) && isActive ? (
                    <span className="text-xs">({formatDistanceToNow(startTime, { addSuffix: true })})</span>
                  ) : null}
                </div>
              </div>
              
              {isActive && calendarAutoRecordVisible && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <label className="text-xs text-muted-foreground">Auto-record</label>
                  <Switch
                    checked={meeting.autoRecordEnabled}
                    onCheckedChange={handleToggleAutoRecord}
                    disabled={updateMutation.isPending}
                    data-testid={`toggle-autorecord-${meeting.id}`}
                  />
                </div>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {inProgress && isActive && (
                <Badge
                  className="bg-emerald-600 hover:bg-emerald-600 text-white"
                  data-testid={`badge-in-progress-${meeting.id}`}
                >
                  <Radio className="w-3 h-3 mr-1 animate-pulse" />
                  In progress — join now
                </Badge>
              )}
              {getMeetingStatusBadge(meeting.status)}
              {isActive && getConsentStatusBadge(meeting.consentStatus)}
              {getBotStatusBadge(meeting.botStatus)}
              {getPlatformIcon(resolveMeetingPlatform(meeting))}
              
              {linkedCase && (
                <Badge variant="secondary" data-testid={`badge-linked-case-${meeting.id}`}>
                  <Briefcase className="w-3 h-3 mr-1" />
                  {linkedCase.title}
                </Badge>
              )}
            </div>
            
            {meeting.clientEmail && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>
                  Consent recipient: {meeting.clientName || meeting.clientEmail}
                  {meeting.clientName && meeting.clientName !== meeting.clientEmail && (
                    <span className="text-xs"> ({meeting.clientEmail})</span>
                  )}
                </span>
              </div>
            )}
            
            {meeting.cancellationReason && meeting.status === 'cancelled' && (
              <p className="text-xs text-muted-foreground italic">Reason: {meeting.cancellationReason}</p>
            )}
            
            {isActive && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                {safeJoinUrl ? (
                  <Button
                    size="sm"
                    className={inProgress ? "bg-emerald-600 hover:bg-emerald-700 text-white" : undefined}
                    onClick={() => {
                      if (meeting.recallBotId) {
                        window.open(safeJoinUrl, '_blank', 'noopener,noreferrer');
                      } else {
                        setShowLiveBotModal(true);
                      }
                    }}
                    data-testid={`button-join-with-legalnote-${meeting.id}`}
                  >
                    <Video className="w-3 h-3 mr-1" />
                    {inProgress
                      ? (meeting.recallBotId ? "Join now" : "Join now with LegalNote")
                      : (meeting.recallBotId ? "Join meeting" : "Join with LegalNote")}
                  </Button>
                ) : null}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCaseDialog(true)}
                  data-testid={`button-link-case-${meeting.id}`}
                >
                  <Briefcase className="w-3 h-3 mr-1" />
                  {meeting.caseId ? 'Change Case' : 'Link Case'}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowEditDialog(true)}
                  data-testid={`button-edit-meeting-${meeting.id}`}
                >
                  <Pencil className="w-3 h-3 mr-1" />
                  Edit Meeting
                </Button>
                
                {attendees.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openRecipientDialog}
                    data-testid={`button-choose-recipient-${meeting.id}`}
                  >
                    <Users className="w-3 h-3 mr-1" />
                    {meeting.clientEmail ? 'Change recipient' : 'Choose recipient'}
                  </Button>
                )}

                <Dialog open={showRecipientDialog} onOpenChange={setShowRecipientDialog}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Choose consent recipient</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                      Select who will receive the recording consent email. This must be someone on the meeting invite.
                    </p>
                    <div className="space-y-2 pt-2 max-h-64 overflow-y-auto">
                      {attendees.map((attendee) => (
                        <button
                          key={attendee.email}
                          type="button"
                          onClick={() => setSelectedAttendeeEmail(attendee.email)}
                          className={`w-full text-left p-3 rounded-md border transition-colors ${
                            selectedAttendeeEmail === attendee.email
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted/50'
                          }`}
                          data-testid={`attendee-option-${attendee.email}`}
                        >
                          <div className="font-medium text-sm">
                            {attendee.name || attendee.email}
                          </div>
                          {attendee.name && (
                            <div className="text-xs text-muted-foreground">{attendee.email}</div>
                          )}
                        </button>
                      ))}
                    </div>
                    <Button
                      onClick={handleConfirmRecipient}
                      disabled={!selectedAttendeeEmail || updateMutation.isPending}
                      data-testid="button-confirm-recipient"
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Confirm recipient'
                      )}
                    </Button>
                  </DialogContent>
                </Dialog>
                
                {meeting.clientEmail && meeting.consentStatus === 'pending' && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => sendConsentMutation.mutate()}
                    disabled={sendConsentMutation.isPending}
                    data-testid={`button-send-consent-${meeting.id}`}
                  >
                    {sendConsentMutation.isPending ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3 mr-1" />
                    )}
                    Send Consent
                  </Button>
                )}
                
                {meeting.autoRecordEnabled && meeting.meetingUrl && meeting.consentStatus === 'approved' && !meeting.recallBotId && (
                  <Button 
                    size="sm"
                    onClick={() => deployBotMutation.mutate()}
                    disabled={deployBotMutation.isPending}
                    data-testid={`button-deploy-bot-${meeting.id}`}
                  >
                    {deployBotMutation.isPending ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Bot className="w-3 h-3 mr-1" />
                    )}
                    Deploy Bot
                  </Button>
                )}
                
                <div className="flex-1" />
                
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => setShowCancelDialog(true)}
                  data-testid={`button-cancel-meeting-${meeting.id}`}
                >
                  <Ban className="w-3 h-3 mr-1" />
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <CasePickerDialog
        meeting={meeting}
        open={showCaseDialog}
        onOpenChange={setShowCaseDialog}
      />
      <LiveBotModal
        open={showLiveBotModal}
        onOpenChange={setShowLiveBotModal}
        caseId={meeting.caseId}
        caseTitle={linkedCase?.title || meeting.title}
        initialMeetingUrl={safeJoinUrl}
        suggestedClientName={meeting.clientName || linkedCase?.clientName || undefined}
      />
      <CancelMeetingDialog
        meeting={meeting}
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
      />
      <EditMeetingDialog
        meeting={meeting}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />
    </>
  );
}

/** Compact overflow row for “See more” — time | title | platform | actions */
function MeetingCompactRow({ meeting }: { meeting: ScheduledMeeting; onUpdate?: () => void }) {
  const [showCaseDialog, setShowCaseDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const startTime = new Date(meeting.startTime);
  const isActive = meeting.status === "scheduled";
  const inProgress = isMeetingInProgress(meeting);
  const safeJoinUrl = getSafeHttpsMeetingUrl(meeting.meetingUrl);

  return (
    <>
      <div
        className={`flex items-center gap-2 sm:gap-3 py-2.5 px-2 border-b last:border-b-0 min-w-0 ${
          inProgress ? "bg-emerald-500/5" : ""
        }`}
        data-testid={`meeting-compact-${meeting.id}`}
      >
        <div className="w-14 sm:w-16 flex-shrink-0 text-xs text-muted-foreground tabular-nums">
          {format(startTime, "h:mm a")}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{meeting.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            {inProgress
              ? "In progress — join now"
              : isToday(startTime)
                ? "Today"
                : isTomorrow(startTime)
                  ? "Tomorrow"
                  : format(startTime, "EEE, MMM d")}
          </p>
        </div>
        <div className="hidden sm:flex flex-shrink-0 items-center gap-1">
          {inProgress && (
            <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0">
              Live
            </Badge>
          )}
          {getPlatformIcon(resolveMeetingPlatform(meeting))}
        </div>
        {isActive && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {safeJoinUrl && (
              <Button
                size="sm"
                variant={inProgress ? "default" : "ghost"}
                className={`h-8 px-2 ${inProgress ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                onClick={() => window.open(safeJoinUrl, "_blank", "noopener,noreferrer")}
                data-testid={`button-compact-join-${meeting.id}`}
              >
                <Video className="w-3.5 h-3.5" />
                <span className="sr-only sm:not-sr-only sm:ml-1 text-xs">
                  {inProgress ? "Join now" : "Join"}
                </span>
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              onClick={() => setShowCaseDialog(true)}
              data-testid={`button-compact-link-case-${meeting.id}`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span className="sr-only sm:not-sr-only sm:ml-1 text-xs">Case</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              onClick={() => setShowEditDialog(true)}
              data-testid={`button-compact-edit-meeting-${meeting.id}`}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span className="sr-only sm:not-sr-only sm:ml-1 text-xs">Edit</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-destructive"
              onClick={() => setShowCancelDialog(true)}
              data-testid={`button-compact-cancel-${meeting.id}`}
            >
              <Ban className="w-3.5 h-3.5" />
              <span className="sr-only sm:not-sr-only sm:ml-1 text-xs">Cancel</span>
            </Button>
          </div>
        )}
      </div>
      <CasePickerDialog
        meeting={meeting}
        open={showCaseDialog}
        onOpenChange={setShowCaseDialog}
      />
      <CancelMeetingDialog
        meeting={meeting}
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
      />
      <EditMeetingDialog
        meeting={meeting}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />
    </>
  );
}

export function ScheduledMeetingsViewer() {
  const { toast } = useToast();
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<MeetingTimeTab>("today");
  const [hasUserPickedTab, setHasUserPickedTab] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const isDesktop = useIsDesktop();

  const { data: meetings, isLoading, error, refetch } = useQuery<ScheduledMeeting[]>({
    queryKey: ["/api/scheduled-meetings", { daysAhead: 30 }],
    queryFn: async () => {
      const res = await fetch("/api/scheduled-meetings?daysAhead=30", { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to load meetings");
      }
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: connections, isPending: isConnectionsPending } = useQuery<{
    google: { connected: boolean; email?: string };
    outlook?: { connected: boolean; email?: string };
  }>({
    queryKey: ["/api/oauth/connections"],
  });

  const calendarConnected =
    !!connections?.google?.connected || !!connections?.outlook?.connected;

  const tabCounts = useMemo(() => {
    const counts: Record<MeetingTimeTab, number> = {
      today: 0,
      tomorrow: 0,
      next7: 0,
      later: 0,
    };
    for (const m of meetings || []) {
      counts[categorizeMeeting(m)] += 1;
    }
    return counts;
  }, [meetings]);

  useEffect(() => {
    if (!meetings || meetings.length === 0 || hasUserPickedTab) return;
    setActiveTab(pickDefaultMeetingTab(meetings));
  }, [meetings, hasUserPickedTab]);

  useEffect(() => {
    setShowMore(false);
  }, [activeTab]);

  const filteredMeetings = useMemo(
    () => (meetings || []).filter((m) => categorizeMeeting(m) === activeTab),
    [meetings, activeTab],
  );

  const visibleCap = isDesktop ? 4 : 1;
  const visibleMeetings = filteredMeetings.slice(0, visibleCap);
  const overflowMeetings = filteredMeetings.slice(visibleCap);
  const hasOverflow = overflowMeetings.length > 0;

  const syncMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/scheduled-meetings/sync");
    },
    onSuccess: (data: any) => {
      toast({
        title: "Meetings refreshed",
        description: `Found ${data.meetings?.length || 0} upcoming meetings`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-meetings"] });
    },
    onError: (error: any) => {
      if (error.message?.includes("not connected") || error.needsCalendarConnection) {
        queryClient.invalidateQueries({ queryKey: ["/api/oauth/connections"] });
        setShowCalendarModal(true);
      } else {
        toast({
          title: "Refresh failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const handleCalendarAction = () => {
    if (!calendarConnected) {
      setShowCalendarModal(true);
      return;
    }
    syncMutation.mutate();
  };

  const handleScheduleClick = () => {
    if (!calendarConnected) {
      setShowCalendarModal(true);
      return;
    }
    setShowScheduleModal(true);
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTabChange = (tab: MeetingTimeTab) => {
    setHasUserPickedTab(true);
    setActiveTab(tab);
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Upcoming Meetings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Failed to load meetings</p>
            <p className="text-sm mt-2 max-w-md mx-auto">
              {getApiErrorMessage(error, "Check your connection and try again.")}
            </p>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-4">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalCount = meetings?.length ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="w-5 h-5" />
            Upcoming Meetings
            {totalCount > 0 && (
              <span className="text-sm font-normal text-muted-foreground">({totalCount})</span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {isConnectionsPending ? (
              <Button
                size="sm"
                disabled
                aria-busy
                aria-label="Checking calendar connection"
                data-testid="button-calendar-connection-loading"
              >
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Checking…
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleScheduleClick}
                  data-testid="button-schedule-meeting"
                >
                  <CalendarPlus className="w-4 h-4 mr-2" />
                  Schedule
                </Button>
                <Button
                  size="sm"
                  onClick={handleCalendarAction}
                  disabled={syncMutation.isPending}
                  data-testid={
                    calendarConnected ? "button-refresh-calendar-meetings" : "button-sync-calendar"
                  }
                >
                  {syncMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  {calendarConnected ? "Refresh Meetings" : "Sync Calendar"}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !meetings || meetings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No upcoming meetings in the next 30 days</p>
            <p className="text-sm mt-2">
              Schedule a meeting or sync your calendar to see upcoming video calls
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={handleScheduleClick}
              data-testid="button-schedule-meeting-empty"
            >
              <CalendarPlus className="w-4 h-4 mr-2" />
              Schedule meeting
            </Button>
          </div>
        ) : (
          <>
            <div
              className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5 border border-border/50 overflow-x-auto"
              role="tablist"
              aria-label="Filter meetings by time"
            >
              {MEETING_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.value}
                  onClick={() => handleTabChange(tab.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap transition-colors ${
                    activeTab === tab.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                  data-testid={`button-meetings-tab-${tab.value}`}
                >
                  {tab.label}
                  {tabCounts[tab.value] > 0 && (
                    <span className="ml-1 opacity-70">({tabCounts[tab.value]})</span>
                  )}
                </button>
              ))}
            </div>

            {filteredMeetings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Video className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No meetings in this period</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {visibleMeetings.map((meeting) => (
                    <MeetingCard
                      key={meeting.id}
                      meeting={meeting}
                      onUpdate={handleRefresh}
                    />
                  ))}
                </div>

                {hasOverflow && (
                  <div className="space-y-0">
                    <button
                      type="button"
                      onClick={() => setShowMore((v) => !v)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground border border-dashed rounded-md transition-colors"
                      data-testid="button-see-more-meetings"
                    >
                      {showMore ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          See more meetings ({overflowMeetings.length})
                        </>
                      )}
                    </button>
                    {showMore && (
                      <div
                        className="mt-2 rounded-md border bg-muted/20 divide-y-0"
                        data-testid="meetings-overflow-list"
                      >
                        {overflowMeetings.map((meeting) => (
                          <MeetingCompactRow
                            key={meeting.id}
                            meeting={meeting}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </CardContent>

      <ConfigurationErrorModal
        open={showCalendarModal}
        onOpenChange={setShowCalendarModal}
        errorType="calendar_not_connected"
      />

      <ScheduleMeetingModal
        open={showScheduleModal}
        onOpenChange={setShowScheduleModal}
        googleConnected={!!connections?.google?.connected}
        outlookConnected={!!connections?.outlook?.connected}
        onNeedsCalendarConnection={() => setShowCalendarModal(true)}
      />
    </Card>
  );
}
