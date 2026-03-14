import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
  Link as LinkIcon,
  Bot,
  Send,
  Loader2,
  Users,
  Briefcase,
  Ban,
  CalendarClock,
  Search,
  X
} from "lucide-react";
import { format, formatDistanceToNow, isToday, isTomorrow, isPast } from "date-fns";
import { useState } from "react";
import type { ScheduledMeeting, Case } from "@shared/schema";
import ConfigurationErrorModal from "@/components/ConfigurationErrorModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

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

function getPlatformIcon(platform: string | null) {
  switch (platform) {
    case 'zoom':
      return <Badge variant="outline" className="text-xs">Zoom</Badge>;
    case 'teams':
      return <Badge variant="outline" className="text-xs">Teams</Badge>;
    case 'meet':
      return <Badge variant="outline" className="text-xs">Meet</Badge>;
    case 'webex':
      return <Badge variant="outline" className="text-xs">Webex</Badge>;
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

function RescheduleMeetingDialog({
  meeting,
  open,
  onOpenChange,
}: {
  meeting: ScheduledMeeting;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  
  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      const newStartTime = new Date(`${newDate}T${newTime}`);
      const endTimeDiff = meeting.endTime 
        ? new Date(meeting.endTime).getTime() - new Date(meeting.startTime).getTime() 
        : 60 * 60 * 1000;
      const newEndTime = new Date(newStartTime.getTime() + endTimeDiff);
      return apiRequest('POST', `/api/scheduled-meetings/${meeting.id}/reschedule`, {
        newStartTime: newStartTime.toISOString(),
        newEndTime: newEndTime.toISOString(),
      });
    },
    onSuccess: () => {
      toast({ title: "Meeting rescheduled", description: "A new meeting has been created with the updated time." });
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-meetings'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to reschedule", description: error.message, variant: "destructive" });
    },
  });
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-reschedule-meeting">
        <DialogHeader>
          <DialogTitle>Reschedule Meeting</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Reschedule <span className="font-medium text-foreground">{meeting.title}</span>
          </p>
          <div>
            <Label>New Date</Label>
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
              data-testid="input-reschedule-date"
            />
          </div>
          <div>
            <Label>New Time</Label>
            <Input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              data-testid="input-reschedule-time"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-reschedule-dismiss">
            Cancel
          </Button>
          <Button
            onClick={() => rescheduleMutation.mutate()}
            disabled={rescheduleMutation.isPending || !newDate || !newTime}
            data-testid="button-confirm-reschedule"
          >
            {rescheduleMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CalendarClock className="w-4 h-4 mr-1" />}
            Reschedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MeetingCard({ meeting, onUpdate }: { meeting: ScheduledMeeting; onUpdate: () => void }) {
  const { toast } = useToast();
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState('');
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [clientEmail, setClientEmail] = useState(meeting.clientEmail || '');
  const [clientName, setClientName] = useState(meeting.clientName || '');
  const [showCaseDialog, setShowCaseDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  
  const startTime = new Date(meeting.startTime);
  const isMeetingSoon = !isPast(startTime) && startTime.getTime() - Date.now() < 30 * 60 * 1000;
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
  
  const setUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      return apiRequest('POST', `/api/scheduled-meetings/${meeting.id}/set-url`, { meetingUrl: url });
    },
    onSuccess: () => {
      toast({ title: "Meeting URL saved" });
      setShowUrlDialog(false);
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-meetings'] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to save URL", description: error.message, variant: "destructive" });
    },
  });
  
  const handleToggleAutoRecord = (enabled: boolean) => {
    updateMutation.mutate({ autoRecordEnabled: enabled });
  };
  
  const handleSaveClient = () => {
    updateMutation.mutate({ clientEmail, clientName });
    setShowClientDialog(false);
  };

  const { data: linkedCase } = useQuery<Case>({
    queryKey: ['/api/cases', meeting.caseId],
    queryFn: () => fetch(`/api/cases/${meeting.caseId}`).then(r => r.ok ? r.json() : null),
    enabled: !!meeting.caseId,
  });
  
  return (
    <>
      <Card className={`${isMeetingSoon && isActive ? 'border-primary' : ''} ${!isActive ? 'opacity-75' : ''}`} data-testid={`meeting-card-${meeting.id}`}>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate" data-testid={`meeting-title-${meeting.id}`}>{meeting.title}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Calendar className="w-4 h-4 flex-shrink-0" />
                  <span>
                    {isToday(startTime) ? 'Today' : isTomorrow(startTime) ? 'Tomorrow' : format(startTime, 'EEE, MMM d')}
                    {' at '}
                    {format(startTime, 'h:mm a')}
                  </span>
                  {!isPast(startTime) && isActive && (
                    <span className="text-xs">({formatDistanceToNow(startTime, { addSuffix: true })})</span>
                  )}
                </div>
              </div>
              
              {isActive && (
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
              {getMeetingStatusBadge(meeting.status)}
              {isActive && getConsentStatusBadge(meeting.consentStatus)}
              {getBotStatusBadge(meeting.botStatus)}
              {getPlatformIcon(meeting.meetingPlatform)}
              
              {isActive && !meeting.meetingUrl && (
                <Badge variant="outline" className="text-orange-600 border-orange-300">
                  <AlertCircle className="w-3 h-3 mr-1" /> No URL
                </Badge>
              )}
              
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
                <span>{meeting.clientName || meeting.clientEmail}</span>
              </div>
            )}
            
            {meeting.cancellationReason && meeting.status === 'cancelled' && (
              <p className="text-xs text-muted-foreground italic">Reason: {meeting.cancellationReason}</p>
            )}
            
            {isActive && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCaseDialog(true)}
                  data-testid={`button-link-case-${meeting.id}`}
                >
                  <Briefcase className="w-3 h-3 mr-1" />
                  {meeting.caseId ? 'Change Case' : 'Link Case'}
                </Button>
                
                {!meeting.meetingUrl && (
                  <Dialog open={showUrlDialog} onOpenChange={setShowUrlDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" data-testid={`button-set-url-${meeting.id}`}>
                        <LinkIcon className="w-3 h-3 mr-1" /> Set URL
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Set Meeting URL</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div>
                          <Label>Meeting URL</Label>
                          <Input
                            placeholder="https://zoom.us/j/..."
                            value={meetingUrl}
                            onChange={(e) => setMeetingUrl(e.target.value)}
                            data-testid="input-meeting-url"
                          />
                        </div>
                        <Button 
                          onClick={() => setUrlMutation.mutate(meetingUrl)}
                          disabled={!meetingUrl || setUrlMutation.isPending}
                          data-testid="button-save-url"
                        >
                          {setUrlMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save URL'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                
                {!meeting.clientEmail && (
                  <Dialog open={showClientDialog} onOpenChange={setShowClientDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" data-testid={`button-set-client-${meeting.id}`}>
                        <Users className="w-3 h-3 mr-1" /> Set Client
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Set Client Details</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div>
                          <Label>Client Name</Label>
                          <Input
                            placeholder="John Smith"
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            data-testid="input-client-name"
                          />
                        </div>
                        <div>
                          <Label>Client Email</Label>
                          <Input
                            type="email"
                            placeholder="client@example.com"
                            value={clientEmail}
                            onChange={(e) => setClientEmail(e.target.value)}
                            data-testid="input-client-email"
                          />
                        </div>
                        <Button 
                          onClick={handleSaveClient}
                          disabled={!clientEmail || updateMutation.isPending}
                          data-testid="button-save-client"
                        >
                          Save
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                
                {meeting.autoRecordEnabled && meeting.clientEmail && meeting.consentStatus === 'pending' && (
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
                  onClick={() => setShowRescheduleDialog(true)}
                  data-testid={`button-reschedule-${meeting.id}`}
                >
                  <CalendarClock className="w-3 h-3 mr-1" />
                  Reschedule
                </Button>
                
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
      <CancelMeetingDialog
        meeting={meeting}
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
      />
      <RescheduleMeetingDialog
        meeting={meeting}
        open={showRescheduleDialog}
        onOpenChange={setShowRescheduleDialog}
      />
    </>
  );
}

export function ScheduledMeetingsViewer() {
  const { toast } = useToast();
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  
  const { data: meetings, isLoading, error, refetch } = useQuery<ScheduledMeeting[]>({
    queryKey: ['/api/scheduled-meetings'],
    refetchInterval: 30000,
  });
  
  const syncMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/scheduled-meetings/sync');
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Calendar synced", 
        description: `Found ${data.meetings?.length || 0} upcoming meetings` 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-meetings'] });
    },
    onError: (error: any) => {
      if (error.message?.includes('not connected') || error.needsCalendarConnection) {
        setShowCalendarModal(true);
      } else {
        toast({ 
          title: "Sync failed", 
          description: error.message,
          variant: "destructive"
        });
      }
    },
  });
  
  const handleRefresh = () => {
    refetch();
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
            <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-4">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="w-5 h-5" />
            Upcoming Meetings
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isLoading}
              data-testid="button-refresh-meetings"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button 
              size="sm" 
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              data-testid="button-sync-calendar"
            >
              {syncMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sync Calendar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !meetings || meetings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No upcoming meetings in the next 7 days</p>
            <p className="text-sm mt-2">Sync your calendar to see scheduled video calls</p>
          </div>
        ) : (
          <div className="space-y-3">
            {meetings.map((meeting) => (
              <MeetingCard 
                key={meeting.id} 
                meeting={meeting} 
                onUpdate={handleRefresh}
              />
            ))}
          </div>
        )}
      </CardContent>
      
      <ConfigurationErrorModal
        open={showCalendarModal}
        onOpenChange={setShowCalendarModal}
        errorType="calendar_not_connected"
      />
    </Card>
  );
}
