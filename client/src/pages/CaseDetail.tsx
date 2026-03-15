import { useState, useEffect, useRef } from "react";
import { toTitleCase } from "@/lib/utils";
import {
  ArrowLeft, Calendar, User, Shield, Loader2, RefreshCw, Sparkles,
  FileText, Bot, MessageSquarePlus, Plus, MoreVertical, AlertCircle,
  Share2, Eye, Download, Archive, Video, ListChecks, History,
  ScrollText, Focus, X, Phone, Lock, ArrowRightLeft, Clock, Send,
  ShieldCheck, ChevronRight,
} from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
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

type CaseSection =
  | "documents" | "obligations" | "sessions" | "notes" | "briefing"
  | "time" | "undertakings" | "external-refs" | "linked-calls"
  | "consent" | "compliance" | "activity" | "sharing" | "audit";

const SECTION_LABELS: Record<CaseSection, string> = {
  documents: "Documents",
  obligations: "Obligations",
  sessions: "Sessions",
  notes: "Notes",
  briefing: "Pre-meeting Briefing",
  time: "Time Recording",
  undertakings: "Undertakings",
  "external-refs": "External References",
  "linked-calls": "Telephone Notes",
  consent: "Consent Evidence",
  compliance: "Compliance Thread",
  activity: "Activity Timeline",
  sharing: "Sharing History",
  audit: "Audit Trail",
};

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

  const activeDocuments = data.documents.filter(d => d.isActive);
  const previousVersions = data.documents.filter(d => !d.isActive);

  return (
    <div className="py-3 space-y-3" data-testid={`session-details-${sessionId}`}>
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
  const [showCareLetterModal, setShowCareLetterModal] = useState(false);
  const [showSendCareLetterDialog, setShowSendCareLetterDialog] = useState(false);
  const [sendEmail, setSendEmail] = useState("");
  const [isSendingCareLetter, setIsSendingCareLetter] = useState(false);
  const [editingPracticeArea, setEditingPracticeArea] = useState(false);

  const timeRecordingKey = `timeRecordingPrompted_${params.id}`;
  const [hasPromptedTimeRecording, setHasPromptedTimeRecording] = useState(() => {
    return localStorage.getItem(timeRecordingKey) === 'true';
  });
  useEffect(() => {
    setHasPromptedTimeRecording(localStorage.getItem(timeRecordingKey) === 'true');
  }, [timeRecordingKey]);

  const { user } = useAuth();
  const audioPlayerRef = useRef<AudioPlayerHandle>(null);
  const [hasAutoSeeked, setHasAutoSeeked] = useState(false);

  const searchParams = new URLSearchParams(search);
  const urlTab = searchParams.get('tab') as 'attendance' | 'summary' | 'transcript' | 'compliance' | null;
  const urlTimestamp = searchParams.get('timestamp');

  const [activeSection, setActiveSection] = useState<CaseSection>(() => {
    if (urlTab === 'compliance') return 'compliance';
    return 'documents';
  });

  useEffect(() => {
    if (urlTab === 'compliance') setActiveSection('compliance');
  }, [urlTab]);

  const handleTranscriptTimestampClick = (timeMs: number) => {
    audioPlayerRef.current?.seekTo(timeMs);
  };

  useEffect(() => {
    if (urlTimestamp && !hasAutoSeeked && audioPlayerRef.current) {
      const timestampMs = parseInt(urlTimestamp, 10);
      if (!isNaN(timestampMs)) {
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

  const { data: undertakingsData = [] } = useQuery<Array<{ id: string; status: string }>>({
    queryKey: [`/api/cases/${caseId}/undertakings`],
    enabled: !!caseId,
  });
  const outstandingUndertakingsCount = undertakingsData.filter(u => u.status === 'outstanding').length;

  const { data: actionItems = [] } = useQuery<Array<{ id: string; status: string }>>({
    queryKey: [`/api/cases/${caseId}/action-items`],
    enabled: !!caseId && (caseData?.status === 'review_required' || caseData?.status === 'completed'),
  });
  const pendingObligationsCount = actionItems.filter(a => a.status === 'draft').length;

  const { data: timeEntries = [] } = useQuery<Array<{ id: string; duration: number }>>({
    queryKey: [`/api/cases/${caseId}/time-entries`],
    enabled: !!caseId,
  });
  const totalTimeMinutes = timeEntries.reduce((sum: number, t: any) => sum + (t.duration || 0), 0);
  const totalTimeLabel = totalTimeMinutes > 0
    ? totalTimeMinutes >= 60
      ? `${Math.floor(totalTimeMinutes / 60)}h ${totalTimeMinutes % 60}m`
      : `${totalTimeMinutes}m`
    : null;

  const { data: allCases } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    enabled: !!caseId,
  });
  const linkedDictations = (allCases || []).filter(c => c.parentCaseId === caseId && c.sourceType === 'dictation');

  interface SpeakerUtterance {
    speaker: string; text: string; start: number; end: number; confidence: number;
  }
  interface Redaction {
    start: number; end: number; reason: string; redactedBy: string; timestamp: string;
  }

  const { data: transcript } = useQuery<{
    id: string; caseId: string; content: string;
    utterances?: SpeakerUtterance[]; speakerCount?: number;
    redactions?: Redaction[]; createdAt: string;
  }>({
    queryKey: [`/api/cases/${caseId}/transcript`],
    enabled: !!caseId && (caseData?.status === 'review_required' || caseData?.status === 'completed'),
  });

  const { data: documents = [] } = useQuery<Array<{
    id: string; caseId: string; type: 'attendance_note' | 'summary';
    content: string; version: number; createdAt: string;
  }>>({
    queryKey: [`/api/cases/${caseId}/documents`],
    enabled: !!caseId && (caseData?.status === 'review_required' || caseData?.status === 'completed'),
  });

  const { data: processingStatus } = useQuery<{
    status: string;
    processingMetadata: {
      status: string; progress: number; currentStep: string;
      totalCost: number; totalTokens: number; error?: string; completedAt?: string;
    };
  }>({
    queryKey: [`/api/cases/${caseId}/processing-status`],
    enabled: !!caseId && caseData?.status === 'processing',
    refetchInterval: 5000,
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

  useEffect(() => {
    if (
      !hasPromptedTimeRecording &&
      caseData?.status === 'review_required' &&
      (caseData?.sourceType === 'audio' || caseData?.sourceType === 'dictation')
    ) {
      localStorage.setItem(timeRecordingKey, 'true');
      setHasPromptedTimeRecording(true);
      const timer = setTimeout(() => {
        setShowTimeRecordingModal(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [caseData?.status, caseData?.sourceType, hasPromptedTimeRecording, timeRecordingKey]);

  const hasValidConsent = consentLogs.some(log => log.consentGiven === true);

  const processAIMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/cases/${caseId}/process`, {}),
    onSuccess: () => {
      toast({ title: "Processing complete", description: "Documents have been produced successfully", duration: 6000 });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });
    },
    onError: (error: any) => {
      toast({ title: "Processing failed", description: error.message || "Failed to process case. Please try again.", variant: "destructive", duration: 6000 });
    },
  });

  const retryProcessingMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/cases/${caseId}/retry-processing`, {}),
    onSuccess: () => {
      toast({ title: "Retry started", description: "Processing has been queued again", duration: 6000 });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });
    },
    onError: (error: any) => {
      toast({ title: "Retry failed", description: error.message || "Failed to retry processing.", variant: "destructive", duration: 6000 });
    },
  });

  const { markReviewedMutation, archiveMutation } = useCaseActions({
    caseId: caseId!,
    onArchiveSuccess: () => setLocation('/'),
  });
  const { handleDownload } = useCaseExport({
    caseId: caseId!,
    enabled: showDownloadModal,
    prefetchedData: { caseData, documents, transcript },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <div className="hidden lg:flex w-[220px] shrink-0 border-r border-border bg-muted/20 flex-col h-screen sticky top-16 overflow-y-auto">
          <div className="px-4 pt-4 pb-3 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="px-2 py-3 space-y-1">
            {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-md" />)}
          </div>
        </div>
        <main className="flex-1 min-w-0 px-8 py-8 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-[400px] w-full rounded-lg" />
        </main>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Case not found</p>
          <Button variant="ghost" onClick={() => setLocation('/')} className="gap-2" data-testid="button-back-to-dashboard">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const riskColors: Record<string, string> = {
    high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  };

  const matterNavItems: { id: string; label: string; icon: any; badge?: React.ReactNode; show?: boolean }[] = [
    { id: 'documents', label: 'Documents', icon: FileText },
    {
      id: 'obligations', label: 'Obligations', icon: ListChecks,
      badge: pendingObligationsCount > 0
        ? <Badge variant="secondary" className="text-[10px] h-4 px-1 no-default-hover-elevate no-default-active-elevate">{pendingObligationsCount}</Badge>
        : undefined,
    },
    {
      id: 'sessions', label: 'Sessions', icon: History,
      badge: meetingSessions.length > 0
        ? <Badge variant="secondary" className="text-[10px] h-4 px-1 no-default-hover-elevate no-default-active-elevate">{meetingSessions.length}</Badge>
        : undefined,
    },
    {
      id: 'notes', label: 'Notes', icon: MessageSquarePlus,
      badge: caseData.textNotes
        ? <Badge variant="secondary" className="text-[10px] h-4 px-1 no-default-hover-elevate no-default-active-elevate">1</Badge>
        : undefined,
    },
    { id: 'briefing', label: 'Pre-meeting Briefing', icon: Sparkles },
    {
      id: 'time', label: 'Time Recording', icon: Clock,
      badge: totalTimeLabel
        ? <Badge variant="secondary" className="text-[10px] h-4 px-1 no-default-hover-elevate no-default-active-elevate">{totalTimeLabel}</Badge>
        : undefined,
    },
    {
      id: 'undertakings', label: 'Undertakings', icon: Shield,
      badge: outstandingUndertakingsCount > 0
        ? <Badge variant="destructive" className="text-[10px] h-4 px-1 no-default-hover-elevate no-default-active-elevate">{outstandingUndertakingsCount}</Badge>
        : undefined,
    },
    { id: 'external-refs', label: 'External References', icon: FileText },
    { id: 'linked-calls', label: 'Telephone Notes', icon: Phone, show: linkedDictations.length > 0, badge: linkedDictations.length > 0 ? <Badge variant="secondary" className="text-[10px] h-4 px-1 no-default-hover-elevate no-default-active-elevate">{linkedDictations.length}</Badge> : undefined },
  ].filter(item => item.show !== false);

  const complianceNavItems: { id: string; label: string; icon: any; badge?: React.ReactNode; show?: boolean }[] = [
    { id: 'consent', label: 'Consent Evidence', icon: Shield, show: caseData.sourceType === 'audio' },
    {
      id: 'compliance', label: 'Compliance Thread', icon: ShieldCheck,
      badge: caseData.riskLevel
        ? <Badge className={cn("text-[10px] h-4 px-1 no-default-hover-elevate no-default-active-elevate", riskColors[caseData.riskLevel] || '')}>{(caseData.riskLevel as string).toUpperCase()}</Badge>
        : undefined,
    },
    { id: 'activity', label: 'Activity Timeline', icon: Calendar },
    { id: 'sharing', label: 'Sharing History', icon: Share2 },
    { id: 'audit', label: 'Audit Trail', icon: ScrollText },
  ].filter(item => item.show !== false);

  const NavItem = ({ item, isCompliance = false }: { item: typeof matterNavItems[0]; isCompliance?: boolean }) => {
    const isActive = activeSection === item.id;
    const Icon = item.icon;
    return (
      <button
        key={item.id}
        onClick={() => {
          setActiveSection(item.id as CaseSection);
          if (item.id === 'compliance') setAutoOpenComplianceNote(0);
        }}
        className={cn(
          "relative w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors duration-150 text-left group",
          isActive
            ? "bg-accent/10 text-accent font-medium"
            : "text-foreground/70 hover:text-foreground hover-elevate"
        )}
        data-testid={`nav-${item.id}`}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent rounded-r" />
        )}
        <Icon className={cn("w-4 h-4 shrink-0", isCompliance && !isActive ? "text-muted-foreground" : isActive ? "text-accent" : "text-muted-foreground group-hover:text-foreground")} />
        <span className="flex-1 truncate text-xs">{item.label}</span>
        {item.badge}
      </button>
    );
  };

  const mobileNavItems = [...matterNavItems, ...complianceNavItems];

  const showAudioPlayer = caseData.sourceType === 'audio' && audioData?.filePath && !audioData.deletedAt;

  const sectionActions: Partial<Record<CaseSection, React.ReactNode>> = {
    documents: (
      <Button variant="outline" size="sm" onClick={() => setShowDownloadModal(true)} className="gap-1.5" data-testid="button-download-documents">
        <Download className="w-3.5 h-3.5" />
        Download
      </Button>
    ),
    time: (
      <Button variant="outline" size="sm" onClick={() => setShowTimeRecordingModal(true)} className="gap-1.5" data-testid="button-record-time-top">
        <Clock className="w-3.5 h-3.5" />
        Record Time
      </Button>
    ),
    notes: (
      <Button variant="outline" size="sm" onClick={() => setShowAddNoteModal(true)} className="gap-1.5" data-testid="button-add-note-top">
        <Plus className="w-3.5 h-3.5" />
        {caseData.textNotes ? 'Edit Note' : 'Add Note'}
      </Button>
    ),
  };

  return (
    <div className={cn("flex bg-background", isFocusMode ? "min-h-screen" : "")}>
      {isFocusMode && (
        <div className="fixed top-4 right-4 z-[200]">
          <Button variant="outline" size="sm" onClick={exitFocusMode} className="gap-2 bg-background/80 backdrop-blur-sm shadow-lg" data-testid="button-exit-focus-mode">
            <X className="w-4 h-4" /> Exit Focus Mode
          </Button>
        </div>
      )}

      {/* ── Left Panel ── */}
      {!isFocusMode && (
        <aside
          className="hidden lg:flex w-[220px] shrink-0 border-r border-border bg-muted/20 flex-col sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto z-40"
          data-testid="case-side-nav"
        >
          {/* Back link */}
          <div className="px-4 pt-4 pb-2">
            <button
              onClick={() => setLocation('/')}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
              data-testid="link-back-all-cases"
            >
              <ArrowLeft className="w-3 h-3" />
              All Cases
            </button>
          </div>

          {/* Case identity */}
          <div className="px-4 pb-4 border-b border-border">
            <h1 className="font-semibold text-sm leading-snug text-foreground mb-1 line-clamp-2" data-testid="text-case-title-panel">
              {caseData.title}
            </h1>
            {caseData.clientId ? (
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 text-left truncate max-w-full block"
                onClick={() => setLocation(`/clients/${caseData.clientId}`)}
                data-testid="link-client-profile"
              >
                {caseData.clientName}
              </button>
            ) : (
              <p className="text-xs text-muted-foreground truncate">{caseData.clientName}</p>
            )}
            {caseData.matterReference && (
              <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate" data-testid="text-matter-ref-panel">
                {caseData.matterReference}
              </p>
            )}
            <div className="flex flex-wrap gap-1 mt-2">
              {caseData.riskLevel && (
                <Badge className={cn("text-[10px] no-default-hover-elevate no-default-active-elevate", riskColors[caseData.riskLevel] || '')} data-testid="badge-risk-panel">
                  {(caseData.riskLevel as string).toUpperCase()} RISK
                </Badge>
              )}
              <Badge variant="secondary" className="text-[10px] no-default-hover-elevate no-default-active-elevate" data-testid="badge-status-panel">
                {caseData.status === 'review_required' ? 'For Review'
                  : caseData.status === 'completed' ? 'Completed'
                  : caseData.status === 'processing' ? 'Processing'
                  : caseData.status === 'failed' ? 'Failed'
                  : 'Pending'}
              </Badge>
            </div>
          </div>

          {/* Matter nav */}
          <nav className="flex-1 py-2 px-2 space-y-0.5" aria-label="Matter sections">
            {matterNavItems.map(item => <NavItem key={item.id} item={item} />)}

            {/* Compliance divider */}
            <div className="px-3 pt-4 pb-1">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-muted-foreground" />
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Compliance</p>
              </div>
            </div>

            {complianceNavItems.map(item => <NavItem key={item.id} item={item} isCompliance />)}
          </nav>

          {/* Bottom actions */}
          <div className="p-3 border-t border-border space-y-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-full gap-2 justify-start" data-testid="button-case-actions">
                  <MoreVertical className="w-3.5 h-3.5" />
                  Case Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-52">
                <DropdownMenuItem onClick={toggleFocusMode} data-testid="action-focus-mode">
                  <Focus className="w-4 h-4 mr-2" />
                  {isFocusMode ? "Exit Focus Mode" : "Focus Mode"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowPriorityModal(true)} data-testid="action-set-priority">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Set Priority / Deadline
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
                <DropdownMenuItem onClick={() => markReviewedMutation.mutate(!caseData.reviewed)} data-testid="action-mark-reviewed">
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
                <DropdownMenuItem onClick={() => archiveMutation.mutate(true)} className="text-destructive focus:text-destructive" data-testid="action-archive">
                  <Archive className="w-4 h-4 mr-2" />
                  Archive Case
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-2 justify-start text-xs"
              onClick={() => setShowTimeRecordingModal(true)}
              data-testid="button-log-time-panel"
            >
              <Clock className="w-3.5 h-3.5" />
              Log Time
            </Button>
          </div>
        </aside>
      )}

      {/* ── Main Content ── */}
      <main className="flex-1 min-w-0 flex flex-col">

        {/* Mobile tab bar */}
        <div className="lg:hidden sticky top-16 z-30 bg-background border-b border-border overflow-x-auto">
          <div className="flex items-center gap-0.5 px-4 py-2 min-w-max">
            {mobileNavItems.map(item => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id as CaseSection)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors duration-150",
                    isActive ? "bg-accent/10 text-accent font-medium" : "text-muted-foreground hover:text-foreground"
                  )}
                  data-testid={`mobile-nav-${item.id}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section top bar */}
        <div className="sticky top-16 lg:top-16 z-20 bg-background border-b border-border h-14 flex items-center px-6 lg:px-8 gap-4 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h2 className="font-semibold text-sm text-foreground truncate">
              {SECTION_LABELS[activeSection]}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {sectionActions[activeSection]}
          </div>
        </div>

        {/* Persistent elements */}
        <div className="px-6 lg:px-8 pt-6 space-y-4">
          {/* GDPR / Consent alert */}
          {caseData.sourceType === 'audio' && !consentLoading && !hasValidConsent && (
            <div className="p-4 bg-destructive/10 border border-destructive/40 rounded-md" data-testid="alert-gdpr-required">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">GDPR Compliance Required</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    No valid client consent has been recorded. Obtain consent before processing audio.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Recording archived */}
          {caseData.sourceType === 'audio' && hasValidConsent && audioData?.deletedAt && (
            <div className="bg-card border rounded-md p-4 space-y-2" data-testid="card-recording-archived">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-md border bg-muted/50 shrink-0">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <svg viewBox="0 0 200 24" preserveAspectRatio="none" className="w-full h-6" aria-hidden="true" data-testid="waveform-archived">
                    {[0.3,0.5,0.7,0.4,0.9,0.6,0.8,0.35,0.65,0.5,0.85,0.45,0.7,0.55,0.4,0.75,0.3,0.6,0.9,0.5,0.7,0.4,0.85,0.55,0.65,0.3,0.8,0.45,0.6,0.7,0.35,0.5,0.75,0.4,0.9,0.55,0.65,0.8,0.3,0.7].map((h, i) => (
                      <rect key={i} x={i * 5} y={24 - h * 24} width={3.5} height={h * 24} rx={1} className="fill-muted-foreground/25" />
                    ))}
                  </svg>
                </div>
                <Badge variant="secondary" className="text-[10px] shrink-0 no-default-hover-elevate no-default-active-elevate" data-testid="badge-recording-deleted">
                  Deleted
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground" data-testid="text-archived-explanation">
                Original audio securely deleted under 7-day GDPR retention. Transcript and documents remain on file.
              </p>
            </div>
          )}

          {/* No-consent text-only alert */}
          {caseData.sourceType === 'audio' && !hasValidConsent && !consentLoading && !audioLoading && (
            <Alert className="bg-card border-muted" data-testid="alert-no-recording-consent">
              <FileText className="w-4 h-4" />
              <AlertDescription>
                <span className="font-medium">Text notes only — recording consent declined</span>
                <p className="text-sm text-muted-foreground mt-0.5">Client declined audio recording consent.</p>
              </AlertDescription>
            </Alert>
          )}

          {/* Audio player */}
          {showAudioPlayer && (
            <AudioPlayer
              audioUrl={audioData!.filePath!}
              expiresAt={new Date(audioData!.expiresAt)}
              caseId={caseData.id}
              audioRecordingId={audioData!.id}
              playerRef={audioPlayerRef}
            />
          )}

          {/* Processing card */}
          {caseData.status === 'processing' && (
            <div className="p-5 bg-card rounded-md border border-accent/30" data-testid="processing-status-card">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-1.5 bg-accent/20 rounded-md shrink-0">
                  <Bot className="w-5 h-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm">Meeting-to-Matter™ Engine</p>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                  </div>
                  <p className="text-xs text-muted-foreground" data-testid="text-current-step">
                    {processingStatus?.processingMetadata?.currentStep || 'Preparing...'}
                  </p>
                </div>
              </div>
              {processingStatus?.processingMetadata && (
                <div className="space-y-1.5">
                  <Progress value={processingStatus.processingMetadata.progress || 0} className="h-1.5" data-testid="progress-bar" />
                  <p className="text-xs text-muted-foreground" data-testid="text-progress-percentage">
                    {processingStatus.processingMetadata.progress || 0}% complete
                  </p>
                </div>
              )}
              {processingStatus?.processingMetadata?.error && (
                <Alert variant="destructive" className="mt-3" data-testid="alert-processing-error">
                  <AlertDescription>{processingStatus.processingMetadata.error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Failed card */}
          {caseData.status === 'failed' && (
            <div className="p-5 bg-destructive/10 rounded-md border border-destructive/40" data-testid="failed-status-card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-1">Processing Failed</p>
                  <p className="text-sm text-muted-foreground">
                    {(caseData.aiProcessingMetadata as any)?.error || 'An error occurred during processing.'}
                  </p>
                </div>
                <Button onClick={() => retryProcessingMutation.mutate()} disabled={retryProcessingMutation.isPending} variant="destructive" size="sm" className="gap-2 shrink-0" data-testid="button-retry-processing">
                  {retryProcessingMutation.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Retrying...</> : <><RefreshCw className="w-3.5 h-3.5" />Retry</>}
                </Button>
              </div>
            </div>
          )}

          {/* Ready-to-process card */}
          {(caseData.sourceType === 'audio' || caseData.sourceType === 'dictation') && caseData.status === 'pending' && !transcript?.content && (
            <div className="p-5 bg-card rounded-md border border-border" data-testid="ready-to-process-card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-sm mb-1">
                    {caseData.sourceType === 'dictation' ? 'Ready for Processing'
                      : hasValidConsent ? 'Ready for Processing' : 'Consent Required Before Processing'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {caseData.sourceType === 'dictation'
                      ? 'Your dictation is ready to transcribe and produce a telephone attendance note.'
                      : hasValidConsent
                        ? 'Your audio recording is ready to transcribe and produce legal documents.'
                        : 'Valid client consent must be recorded before processing can begin.'}
                  </p>
                </div>
                <Button
                  onClick={() => processAIMutation.mutate()}
                  disabled={processAIMutation.isPending || (caseData.sourceType !== 'dictation' && !hasValidConsent)}
                  className="gap-2 bg-accent hover:bg-accent shrink-0"
                  size="sm"
                  data-testid="button-process-ai"
                >
                  {processAIMutation.isPending
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Processing...</>
                    : <><RefreshCw className="w-3.5 h-3.5" />Process Case</>}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Section content ── */}
        <div
          key={activeSection}
          className="flex-1 px-6 lg:px-8 py-6 animate-in fade-in duration-200"
        >
          {activeSection === 'documents' && (
            <DocumentViewer
              caseId={caseId!}
              documents={documents as any}
              transcript={transcript?.content}
              transcriptUtterances={transcript?.utterances}
              speakerCount={transcript?.speakerCount}
              transcriptRedactions={transcript?.redactions}
              textNotes={caseData.textNotes}
              status={caseData.status}
              caseTitle={caseData.title}
              clientName={caseData.clientName}
              matterReference={caseData.matterReference || undefined}
              createdAt={new Date(caseData.createdAt).toISOString()}
              onTranscriptTimestampClick={handleTranscriptTimestampClick}
              initialTab={urlTab !== 'compliance' ? (urlTab || undefined) : undefined}
              initialTimestamp={urlTimestamp ? parseInt(urlTimestamp, 10) : undefined}
            />
          )}

          {activeSection === 'obligations' && (
            <div className="max-w-3xl">
              <ActionItemsViewer caseId={caseId!} hasTranscript={!!transcript?.content} />
            </div>
          )}

          {activeSection === 'sessions' && (
            <div className="max-w-3xl space-y-4">
              {meetingSessions.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <History className="w-8 h-8 mx-auto text-muted-foreground/40" />
                  <p className="font-medium text-sm">No sessions recorded yet</p>
                  <p className="text-xs text-muted-foreground">Sessions will appear here once a meeting is recorded for this matter.</p>
                </div>
              ) : (
                <div className="space-y-3" data-testid="session-timeline-list">
                  {meetingSessions.map((session, idx) => (
                    <Card key={session.id} className="overflow-hidden" data-testid={`session-item-${session.id}`}>
                      <CardContent className="p-0">
                        <div className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-xs font-semibold text-accent shrink-0 mt-0.5">
                              {meetingSessions.length - idx}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <Badge variant="outline" className="text-xs no-default-hover-elevate no-default-active-elevate" data-testid={`badge-recording-type-${session.id}`}>
                                  {RECORDING_TYPE_LABELS[session.recordingType as RecordingType] || session.recordingType}
                                </Badge>
                                <Badge
                                  variant={session.status === "completed" ? "default" : session.status === "failed" ? "destructive" : "secondary"}
                                  className="text-xs no-default-hover-elevate no-default-active-elevate"
                                  data-testid={`badge-session-status-${session.id}`}
                                >
                                  {toTitleCase(session.status)}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {session.startedAt ? format(new Date(session.startedAt), "d MMM yyyy, HH:mm") : "—"}
                                {session.durationSeconds != null && (
                                  <span className="ml-2">{Math.floor(session.durationSeconds / 60)}m {session.durationSeconds % 60}s</span>
                                )}
                              </p>
                              {session.notes && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{session.notes}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="border-t border-border px-4">
                          <SessionDetails sessionId={session.id} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSection === 'notes' && (
            <div className="max-w-3xl">
              {caseData.textNotes ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-foreground whitespace-pre-wrap leading-relaxed" data-testid="text-quick-notes-content">
                    {caseData.textNotes}
                  </p>
                </div>
              ) : (
                <div className="text-center py-16 space-y-3">
                  <MessageSquarePlus className="w-8 h-8 mx-auto text-muted-foreground/40" />
                  <p className="font-medium text-sm">No notes added yet</p>
                  <p className="text-xs text-muted-foreground">Quick notes appear here. Use the button above to add one.</p>
                  <Button variant="outline" size="sm" onClick={() => setShowAddNoteModal(true)} className="gap-2" data-testid="button-add-note-empty">
                    <Plus className="w-3.5 h-3.5" />
                    Add Note
                  </Button>
                </div>
              )}
            </div>
          )}

          {activeSection === 'briefing' && (
            <div className="max-w-3xl">
              <PreMeetingBriefing caseId={caseId!} hasTranscript={!!transcript?.content} />
            </div>
          )}

          {activeSection === 'time' && (
            <div className="max-w-3xl">
              <TimeEntriesViewer
                caseId={caseId!}
                caseTitle={caseData.title}
                matterReference={caseData.matterReference || undefined}
                durationSeconds={audioData?.duration || undefined}
              />
            </div>
          )}

          {activeSection === 'undertakings' && (
            <div className="max-w-3xl">
              <UndertakingsViewer caseId={caseId!} hasTranscript={!!transcript?.content} />
            </div>
          )}

          {activeSection === 'external-refs' && (
            <div className="max-w-3xl">
              <ExternalDocumentRefs caseId={caseId!} />
            </div>
          )}

          {activeSection === 'linked-calls' && (
            <div className="max-w-3xl space-y-2">
              {linkedDictations.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <Phone className="w-8 h-8 mx-auto text-muted-foreground/40" />
                  <p className="font-medium text-sm">No telephone notes linked</p>
                </div>
              ) : linkedDictations.map(d => (
                <Card key={d.id} className="cursor-pointer hover-elevate" onClick={() => setLocation(`/case/${d.id}`)} data-testid={`linked-call-${d.id}`}>
                  <CardContent className="p-4 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(d.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={d.status === 'completed' || d.status === 'review_required' ? 'secondary' : 'outline'} className="text-xs no-default-hover-elevate no-default-active-elevate">
                        {d.status === 'review_required' ? 'For Review' : d.status === 'completed' ? 'Completed' : d.status === 'processing' ? 'Processing' : 'Pending'}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {activeSection === 'consent' && (
            <div className="max-w-3xl">
              {caseData.sourceType === 'audio' ? (
                <ConsentEvidence caseId={caseId!} audioRecording={audioData} consentLogs={consentLogs} />
              ) : (
                <div className="text-center py-16 space-y-3">
                  <Shield className="w-8 h-8 mx-auto text-muted-foreground/40" />
                  <p className="font-medium text-sm">Consent evidence not applicable</p>
                  <p className="text-xs text-muted-foreground">Consent evidence is only available for audio-recorded matters.</p>
                </div>
              )}
            </div>
          )}

          {activeSection === 'compliance' && (
            <div className="max-w-3xl space-y-4">
              {user?.complianceThread && (
                <AmlTriggerBanner
                  caseData={caseData}
                  onAddMonitoringNote={() => setAutoOpenComplianceNote(prev => prev + 1)}
                />
              )}
              {user?.complianceThread ? (
                <ComplianceThread
                  caseId={caseId!}
                  riskLevel={caseData.riskLevel}
                  clientName={caseData.clientName}
                  autoOpenNoteForm={autoOpenComplianceNote}
                />
              ) : (
                <div className="text-center py-16 space-y-4">
                  <ShieldCheck className="w-10 h-10 mx-auto text-muted-foreground/40" />
                  <div>
                    <p className="font-medium text-sm">Compliance Thread</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      Per-matter AML monitoring, risk assessments, and MLRO decision records. This premium feature requires activation by your account administrator.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="default" size="sm" onClick={() => window.open("https://legalnote.ai/pricing", "_blank")} data-testid="button-upgrade-compliance">
                      <Lock className="w-3.5 h-3.5 mr-1.5" />
                      Upgrade to Enable
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.location.href = "/settings"} data-testid="button-compliance-settings">
                      View Settings
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === 'activity' && (
            <div className="max-w-3xl">
              <CaseTimeline caseId={caseId!} />
            </div>
          )}

          {activeSection === 'sharing' && (
            <div className="max-w-3xl">
              <SharedHistoryViewer caseId={caseId!} />
            </div>
          )}

          {activeSection === 'audit' && (
            <div className="max-w-3xl">
              <AuditTrail caseId={caseId!} limit={50} />
            </div>
          )}
        </div>

        {/* Case metadata footer strip (practice area, care letter, conflict check) */}
        <div className="px-6 lg:px-8 pb-8">
          <div className="flex flex-wrap gap-2 items-center pt-4 border-t border-border">
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
                className={!caseData.practiceArea ? "cursor-pointer" : "no-default-hover-elevate no-default-active-elevate"}
                onClick={() => !caseData.practiceArea && setEditingPracticeArea(true)}
                data-testid="badge-practice-area"
              >
                {caseData.practiceArea
                  ? PRACTICE_AREA_LABELS[caseData.practiceArea as keyof typeof PRACTICE_AREA_LABELS] || caseData.practiceArea
                  : "Set practice area"}
              </Badge>
            )}
            <Badge
              variant="secondary"
              className={cn(
                "no-default-hover-elevate no-default-active-elevate",
                caseData.conflictCheckCompleted
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
              )}
              data-testid="badge-conflict-check"
            >
              <Shield className="w-3 h-3 mr-1" />
              {caseData.conflictCheckCompleted ? "Conflict Check Completed" : "Conflict Check Pending"}
            </Badge>
            {caseData.clientCareLetterId ? (
              <>
                <Badge
                  variant="secondary"
                  className={cn(
                    "no-default-hover-elevate no-default-active-elevate",
                    caseData.clientCareLetterSentAt
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                  )}
                  data-testid="badge-client-care-letter"
                >
                  <FileText className="w-3 h-3 mr-1" />
                  {caseData.clientCareLetterSentAt ? "Client Care Letter Sent" : "Client Care Letter Ready"}
                </Badge>
                {!caseData.clientCareLetterSentAt && (
                  <Button variant="outline" size="sm" onClick={() => setShowSendCareLetterDialog(true)} className="gap-1" data-testid="button-send-care-letter">
                    <Send className="w-3 h-3" />
                    Send to Client
                  </Button>
                )}
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowCareLetterModal(true)} className="gap-1" data-testid="button-generate-care-letter">
                <FileText className="w-3 h-3" />
                Generate Client Care Letter
              </Button>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground ml-auto">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {format(new Date(caseData.createdAt), "dd MMM yyyy")}
              </span>
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {caseData.createdBy}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* ── Modals ── */}
      <AddQuickNoteModal open={showAddNoteModal} onOpenChange={setShowAddNoteModal} caseId={caseId!} />
      <SetPriorityDeadlineModal
        open={showPriorityModal} onOpenChange={setShowPriorityModal} caseId={caseId!}
        caseTitle={caseData.title}
        currentPriority={caseData.priority as "urgent" | "deadline-soon" | "normal" || "normal"}
        currentDeadline={caseData.deadline || null}
        currentDeadlineIsAllDay={caseData.deadlineIsAllDay || false}
      />
      <ShareLinkModal open={showShareModal} onOpenChange={setShowShareModal} caseId={caseId!} caseTitle={caseData.title} userRole="Partner" />
      <DownloadModal
        open={showDownloadModal} onOpenChange={setShowDownloadModal}
        availableDocuments={{
          hasAttendanceNote: !!documents.find((d: any) => d.isActive && d.type === 'attendance_note'),
          hasSummary: !!documents.find((d: any) => d.isActive && d.type === 'summary') || !!caseData.textNotes,
          hasTranscript: !!documents.find((d: any) => d.isActive && d.type === 'transcript') || !!transcript?.content,
        }}
        sharedDocuments={['attendance_note', 'summary', 'transcript']}
        onDownload={handleDownload}
      />
      <ImportRecordingModal open={showImportModal} onOpenChange={setShowImportModal} caseId={caseId!} caseTitle={caseData.title} />
      <LogCallModal open={showLogCallModal} onOpenChange={setShowLogCallModal} caseId={caseId!} caseTitle={caseData.title} clientName={caseData.clientName} clientId={caseData.clientId || undefined} matterReference={caseData.matterReference || undefined} />
      <HandoverModal open={showHandoverModal} onOpenChange={setShowHandoverModal} caseId={caseId!} caseTitle={caseData.title} currentAssignee={caseData.assignedToUserId || undefined} />
      <TimeRecordingModal
        open={showTimeRecordingModal} onOpenChange={setShowTimeRecordingModal}
        caseId={caseId!} caseTitle={caseData.title}
        matterReference={caseData.matterReference || undefined}
        durationSeconds={audioData?.duration || undefined}
        sessionType={caseData.sourceType === 'dictation' ? 'Telephone Attendance' : 'Meeting'}
      />
      <ClientCareLetterModal open={showCareLetterModal} onOpenChange={setShowCareLetterModal} caseId={caseId!} clientName={caseData.clientName} costsEstimate={caseData.costsEstimate} />

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
              <Label htmlFor="send-ccl-email">Recipient Email <span className="text-destructive">*</span></Label>
              <Input
                id="send-ccl-email" type="email" placeholder="client@example.com"
                value={sendEmail} onChange={(e) => setSendEmail(e.target.value)}
                disabled={isSendingCareLetter} data-testid="input-send-ccl-email"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowSendCareLetterDialog(false)} disabled={isSendingCareLetter}>Cancel</Button>
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
              {isSendingCareLetter ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</> : "Send Letter"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
