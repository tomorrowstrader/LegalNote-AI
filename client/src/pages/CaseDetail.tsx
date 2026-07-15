import { useState, useEffect, useRef } from "react";
import { toTitleCase } from "@/lib/utils";
import {
  ArrowLeft, Calendar, User, Shield, Loader2, RefreshCw, Sparkles,
  FileText, Bot, MessageSquarePlus, Plus, MoreVertical, AlertCircle,
  Share2, Eye, Archive, Video, ListChecks, History,
  ScrollText, Focus, X, Phone, Lock, ArrowRightLeft, Clock, Send,
  ShieldCheck, ChevronRight, ChevronDown, ChevronUp, CheckCircle2, Mic, FileCheck,
  ChevronsLeft, ChevronsRight,
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
import { Textarea } from "@/components/ui/textarea";
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
import ImportRecordingModal from "@/components/ImportRecordingModal";
import { LiveBotModal } from "@/components/LiveBotModal";
import LogCallModal from "@/components/LogCallModal";
import ComplianceThread from "@/components/ComplianceThread";
import AmlTriggerBanner from "@/components/AmlTriggerBanner";
import SharedHistoryViewer from "@/components/SharedHistoryViewer";
import ActionItemsViewer from "@/components/ActionItemsViewer";
import PreMeetingBriefing from "@/components/PreMeetingBriefing";
import HandoverModal from "@/components/HandoverModal";
import NewSessionModal from "@/components/NewSessionModal";
import ExternalDocumentRefs from "@/components/ExternalDocumentRefs";
import TimeEntriesViewer from "@/components/TimeEntriesViewer";
import TimeRecordingModal from "@/components/TimeRecordingModal";
import ClientCareLetterModal from "@/components/ClientCareLetterModal";
import UndertakingsViewer from "@/components/UndertakingsViewer";
import SupervisionSection from "@/components/SupervisionSection";
import LitigationHoldSection from "@/components/LitigationHoldSection";
import { useLocation, useParams, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCaseActions } from "@/hooks/useCaseActions";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import type { Case, AudioRecording, ConsentLog, MeetingSession, Transcript, Document } from "@shared/schema";
import { RECORDING_TYPE_LABELS, type RecordingType } from "@shared/schema";
import { PRACTICE_AREA_LABELS, PRACTICE_AREAS, type PracticeArea } from "@shared/schema";
import { CONSENT_DISCLAIMER_TEXT, CONSENT_DISCLAIMER_VERSION } from "@shared/consent";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isFeatureVisible } from "@/lib/features";

const amlComplianceVisible = isFeatureVisible("amlCompliance");
const sraReadinessVisible = isFeatureVisible("sraReadiness");
const supervisionVisible = isFeatureVisible("supervision");
const externalReferencesVisible = isFeatureVisible("externalReferences");

interface SessionTranscript extends Omit<Transcript, 'utterances'> {
  utterances: Array<{ speaker: string; text: string; start: number; end: number }> | null;
}

interface SessionWithDetails extends MeetingSession {
  transcript: SessionTranscript | null;
  documents: Document[];
}

type CaseSection =
  | "documents" | "obligations" | "sessions" | "notes" | "briefing"
  | "time" | "undertakings" | "external-refs" | "linked-calls"
  | "consent" | "compliance" | "litigation-hold" | "activity" | "sharing" | "audit" | "supervision";

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
  "litigation-hold": "Litigation Hold",
  activity: "Activity Timeline",
  sharing: "Sharing History",
  audit: "Audit Trail",
  supervision: "Supervision",
};

const PROCESSING_PROGRESS_MILESTONES = [10, 20, 25, 35, 40, 50, 60, 75, 100];
const INITIAL_PROGRESS = 3;
const CREEP_EASE_FACTOR = 0.06;
const CREEP_MIN_INCREMENT = 0.03;

function getNextProcessingMilestone(progress: number): number {
  for (const milestone of PROCESSING_PROGRESS_MILESTONES) {
    if (milestone > progress) return milestone;
  }
  return 100;
}

function getProcessingCreepCap(realProgress: number): number {
  if (realProgress >= 100) return 100;
  // During transcription (below doc-gen at 40%), creep toward 39 for visible motion
  if (realProgress < 40) {
    const docGenMilestone = PROCESSING_PROGRESS_MILESTONES.find((m) => m >= 40);
    if (docGenMilestone) return docGenMilestone - 1;
  }
  let next = getNextProcessingMilestone(realProgress);
  if (next - realProgress <= 5) {
    const further = getNextProcessingMilestone(next);
    if (further > next) next = further;
  }
  return next - 1;
}

