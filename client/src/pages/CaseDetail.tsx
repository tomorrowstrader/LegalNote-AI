import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Calendar, User, Shield, Loader2, RefreshCw, Sparkles, FileText, Bot, MessageSquarePlus, Plus, MoreVertical, AlertCircle, Share2, Eye, Download, Archive, Video, ChevronDown, ListChecks, ClipboardList, History, ScrollText, Focus, X, Phone, Lock, ArrowRightLeft, Clock, Send } from "lucide-react";
import { useFocusMode } from "@/contexts/FocusModeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DocumentViewer from "@/components/DocumentViewer";
import { AudioPlayer, type AudioPlayerHandle } from "@/components/AudioPlayer";
import { AuditTrail } from "@/components/AuditTrail";
import { ConsentEvidence } from "@/components/ConsentEvidence";
import CaseTimeline from "@/components/CaseTimeline";
import AddQuickNoteModal from "@/components/AddQuickNoteModal";
import SetPriorityDeadlineModal from "@/components/SetPriorityDeadlineModal";
import ShareLinkModal from "@/components/ShareLinkModal";
import DownloadModal from "@/components/DownloadModal";
import ImportRecordingModal from "@/components/ImportRecordingModal";
import LogCallModal from "@/components/LogCallModal";
import ComplianceThread from "@/components/ComplianceThread";
import AmlTriggerBanner from "@/components/AmlTriggerBanner";
import SharedHistoryViewer from "@/components/SharedHistoryViewer";
import ActionItemsViewer from "@/components/ActionItemsViewer";
import PreMeetingBriefing from "@/components/PreMeetingBriefing";
import HandoverModal from "@/components/HandoverModal";
import ExternalDocumentRefs from "@/components/ExternalDocumentRefs";
import TimeEntriesViewer from "@/components/TimeEntriesViewer";
import TimeRecordingModal from "@/components/TimeRecordingModal";
import ClientCareLetterModal from "@/components/ClientCareLetterModal";
import UndertakingsViewer from "@/components/UndertakingsViewer";
import { useLocation, useParams, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCaseActions } from "@/hooks/useCaseActions";
import { useCaseExport } from "@/hooks/useCaseExport";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import type { Case, AudioRecording, ConsentLog, MeetingSession, Transcript, Document } from "@shared/schema";
import { RECORDING_TYPE_LABELS, type RecordingType } from "@shared/schema";
import { PRACTICE_AREA_LABELS, PRACTICE_AREAS, type PracticeArea } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SessionWithDetails extends MeetingSession {
  transcript: Transcript | null;
  documents: Document[];
}

