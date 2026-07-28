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
  Radio,
  Pencil,
  FileText,
  ExternalLink,
  FolderOpen,
} from "lucide-react";
import { format, formatDistanceToNow, isToday, isTomorrow, isPast, addDays, startOfDay } from "date-fns";
import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { isFeatureVisible } from "@/lib/features";
import { getSafeHttpsMeetingUrl } from "@/lib/meetingUrl";
import { toTitleCase } from "@/lib/utils";
import { LiveBotModal } from "@/components/LiveBotModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CASE_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  processing: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  review_required: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  completed: "bg-green-500/10 text-green-500 border-green-500/20",
  failed: "bg-red-500/10 text-red-500 border-red-500/20",
};

const caseStatusIconColor = (status: string) => {
  switch (status) {
    case "pending":
      return "text-amber-500";
    case "processing":
      return "text-blue-500";
    case "review_required":
      return "text-purple-500";
    case "completed":
      return "text-emerald-500";
    case "failed":
      return "text-red-500";
    default:
      return "text-muted-foreground";
  }
};

/** Keep meetings visible this long after start for late logins (must match server). */
const LATE_JOIN_GRACE_MS = 15 * 60 * 1000;
/** Show Join now from this long before scheduled start. */
const EARLY_JOIN_MS = 5 * 60 * 1000;

type MeetingTimeTab = "today" | "tomorrow" | "next7" | "later";

const MEETING_TABS: { value: MeetingTimeTab; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "next7", label: "Next 7 days" },
  { value: "later", label: "Later" },
];

/** After scheduled start, within the late-join grace window. */
function isMeetingInProgress(meeting: ScheduledMeeting, now = Date.now()): boolean {
  if (meeting.status !== "scheduled") return false;
  const start = new Date(meeting.startTime).getTime();
  return start <= now && now < start + LATE_JOIN_GRACE_MS;
}

/** Join now cue: from 5 minutes before start through the 15-minute post-start grace. */
function isInJoinNowWindow(meeting: ScheduledMeeting, now = Date.now()): boolean {
  if (meeting.status !== "scheduled") return false;
  const start = new Date(meeting.startTime).getTime();
  return start - EARLY_JOIN_MS <= now && now < start + LATE_JOIN_GRACE_MS;
}

