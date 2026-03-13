import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Calendar, User, Shield, Loader2, RefreshCw, Sparkles, FileText, Bot, MessageSquarePlus, Plus, MoreVertical, AlertCircle, Share2, Eye, Download, Archive, Video, ChevronDown, ListChecks, ClipboardList, History, ScrollText, Focus, X, Phone } from "lucide-react";
import { useFocusMode } from "@/contexts/FocusModeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { useLocation, useParams, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCaseActions } from "@/hooks/useCaseActions";
import { useCaseExport } from "@/hooks/useCaseExport";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import type { Case, AudioRecording, ConsentLog } from "@shared/schema";

export default function CaseDetail() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const search = useSearch();
  const caseId = params.id;
  const { toast } = useToast();
  const { isFocusMode, toggleFocusMode, exitFocusMode } = useFocusMode();
  const [autoOpenComplianceNote, setAutoOpenComplianceNote] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showLogCallModal, setShowLogCallModal] = useState(false);
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

  // Refresh case data when processing completes (any terminal status)
  useEffect(() => {
    const terminalStatuses = ['review_required', 'completed', 'pending', 'failed'];
    if (processingStatus?.status && terminalStatuses.includes(processingStatus.status) && caseData?.status === 'processing') {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });
    }
  }, [processingStatus?.status, caseData?.status, caseId]);

  // Check if there's a valid consent log (consentGiven === true)
  const hasValidConsent = consentLogs.some(log => log.consentGiven === true);
  
  const processAIMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/cases/${caseId}/process`, {});
    },
    onSuccess: () => {
      toast({
        title: "Processing complete",
        description: "Documents have been generated successfully",
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
              <p className={`text-muted-foreground ${isFocusMode ? 'text-xl' : 'text-lg'}`}>{caseData.clientName}</p>
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

        {/* Audio deletion status indicator */}
        {caseData.sourceType === 'audio' && hasValidConsent && audioData?.deletedAt && (
          <Alert className="mb-8 bg-card border-muted" data-testid="alert-audio-deleted">
            <Shield className="w-4 h-4" />
            <AlertDescription>
              <span className="font-medium">Audio Recording Deleted - GDPR Compliance</span>
              <p className="text-sm text-muted-foreground mt-1">
                The audio recording has been automatically deleted in accordance with our GDPR data retention policy. 
                This deletion occurred either after successful processing completion or after the 7-day retention period. 
                All generated documents and transcripts remain securely available.
              </p>
            </AlertDescription>
          </Alert>
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
              setAutoOpenComplianceNote(true);
              const el = document.querySelector('[data-testid="accordion-compliance-thread"]');
              if (el) {
                (el as HTMLElement).click();
                setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
              }
            }}
          />
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
                        Enable in Settings to start tracking compliance for your matters.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation("/settings")}
                      data-testid="button-enable-compliance"
                    >
                      Enable in Settings
                    </Button>
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
        matterReference={caseData.matterReference || undefined}
      />
    </div>
  );
}