function SessionDetails({ sessionId }: { sessionId: string }) {
  const { data, isLoading } = useQuery<SessionWithDetails>({
    queryKey: ['/api/sessions', sessionId],
  });

  if (isLoading) {
    return (
      <div className="py-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading session details...
      </div>
    );
  }

  if (!data) return null;

  const hasTranscript = data.transcript && data.transcript.content;
  const activeDocuments = data.documents.filter(d => d.isActive);
  const previousVersions = data.documents.filter(d => !d.isActive);

  return (
    <div className="py-3 space-y-3" data-testid={`session-details-${sessionId}`}>
      {hasTranscript ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <ScrollText className="w-3.5 h-3.5" />
            Transcript
          </p>
          <div className="text-sm bg-muted/30 rounded-md p-3 max-h-40 overflow-y-auto">
            <p className="whitespace-pre-wrap line-clamp-6">{data.transcript!.content.slice(0, 500)}{data.transcript!.content.length > 500 ? "..." : ""}</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <ScrollText className="w-3.5 h-3.5" />
          No transcript linked to this session
        </p>
      )}
      {activeDocuments.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Documents ({activeDocuments.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {activeDocuments.map(doc => (
              <Badge key={doc.id} variant="outline" className="text-xs" data-testid={`session-doc-${doc.id}`}>
                {doc.type === "summary" ? "Summary" : "Attendance Note"}
                {doc.version > 1 && ` v${doc.version}`}
              </Badge>
            ))}
          </div>
          {previousVersions.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1" data-testid={`session-version-history-${sessionId}`}>
              {previousVersions.length} previous version{previousVersions.length !== 1 ? "s" : ""} available
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          No documents linked to this session
        </p>
      )}
    </div>
  );
}

export default function CaseDetail() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const search = useSearch();
  const caseId = params.id;
  const { toast } = useToast();
  const { isFocusMode, toggleFocusMode, exitFocusMode } = useFocusMode();
  const [autoOpenComplianceNote, setAutoOpenComplianceNote] = useState(0);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showLogCallModal, setShowLogCallModal] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showTimeRecordingModal, setShowTimeRecordingModal] = useState(false);
  const [hasPromptedTimeRecording, setHasPromptedTimeRecording] = useState(false);
  const [showCareLetterModal, setShowCareLetterModal] = useState(false);
  const [showSendCareLetterDialog, setShowSendCareLetterDialog] = useState(false);
  const [sendEmail, setSendEmail] = useState("");
  const [isSendingCareLetter, setIsSendingCareLetter] = useState(false);
  const [editingPracticeArea, setEditingPracticeArea] = useState(false);
  const { user } = useAuth();
  const audioPlayerRef = useRef<AudioPlayerHandle>(null);
  const [hasAutoSeeked, setHasAutoSeeked] = useState(false);
  
  // Parse URL search parameters for deep linking from search results
  const searchParams = new URLSearchParams(search);
  const urlTab = searchParams.get('tab') as 'attendance' | 'summary' | 'transcript' | 'compliance' | null;
  const urlTimestamp = searchParams.get('timestamp');

  const handleTranscriptTimestampClick = (timeMs: number) => {
    audioPlayerRef.current?.seekTo(timeMs);
  };
  
  // Auto-seek to timestamp when coming from search results
  useEffect(() => {
    if (urlTimestamp && !hasAutoSeeked && audioPlayerRef.current) {
      const timestampMs = parseInt(urlTimestamp, 10);
      if (!isNaN(timestampMs)) {
        // Small delay to ensure audio player is ready
        setTimeout(() => {
          audioPlayerRef.current?.seekTo(timestampMs);
          setHasAutoSeeked(true);
        }, 500);
      }
    }
  }, [urlTimestamp, hasAutoSeeked]);

  const { data: caseData, isLoading, error } = useQuery<Case>({
    queryKey: [`/api/cases/${caseId}`],
    enabled: !!caseId,
  });
  
  const { data: audioData, isLoading: audioLoading } = useQuery<AudioRecording>({
    queryKey: [`/api/audio/by-case/${caseId}`],
    enabled: !!caseId && (caseData?.sourceType === 'audio' || caseData?.sourceType === 'dictation'),
  });

  const { data: consentLogs = [], isLoading: consentLoading } = useQuery<ConsentLog[]>({
    queryKey: [`/api/consent/by-case/${caseId}`],
    enabled: !!caseId && caseData?.sourceType === 'audio',
  });

  const { data: allCases } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    enabled: !!caseId,
  });
  const linkedDictations = (allCases || []).filter(c => c.parentCaseId === caseId && c.sourceType === 'dictation');

  interface SpeakerUtterance {
    speaker: string;
    text: string;
    start: number;
    end: number;
    confidence: number;
  }
  
  interface Redaction {
    start: number;
    end: number;
    reason: string;
    redactedBy: string;
    timestamp: string;
  }
  
  const { data: transcript } = useQuery<{ 
    id: string; 
    caseId: string; 
    content: string; 
    utterances?: SpeakerUtterance[];
    speakerCount?: number;
    redactions?: Redaction[];
    createdAt: string;
  }>({
    queryKey: [`/api/cases/${caseId}/transcript`],
    enabled: !!caseId && (caseData?.status === 'review_required' || caseData?.status === 'completed'),
  });

  const { data: documents = [] } = useQuery<Array<{
    id: string;
    caseId: string;
    type: 'attendance_note' | 'summary';
    content: string;
    version: number;
    createdAt: string;
  }>>({
    queryKey: [`/api/cases/${caseId}/documents`],
    enabled: !!caseId && (caseData?.status === 'review_required' || caseData?.status === 'completed'),
  });

  // Poll processing status when case is being processed
  const { data: processingStatus } = useQuery<{
    status: string;
    processingMetadata: {
      status: string;
      progress: number;
      currentStep: string;
      totalCost: number;
      totalTokens: number;
      error?: string;
      completedAt?: string;
    };
  }>({
    queryKey: [`/api/cases/${caseId}/processing-status`],
    enabled: !!caseId && caseData?.status === 'processing',
    refetchInterval: 5000, // Poll every 5 seconds
  });

  const { data: meetingSessions = [] } = useQuery<MeetingSession[]>({
    queryKey: [`/api/cases/${caseId}/sessions`],
    enabled: !!caseId,
  });

  useEffect(() => {
    const terminalStatuses = ['review_required', 'completed', 'pending', 'failed'];
    if (processingStatus?.status && terminalStatuses.includes(processingStatus.status) && caseData?.status === 'processing') {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });
    }
  }, [processingStatus?.status, caseData?.status, caseId]);

  // Prompt time recording after processing completes
  useEffect(() => {
    if (
      !hasPromptedTimeRecording &&
      caseData?.status === 'review_required' &&
      (caseData?.sourceType === 'audio' || caseData?.sourceType === 'dictation')
    ) {
      const timer = setTimeout(() => {
        setShowTimeRecordingModal(true);
        setHasPromptedTimeRecording(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [caseData?.status, caseData?.sourceType, hasPromptedTimeRecording]);

  // Check if there's a valid consent log (consentGiven === true)
  const hasValidConsent = consentLogs.some(log => log.consentGiven === true);
  
  const processAIMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/cases/${caseId}/process`, {});
    },
    onSuccess: () => {
      toast({
        title: "Processing complete",
        description: "Documents have been produced successfully",
        duration: 6000,
      });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/cases/${caseId}`] 
      });
    },
    onError: (error: any) => {
      toast({
        title: "Processing failed",
        description: error.message || "Failed to process case. Please try again.",
        variant: "destructive",
        duration: 6000,
      });
    },
  });

  const retryProcessingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/cases/${caseId}/retry-processing`, {});
    },
    onSuccess: () => {
      toast({
        title: "Retry started",
        description: "AI processing has been queued again",
        duration: 6000,
      });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/cases/${caseId}`] 
      });
    },
    onError: (error: any) => {
      toast({
        title: "Retry failed",
        description: error.message || "Failed to retry processing. Please try again.",
        variant: "destructive",
        duration: 6000,
      });
    },
  });

  // Shared hooks for case actions and export
  const { markReviewedMutation, archiveMutation } = useCaseActions({ 
    caseId: caseId!, 
    onArchiveSuccess: () => setLocation('/') 
  });
  const { handleDownload } = useCaseExport({ 
    caseId: caseId!, 
    enabled: showDownloadModal,
    prefetchedData: {
      caseData: caseData,
      documents: documents,
      transcript: transcript,
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
          <Skeleton className="h-10 w-48 mb-6" />
          <div className="mb-8">
            <Skeleton className="h-10 w-96 mb-4" />
            <Skeleton className="h-6 w-64 mb-4" />
            <div className="flex gap-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-40" />
            </div>
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
          <Button
            variant="ghost"
            onClick={() => setLocation('/')}
            className="mb-6 gap-2"
            data-testid="button-back-to-dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">Case not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background ${isFocusMode ? 'focus-mode' : ''}`}>
      {/* Focus Mode Exit Button - floating */}
      {isFocusMode && (
        <div className="fixed top-4 right-4 z-50">
          <Button
            variant="outline"
            size="sm"
            onClick={exitFocusMode}
            className="gap-2 bg-background/80 backdrop-blur-sm shadow-lg"
            data-testid="button-exit-focus-mode"
          >
            <X className="w-4 h-4" />
            Exit Focus Mode
          </Button>
        </div>
      )}
      
      <div className={`mx-auto px-6 lg:px-8 py-8 ${isFocusMode ? 'max-w-3xl' : 'max-w-4xl'}`}>
        {!isFocusMode && (
          <Button
            variant="ghost"
            onClick={() => setLocation('/')}
            className="mb-6 gap-2"
            data-testid="button-back-to-dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        )}

        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h1 className={`font-semibold text-foreground mb-2 ${isFocusMode ? 'text-4xl' : 'text-3xl'}`}>
                {caseData.title}
              </h1>
              {caseData.clientId ? (
                <button
                  className={`text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors ${isFocusMode ? 'text-xl' : 'text-lg'}`}
                  onClick={() => setLocation(`/clients/${caseData.clientId}`)}
                  data-testid="link-client-profile"
                >
                  {caseData.clientName}
                </button>
              ) : (
                <p className={`text-muted-foreground ${isFocusMode ? 'text-xl' : 'text-lg'}`}>{caseData.clientName}</p>
              )}
              {caseData.parentCaseId && (
                <button
                  className="text-sm text-accent underline underline-offset-2 mt-1 text-left"
                  onClick={() => setLocation(`/case/${caseData.parentCaseId}`)}
                  data-testid="link-parent-case"
                >
                  View parent matter
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {caseData.sourceType === 'dictation' && (
                <Badge variant="secondary" data-testid="badge-dictation">
                  <Phone className="w-3 h-3 mr-1" />
                  Telephone Attendance
                </Badge>
              )}
              {caseData.sourceType === 'audio' && hasValidConsent ? (
                <Badge className="bg-accent" data-testid="badge-gdpr-compliant">
                  <Shield className="w-3 h-3 mr-1" />
                  GDPR Compliant
                </Badge>
              ) : caseData.sourceType === 'audio' ? (
                <Badge variant="destructive" data-testid="badge-consent-missing">
                  <Shield className="w-3 h-3 mr-1" />
                  Consent Required
                </Badge>
              ) : null}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" data-testid="button-case-actions">
                    <MoreVertical className="w-4 h-4" />
                    <span className="hidden sm:inline">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={toggleFocusMode} data-testid="action-focus-mode">
                    <Focus className="w-4 h-4 mr-2" />
                    {isFocusMode ? "Exit Focus Mode" : "Focus Mode"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowPriorityModal(true)} data-testid="action-set-priority">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Set Priority/Deadline
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowAddNoteModal(true)} data-testid="action-add-note">
                    <MessageSquarePlus className="w-4 h-4 mr-2" />
                    Add Quick Note
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowLogCallModal(true)} data-testid="action-log-call">
                    <Phone className="w-4 h-4 mr-2" />
                    Log a Phone Call
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowImportModal(true)} data-testid="action-import-recording">
                    <Video className="w-4 h-4 mr-2" />
                    Import Recording
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowShareModal(true)} data-testid="action-share">
                    <Share2 className="w-4 h-4 mr-2" />
                    Secure Share
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => markReviewedMutation.mutate(!caseData.reviewed)} 
                    data-testid="action-mark-reviewed"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    {caseData.reviewed ? "Unmark as Reviewed" : "Mark as Reviewed"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowDownloadModal(true)} data-testid="action-download">
                    <Download className="w-4 h-4 mr-2" />
                    Download Document
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowHandoverModal(true)} data-testid="action-handover">
                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                    Handover Case
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => archiveMutation.mutate(true)}
                    className="text-destructive focus:text-destructive"
                    data-testid="action-archive"
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    Archive Case
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{format(new Date(caseData.createdAt), "dd MMMM yyyy")}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="w-4 h-4" />
              <span>Created by {caseData.createdBy}</span>
            </div>
            {caseData.consentGiven && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="w-4 h-4" />
                <span>Consent recorded</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {editingPracticeArea ? (
              <Select
                value={caseData.practiceArea || ""}
                onValueChange={async (val) => {
                  try {
                    await apiRequest("PATCH", `/api/cases/${caseId}`, { practiceArea: val });
                    queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });
                    toast({ title: "Practice area updated" });
                  } catch (err: any) {
                    toast({ title: "Update failed", description: err.message, variant: "destructive" });
                  }
                  setEditingPracticeArea(false);
                }}
              >
                <SelectTrigger className="w-auto min-w-[200px]" data-testid="select-edit-practice-area">
                  <SelectValue placeholder="Select practice area..." />
                </SelectTrigger>
                <SelectContent>
                  {PRACTICE_AREAS.map((pa) => (
                    <SelectItem key={pa} value={pa}>{PRACTICE_AREA_LABELS[pa]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge
                variant="secondary"
                className={!caseData.practiceArea ? "cursor-pointer" : ""}
                onClick={() => !caseData.practiceArea && setEditingPracticeArea(true)}
                data-testid="badge-practice-area"
              >
                {caseData.practiceArea
                  ? PRACTICE_AREA_LABELS[caseData.practiceArea as keyof typeof PRACTICE_AREA_LABELS] || caseData.practiceArea
                  : "Practice area not set (click to set)"}
              </Badge>
            )}
            <Badge
              variant={caseData.conflictCheckCompleted ? "secondary" : "outline"}
              className={caseData.conflictCheckCompleted
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"}
              data-testid="badge-conflict-check"
            >
              <Shield className="w-3 h-3 mr-1" />
              {caseData.conflictCheckCompleted ? "Conflict Check Completed" : "Conflict Check Pending"}
            </Badge>
            {!caseData.conflictCheckCompleted && caseData.conflictCheckNote && (
              <span className="text-xs text-muted-foreground italic" data-testid="text-conflict-note">
                Note: {caseData.conflictCheckNote}
              </span>
            )}
            {caseData.clientCareLetterId ? (
              <>
                <Badge
                  variant="secondary"
                  className={caseData.clientCareLetterSentAt
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"}
                  data-testid="badge-client-care-letter"
                >
                  <FileText className="w-3 h-3 mr-1" />
                  {caseData.clientCareLetterSentAt ? "Client Care Letter Sent" : "Client Care Letter Ready"}
                </Badge>
                {!caseData.clientCareLetterSentAt && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSendCareLetterDialog(true)}
                    className="gap-1"
                    data-testid="button-send-care-letter"
                  >
                    <Send className="w-3 h-3" />
                    Send to Client
                  </Button>
                )}
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCareLetterModal(true)}
                className="gap-1"
                data-testid="button-generate-care-letter"
              >
                <FileText className="w-3 h-3" />
                Generate Client Care Letter
              </Button>
            )}
          </div>
        </div>

        {caseData.sourceType === 'audio' && !consentLoading && !hasValidConsent && (
          <div className="mb-8 p-6 bg-destructive/10 border-2 border-destructive rounded-lg">
            <div className="flex items-start gap-4">
              <Shield className="w-6 h-6 text-destructive flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-2">GDPR Compliance Required</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  No valid client consent has been recorded for this case. UK solicitors must obtain and document client 
                  consent before processing audio recordings under GDPR and professional conduct rules.
                </p>
                <p className="text-sm font-medium text-foreground">
                  Please contact your client to obtain consent, or delete this case if consent cannot be obtained.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recording Archived card — shown when audio has been deleted under GDPR retention */}
        {caseData.sourceType === 'audio' && hasValidConsent && audioData?.deletedAt && (
          <div className="mb-8 bg-card border-2 rounded-lg p-4 space-y-3" data-testid="card-recording-archived">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-9 h-9 rounded-md border bg-muted/50">
                <Shield className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="flex-1 space-y-1">
                {/* Static decorative waveform (SVG bar pattern) */}
                <svg
                  viewBox="0 0 200 32"
                  preserveAspectRatio="none"
                  className="w-full h-8"
                  aria-hidden="true"
                  data-testid="waveform-archived"
                >
                  {[0.3,0.5,0.7,0.4,0.9,0.6,0.8,0.35,0.65,0.5,0.85,0.45,0.7,0.55,0.4,0.75,0.3,0.6,0.9,0.5,0.7,0.4,0.85,0.55,0.65,0.3,0.8,0.45,0.6,0.7,0.35,0.5,0.75,0.4,0.9,0.55,0.65,0.8,0.3,0.7].map((h, i) => (
                    <rect
                      key={i}
                      x={i * 5}
                      y={32 - h * 32}
                      width={3.5}
                      height={h * 32}
                      rx={1}
                      className="fill-muted-foreground/25"
                    />
                  ))}
                </svg>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span data-testid="text-archived-duration">
                      {audioData.duration
                        ? `${Math.floor(audioData.duration / 60)} min ${audioData.duration % 60} sec`
                        : "Duration unavailable"}
                    </span>
                    <span data-testid="text-archived-date">
                      {new Date(audioData.recordedAt).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                      })}{" "}
                      {new Date(audioData.recordedAt).toLocaleTimeString("en-GB", {
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] no-default-hover-elevate no-default-active-elevate" data-testid="badge-recording-deleted">
                    Recording permanently deleted
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground" data-testid="text-archived-explanation">
                The original audio has been securely deleted. The transcript and documents produced from this recording remain on file.
              </p>
              <Badge variant="outline" className="text-[10px] whitespace-nowrap no-default-hover-elevate no-default-active-elevate" data-testid="badge-gdpr-retention">
                7-day retention — Article 5(1)(e) GDPR
              </Badge>
            </div>
          </div>
        )}

        {caseData.sourceType === 'audio' && !hasValidConsent && !consentLoading && !audioLoading && (
          <Alert className="mb-8 bg-card border-muted" data-testid="alert-no-recording-consent">
            <FileText className="w-4 h-4" />
            <AlertDescription>
              <span className="font-medium">Text notes only - Recording consent declined</span>
              <p className="text-sm text-muted-foreground mt-1">
                Client declined audio recording consent. This case uses text-based notes instead.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {caseData.sourceType === 'audio' && audioData && audioData.filePath && !audioData.deletedAt && (
          <div className="mb-8">
            <AudioPlayer
              audioUrl={audioData.filePath}
              expiresAt={new Date(audioData.expiresAt)}
              caseId={caseData.id}
              audioRecordingId={audioData.id}
              playerRef={audioPlayerRef}
            />
          </div>
        )}

        {caseData.status === 'processing' && (
          <div className="mb-8 p-6 bg-card rounded-lg border-2 border-accent shadow-lg" data-testid="processing-status-card">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-2 bg-accent/20 rounded-lg">
                <Bot className="w-6 h-6 text-accent" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-foreground">Meeting-to-Matter™ AI Engine</h3>
                  {(!processingStatus || processingStatus.processingMetadata?.status === 'processing') && (
                    <Loader2 className="w-4 h-4 animate-spin text-accent" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-3" data-testid="text-current-step">
                  {processingStatus?.processingMetadata?.currentStep || 'Preparing...'}
                </p>
                
                {processingStatus?.processingMetadata && (
                  <>
                    <Progress 
                      value={processingStatus.processingMetadata.progress || 0} 
                      className="h-2 mb-3"
                      data-testid="progress-bar"
                    />
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground" data-testid="text-progress-percentage">
                        {processingStatus.processingMetadata.progress || 0}% complete
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {processingStatus?.processingMetadata?.error && (
              <Alert variant="destructive" className="mt-4" data-testid="alert-processing-error">
                <AlertDescription>
                  {processingStatus.processingMetadata.error}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {caseData.status === 'failed' && (
          <div className="mb-8 p-6 bg-destructive/10 rounded-lg border-2 border-destructive" data-testid="failed-status-card">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-2">AI Processing Failed</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {(caseData.aiProcessingMetadata as any)?.error || 'An error occurred during processing. Please try again.'}
                </p>
                {(caseData.aiProcessingMetadata as any)?.error?.includes('quota') && (
                  <Alert className="mb-4 bg-amber-500/10 border-amber-500/20" data-testid="alert-quota-error">
                    <AlertDescription className="text-sm">
                      <strong>API Credits Needed:</strong> The OpenAI API key has insufficient credits. 
                      Please add credits to your OpenAI account and retry.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <Button
                onClick={() => retryProcessingMutation.mutate()}
                disabled={retryProcessingMutation.isPending}
                variant="destructive"
                className="gap-2"
                data-testid="button-retry-processing"
              >
                {retryProcessingMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Retry Processing
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {(caseData.sourceType === 'audio' || caseData.sourceType === 'dictation') && caseData.status === 'pending' && !caseData.transcript && (
          <div className="mb-8 p-6 bg-card rounded-lg border border-border">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">
                  {caseData.sourceType === 'dictation'
                    ? 'Ready for AI Processing'
                    : hasValidConsent ? 'Ready for AI Processing' : 'Consent Required Before Processing'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {caseData.sourceType === 'dictation'
                    ? 'Your dictation is ready. Click below to transcribe and generate the telephone attendance note.'
                    : hasValidConsent 
                      ? 'Your audio recording is ready. Click below to transcribe and generate legal documents.'
                      : 'Valid client consent must be recorded before AI processing can begin. This is required for GDPR compliance.'}
                </p>
              </div>
              <Button
                onClick={() => processAIMutation.mutate()}
                disabled={processAIMutation.isPending || (caseData.sourceType !== 'dictation' && !hasValidConsent)}
                className="gap-2 bg-accent hover:bg-accent"
                data-testid="button-process-ai"
              >
                {processAIMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Process with AI
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        <DocumentViewer
          caseId={caseId!}
          documents={documents}
          transcript={transcript?.content}
          transcriptUtterances={transcript?.utterances}
          speakerCount={transcript?.speakerCount}
          transcriptRedactions={transcript?.redactions}
          textNotes={caseData.textNotes}
          status={caseData.status}
          caseTitle={caseData.title}
          clientName={caseData.clientName}
          matterReference={caseData.matterReference}
          createdAt={caseData.createdAt}
          onTranscriptTimestampClick={handleTranscriptTimestampClick}
          initialTab={urlTab || undefined}
          initialTimestamp={urlTimestamp ? parseInt(urlTimestamp, 10) : undefined}
        />

        {user?.complianceThread && (
          <AmlTriggerBanner
            caseData={caseData}
            onAddMonitoringNote={() => {
              setAutoOpenComplianceNote(prev => prev + 1);
              const el = document.querySelector('[data-testid="accordion-compliance-thread"]');
              if (el) {
                (el as HTMLElement).click();
                setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
              }
            }}
          />
        )}

        {meetingSessions.length > 0 && (
          <div className="mt-8">
            <Accordion type="multiple" defaultValue={["session-timeline"]} className="space-y-4">
              <AccordionItem value="session-timeline" className="bg-card rounded-lg border border-border px-6">
                <AccordionTrigger className="hover:no-underline" data-testid="accordion-session-timeline">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-accent" />
                    <span className="font-semibold">Session Timeline</span>
                    <Badge variant="secondary" className="ml-2 text-xs">{meetingSessions.length} {meetingSessions.length === 1 ? "session" : "sessions"}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="py-4 space-y-3" data-testid="session-timeline-list">
                    <Accordion type="multiple">
                      {meetingSessions.map((session, idx) => (
                        <AccordionItem
                          key={session.id}
                          value={`session-${session.id}`}
                          className="border border-border rounded-md mb-3 last:mb-0 px-3"
                          data-testid={`session-item-${session.id}`}
                        >
                          <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-start gap-4 w-full">
                              <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                                <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-xs font-semibold text-accent">
                                  {meetingSessions.length - idx}
                                </div>
                                {idx < meetingSessions.length - 1 && (
                                  <div className="w-px h-6 bg-border" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0 text-left">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="text-xs" data-testid={`badge-recording-type-${session.id}`}>
                                    {RECORDING_TYPE_LABELS[session.recordingType as RecordingType] || session.recordingType}
                                  </Badge>
                                  <Badge
                                    variant={session.status === "completed" ? "default" : session.status === "failed" ? "destructive" : "secondary"}
                                    className="text-xs"
                                    data-testid={`badge-session-status-${session.id}`}
                                  >
                                    {session.status}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {session.startedAt ? format(new Date(session.startedAt), "d MMM yyyy, HH:mm") : "—"}
                                  {session.durationSeconds != null && (
                                    <span className="ml-2">
                                      {Math.floor(session.durationSeconds / 60)}m {session.durationSeconds % 60}s
                                    </span>
                                  )}
                                </p>
                                {session.notes && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{session.notes}</p>
                                )}
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <SessionDetails sessionId={session.id} />
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}

        {/* Briefing Stack - Collapsible Sections */}
        <div className="mt-8">
          <Accordion type="multiple" defaultValue={urlTab === "compliance" ? ["quick-notes", "action-items", "compliance-thread"] : ["quick-notes", "action-items"]} className="space-y-4">
            {/* Quick Notes Section */}
            <AccordionItem value="quick-notes" className="bg-card rounded-lg border border-border px-6">
              <AccordionTrigger className="hover:no-underline" data-testid="accordion-quick-notes">
                <div className="flex items-center gap-2">
                  <MessageSquarePlus className="w-5 h-5 text-accent" />
                  <span className="font-semibold">Quick Notes</span>
                  {caseData.textNotes && (
                    <Badge variant="secondary" className="ml-2 text-xs">Has notes</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddNoteModal(true)}
                    className="gap-2"
                    data-testid="button-add-quick-note"
                  >
                    <Plus className="w-4 h-4" />
                    {caseData.textNotes ? "Edit Note" : "Add Note"}
                  </Button>
                </div>
                
                {caseData.textNotes ? (
                  <div className="prose prose-sm max-w-none">
                    <p className="text-foreground whitespace-pre-wrap" data-testid="text-quick-notes-content">
                      {caseData.textNotes}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic" data-testid="text-no-quick-notes">
                    No quick notes added yet. Click "Add Note" to add text or voice notes to this case.
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Action Items & Pre-Meeting Briefing */}
            <AccordionItem value="action-items" className="bg-card rounded-lg border border-border px-6">
              <AccordionTrigger className="hover:no-underline" data-testid="accordion-action-items">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-accent" />
                  <span className="font-semibold">Action Items & Briefing</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ActionItemsViewer caseId={caseId!} hasTranscript={!!transcript?.content} />
                  <PreMeetingBriefing caseId={caseId!} hasTranscript={!!transcript?.content} />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Undertakings Register */}
            <AccordionItem value="undertakings" className="bg-card rounded-lg border border-border px-6">
              <AccordionTrigger className="hover:no-underline" data-testid="accordion-undertakings">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-accent" />
                  <span className="font-semibold">Undertakings</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <UndertakingsViewer caseId={caseId!} hasTranscript={!!transcript?.content} />
              </AccordionContent>
            </AccordionItem>

            {/* Consent Evidence Section - preserved indefinitely for compliance */}
            {caseData.sourceType === 'audio' && (
              <AccordionItem value="consent-evidence" className="bg-card rounded-lg border border-border px-6">
                <AccordionTrigger className="hover:no-underline" data-testid="accordion-consent-evidence">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-accent" />
                    <span className="font-semibold">Consent Evidence</span>
                    {hasValidConsent && (
                      <Badge className="ml-2 text-xs bg-accent">Verified</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ConsentEvidence 
                    caseId={caseId!} 
                    audioRecording={audioData}
                    consentLogs={consentLogs}
                  />
                </AccordionContent>
              </AccordionItem>
            )}

            <AccordionItem value="external-documents" className="bg-card rounded-lg border border-border px-6">
              <AccordionTrigger className="hover:no-underline" data-testid="accordion-external-documents">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-accent" />
                  <span className="font-semibold">External Document References</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ExternalDocumentRefs caseId={caseId!} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="time-entries" className="bg-card rounded-lg border border-border px-6">
              <AccordionTrigger className="hover:no-underline" data-testid="accordion-time-entries">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-accent" />
                  <span className="font-semibold">Time</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <TimeEntriesViewer
                  caseId={caseId!}
                  caseTitle={caseData.title}
                  matterReference={caseData.matterReference || undefined}
                  durationSeconds={audioData?.duration || undefined}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="compliance-thread" className="bg-card rounded-lg border border-border px-6">
              <AccordionTrigger className="hover:no-underline" data-testid="accordion-compliance-thread">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-accent" />
                  <span className="font-semibold">Compliance Thread</span>
                  {user?.complianceThread && caseData.riskLevel && (
                    <Badge className={`text-xs no-default-hover-elevate no-default-active-elevate ${
                      caseData.riskLevel === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                      caseData.riskLevel === 'medium' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' :
                      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    }`}>
                      {(caseData.riskLevel as string).toUpperCase()}
                    </Badge>
                  )}
                  {!user?.complianceThread && (
                    <Badge variant="outline" className="text-xs no-default-hover-elevate no-default-active-elevate">
                      Locked
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {user?.complianceThread ? (
                  <ComplianceThread
                    caseId={caseId!}
                    riskLevel={caseData.riskLevel}
                    clientName={caseData.clientName}
                    autoOpenNoteForm={autoOpenComplianceNote}
                  />
                ) : (
                  <div className="text-center py-6 space-y-3" data-testid="compliance-locked-prompt">
                    <Shield className="w-10 h-10 mx-auto text-muted-foreground opacity-40" />
                    <div>
                      <p className="font-medium text-sm">Compliance Thread</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Per-matter AML monitoring, risk assessments, and MLRO decision records.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        This premium feature requires activation by your account administrator.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => window.open("https://legalnote.ai/pricing", "_blank")}
                        data-testid="button-upgrade-compliance"
                      >
                        <Lock className="w-3.5 h-3.5 mr-1" />
                        Upgrade to Enable
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.href = "/settings"}
                        data-testid="button-compliance-settings"
                      >
                        View Settings
                      </Button>
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {linkedDictations.length > 0 && (
              <AccordionItem value="linked-calls" className="bg-card rounded-lg border border-border px-6">
                <AccordionTrigger className="hover:no-underline" data-testid="accordion-linked-calls">
                  <div className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-accent" />
                    <span className="font-semibold">Telephone Attendance Notes</span>
                    <Badge variant="secondary" className="text-xs">{linkedDictations.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {linkedDictations.map(d => (
                      <Card
                        key={d.id}
                        className="cursor-pointer hover-elevate"
                        onClick={() => setLocation(`/case/${d.id}`)}
                        data-testid={`linked-call-${d.id}`}
                      >
                        <CardContent className="p-3 flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-medium">{d.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(d.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <Badge variant={d.status === 'completed' || d.status === 'review_required' ? 'secondary' : 'outline'} className="text-xs shrink-0">
                            {d.status === 'review_required' ? 'Ready for Review' : d.status === 'completed' ? 'Completed' : d.status === 'processing' ? 'Processing' : 'Pending'}
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Case Timeline */}
            <AccordionItem value="timeline" className="bg-card rounded-lg border border-border px-6">
              <AccordionTrigger className="hover:no-underline" data-testid="accordion-timeline">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-accent" />
                  <span className="font-semibold">Timeline</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <CaseTimeline caseId={caseId!} />
              </AccordionContent>
            </AccordionItem>

            {/* Sharing History */}
            <AccordionItem value="sharing-history" className="bg-card rounded-lg border border-border px-6">
              <AccordionTrigger className="hover:no-underline" data-testid="accordion-sharing-history">
                <div className="flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-accent" />
                  <span className="font-semibold">Sharing History</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <SharedHistoryViewer caseId={caseId!} />
              </AccordionContent>
            </AccordionItem>

            {/* Audit Trail */}
            <AccordionItem value="audit-trail" className="bg-card rounded-lg border border-border px-6">
              <AccordionTrigger className="hover:no-underline" data-testid="accordion-audit-trail">
                <div className="flex items-center gap-2">
                  <ScrollText className="w-5 h-5 text-accent" />
                  <span className="font-semibold">Audit Trail</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <AuditTrail caseId={caseId!} limit={50} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      <AddQuickNoteModal
        open={showAddNoteModal}
        onOpenChange={setShowAddNoteModal}
        caseId={caseId!}
      />

      <SetPriorityDeadlineModal
        open={showPriorityModal}
        onOpenChange={setShowPriorityModal}
        caseId={caseId!}
        caseTitle={caseData.title}
        currentPriority={caseData.priority as "urgent" | "deadline-soon" | "normal" || "normal"}
        currentDeadline={caseData.deadline || null}
        currentDeadlineIsAllDay={caseData.deadlineIsAllDay || false}
      />

      <ShareLinkModal
        open={showShareModal}
        onOpenChange={setShowShareModal}
        caseId={caseId!}
        caseTitle={caseData.title}
        userRole="Partner"
      />

      <DownloadModal
        open={showDownloadModal}
        onOpenChange={setShowDownloadModal}
        availableDocuments={{
          hasAttendanceNote: !!documents.find((d: any) => d.isActive && d.type === 'attendance_note'),
          hasSummary: !!documents.find((d: any) => d.isActive && d.type === 'summary') || !!caseData.textNotes,
          hasTranscript: !!documents.find((d: any) => d.isActive && d.type === 'transcript') || !!transcript?.content,
        }}
        sharedDocuments={['attendance_note', 'summary', 'transcript']}
        onDownload={handleDownload}
      />

      <ImportRecordingModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        caseId={caseId!}
        caseTitle={caseData.title}
      />

      <LogCallModal
        open={showLogCallModal}
        onOpenChange={setShowLogCallModal}
        caseId={caseId!}
        caseTitle={caseData.title}
        clientName={caseData.clientName}
        clientId={caseData.clientId}
        matterReference={caseData.matterReference || undefined}
      />

      <HandoverModal
        open={showHandoverModal}
        onOpenChange={setShowHandoverModal}
        caseId={caseId!}
        caseTitle={caseData.title}
        currentAssignee={caseData.assignedToUserId}
      />

      <TimeRecordingModal
        open={showTimeRecordingModal}
        onOpenChange={setShowTimeRecordingModal}
        caseId={caseId!}
        caseTitle={caseData.title}
        matterReference={caseData.matterReference || undefined}
        durationSeconds={audioData?.duration || undefined}
        sessionType={caseData.sourceType === 'dictation' ? 'Telephone Attendance' : 'Meeting'}
      />

      <ClientCareLetterModal
        open={showCareLetterModal}
        onOpenChange={setShowCareLetterModal}
        caseId={caseId!}
        clientName={caseData.clientName}
        costsEstimate={caseData.costsEstimate}
      />

      <Dialog open={showSendCareLetterDialog} onOpenChange={setShowSendCareLetterDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Send Client Care Letter
            </DialogTitle>
            <DialogDescription>
              Send the client care letter to {caseData.clientName} via email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="send-ccl-email">
                Recipient Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="send-ccl-email"
                type="email"
                placeholder="client@example.com"
                value={sendEmail}
                onChange={(e) => setSendEmail(e.target.value)}
                disabled={isSendingCareLetter}
                data-testid="input-send-ccl-email"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowSendCareLetterDialog(false)} disabled={isSendingCareLetter}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!sendEmail.trim()) {
                  toast({ title: "Email required", description: "Please enter a recipient email address", variant: "destructive" });
                  return;
                }
                setIsSendingCareLetter(true);
                try {
                  await apiRequest("POST", `/api/cases/${caseId}/send-client-care-letter`, {
                    recipientEmail: sendEmail.trim(),
                    recipientName: caseData.clientName,
                  });
                  toast({ title: "Letter sent", description: `Client care letter sent to ${sendEmail}` });
                  setShowSendCareLetterDialog(false);
                  setSendEmail("");
                } catch (err: any) {
                  toast({ title: "Send failed", description: err.message || "Failed to send client care letter", variant: "destructive" });
                } finally {
                  setIsSendingCareLetter(false);
                }
              }}
              disabled={isSendingCareLetter}
              data-testid="button-confirm-send-ccl"
            >
              {isSendingCareLetter ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Letter"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