function useNowTick(intervalMs = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
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
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: cases = [], isLoading } = useQuery<Case[]>({
    queryKey: ['/api/cases'],
    enabled: open,
  });

  useEffect(() => {
    if (!open) setSearchQuery('');
  }, [open]);
  
  const filteredCases = cases
    .filter((c) => !c.archived)
    .filter((c) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        (c.clientName && c.clientName.toLowerCase().includes(q)) ||
        (c.matterReference && c.matterReference.toLowerCase().includes(q))
      );
    })
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime()
    );

  const hasScrollableList = filteredCases.length > 5;
  
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
      <DialogContent
        className="max-w-96 gap-0 overflow-hidden rounded-xl border border-[#e6ddd0] bg-white p-0 shadow-2xl dark:border-border dark:bg-popover"
        data-testid="dialog-case-picker"
      >
        <DialogHeader className="space-y-0 border-b border-[#e8dfd2] bg-white px-4 py-3 pr-12 text-left dark:border-border dark:bg-popover">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm font-semibold leading-none tracking-normal">
                  Link to Case
                </DialogTitle>
                {filteredCases.length > 0 && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    {filteredCases.length}
                  </Badge>
                )}
              </div>
              {hasScrollableList && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Showing latest cases. Scroll for more.
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 shrink-0 text-xs px-2 gap-1"
              onClick={() => {
                setLocation("/cases");
                onOpenChange(false);
              }}
              data-testid="case-picker-view-all"
            >
              <FolderOpen className="w-3 h-3" />
              View all
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-2 border-b border-[#e8dfd2] px-3 py-3 dark:border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search cases..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 border-[#e8dfd2] bg-white pl-9 shadow-none focus-visible:ring-[#dec27b]/40 dark:border-border"
              data-testid="input-case-search"
            />
          </div>
          {meeting.caseId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start text-xs text-muted-foreground hover:text-foreground"
              onClick={() => linkCaseMutation.mutate(null)}
              disabled={linkCaseMutation.isPending}
              data-testid="button-unlink-case"
            >
              <X className="w-3 h-3 mr-1" />
              Unlink Current Case
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[31rem] [&_[data-radix-scroll-area-scrollbar]]:opacity-100">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <Briefcase className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No cases found</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {searchQuery ? "Try a different search" : "Your cases will appear here"}
              </p>
            </div>
          ) : (
            <div className="space-y-2 p-3">
              {filteredCases.map((caseItem) => {
                const isLinked = meeting.caseId === caseItem.id;
                const iconColor = caseStatusIconColor(caseItem.status);

                return (
                  <button
                    key={caseItem.id}
                    type="button"
                    onClick={() => linkCaseMutation.mutate(caseItem.id)}
                    disabled={linkCaseMutation.isPending}
                    className={`flex w-full min-h-20 items-start gap-3 rounded-lg border px-3 py-3 text-left shadow-sm transition-colors dark:hover:bg-accent/20 ${
                      isLinked
                        ? "border-[#dec27b] bg-white hover:bg-[#fff8e7] dark:border-amber-500/30 dark:bg-card dark:hover:bg-amber-500/10"
                        : "border-[#e8dfd2] bg-white hover:bg-[#fbf7ef] dark:border-border dark:bg-card"
                    }`}
                    data-testid={`button-select-case-${caseItem.id}`}
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f4ede2] dark:bg-muted ${iconColor}`}
                    >
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground leading-tight flex-1 min-w-0 truncate">
                          {caseItem.title}
                        </p>
                        {isLinked && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                            Linked
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed truncate">
                        {caseItem.clientName || "Unknown Client"}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground/70">
                          {format(
                            new Date(caseItem.updatedAt || caseItem.createdAt),
                            "dd MMM yyyy"
                          )}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <ExternalLink className="w-2.5 h-2.5" />
                          Link case
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ml-auto ${CASE_STATUS_COLORS[caseItem.status] || ""}`}
                        >
                          {toTitleCase(caseItem.status)}
                        </Badge>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
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
  const now = useNowTick();
  const [showCaseDialog, setShowCaseDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showLiveBotModal, setShowLiveBotModal] = useState(false);
  const [allocateLater, setAllocateLater] = useState(false);

  const openLiveBot = (deferMatter: boolean) => {
    setAllocateLater(deferMatter);
    setShowLiveBotModal(true);
  };

  const safeJoinUrl = getSafeHttpsMeetingUrl(meeting.meetingUrl);
  
  const startTime = new Date(meeting.startTime);
  const inProgress = isMeetingInProgress(meeting, now);
  const joinNow = isInJoinNowWindow(meeting, now);
  const isMeetingSoon =
    !joinNow && !isPast(startTime) && startTime.getTime() - now < 30 * 60 * 1000;
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

  const { data: linkedCase } = useQuery<Case>({
    queryKey: ['/api/cases', meeting.caseId],
    queryFn: () => fetch(`/api/cases/${meeting.caseId}`).then(r => r.ok ? r.json() : null),
    enabled: !!meeting.caseId,
  });
  
  return (
    <>
      <Card
        className={`${
          joinNow && isActive
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
                  {joinNow && isActive ? (
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
              {joinNow && isActive && (
                <Badge
                  className="bg-emerald-600 hover:bg-emerald-600 text-white"
                  data-testid={`badge-in-progress-${meeting.id}`}
                >
                  <Radio className="w-3 h-3 mr-1 animate-pulse" />
                  {inProgress ? "In progress — join now" : "Starting soon — join now"}
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
                {(safeJoinUrl || joinNow) ? (
                  meeting.recallBotId && safeJoinUrl ? (
                    <Button
                      size="sm"
                      className={joinNow ? "bg-emerald-600 hover:bg-emerald-700 text-white" : undefined}
                      onClick={() => window.open(safeJoinUrl, '_blank', 'noopener,noreferrer')}
                      data-testid={`button-join-with-legalnote-${meeting.id}`}
                    >
                      <Video className="w-3 h-3 mr-1" />
                      {joinNow ? "Join now" : "Join meeting"}
                    </Button>
                  ) : (
                    <div className="flex items-stretch">
                      <Button
                        size="sm"
                        className={`rounded-r-none ${joinNow ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                        onClick={() => openLiveBot(false)}
                        data-testid={`button-join-with-legalnote-${meeting.id}`}
                      >
                        <Video className="w-3 h-3 mr-1" />
                        {joinNow ? "Join now with LegalNote" : "Join with LegalNote"}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            className={`rounded-l-none border-l px-2 ${
                              joinNow
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500"
                                : ""
                            }`}
                            aria-label="More join options"
                            data-testid={`button-join-options-${meeting.id}`}
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem
                            onClick={() => openLiveBot(true)}
                            data-testid={`menu-join-allocate-later-${meeting.id}`}
                          >
                            Join &amp; allocate to matter later
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )
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
        onOpenChange={(next) => {
          setShowLiveBotModal(next);
          if (!next) setAllocateLater(false);
        }}
        caseId={allocateLater ? null : meeting.caseId}
        caseTitle={allocateLater ? undefined : (linkedCase?.title || meeting.title)}
        initialMeetingUrl={safeJoinUrl}
        suggestedClientName={meeting.clientName || linkedCase?.clientName || undefined}
        allocateLater={allocateLater}
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
  const now = useNowTick();
  const startTime = new Date(meeting.startTime);
  const isActive = meeting.status === "scheduled";
  const inProgress = isMeetingInProgress(meeting, now);
  const joinNow = isInJoinNowWindow(meeting, now);
  const safeJoinUrl = getSafeHttpsMeetingUrl(meeting.meetingUrl);

  return (
    <>
      <div
        className={`flex items-center gap-2 sm:gap-3 py-2.5 px-2 border-b last:border-b-0 min-w-0 ${
          joinNow ? "bg-emerald-500/5" : ""
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
              : joinNow
                ? "Starting soon — join now"
                : isToday(startTime)
                  ? "Today"
                  : isTomorrow(startTime)
                    ? "Tomorrow"
                    : format(startTime, "EEE, MMM d")}
          </p>
        </div>
        <div className="hidden sm:flex flex-shrink-0 items-center gap-1">
          {joinNow && (
            <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0">
              {inProgress ? "Live" : "Soon"}
            </Badge>
          )}
          {getPlatformIcon(resolveMeetingPlatform(meeting))}
        </div>
        {isActive && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {safeJoinUrl && (
              <Button
                size="sm"
                variant={joinNow ? "default" : "ghost"}
                className={`h-8 px-2 ${joinNow ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                onClick={() => window.open(safeJoinUrl, "_blank", "noopener,noreferrer")}
                data-testid={`button-compact-join-${meeting.id}`}
              >
                <Video className="w-3.5 h-3.5" />
                <span className="sr-only sm:not-sr-only sm:ml-1 text-xs">
                  {joinNow ? "Join now" : "Join"}
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
                  onClick={handleScheduleClick}
                  data-testid="button-schedule-meeting"
                >
                  <Video className="w-4 h-4 mr-2" />
                  New meeting
                </Button>
                <Button
                  size="sm"
                  variant="outline"
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
              Create one here or sync your calendar to see upcoming video calls
            </p>
            <Button
              size="sm"
              className="mt-4"
              onClick={handleScheduleClick}
              data-testid="button-schedule-meeting-empty"
            >
              <Video className="w-4 h-4 mr-2" />
              New meeting
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
