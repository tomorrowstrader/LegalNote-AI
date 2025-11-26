import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Loader2, 
  Video, 
  Clock, 
  Calendar, 
  Users, 
  Shield, 
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";

interface Meeting {
  id: string;
  title: string;
  platform: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  participantCount: number;
  recordingAvailable: boolean;
  importedAt?: string;
}

interface ImportRecordingModalProps {
  caseId: string;
  caseTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportRecordingModal({ 
  caseId, 
  caseTitle, 
  open, 
  onOpenChange 
}: ImportRecordingModalProps) {
  const { toast } = useToast();
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [step, setStep] = useState<'select' | 'confirm' | 'importing'>('select');

  const { data: recallStatus } = useQuery<{
    configured: boolean;
    connected: boolean;
  }>({
    queryKey: ['/api/recall/status'],
    enabled: open,
  });

  const { data: meetings, isLoading: loadingMeetings, refetch: refetchMeetings } = useQuery<Meeting[]>({
    queryKey: ['/api/recall/meetings'],
    enabled: open && recallStatus?.connected === true,
  });

  const importMutation = useMutation({
    mutationFn: async (params: { botId: string }) => {
      // Step 1: Create the import (consent not yet confirmed)
      const importRes = await apiRequest('/api/recall/import', {
        method: 'POST',
        body: JSON.stringify({
          botId: params.botId,
          caseId,
        }),
      });
      
      // Step 2: Confirm consent via attestation (creates audit trail)
      await apiRequest(`/api/recall/import/${importRes.id}/consent`, {
        method: 'PATCH',
        body: JSON.stringify({
          userConfirmsVerbalConsent: true,
        }),
      });
      
      // Step 3: Start processing
      await apiRequest(`/api/recall/import/${importRes.id}/process`, {
        method: 'POST',
      });
      
      return importRes;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/recall/meetings`] });
      
      toast({
        title: "Import Started",
        description: "Your meeting recording is being processed. This may take a few minutes.",
        duration: 5000,
      });
      
      onOpenChange(false);
      resetState();
    },
    onError: (error: Error) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import recording",
        variant: "destructive",
      });
      setStep('select');
    },
  });

  const resetState = () => {
    setSelectedMeeting(null);
    setConsentConfirmed(false);
    setStep('select');
  };

  const handleSelectMeeting = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setStep('confirm');
  };

  const handleConfirmImport = () => {
    if (!selectedMeeting || !consentConfirmed) return;
    
    setStep('importing');
    importMutation.mutate({
      botId: selectedMeeting.id,
    });
  };

  const handleBack = () => {
    if (step === 'confirm') {
      setSelectedMeeting(null);
      setConsentConfirmed(false);
      setStep('select');
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'zoom': return 'bg-blue-500';
      case 'teams': 
      case 'microsoft_teams': return 'bg-purple-500';
      case 'google_meet':
      case 'meet': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getPlatformName = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'zoom': return 'Zoom';
      case 'teams':
      case 'microsoft_teams': return 'Teams';
      case 'google_meet':
      case 'meet': return 'Meet';
      default: return platform;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetState();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Import Meeting Recording
          </DialogTitle>
          <DialogDescription>
            Import a video meeting recording to automatically generate attendance notes for "{caseTitle}"
          </DialogDescription>
        </DialogHeader>

        {!recallStatus?.configured ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Video conferencing integration is not configured. Please contact your administrator.
            </AlertDescription>
          </Alert>
        ) : !recallStatus?.connected ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Video conferencing is not connected. Go to Settings → Integrations to connect your account.
            </AlertDescription>
          </Alert>
        ) : step === 'select' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Select a meeting recording to import:
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchMeetings()}
                disabled={loadingMeetings}
                data-testid="button-refresh-meetings"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loadingMeetings ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            <ScrollArea className="h-[300px] pr-4">
              {loadingMeetings ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : !meetings || meetings.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No meetings available</p>
                  <p className="text-sm mt-1">
                    Complete a video meeting with recording enabled to see it here
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {meetings.map((meeting) => (
                    <div
                      key={meeting.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors hover-elevate ${
                        meeting.importedAt ? 'opacity-60' : ''
                      }`}
                      onClick={() => !meeting.importedAt && handleSelectMeeting(meeting)}
                      data-testid={`meeting-item-${meeting.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${getPlatformColor(meeting.platform)}`} />
                            <Badge variant="secondary" className="text-xs">
                              {getPlatformName(meeting.platform)}
                            </Badge>
                            {meeting.importedAt && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Imported
                              </Badge>
                            )}
                          </div>
                          <p className="font-medium truncate">{meeting.title || 'Untitled Meeting'}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(meeting.startTime), 'dd MMM yyyy, HH:mm')}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDuration(meeting.durationSeconds)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {meeting.participantCount} participant{meeting.participantCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        {!meeting.importedAt && (
                          <Button variant="outline" size="sm" data-testid={`button-select-${meeting.id}`}>
                            Select
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        ) : step === 'confirm' ? (
          <div className="space-y-6">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>GDPR Compliance Required:</strong> You must confirm that recording consent was obtained from all meeting participants before importing.
              </AlertDescription>
            </Alert>

            {selectedMeeting && (
              <div className="p-4 border rounded-lg bg-muted/30">
                <p className="font-medium">{selectedMeeting.title || 'Untitled Meeting'}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <Badge variant="secondary">{getPlatformName(selectedMeeting.platform)}</Badge>
                  <span>{format(new Date(selectedMeeting.startTime), 'dd MMM yyyy, HH:mm')}</span>
                  <span>{formatDuration(selectedMeeting.durationSeconds)}</span>
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-4">
              <p className="text-sm font-medium">Consent Verification</p>
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="consent"
                  checked={consentConfirmed}
                  onCheckedChange={(checked) => setConsentConfirmed(checked === true)}
                  data-testid="checkbox-consent"
                />
                <Label 
                  htmlFor="consent" 
                  className="text-sm leading-relaxed cursor-pointer"
                >
                  I confirm that all participants were informed about and consented to the recording of this meeting. I understand that importing recordings without proper consent may violate GDPR and professional regulations.
                </Label>
              </div>
            </div>

            <div className="p-3 bg-muted rounded-md text-xs text-muted-foreground">
              <p><strong>What happens next:</strong></p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>The audio will be downloaded from your video conferencing platform</li>
                <li>LegalNote AI will transcribe the recording with speaker identification</li>
                <li>Attendance notes and other documents will be generated automatically</li>
                <li>The recording will be stored securely and deleted within 7 days</li>
              </ul>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleBack} data-testid="button-back">
                Back
              </Button>
              <Button 
                onClick={handleConfirmImport} 
                disabled={!consentConfirmed}
                data-testid="button-confirm-import"
              >
                Import Recording
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="py-12 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="font-medium">Importing recording...</p>
            <p className="text-sm text-muted-foreground mt-1">
              This may take a moment
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ImportRecordingModal;