function SessionDetails({ sessionId, caseId, onOpenAttendanceNote, litigationHold, litigationHoldReason }: { sessionId: string; caseId: string; onOpenAttendanceNote: () => void; litigationHold?: boolean; litigationHoldReason?: string | null }) {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<SessionWithDetails>({
    queryKey: ['/api/sessions', sessionId],
  });

  const { data: sessionAudio } = useQuery<{ id: string; filePath: string | null; deletedAt: string | null; expiresAt: string | null; duration?: number | null } | undefined>({
    queryKey: [`/api/audio/by-session/${sessionId}`],
    enabled: !!sessionId,
  });

  const generateDocsMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/cases/${caseId}/process`, { sessionId }),
    onSuccess: () => {
      toast({ title: "Documents generated", description: "Session documents are being produced.", duration: 5000 });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/documents`] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to generate documents", description: error.message || "Please try again.", variant: "destructive", duration: 5000 });
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading session details...
      </div>
    );
  }

  if (!data) return null;

  const sessionDocuments = data.documents;
  const activeDocuments = sessionDocuments.filter(d => d.isActive);
  const activeAttendanceNote = activeDocuments.find(d => d.type === 'attendance_note' || d.type === 'meeting_notes');
  const inactiveCount = sessionDocuments.filter(d => !d.isActive).length;
  const sessionIsPending = data.status === "pending" || data.status === "processing";

  return (
    <div className="p-4 space-y-4" data-testid={`session-details-${sessionId}`}>
      {/* Audio */}
      <div className="space-y-1.5" data-testid="audio-player-container">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Audio</p>
        {sessionAudio ? (
          sessionAudio.deletedAt ? (
            <p className="text-xs text-muted-foreground italic" data-testid={`session-audio-deleted-${sessionId}`}>
              Recording securely deleted{sessionAudio.expiresAt ? ` · retained until ${format(new Date(sessionAudio.expiresAt), "d MMM yyyy")}` : ""}
            </p>
          ) : sessionAudio.filePath ? (
            <AudioPlayer
              audioUrl={`/api/audio/${sessionAudio.id}/stream`}
              expiresAt={sessionAudio.expiresAt ? new Date(sessionAudio.expiresAt) : null}
              caseId={caseId}
              audioRecordingId={sessionAudio.id}
              knownDurationSeconds={sessionAudio.duration ?? undefined}
              litigationHold={litigationHold}
              litigationHoldReason={litigationHoldReason}
            />
          ) : (
            <p className="text-xs text-muted-foreground">Audio not yet available.</p>
          )
        ) : (
          <p className="text-xs text-muted-foreground">No audio recording linked to this session.</p>
        )}
      </div>

      {/* Transcript */}
      <div className="space-y-1.5" data-testid="session-transcript-preview">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Transcript</p>
        {sessionIsPending && !data.transcript ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid={`session-transcript-pending-${sessionId}`}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Transcript is being processed…
          </div>
        ) : data.transcript ? (() => {
          const utterances = data.transcript.utterances;
          const hasUtterances = Array.isArray(utterances) && utterances.length > 0;
          return (
            <div className="max-h-48 overflow-y-auto rounded-md bg-muted/30 p-3 text-xs space-y-2" data-testid={`session-transcript-${sessionId}`}>
              {hasUtterances ? utterances!.map((u, i) => (
                <div key={i} className="flex gap-2">
                  <span className="font-semibold text-accent shrink-0 w-16 truncate">{u.speaker}</span>
                  <span className="leading-relaxed text-foreground/80">{u.text}</span>
                </div>
              )) : (
                <p className="leading-relaxed whitespace-pre-wrap text-foreground/80">{data.transcript!.content}</p>
              )}
            </div>
          );
        })() : (
          <p className="text-xs text-muted-foreground">No transcript for this session.</p>
        )}
      </div>

      {/* Documents */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Documents</p>
          {data.transcript && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => generateDocsMutation.mutate()}
              disabled={generateDocsMutation.isPending}
              data-testid={`button-generate-docs-${sessionId}`}
              className="gap-1.5"
            >
              {generateDocsMutation.isPending
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating…</>
                : <><FileText className="w-3.5 h-3.5" />{activeDocuments.length > 0 ? "Regenerate" : "Generate documents"}</>}
            </Button>
          )}
        </div>
        {activeAttendanceNote ? (
          <div className="space-y-1.5">
            <Button
              size="sm"
              variant="default"
              onClick={onOpenAttendanceNote}
              data-testid={`button-open-attendance-note-${sessionId}`}
              className="gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              {activeAttendanceNote?.type === 'meeting_notes' ? 'Open Meeting Notes' : 'Open Attendance Note'}
            </Button>
            {inactiveCount > 0 && (
              <p className="text-xs text-muted-foreground" data-testid={`text-older-versions-${sessionId}`}>
                {inactiveCount} previous {inactiveCount === 1 ? "version" : "versions"}
              </p>
            )}
          </div>
        ) : activeDocuments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No documents linked to this session.</p>
        ) : null}
        <button
          onClick={onOpenAttendanceNote}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 underline-offset-2 hover:underline"
          data-testid={`link-view-all-session-docs-${sessionId}`}
        >
          View all documents for this session
        </button>
      </div>
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [showLiveBotModal, setShowLiveBotModal] = useState(false);
  const [showLogCallModal, setShowLogCallModal] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showTimeRecordingModal, setShowTimeRecordingModal] = useState(false);
  const [showCareLetterModal, setShowCareLetterModal] = useState(false);
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [focusSessionId, setFocusSessionId] = useState<string | null>(null);
  const [showSendCareLetterDialog, setShowSendCareLetterDialog] = useState(false);
  const [sendEmail, setSendEmail] = useState("");
  const [isSendingCareLetter, setIsSendingCareLetter] = useState(false);
  const [editingPracticeArea, setEditingPracticeArea] = useState(false);
  const [showReadinessPanel, setShowReadinessPanel] = useState(false);
  const [isCompilingReport, setIsCompilingReport] = useState(false);
  const [showConflictCheckDialog, setShowConflictCheckDialog] = useState(false);
  const [conflictCheckOutcome, setConflictCheckOutcome] = useState<"no_conflict" | "conflict_managed">("no_conflict");
  const [conflictCheckNotes, setConflictCheckNotes] = useState("");

  // Missing-consent banner state
  const [showConfirmVerbalConsentDialog, setShowConfirmVerbalConsentDialog] = useState(false);
  const [consentDialogMode, setConsentDialogMode] = useState<'bot' | 'direct'>('bot');
  const [showScriptInBanner, setShowScriptInBanner] = useState(false);
  const [showSendConsentLinkBanner, setShowSendConsentLinkBanner] = useState(false);
  const [bannerConsentLinkContact, setBannerConsentLinkContact] = useState("");
  const [bannerConsentLinkName, setBannerConsentLinkName] = useState("");
  const [bannerConsentLinkSent, setBannerConsentLinkSent] = useState(false);

  const timeRecordingKey = `timeRecordingPrompted_${params.id}`;
  const [hasPromptedTimeRecording, setHasPromptedTimeRecording] = useState(() => {
    return localStorage.getItem(timeRecordingKey) === 'true';
  });
  useEffect(() => {
    setHasPromptedTimeRecording(localStorage.getItem(timeRecordingKey) === 'true');
  }, [timeRecordingKey]);

  const [isDemoJustRevealed, setIsDemoJustRevealed] = useState(() => {
    const flag = localStorage.getItem("legalnote_demo_case_just_revealed") === "1";
    if (flag) localStorage.removeItem("legalnote_demo_case_just_revealed");
    return flag;
  });
  const [showDemoJustProducedBadge, setShowDemoJustProducedBadge] = useState(false);
  const demoJustProducedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { user } = useAuth();
  const audioPlayerRef = useRef<AudioPlayerHandle>(null);
  const [hasAutoSeeked, setHasAutoSeeked] = useState(false);

  const searchParams = new URLSearchParams(search);
  const urlTab = searchParams.get('tab') as 'attendance' | 'summary' | 'transcript' | 'compliance' | null;
  const urlTimestamp = searchParams.get('timestamp');
  const urlSessionId = searchParams.get('sessionId');

  const [activeSection, setActiveSection] = useState<CaseSection>(() => {
    if (urlTab === 'compliance' && amlComplianceVisible) return 'compliance';
    return 'documents';
  });

  useEffect(() => {
    if (urlTab === 'compliance' && amlComplianceVisible) {
      setActiveSection('compliance');
    } else if (urlTab === 'compliance' && !amlComplianceVisible) {
      setActiveSection('documents');
    }
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
    content: string; version: number; createdAt: string; isActive?: boolean;
    meetingSessionId?: string | null;
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

  const realProcessingProgress = processingStatus?.processingMetadata?.progress ?? 0;
  const [displayProgress, setDisplayProgress] = useState(INITIAL_PROGRESS);
  const realProgressRef = useRef(0);
  const displayProgressRef = useRef(INITIAL_PROGRESS);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    realProgressRef.current = realProcessingProgress;
    if (realProcessingProgress >= 100) {
      displayProgressRef.current = 100;
      setDisplayProgress(100);
    } else if (realProcessingProgress > displayProgressRef.current) {
      displayProgressRef.current = realProcessingProgress;
      setDisplayProgress(realProcessingProgress);
    }
  }, [realProcessingProgress]);

  useEffect(() => {
    if (caseData?.status !== "processing") {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      displayProgressRef.current = 0;
      setDisplayProgress(0);
      return;
    }

    displayProgressRef.current = INITIAL_PROGRESS;
    setDisplayProgress(INITIAL_PROGRESS);
    realProgressRef.current = realProcessingProgress;

    const animate = () => {
      const real = realProgressRef.current;
      let display = displayProgressRef.current;

      if (real >= 100) {
        display = 100;
      } else if (real > display) {
        display = real;
      } else {
        const cap = getProcessingCreepCap(real);
        if (display < cap) {
          const delta = (cap - display) * CREEP_EASE_FACTOR;
          display = display + Math.max(delta, CREEP_MIN_INCREMENT);
          display = Math.min(display, cap);
        }
        display = Math.min(display, 99);
      }

      display = Math.max(display, real);

      if (display !== displayProgressRef.current) {
        displayProgressRef.current = display;
        setDisplayProgress(display);
      }

      rafIdRef.current = requestAnimationFrame(animate);
    };

    rafIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [caseData?.status]);

  const { data: meetingSessions = [] } = useQuery<MeetingSession[]>({
    queryKey: [`/api/cases/${caseId}/sessions`],
    enabled: !!caseId,
  });

  type ReadinessCriterion = { key: string; label: string; status: "green" | "amber" | "red"; detail: string; sraRef: string; actionRoute: string | null; externalNote: string | null };
  type ReadinessData = { overall: "green" | "amber" | "red"; outstandingCount: number; criteria: ReadinessCriterion[]; disclaimer: string };
  const { data: sraReadiness, isLoading: readinessLoading } = useQuery<ReadinessData>({
    queryKey: [`/api/cases/${caseId}/sra-readiness`],
    enabled: !!caseId && sraReadinessVisible,
  });

  const [showSraReportModal, setShowSraReportModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("legalnote-case-sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("legalnote-case-sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  type SraReportPreview = {
    sections: {
      matterOverview: { clientName: string | null; matterRef: string | null; practiceArea: string | null };
      aml: { riskLevel: string | null; notesCount: number; decisionsCount: number };
      clientCare: { hasCareLetter: boolean; hasConsent: boolean; consentCount: number };
      communications: { sessionCount: number; noteCount: number; totalDurationSeconds: number };
      obligationsAndUndertakings: { obligationCount: number; undertakingCount: number; outstandingCount: number };
      documents: { documentCount: number };
      timeRecording: { entryCount: number; totalMinutes: number };
      dataProtection: { consentCount: number; dsarCount: number };
      supervision: { supervisor: string | null };
      auditTrail: { entryCount: number };
    };
    disclaimer: string;
  };
  const { data: sraReportPreview, isLoading: previewLoading } = useQuery<SraReportPreview>({
    queryKey: [`/api/cases/${caseId}/sra-report/preview`],
    enabled: !!caseId && showSraReportModal,
  });

  type LiveImport = { importId: string; botId: string | null; status: string; botStatus: string | null; errorMessage: string | null; createdAt: string; consentMode?: string; consentConfirmed?: boolean };
  const liveImportConsecutive429Ref = useRef(0);
  const liveImportPollIntervalRef = useRef(20000);

  const liveImportQueryFn = async (): Promise<LiveImport | null> => {
    const res = await fetch(`/api/cases/${caseId}/live-import`, { credentials: 'include' });
    if (res.status === 429) {
      liveImportConsecutive429Ref.current += 1;
      // First 429 → 30s, subsequent → double up to 60s
      liveImportPollIntervalRef.current = liveImportConsecutive429Ref.current === 1
        ? 30000
        : Math.min(liveImportPollIntervalRef.current * 2, 60000);
      const err = Object.assign(new Error('429: Too Many Requests'), { status: 429 });
      throw err;
    }
    if (!res.ok) {
      const text = (await res.text()) || res.statusText;
      throw new Error(`${res.status}: ${text}`);
    }
    // Reset backoff on successful response
    liveImportConsecutive429Ref.current = 0;
    liveImportPollIntervalRef.current = 20000;
    return res.json();
  };

  const { data: liveImport, refetch: refetchLiveImport } = useQuery<LiveImport | null>({
    queryKey: [`/api/cases/${caseId}/live-import`],
    enabled: !!caseId,
    queryFn: liveImportQueryFn,
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      if (liveImportConsecutive429Ref.current >= 3) return false;
      const shouldPoll =
        ['live', 'pending', 'transcribing'].includes(data.status) ||
        (['transcribing', 'completed', 'failed'].includes(data.status) && data.consentMode === 'in_meeting' && !data.consentConfirmed);
      if (!shouldPoll) return false;
      return liveImportPollIntervalRef.current;
    },
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
  const hasDeclinedConsent = consentLogs.some(log => log.consentGiven === false);
  const hasMissingAudio =
    caseData?.sourceType === 'audio' &&
    !audioLoading &&
    !!audioData &&
    !audioData.filePath &&
    !audioData.deletedAt;

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

  const processImportMutation = useMutation({
    mutationFn: async (importId: string) => apiRequest("POST", `/api/recall/import/${importId}/process`, {}),
    onSuccess: () => {
      toast({ title: "Processing started", description: "The recording is being transcribed. This may take a few minutes.", duration: 7000 });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/live-import`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });
    },
    onError: (error: any) => {
      toast({ title: "Could not start processing", description: error.message || "Please try again.", variant: "destructive" });
    },
  });

  // Confirm verbal consent post-meeting (from missing-consent bot banner — requires importId)
  const confirmBannerConsentMutation = useMutation({
    mutationFn: async () => {
      if (!liveImport?.importId) throw new Error("No import found");
      return apiRequest("PATCH", `/api/recall/import/${liveImport.importId}/consent`, {
        userConfirmsVerbalConsent: true,
        consentSource: 'post_meeting_confirm',
      });
    },
    onSuccess: () => {
      toast({ title: "Consent recorded", description: "Verbal consent has been logged in the audit trail.", duration: 5000 });
      setShowConfirmVerbalConsentDialog(false);
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/live-import`] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to record consent", description: error.message || "Please try again.", variant: "destructive" });
    },
  });

  // Record verbal consent directly for audio cases (from GDPR banner — no importId needed)
  const recordDirectConsentMutation = useMutation({
    mutationFn: async (consentGiven: boolean) => {
      return apiRequest("POST", `/api/consent`, {
        caseId,
        consentGiven,
        disclaimerScriptVersion: CONSENT_DISCLAIMER_VERSION,
        consentModality: 'verbal_attested',
        disclaimerWordingText: CONSENT_DISCLAIMER_TEXT,
        audioRecordingId: audioData?.id,
      });
    },
    onSuccess: (_data, consentGiven) => {
      toast({
        title: consentGiven ? "Consent recorded" : "Declined recorded",
        description: consentGiven
          ? "Client consent has been logged in the audit trail."
          : "Client's decline has been recorded.",
        duration: 5000,
      });
      setShowConfirmVerbalConsentDialog(false);
      queryClient.invalidateQueries({ queryKey: [`/api/consent/by-case/${caseId}`] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to record consent", description: error.message || "Please try again.", variant: "destructive" });
    },
  });

  // Send consent link from CaseDetail banner
  const sendBannerConsentLinkMutation = useMutation({
    mutationFn: async () => {
      if (!liveImport?.importId) throw new Error("No import found");
      const contact = bannerConsentLinkContact.trim();
      const isEmail = contact.includes("@");
      return apiRequest("POST", `/api/recall/import/${liveImport.importId}/send-consent-link`, {
        ...(isEmail ? { contactEmail: contact } : { contactMobile: contact }),
        contactName: bannerConsentLinkName || undefined,
        source: 'post_meeting_banner',
      });
    },
    onSuccess: () => {
      setBannerConsentLinkSent(true);
      toast({ title: "Consent link sent", description: `A consent confirmation link has been sent to ${bannerConsentLinkContact}.`, duration: 5000 });
    },
    onError: (error: any) => {
      toast({ title: "Failed to send consent link", description: error.message || "Please check the email address and try again.", variant: "destructive" });
    },
  });

  const { markReviewedMutation, archiveMutation } = useCaseActions({
    caseId: caseId!,
    onArchiveSuccess: () => setLocation('/'),
  });

  const [piPackLoading, setPiPackLoading] = useState(false);

  const handlePiPackDownload = async () => {
    if (!caseId || piPackLoading) return;
    setPiPackLoading(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/pi-pack`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch PI pack');
      const pack = await response.json();

      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 18;
      const contentW = pageW - margin * 2;
      let y = margin;

      const addText = (text: string, size: number, bold = false, color: [number, number, number] = [26, 26, 26]) => {
        doc.setFontSize(size);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setTextColor(...color);
        const lines = doc.splitTextToSize(text, contentW);
        if (y + lines.length * size * 0.35 > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(lines, margin, y);
        y += lines.length * size * 0.45 + 2;
      };

      const addLine = () => {
        doc.setDrawColor(200, 190, 180);
        doc.line(margin, y, pageW - margin, y);
        y += 4;
      };

      // Header
      doc.setFillColor(139, 69, 19);
      doc.rect(0, 0, pageW, 12, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('PI DEFENCE PACK — CONFIDENTIAL', margin, 8);
      doc.text(`Produced: ${new Date(pack.generatedAt).toLocaleDateString('en-GB')}`, pageW - margin, 8, { align: 'right' });
      y = 20;

      addText('PI DEFENCE PACK', 18, true, [139, 69, 19]);
      addText(pack.matter.title, 14, true);
      if (pack.firm?.firmName) addText(pack.firm.firmName, 10, false, [100, 90, 80]);
      y += 3;
      addLine();

      addText('Matter Details', 12, true);
      if (pack.matter.matterReference) addText(`Reference: ${pack.matter.matterReference}`, 9);
      if (pack.matter.practiceArea) addText(`Practice area: ${pack.matter.practiceArea.replace(/_/g, ' ')}`, 9);
      if (pack.matter.clientName) addText(`Client: ${pack.matter.clientName}`, 9);
      if (pack.matter.createdAt) addText(`Matter opened: ${new Date(pack.matter.createdAt).toLocaleDateString('en-GB')}`, 9);
      if (pack.matter.riskLevel) addText(`AML risk: ${pack.matter.riskLevel.toUpperCase()}`, 9);
      y += 2; addLine();

      addText('Sessions', 12, true);
      for (const s of pack.sessions) {
        const label = `${s.recordingType?.replace(/_/g, ' ') ?? 'Session'}${s.sessionTitle ? ` — ${s.sessionTitle}` : ''}`;
        const when = s.startedAt ? new Date(s.startedAt).toLocaleDateString('en-GB') : 'Date not recorded';
        addText(`${when}: ${label}`, 9);
      }
      if (pack.sessions.length === 0) addText('No sessions recorded.', 9, false, [120, 110, 100]);
      y += 2; addLine();

      addText('Consent', 12, true);
      for (const c of pack.consentLog) {
        addText(`${c.consentGiven ? 'Consent given' : 'Consent not given'} (${c.consentModality ?? 'verbal'}) — ${c.consentTimestamp ? new Date(c.consentTimestamp).toLocaleDateString('en-GB') : 'Date not recorded'}`, 9);
      }
      if (pack.consentLog.length === 0) addText('No consent log entries.', 9, false, [120, 110, 100]);
      y += 2; addLine();

      addText('Documents', 12, true);
      for (const d of pack.documents) {
        addText(`${d.type?.replace(/_/g, ' ') ?? 'Document'} — created ${d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-GB') : 'unknown'}`, 9);
      }
      if (pack.documents.length === 0) addText('No documents on record.', 9, false, [120, 110, 100]);
      y += 2; addLine();

      addText('Audit Highlights', 12, true);
      for (const a of pack.auditHighlights.slice(0, 20)) {
        addText(`${a.timestamp ? new Date(a.timestamp).toLocaleDateString('en-GB') : ''} — ${a.eventType ?? ''}: ${a.description ?? ''}`, 8, false, [80, 70, 60]);
      }
      y += 4;
      addLine();

      addText(pack.disclaimer, 8, false, [120, 110, 100]);

      doc.save(`PI-Defence-Pack-${pack.matter.title.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
    } catch (err: any) {
      console.error('PI pack error:', err);
    } finally {
      setPiPackLoading(false);
    }
  };

  const recordConflictCheckMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/cases/${caseId}/conflict-check`, {
        outcome: conflictCheckOutcome,
        notes: conflictCheckNotes || undefined,
        datePerformed: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      toast({ title: "Conflict check recorded", description: "The conflict of interest check has been recorded.", duration: 4000 });
      setShowConflictCheckDialog(false);
      setConflictCheckNotes("");
      setConflictCheckOutcome("no_conflict");
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/sra-readiness`] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to record conflict check", description: error.message || "Please try again.", variant: "destructive" });
    },
  });

  const compileSraReport = async () => {
    if (!caseId || isCompilingReport) return;
    setIsCompilingReport(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/sra-report`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SRA-Matter-Report-${caseId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Report compiled", description: "SRA Matter Report has been downloaded.", duration: 5000 });
    } catch (err: any) {
      toast({ title: "Report failed", description: err.message || "Could not compile report.", variant: "destructive", duration: 6000 });
    } finally {
      setIsCompilingReport(false);
    }
  };

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
    {
      id: 'documents', label: 'Documents', icon: FileText,
      badge: isDemoJustRevealed
        ? <Badge variant="secondary" className="text-[10px] h-4 px-1 no-default-hover-elevate no-default-active-elevate animate-pulse">2</Badge>
        : undefined,
    },
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
    { id: 'external-refs', label: 'External References', icon: FileText, show: externalReferencesVisible },
    { id: 'linked-calls', label: 'Telephone Notes', icon: Phone, show: linkedDictations.length > 0, badge: linkedDictations.length > 0 ? <Badge variant="secondary" className="text-[10px] h-4 px-1 no-default-hover-elevate no-default-active-elevate">{linkedDictations.length}</Badge> : undefined },
  ].filter(item => item.show !== false);

  const complianceNavItems: { id: string; label: string; icon: any; badge?: React.ReactNode; show?: boolean }[] = [
    { id: 'consent', label: 'Consent Evidence', icon: Shield, show: caseData.sourceType === 'audio' },
    {
      id: 'compliance', label: 'Compliance Thread', icon: ShieldCheck,
      show: amlComplianceVisible,
      badge: caseData.riskLevel
        ? <Badge className={cn("text-[10px] h-4 px-1 no-default-hover-elevate no-default-active-elevate", riskColors[caseData.riskLevel] || '')}>{(caseData.riskLevel as string).toUpperCase()}</Badge>
        : undefined,
    },
    { id: 'supervision', label: 'Supervision', icon: ShieldCheck, show: supervisionVisible },
    {
      id: 'litigation-hold',
      label: 'Litigation Hold',
      icon: Lock,
      badge: caseData.litigationHold
        ? <Badge variant="destructive" className="text-[10px] h-4 px-1 no-default-hover-elevate no-default-active-elevate">Hold</Badge>
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
          if (item.id === 'documents' && isDemoJustRevealed) {
            setIsDemoJustRevealed(false);
            setShowDemoJustProducedBadge(true);
            if (demoJustProducedTimerRef.current) clearTimeout(demoJustProducedTimerRef.current);
            demoJustProducedTimerRef.current = setTimeout(() => setShowDemoJustProducedBadge(false), 5000);
          }
        }}
        title={sidebarCollapsed ? item.label : undefined}
        className={cn(
          "relative w-full flex items-center rounded-md text-sm transition-colors duration-150 text-left group",
          sidebarCollapsed ? "justify-center px-2 py-2.5" : "gap-2.5 px-3 py-2",
          isActive
            ? "bg-accent/10 text-accent font-medium"
            : "text-foreground/70 hover:text-foreground hover-elevate"
        )}
        data-testid={`nav-${item.id}`}
        aria-label={item.label}
      >
        {isActive && (
          <span className={cn(
            "absolute top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent rounded-r",
            sidebarCollapsed ? "left-0" : "left-0",
          )} />
        )}
        <Icon className={cn("w-4 h-4 shrink-0", isCompliance && !isActive ? "text-muted-foreground" : isActive ? "text-accent" : "text-muted-foreground group-hover:text-foreground")} />
        {!sidebarCollapsed && <span className="flex-1 truncate text-xs">{item.label}</span>}
        {!sidebarCollapsed && item.badge}
        {sidebarCollapsed && item.badge && (
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-destructive" aria-hidden />
        )}
      </button>
    );
  };

  const mobileNavItems = [...matterNavItems, ...complianceNavItems];

  const showAudioPlayer = caseData.sourceType === 'audio' && (audioData?.filePath || audioData?.deletedAt);

  const sharedCaseActionsGroup = (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-case-actions">
            <MoreVertical className="w-3.5 h-3.5" />
            Case Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => setShowLiveBotModal(true)} data-testid="button-join-with-bot">
            <Video className="w-4 h-4 mr-2" />
            Join with LegalNote
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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
          <DropdownMenuItem onClick={handlePiPackDownload} disabled={piPackLoading} data-testid="action-pi-pack">
            {piPackLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileCheck className="w-4 h-4 mr-2" />}
            PI Defence Pack
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowHandoverModal(true)} data-testid="action-handover">
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            Handover Case
          </DropdownMenuItem>
          {sraReadinessVisible && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowSraReportModal(true)} data-testid="action-sra-report">
                <ShieldCheck className="w-4 h-4 mr-2" />
                Prepare SRA Matter Report
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => archiveMutation.mutate(true)} className="text-destructive focus:text-destructive" data-testid="action-archive">
            <Archive className="w-4 h-4 mr-2" />
            Archive Case
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const sectionActions: Partial<Record<CaseSection, React.ReactNode>> = {
    documents: sharedCaseActionsGroup,
    obligations: sharedCaseActionsGroup,
    briefing: sharedCaseActionsGroup,
    compliance: sharedCaseActionsGroup,
    consent: sharedCaseActionsGroup,
    supervision: sharedCaseActionsGroup,
    "litigation-hold": sharedCaseActionsGroup,
    activity: sharedCaseActionsGroup,
    sharing: sharedCaseActionsGroup,
    audit: sharedCaseActionsGroup,
    "external-refs": sharedCaseActionsGroup,
    undertakings: sharedCaseActionsGroup,
    "linked-calls": sharedCaseActionsGroup,
    sessions: (
      <Button size="sm" onClick={() => setShowNewSessionModal(true)} className="gap-1.5" data-testid="button-record-new-session">
        <Mic className="w-3.5 h-3.5" />
        Record New Session
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
    <div className={cn("flex bg-background overflow-x-hidden", isFocusMode ? "min-h-screen" : "h-[calc(100vh-4rem)]")}>
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
          className={cn(
            "hidden lg:flex shrink-0 border-r border-border bg-muted/20 flex-col sticky top-0 self-start h-[calc(100vh-4rem)] overflow-y-auto z-40 transition-[width] duration-200",
            sidebarCollapsed ? "w-14" : "w-[220px]",
          )}
          data-testid="case-side-nav"
        >
          {/* Back link + collapse toggle */}
          <div className={cn("pt-4 pb-2 flex items-center", sidebarCollapsed ? "px-1.5 flex-col gap-1" : "px-4 justify-between gap-2")}>
            {!sidebarCollapsed && (
              <button
                onClick={() => setLocation('/')}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
                data-testid="link-back-all-cases"
              >
                <ArrowLeft className="w-3 h-3" />
                All Cases
              </button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={toggleSidebarCollapsed}
              title={sidebarCollapsed ? "Expand menu" : "Collapse menu"}
              data-testid="button-toggle-case-sidebar"
            >
              {sidebarCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
            </Button>
          </div>

          {/* Case identity */}
          {!sidebarCollapsed && (
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
              {amlComplianceVisible && caseData.riskLevel && (
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
              {sraReadinessVisible && !readinessLoading && sraReadiness && (
                <button
                  onClick={() => setShowReadinessPanel(prev => !prev)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium border transition-colors duration-150",
                    sraReadiness.overall === "green" && "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
                    sraReadiness.overall === "amber" && "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
                    sraReadiness.overall === "red" && "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
                  )}
                  data-testid="badge-sra-readiness"
                >
                  <ShieldCheck className="w-2.5 h-2.5" />
                  {sraReadiness.overall === "green"
                    ? "SRA Ready"
                    : sraReadiness.overall === "amber"
                    ? `SRA Amber (${sraReadiness.outstandingCount})`
                    : `SRA Attention (${sraReadiness.outstandingCount})`}
                </button>
              )}
              {caseData.litigationHold && (
                <Badge
                  variant="destructive"
                  className="gap-1 bg-red-600 hover:bg-red-700 dark:bg-red-800"
                  data-testid="badge-litigation-hold"
                >
                  <Lock className="w-3 h-3" />
                  LITIGATION HOLD
                </Badge>
              )}
            </div>
            {sraReadinessVisible && showReadinessPanel && sraReadiness && (
              <div className="mt-3 rounded-md border border-border bg-background p-3 space-y-2" data-testid="panel-sra-readiness">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Compliance Readiness</p>
                  <button onClick={() => setShowReadinessPanel(false)} className="text-muted-foreground hover:text-foreground" data-testid="button-close-readiness-panel">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                {sraReadiness.criteria.map((c) => (
                  <div key={c.key} className="flex items-start gap-2" data-testid={`readiness-criterion-${c.key}`}>
                    <span className={cn(
                      "mt-0.5 w-2 h-2 rounded-full shrink-0",
                      c.status === "green" && "bg-green-500",
                      c.status === "amber" && "bg-amber-500",
                      c.status === "red" && "bg-red-500",
                    )} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-medium text-foreground leading-tight">{c.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{c.detail}</p>
                      {c.sraRef && (
                        <p className="text-[9px] text-muted-foreground/70 leading-tight mt-0.5 font-mono">{c.sraRef}</p>
                      )}
                      {c.externalNote && c.status !== "green" && (
                        <p className="text-[9px] text-muted-foreground/60 leading-tight mt-0.5 italic">{c.externalNote}</p>
                      )}
                      {c.status !== "green" && c.key === "conflict_check" && (
                        <button
                          onClick={() => { setShowReadinessPanel(false); setShowConflictCheckDialog(true); }}
                          className="mt-1 text-[9px] font-medium text-accent underline-offset-2 underline"
                          data-testid="link-readiness-action-conflict-check"
                        >
                          Record conflict check
                        </button>
                      )}
                      {c.status !== "green" && c.actionRoute && c.key !== "conflict_check" && (
                        <a
                          href={c.actionRoute}
                          className="mt-1 inline-block text-[9px] font-medium text-accent underline-offset-2 underline"
                          data-testid={`link-readiness-action-${c.key}`}
                        >
                          Go to {c.label.toLowerCase()}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {sraReadiness.disclaimer && (
                  <p className="text-[9px] text-muted-foreground/60 leading-tight pt-1 border-t border-border" data-testid="text-readiness-disclaimer">
                    {sraReadiness.disclaimer}
                  </p>
                )}
                <button
                  onClick={() => { setShowReadinessPanel(false); setShowSraReportModal(true); }}
                  className="mt-1 w-full flex items-center justify-center gap-1.5 text-[10px] font-medium text-accent hover:text-accent/80 transition-colors duration-150 py-1"
                  data-testid="button-open-report-modal-from-panel"
                >
                  <FileText className="w-3 h-3" />
                  Prepare SRA Matter Report
                </button>
              </div>
            )}
          </div>
          )}

          {/* Matter nav */}
          <nav className={cn("flex-1 py-2 space-y-0.5", sidebarCollapsed ? "px-1" : "px-2")} aria-label="Matter sections">
            {matterNavItems.map(item => <NavItem key={item.id} item={item} />)}

            {/* Compliance divider */}
            <div className={cn("pt-4 pb-1", sidebarCollapsed ? "px-1 flex justify-center" : "px-3")}>
              {sidebarCollapsed ? (
                <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" aria-label="Compliance" />
              ) : (
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3 text-muted-foreground" />
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Compliance</p>
                </div>
              )}
            </div>

            {complianceNavItems.map(item => <NavItem key={item.id} item={item} isCompliance />)}
          </nav>

          {/* Bottom actions */}
          <div className={cn("border-t border-border space-y-1.5", sidebarCollapsed ? "p-1.5" : "p-3")}>
            <Button
              variant="ghost"
              size="sm"
              className={cn("gap-2 text-xs", sidebarCollapsed ? "w-full justify-center px-0" : "w-full justify-start")}
              onClick={() => setShowTimeRecordingModal(true)}
              title="Log Time"
              data-testid="button-log-time-panel"
            >
              <Clock className="w-3.5 h-3.5" />
              {!sidebarCollapsed && "Log Time"}
            </Button>
          </div>
        </aside>
      )}

      {/* ── Main Content ── */}
      <main className="flex-1 min-w-0 flex flex-col overflow-y-auto overflow-x-hidden">

        {/* Mobile tab bar */}
        <div className="lg:hidden sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border overflow-x-auto">
          <div className="flex items-center gap-0.5 px-4 py-2 min-w-max">
            {mobileNavItems.map(item => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id as CaseSection);
                    if (item.id === 'documents' && isDemoJustRevealed) {
                      setIsDemoJustRevealed(false);
                      setShowDemoJustProducedBadge(true);
                      if (demoJustProducedTimerRef.current) clearTimeout(demoJustProducedTimerRef.current);
                      demoJustProducedTimerRef.current = setTimeout(() => setShowDemoJustProducedBadge(false), 5000);
                    }
                  }}
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
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border h-14 flex items-center px-6 lg:px-8 gap-4 shrink-0">
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
          {caseData.litigationHold && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-950/30 border border-red-400 dark:border-red-700 rounded-md" data-testid="banner-litigation-hold">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-red-700 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-900 dark:text-red-200">
                    Litigation Hold in effect{caseData.litigationHoldAppliedAt ? ` since ${new Date(caseData.litigationHoldAppliedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
                  </p>
                  {caseData.litigationHoldReason && (
                    <p className="text-xs text-red-800 dark:text-red-300 mt-1">
                      {caseData.litigationHoldReason}
                    </p>
                  )}
                  <p className="text-xs text-red-700 dark:text-red-400 mt-2">
                    All session records, transcripts, and attendance notes on this matter are preserved. Manage the hold from the Litigation Hold section.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* GDPR / Consent alert */}
          {caseData.sourceType === 'audio' && !consentLoading && !hasValidConsent && (
            <div className="p-4 bg-destructive/10 border border-destructive/40 rounded-md" data-testid="alert-gdpr-required">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">GDPR Compliance Required</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    No valid client consent has been recorded. Obtain consent before processing audio.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1.5"
                  onClick={() => { setConsentDialogMode('direct'); setShowConfirmVerbalConsentDialog(true); }}
                  data-testid="button-get-consent-gdpr-banner"
                >
                  <Shield className="w-3.5 h-3.5" />
                  Get Consent
                </Button>
              </div>
            </div>
          )}

          {/* Live / pending bot import banner — suppress for completed imports returned only for unresolved consent */}
          {/* Also suppress if status is 'transcribing' but documents already exist (stuck import guard) */}
          {liveImport && liveImport.status !== 'completed' && !(liveImport.status === 'transcribing' && documents.length > 0) && (
            liveImportConsecutive429Ref.current >= 3 && liveImport.status === 'transcribing' ? (
              <div className="p-4 rounded-md border bg-muted/40 border-border flex items-start gap-3" data-testid="alert-live-import-stalled">
                <Clock className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Processing — check back later</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Transcription is taking longer than expected. The page will update when it completes.</p>
                </div>
              </div>
            ) : (
              <div
                className={`p-4 rounded-md border flex items-start gap-3 ${
                  liveImport.status === 'failed'
                    ? 'bg-destructive/10 border-destructive/40'
                    : 'bg-accent/10 border-accent/30'
                }`}
                data-testid="alert-live-import"
              >
                {liveImport.status === 'failed' ? (
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                ) : liveImport.status === 'transcribing' ? (
                  <Loader2 className="w-5 h-5 text-accent shrink-0 mt-0.5 animate-spin" />
                ) : (
                  <Video className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {liveImport.status === 'failed' && 'Recording processing failed'}
                    {liveImport.status === 'transcribing' && 'Transcribing recording…'}
                    {liveImport.status === 'pending' && 'Recording ready to process'}
                    {liveImport.status === 'live' && (
                      liveImport.botStatus === 'done' || liveImport.botStatus === 'recording_done'
                        ? 'Recording ready to process'
                        : 'Bot recording in progress'
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {liveImport.status === 'failed' && (liveImport.errorMessage || 'An error occurred during processing.')}
                    {liveImport.status === 'transcribing' && 'Transcript and documents will appear here when ready.'}
                    {(liveImport.status === 'pending' || (liveImport.status === 'live' && (liveImport.botStatus === 'done' || liveImport.botStatus === 'recording_done')))
                      && 'The recording is available — click to transcribe and produce documents.'}
                    {liveImport.status === 'live' && liveImport.botStatus !== 'done' && liveImport.botStatus !== 'recording_done'
                      && 'The bot is still in the meeting. Processing will start automatically once it finishes.'}
                  </p>
                </div>
                {(liveImport.status === 'pending' || liveImport.status === 'failed' || (liveImport.status === 'live' && (liveImport.botStatus === 'done' || liveImport.botStatus === 'recording_done'))) && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={processImportMutation.isPending}
                    onClick={() => processImportMutation.mutate(liveImport.importId)}
                    data-testid="button-process-recording"
                  >
                    {processImportMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Process recording'}
                  </Button>
                )}
              </div>
            )
          )}

          {/* Missing-consent banner for bot meetings where consent was not confirmed — shown once session has clearly ended */}
          {liveImport && liveImport.consentMode === 'in_meeting' && liveImport.consentConfirmed === false && ['transcribing', 'completed', 'failed'].includes(liveImport.status) && (
            <div className="p-4 rounded-md border border-amber-500/50 bg-amber-500/10 space-y-3" data-testid="banner-missing-consent">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Verbal consent for this recording was not confirmed during the session</p>
                  <p className="text-sm text-amber-700/80 dark:text-amber-300/80 mt-0.5">You must record consent before processing. Confirm it verbally happened, or send the client a digital consent link.</p>
                </div>
              </div>

              {/* View script toggle */}
              <button
                type="button"
                onClick={() => setShowScriptInBanner(s => !s)}
                className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 transition-colors"
                data-testid="button-toggle-script-banner"
              >
                <Shield className="w-3.5 h-3.5" />
                View consent script
                {showScriptInBanner ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showScriptInBanner && (
                <div className="bg-background rounded-md p-3 border border-border text-sm italic leading-relaxed">
                  "{CONSENT_DISCLAIMER_TEXT}"
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => { setConsentDialogMode('bot'); setShowConfirmVerbalConsentDialog(true); }}
                  data-testid="button-confirm-verbal-consent-banner"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Confirm Verbal Consent
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setShowSendConsentLinkBanner(s => !s)}
                  data-testid="button-toggle-send-consent-link-banner"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send Consent Link
                </Button>
              </div>

              {showSendConsentLinkBanner && !bannerConsentLinkSent && (
                <div className="space-y-2 pt-1">
                  <Input
                    placeholder="Client email or mobile number"
                    value={bannerConsentLinkContact}
                    onChange={e => setBannerConsentLinkContact(e.target.value)}
                    data-testid="input-banner-consent-link-contact"
                  />
                  <Input
                    placeholder="Client name (optional)"
                    value={bannerConsentLinkName}
                    onChange={e => setBannerConsentLinkName(e.target.value)}
                    data-testid="input-banner-consent-link-name"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={!bannerConsentLinkContact.trim() || sendBannerConsentLinkMutation.isPending}
                    onClick={() => sendBannerConsentLinkMutation.mutate()}
                    data-testid="button-send-consent-link-banner"
                  >
                    {sendBannerConsentLinkMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Send Consent Link
                  </Button>
                </div>
              )}
              {bannerConsentLinkSent && (
                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Consent link sent to {bannerConsentLinkContact}
                </p>
              )}
            </div>
          )}

          {/* No-consent text-only alert — only when consent was explicitly declined */}
          {caseData.sourceType === 'audio' && hasDeclinedConsent && !hasValidConsent && !consentLoading && !audioLoading && (
            <Alert className="bg-card border-muted" data-testid="alert-no-recording-consent">
              <FileText className="w-4 h-4" />
              <AlertDescription>
                <span className="font-medium">Text notes only — recording consent declined</span>
                <p className="text-sm text-muted-foreground mt-0.5">Client declined audio recording consent.</p>
              </AlertDescription>
            </Alert>
          )}

          {/* Audio upload incomplete — e.g. Quick Record hit rate limit after case creation */}
          {hasMissingAudio && (
            <Alert variant="destructive" data-testid="alert-audio-missing">
              <Mic className="w-4 h-4" />
              <AlertDescription>
                <span className="font-medium">Recording not attached to this matter</span>
                <p className="text-sm text-muted-foreground mt-0.5">
                  The case was saved but the audio file did not upload. Use Quick Record again for this matter, or check for a recovery prompt if you still have the session open.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {showAudioPlayer && (
            <AudioPlayer
              audioUrl={audioData?.deletedAt ? null : (audioData?.id ? `/api/audio/${audioData.id}/stream` : null)}
              expiresAt={audioData?.expiresAt ? new Date(audioData.expiresAt) : null}
              caseId={caseData.id}
              audioRecordingId={audioData?.id}
              playerRef={audioPlayerRef}
              knownDurationSeconds={audioData?.duration ?? undefined}
              litigationHold={caseData.litigationHold}
              litigationHoldReason={caseData.litigationHoldReason}
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
                  <Progress value={Math.round(displayProgress)} className="h-1.5" data-testid="progress-bar" />
                  <p className="text-xs text-muted-foreground" data-testid="text-progress-percentage">
                    {Math.round(displayProgress)}% complete
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
          {activeSection === 'documents' && (() => {
            return (
              <div className="space-y-6">
                {showDemoJustProducedBadge && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm animate-in fade-in duration-300" data-testid="demo-just-produced-banner">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>Just produced — your attendance notes are ready to review.</span>
                  </div>
                )}
                <DocumentViewer
                  caseId={caseId!}
                  documents={documents as any}
                  sessions={meetingSessions.map(s => ({ id: s.id, sessionTitle: s.sessionTitle, recordingType: s.recordingType }))}
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
                  focusSessionId={focusSessionId || urlSessionId || undefined}
                  hasAmlFlag={amlComplianceVisible && !!caseData.riskLevel && ['high', 'medium'].includes(caseData.riskLevel as string)}
                  litigationHold={caseData.litigationHold}
                />
              </div>
            );
          })()}

          {activeSection === 'obligations' && (
            <div className="max-w-3xl">
              <ActionItemsViewer caseId={caseId!} hasTranscript={!!transcript?.content} />
            </div>
          )}

          {activeSection === 'sessions' && (
            <div className={cn("max-w-3xl space-y-4", isDemoJustRevealed && "animate-in fade-in duration-300")}>
              {meetingSessions.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <History className="w-8 h-8 mx-auto text-muted-foreground/40" />
                  <p className="font-medium text-sm">No sessions recorded yet</p>
                  <p className="text-xs text-muted-foreground">Sessions will appear here once a meeting is recorded for this matter.</p>
                  <Button size="sm" onClick={() => setShowNewSessionModal(true)} className="gap-2 mt-2" data-testid="button-record-new-session-empty">
                    <Mic className="w-4 h-4" />
                    Record New Session
                  </Button>
                </div>
              ) : (
                <div className="space-y-3" data-testid="session-timeline-list">
                  {[...meetingSessions].sort((a, b) => new Date(b.startedAt ?? 0).getTime() - new Date(a.startedAt ?? 0).getTime()).map((session, idx, sorted) => {
                    const isExpanded = expandedSessionId === session.id;
                    const sessionNumber = sorted.length - idx;
                    const primaryLabel = session.sessionTitle || RECORDING_TYPE_LABELS[session.recordingType as RecordingType] || session.recordingType;
                    const hasTitle = !!session.sessionTitle;
                    const navigateToSessionDocs = () => {
                      setFocusSessionId(session.id);
                      setActiveSection('documents');
                    };
                    return (
                      <Card key={session.id} className="overflow-hidden" data-testid={`session-item-${session.id}`}>
                        <CardContent className="p-0">
                          <div className="w-full p-4 text-left flex items-start gap-4">
                            <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-xs font-semibold text-accent shrink-0 mt-0.5">
                              {sessionNumber}
                            </div>
                            <button
                              className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                              onClick={navigateToSessionDocs}
                              data-testid={`button-open-session-docs-${session.id}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-foreground truncate" data-testid={`text-session-title-${session.id}`}>{primaryLabel}</p>
                                  {hasTitle && (
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
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
                                  )}
                                  {!hasTitle && (
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      <Badge
                                        variant={session.status === "completed" ? "default" : session.status === "failed" ? "destructive" : "secondary"}
                                        className="text-xs no-default-hover-elevate no-default-active-elevate"
                                        data-testid={`badge-session-status-${session.id}`}
                                      >
                                        {toTitleCase(session.status)}
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground shrink-0">
                                  {session.startedAt ? format(new Date(session.startedAt), "d MMM yyyy, HH:mm") : "—"}
                                  {session.durationSeconds != null && (
                                    <span className="ml-2">{Math.floor(session.durationSeconds / 60)}m {session.durationSeconds % 60}s</span>
                                  )}
                                </p>
                              </div>
                              {session.notes && !isExpanded && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{session.notes}</p>
                              )}
                            </button>
                            <button
                              onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                              className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
                              data-testid={`button-expand-session-${session.id}`}
                              aria-label={isExpanded ? "Collapse session" : "Expand session"}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                          {isExpanded && (
                            <div className="border-t border-border">
                              <SessionDetails
                                sessionId={session.id}
                                caseId={caseId!}
                                onOpenAttendanceNote={navigateToSessionDocs}
                                litigationHold={caseData.litigationHold}
                                litigationHoldReason={caseData.litigationHoldReason}
                              />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
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

          {activeSection === 'external-refs' && externalReferencesVisible && (
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

          {activeSection === 'compliance' && amlComplianceVisible && (
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
                  headless
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
            <div className="max-w-3xl" data-testid="audit-trail-content">
              <AuditTrail caseId={caseId!} limit={50} />
            </div>
          )}

          {activeSection === 'supervision' && supervisionVisible && (
            <div className="max-w-3xl">
              <SupervisionSection caseId={caseId!} />
            </div>
          )}

          {activeSection === 'litigation-hold' && (
            <div className="max-w-3xl">
              <LitigationHoldSection caseData={caseData} />
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
            <div className="flex items-center gap-1.5">
              {(() => {
                const ccCriterion = sraReadiness?.criteria?.find((c) => c.key === "conflict_check");
                const ccStatus = ccCriterion?.status ?? (caseData.conflictCheckCompleted ? "green" : "amber");
                return (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "no-default-hover-elevate no-default-active-elevate",
                      ccStatus === "green"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                        : ccStatus === "amber"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                    )}
                    data-testid="badge-conflict-check"
                  >
                    <Shield className="w-3 h-3 mr-1" />
                    {ccStatus === "green" ? "Conflict Check Completed" : ccStatus === "amber" ? "Conflict Managed" : "Conflict Check Pending"}
                  </Badge>
                );
              })()}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConflictCheckDialog(true)}
                className="gap-1 text-xs"
                data-testid="button-record-conflict-check"
              >
                <Shield className="w-3 h-3" />
                Record Conflict Check
              </Button>
            </div>
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
      <ImportRecordingModal open={showImportModal} onOpenChange={setShowImportModal} caseId={caseId!} caseTitle={caseData.title} />
      <LiveBotModal open={showLiveBotModal} onOpenChange={setShowLiveBotModal} caseId={caseId!} caseTitle={caseData.title} />
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
      <NewSessionModal open={showNewSessionModal} onOpenChange={setShowNewSessionModal} caseId={caseId!} caseTitle={caseData.title} />

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

      {/* Confirm Verbal Consent Dialog */}
      <Dialog open={showConfirmVerbalConsentDialog} onOpenChange={setShowConfirmVerbalConsentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Confirm Verbal Consent
            </DialogTitle>
            <DialogDescription>
              Confirm that verbal consent was obtained during the recorded session.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted/40 rounded-md p-3 border border-border">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">CONSENT SCRIPT (for reference):</p>
              <p className="text-sm leading-relaxed italic">
                "{CONSENT_DISCLAIMER_TEXT}"
              </p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3">
              <p className="text-xs text-muted-foreground">
                By confirming, you attest that the consent script was read to the client and they verbally agreed. This will be logged in the audit trail.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmVerbalConsentDialog(false)}
              disabled={confirmBannerConsentMutation.isPending || recordDirectConsentMutation.isPending}
            >
              Cancel
            </Button>
            {consentDialogMode === 'direct' ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => recordDirectConsentMutation.mutate(false)}
                  disabled={recordDirectConsentMutation.isPending}
                  data-testid="button-client-declined-consent-dialog"
                >
                  {recordDirectConsentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Client Declined"}
                </Button>
                <Button
                  onClick={() => recordDirectConsentMutation.mutate(true)}
                  disabled={recordDirectConsentMutation.isPending}
                  data-testid="button-client-consented-dialog"
                >
                  {recordDirectConsentMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Recording...</> : "Client Consented"}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => confirmBannerConsentMutation.mutate()}
                disabled={confirmBannerConsentMutation.isPending}
                data-testid="button-confirm-verbal-consent-dialog"
              >
                {confirmBannerConsentMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Confirming...</> : "Confirm Verbal Consent"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* SRA Matter Report Modal */}
      <Dialog open={showSraReportModal} onOpenChange={setShowSraReportModal}>
        <DialogContent className="max-w-lg" data-testid="dialog-sra-report">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-accent" />
              Prepare SRA Matter Report
            </DialogTitle>
            <DialogDescription>
              Review the scope of this report before compiling.
            </DialogDescription>
          </DialogHeader>
          {previewLoading ? (
            <div className="space-y-2 py-4">
              {[...Array(5)].map((_, i) => <div key={i} className="h-4 bg-muted rounded animate-pulse" />)}
            </div>
          ) : sraReportPreview ? (
            <div className="space-y-4">
              <div className="space-y-1.5" data-testid="sra-report-preview-sections">
                {[
                  { label: "Matter Overview", value: sraReportPreview.sections.matterOverview.clientName ? `${sraReportPreview.sections.matterOverview.clientName}` : "No client linked" },
                  { label: "AML and Client Identity", value: `${sraReportPreview.sections.aml.decisionsCount} decision(s), ${sraReportPreview.sections.aml.notesCount} monitoring note(s)` },
                  { label: "Client Care and Consent", value: `${sraReportPreview.sections.clientCare.consentCount} consent record(s)${sraReportPreview.sections.clientCare.hasCareLetter ? ", care letter on file" : ""}` },
                  { label: "Communications and Attendance", value: `${sraReportPreview.sections.communications.sessionCount} session(s), ${sraReportPreview.sections.communications.noteCount} quick note(s)` },
                  { label: "Obligations and Undertakings", value: `${sraReportPreview.sections.obligationsAndUndertakings.obligationCount} obligation(s), ${sraReportPreview.sections.obligationsAndUndertakings.undertakingCount} undertaking(s)` },
                  { label: "Documents", value: `${sraReportPreview.sections.documents.documentCount} active document(s)` },
                  { label: "Time Recording", value: `${sraReportPreview.sections.timeRecording.entryCount} entr${sraReportPreview.sections.timeRecording.entryCount === 1 ? "y" : "ies"}, ${sraReportPreview.sections.timeRecording.totalMinutes} min total` },
                  { label: "Data Protection", value: `${sraReportPreview.sections.dataProtection.consentCount} consent(s), ${sraReportPreview.sections.dataProtection.dsarCount} DSAR(s)` },
                  { label: "Supervision", value: sraReportPreview.sections.supervision.supervisor || "Not recorded" },
                  { label: "Audit Trail", value: `${sraReportPreview.sections.auditTrail.entryCount} event(s)` },
                ].map((row, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-3 text-sm" data-testid={`sra-preview-row-${i}`}>
                    <span className="text-muted-foreground shrink-0">{row.label}</span>
                    <span className="text-foreground text-right text-xs font-mono">{row.value}</span>
                  </div>
                ))}
              </div>
              {sraReportPreview.disclaimer && (
                <div className="bg-muted/40 rounded-md p-3 border border-border" data-testid="sra-report-disclaimer">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{sraReportPreview.disclaimer}</p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowSraReportModal(false)} data-testid="button-cancel-sra-report">
                  Cancel
                </Button>
                <Button
                  onClick={async () => { setShowSraReportModal(false); await compileSraReport(); }}
                  disabled={isCompilingReport}
                  className="gap-1.5"
                  data-testid="button-confirm-compile-report"
                >
                  {isCompilingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  Compile Report
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground" data-testid="sra-report-preview-error">
              Unable to load report preview. You may still compile the report.
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowSraReportModal(false)}>Cancel</Button>
                <Button onClick={async () => { setShowSraReportModal(false); await compileSraReport(); }} disabled={isCompilingReport} className="gap-1.5" data-testid="button-compile-anyway">
                  {isCompilingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  Compile Anyway
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Conflict of Interest Check Dialog */}
      <Dialog open={showConflictCheckDialog} onOpenChange={setShowConflictCheckDialog}>
        <DialogContent className="max-w-md" data-testid="dialog-conflict-check">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Record Conflict of Interest Check
            </DialogTitle>
            <DialogDescription>
              Record the outcome of a conflict of interest check for this matter. SRA Code of Conduct 2019, para 6.1.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="conflict-outcome">Outcome <span className="text-destructive">*</span></Label>
              <Select
                value={conflictCheckOutcome}
                onValueChange={(v) => setConflictCheckOutcome(v as "no_conflict" | "conflict_managed")}
              >
                <SelectTrigger id="conflict-outcome" data-testid="select-conflict-outcome">
                  <SelectValue placeholder="Select outcome..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_conflict">No conflict identified</SelectItem>
                  <SelectItem value="conflict_managed">Conflict identified and managed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="conflict-notes">Notes (optional)</Label>
              <Textarea
                id="conflict-notes"
                placeholder="Record details of the check performed and any relevant considerations..."
                value={conflictCheckNotes}
                onChange={(e) => setConflictCheckNotes(e.target.value)}
                className="resize-none text-sm"
                rows={3}
                data-testid="textarea-conflict-notes"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowConflictCheckDialog(false)} disabled={recordConflictCheckMutation.isPending} data-testid="button-cancel-conflict-check">
              Cancel
            </Button>
            <Button
              onClick={() => recordConflictCheckMutation.mutate()}
              disabled={recordConflictCheckMutation.isPending}
              className="gap-1.5"
              data-testid="button-submit-conflict-check"
            >
              {recordConflictCheckMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              Record Check
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
