import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Clock, ChevronDown, ChevronUp, EyeOff, Eye, Shield, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface SpeakerUtterance {
  speaker: string;
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface Redaction {
  start: number;
  end: number;
  reason: string;
  redactedBy: string;
  timestamp: string;
  status?: 'pending' | 'committed';
  reasonType?: string;
  reasonNotes?: string;
  pendingUntil?: string;
  textStart?: number;
  textEnd?: number;
  selectedText?: string;
}

interface DiarizedTranscriptViewerProps {
  utterances: SpeakerUtterance[];
  speakerCount?: number;
  fallbackContent?: string;
  onTimestampClick?: (timestampMs: number) => void;
  redactions?: Redaction[];
  onRedact?: (redaction: { start: number; end: number; reason: string; textStart?: number; textEnd?: number; selectedText?: string }) => void;
  onRemoveRedaction?: (start: number, end: number, textStart?: number, textEnd?: number) => void;
  canRedact?: boolean;
  initialTimestamp?: number;
  /** Hide clock times — used for uploaded/external transcripts with no audio timeline */
  hideTimestamps?: boolean;
  /** Fee-earner uploaded/pasted transcript (not AssemblyAI from LegalNote audio) */
  isExternalUpload?: boolean;
}

const SPEAKER_COLORS = [
  "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700",
  "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700",
  "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700",
  "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700",
  "bg-rose-100 dark:bg-rose-900/30 border-rose-300 dark:border-rose-700",
  "bg-cyan-100 dark:bg-cyan-900/30 border-cyan-300 dark:border-cyan-700",
];

const SPEAKER_BADGE_COLORS = [
  "bg-blue-500",
  "bg-emerald-500", 
  "bg-purple-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatReasonType(reasonType: string | undefined): string {
  switch (reasonType) {
    case 'redaction_gdpr':
      return 'GDPR — Personal Data';
    case 'redaction_privilege':
      return 'Legal Privilege';
    case 'redaction_third_party':
      return 'Third Party Information';
    case 'redaction_commercially_sensitive':
      return 'Commercially Sensitive';
    case 'redaction_court_order':
      return 'Court Order / Reporting Restriction';
    case 'redaction_without_prejudice':
      return 'Without Prejudice';
    case 'redaction_nda':
      return 'Deal Confidentiality / NDA';
    case 'redaction_ubo':
      return 'Beneficial Ownership / UBO';
    case 'redaction_regulatory_privilege':
      return 'Regulatory / Supervisory Privilege';
    case 'redaction_foreign_law_privilege':
      return 'Foreign Law Privilege';
    default:
      return 'Redacted';
  }
}

function getSpeakerIndex(speaker: string): number {
  const match = speaker.match(/[A-Z]$/);
  if (match) {
    return match[0].charCodeAt(0) - 'A'.charCodeAt(0);
  }
  return 0;
}

const LOW_CONFIDENCE_THRESHOLD = 0.75;

function isLowConfidence(confidence: number): boolean {
  return confidence > 0 && confidence < LOW_CONFIDENCE_THRESHOLD;
}

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/** Strip speaker labels so we can compare utterance text vs stored full content. */
function plainTranscriptLength(text: string): number {
  return text
    // Match AssemblyAI "[Speaker A]:" and named labels like "[Priya]:" from sample/seeded matters
    .replace(/\[[^\]]+\]:\s*/g, "")
    .replace(/\s+/g, " ")
    .trim().length;
}

/**
 * Attendance-note style transcripts prepend metadata above a `---` rule.
 * Compare dialogue body only so a header never forces the plain-text fallback
 * when segmented utterances already cover the conversation.
 */
function dialogueBodyForCompare(text: string): string {
  const match = text.match(/\n---\s*\n/);
  if (match && match.index !== undefined) {
    return text.slice(match.index + match[0].length);
  }
  return text;
}

export default function DiarizedTranscriptViewer({
  utterances,
  speakerCount,
  fallbackContent,
  onTimestampClick,
  redactions = [],
  onRedact,
  onRemoveRedaction,
  canRedact = false,
  initialTimestamp,
  hideTimestamps = false,
  isExternalUpload = false,
}: DiarizedTranscriptViewerProps) {
  const [showTimestamps, setShowTimestamps] = useState(!hideTimestamps);
  // Always start expanded so the full capture is readable without an extra click
  const [expandedView, setExpandedView] = useState(true);
  const [redactionMode, setRedactionMode] = useState(false);
  const [tick, setTick] = useState(0);
  const [highlightedTimestamp, setHighlightedTimestamp] = useState<number | null>(null);
  const lastScrolledTimestamp = useRef<number | undefined>(undefined);
  const utteranceRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const selectionHandledRef = useRef(false);
  void tick;

  useEffect(() => {
    const hasActivePendingUndo = redactions.some((r) => {
      if (r.status !== 'pending' || !r.pendingUntil) return false;
      const pendingUntilMs = new Date(r.pendingUntil).getTime();
      return pendingUntilMs > Date.now();
    });

    if (!hasActivePendingUndo) return;

    const intervalId = window.setInterval(() => {
      setTick((t) => t + 1);
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, [redactions]);

  useEffect(() => {
    if (initialTimestamp !== undefined && initialTimestamp !== lastScrolledTimestamp.current && utterances.length > 0) {
      const targetUtterance = utterances.find(u => u.start <= initialTimestamp && u.end >= initialTimestamp);
      if (targetUtterance) {
        const attemptScroll = (retries = 0) => {
          const targetEl = utteranceRefs.current.get(targetUtterance.start);
          if (targetEl) {
            requestAnimationFrame(() => {
              targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setHighlightedTimestamp(targetUtterance.start);
              lastScrolledTimestamp.current = initialTimestamp;
              setTimeout(() => {
                setHighlightedTimestamp(null);
              }, 2000);
            });
          } else if (retries < 5) {
            setTimeout(() => attemptScroll(retries + 1), 100);
          }
        };
        setTimeout(() => attemptScroll(), 100);
      }
    }
  }, [initialTimestamp, utterances]);

  if (!utterances || utterances.length === 0) {
    if (fallbackContent) {
      return (
        <div
          className="space-y-4 max-h-[min(70vh,720px)] overflow-y-auto overscroll-contain pr-1"
          data-testid="container-transcript-fallback"
        >
          <p className="text-xs text-muted-foreground sticky top-0 bg-card/95 backdrop-blur-sm py-1 z-10">
            Full transcript · {plainTranscriptLength(fallbackContent).toLocaleString()} characters
          </p>
          <p className="text-foreground whitespace-pre-wrap break-words" data-testid="text-transcript-fallback">
            {fallbackContent}
          </p>
        </div>
      );
    }
    return (
      <p className="text-sm text-muted-foreground italic" data-testid="text-no-transcript">
        Transcript not yet available.
      </p>
    );
  }

  const uniqueSpeakers = [...new Set(utterances.map(u => u.speaker))];
  // Real AssemblyAI timings are milliseconds; ordinal placeholders from text parsing are tiny ints.
  const hasAudioTiming =
    !hideTimestamps &&
    !isExternalUpload &&
    utterances.some((u) => (u.end ?? 0) >= 100 || (u.start ?? 0) >= 100);
  const totalDuration = hasAudioTiming && utterances.length > 0
    ? Math.max(...utterances.map((u) => u.end || 0))
    : 0;

  // Prefer the longer of stored full content vs speaker segments — incomplete
  // diarization or a truncated correction must never hide the fuller capture.
  // Ignore attendance headers and speaker-label formatting when comparing lengths
  // so sample/seeded matters with named speakers still use the coloured layout.
  // Never collapse a single timed utterance into plain text — keep coloured UI + scrub.
  const utteranceTextLen = plainTranscriptLength(utterances.map((u) => u.text).join(" "));
  const fallbackTextLen = fallbackContent
    ? plainTranscriptLength(dialogueBodyForCompare(fallbackContent))
    : 0;
  const preferFullContent =
    !!fallbackContent &&
    !hasAudioTiming &&
    utterances.length > 1 &&
    fallbackTextLen > utteranceTextLen * 1.15 + 80;

  if (preferFullContent) {
    return (
      <div
        className="space-y-3 max-h-[min(70vh,720px)] overflow-y-auto overscroll-contain pr-1"
        data-testid="container-diarized-transcript"
      >
        <p className="text-xs text-muted-foreground sticky top-0 bg-card/95 backdrop-blur-sm py-1 z-10" data-testid="text-transcript-full-source-note">
          Showing the full transcript capture
          {utterances.length === 1 ? " (speaker timing was not fully segmented)." : "."}
          {fallbackTextLen > 0 ? ` · ${fallbackTextLen.toLocaleString()} characters` : ""}
        </p>
        <p
          className="text-foreground whitespace-pre-wrap break-words text-sm leading-relaxed"
          data-testid="text-transcript-fallback"
        >
          {fallbackContent}
        </p>
      </div>
    );
  }

  const getRedactionsForUtterance = (start: number, end: number): Redaction[] => {
    return redactions.filter(r => r.start === start && r.end === end);
  };

  const isFullyRedacted = (start: number, end: number): Redaction | undefined => {
    return redactions.find(r => r.start === start && r.end === end && r.textStart === undefined && r.textEnd === undefined);
  };

  const handleTextSelection = (utterance: SpeakerUtterance, utteranceIdx: number) => {
    if (!redactionMode || !canRedact) return;
    
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      return;
    }

    const selectedText = selection.toString();
    const utteranceText = utterance.text;
    
    const range = selection.getRangeAt(0);
    const textElement = document.querySelector(`[data-testid="text-utterance-${utteranceIdx}"]`);
    
    if (!textElement || !textElement.contains(range.commonAncestorContainer)) {
      return;
    }

    // Calculate character offset by walking through text nodes
    const getTextOffset = (container: Node, targetNode: Node, targetOffset: number): number => {
      let offset = 0;
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
      
      let node = walker.nextNode();
      while (node) {
        if (node === targetNode) {
          return offset + targetOffset;
        }
        offset += (node.textContent || '').length;
        node = walker.nextNode();
      }
      return offset;
    };

    const startOffset = getTextOffset(textElement, range.startContainer, range.startOffset);
    const endOffset = getTextOffset(textElement, range.endContainer, range.endOffset);
    
    if (startOffset >= endOffset) {
      return;
    }

    // Get the actual selected text from the original utterance using the offsets
    const actualSelectedText = utteranceText.slice(startOffset, endOffset);

    onRedact?.({
      start: utterance.start,
      end: utterance.end,
      reason: "",
      textStart: startOffset,
      textEnd: endOffset,
      selectedText: actualSelectedText.trim() || selectedText.trim(),
    });
    
    selectionHandledRef.current = true;
    selection.removeAllRanges();
  };

  const handleUtteranceClick = (utterance: SpeakerUtterance, utteranceIdx: number) => {
    if (redactionMode && canRedact) {
      if (selectionHandledRef.current) {
        selectionHandledRef.current = false;
        return;
      }

      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && selection.toString().trim()) {
        handleTextSelection(utterance, utteranceIdx);
        return;
      }

      const fullRedaction = isFullyRedacted(utterance.start, utterance.end);
      if (fullRedaction) {
        onRemoveRedaction?.(utterance.start, utterance.end);
      } else {
        onRedact?.({
          start: utterance.start,
          end: utterance.end,
          reason: "",
          selectedText: utterance.text,
        });
      }
      return;
    }

    // Normal mode: click utterance / timestamp area to scrub the audio player
    if (hasAudioTiming && onTimestampClick) {
      onTimestampClick(utterance.start);
    }
  };

  const renderTextWithRedactions = (text: string, utteranceStart: number, utteranceEnd: number, utteranceIdx: number) => {
    const utteranceRedactions = getRedactionsForUtterance(utteranceStart, utteranceEnd)
      .filter(r => r.textStart !== undefined && r.textEnd !== undefined)
      .sort((a, b) => (a.textStart || 0) - (b.textStart || 0));

    if (utteranceRedactions.length === 0) {
      return (
        <span data-testid={`text-utterance-${utteranceIdx}`}>
          {text}
        </span>
      );
    }

    const segments: { type: 'text' | 'redacted'; content: string; redaction?: Redaction }[] = [];
    let lastEnd = 0;

    for (const redaction of utteranceRedactions) {
      const start = redaction.textStart || 0;
      const end = redaction.textEnd || 0;

      if (start > lastEnd) {
        segments.push({ type: 'text', content: text.slice(lastEnd, start) });
      }
      segments.push({ type: 'redacted', content: text.slice(start, end), redaction });
      lastEnd = end;
    }

    if (lastEnd < text.length) {
      segments.push({ type: 'text', content: text.slice(lastEnd) });
    }

    return (
      <span data-testid={`text-utterance-${utteranceIdx}`}>
        {segments.map((seg, idx) => {
          if (seg.type === 'redacted') {
            const pendingUntilMs = seg.redaction?.pendingUntil ? new Date(seg.redaction.pendingUntil).getTime() : undefined;
            const isUndoAvailable =
              seg.redaction?.status === 'pending' &&
              pendingUntilMs !== undefined &&
              pendingUntilMs > Date.now();
            const undoMinutesRemaining =
              isUndoAvailable && pendingUntilMs !== undefined
                ? Math.max(0, Math.ceil((pendingUntilMs - Date.now()) / 60000))
                : 0;
            return (
              <Tooltip key={idx}>
                <TooltipTrigger asChild>
                  <span 
                    className={cn(
                      "px-1 rounded cursor-pointer",
                      isUndoAvailable
                        ? "bg-amber-200 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300"
                        : "bg-red-200 dark:bg-red-800/50 text-red-700 dark:text-red-300"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (redactionMode && canRedact && seg.redaction) {
                        onRemoveRedaction?.(utteranceStart, utteranceEnd, seg.redaction.textStart, seg.redaction.textEnd);
                      }
                    }}
                  >
                    [REDACTED]
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="font-medium">Redaction Reason:</p>
                  <p className="text-muted-foreground">{formatReasonType(seg.redaction?.reasonType)}</p>
                  {seg.redaction?.reasonNotes && (
                    <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{seg.redaction.reasonNotes}</p>
                  )}
                  {isUndoAvailable && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Undo window: {undoMinutesRemaining}m remaining
                    </p>
                  )}
                  {redactionMode && canRedact && (
                    <p className="text-xs text-muted-foreground mt-1">Click to remove</p>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          }
          return <span key={idx}>{seg.content}</span>;
        })}
      </span>
    );
  };

  return (
    <div
      className="space-y-4 max-h-[min(70vh,720px)] overflow-y-auto overscroll-contain pr-1"
      data-testid="container-diarized-transcript"
    >
      {/* Sticky transcript controls header - sticks to top of its scroll container */}
      <div 
        className="sticky top-0 z-30 bg-card pb-3 pt-2 border-b"
      >
        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground pb-2">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            <span>{speakerCount || uniqueSpeakers.length} speaker{(speakerCount || uniqueSpeakers.length) !== 1 ? 's' : ''}</span>
          </div>
          {hasAudioTiming && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>{formatTimestamp(totalDuration)}</span>
            </div>
          )}
          {isExternalUpload && (
            <Badge
              variant="outline"
              className="text-xs font-normal gap-1"
              data-testid="badge-external-transcript-inline"
            >
              External transcript
            </Badge>
          )}
          {redactions.length > 0 && (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <EyeOff className="w-4 h-4" />
              <span>{redactions.length} redaction{redactions.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
        
        {/* Controls row - all buttons in one horizontal line */}
        <div className="flex flex-wrap items-center gap-2 pb-2 border-b">
          {canRedact && (
            <Button
              variant={redactionMode ? "default" : "outline"}
              size="sm"
              onClick={() => setRedactionMode(!redactionMode)}
              className="gap-1"
              data-testid="button-toggle-redaction-mode"
            >
              <Shield className="w-3 h-3" />
              {redactionMode ? 'Exit Redact' : 'Redact'}
            </Button>
          )}
          {hasAudioTiming && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTimestamps(!showTimestamps)}
              className="gap-1"
              data-testid="button-toggle-timestamps"
            >
              <Clock className="w-3 h-3" />
              {showTimestamps ? 'Hide Times' : 'Show Times'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedView(!expandedView)}
            className="gap-1"
            data-testid="button-toggle-view"
          >
            {expandedView ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expandedView ? 'Compact All' : 'Expand All'}
          </Button>
          
          {/* Speaker badges inline with controls */}
          <div className="flex flex-wrap gap-1.5 ml-auto">
            {uniqueSpeakers.map((speaker, speakerIdx) => {
              const colorIdx = speakerIdx % SPEAKER_BADGE_COLORS.length;
              return (
                <Badge 
                  key={speaker} 
                  variant="outline" 
                  className="gap-1 text-xs"
                  data-testid={`badge-speaker-${speaker}`}
                >
                  <span 
                    className={cn(
                      "w-2 h-2 rounded-full",
                      SPEAKER_BADGE_COLORS[colorIdx]
                    )} 
                  />
                  {speaker}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Redaction mode banner - inside sticky area */}
        {redactionMode && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2 mt-2">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                <strong>Select text</strong> to redact specific words, or <strong>click a segment</strong> to redact entirely. Click redacted text to undo.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className={cn("space-y-3", !expandedView && "space-y-1")}>
        {utterances.map((utterance, idx) => {
          const colorIdx = uniqueSpeakers.indexOf(utterance.speaker) % SPEAKER_COLORS.length;
          const fullRedaction = isFullyRedacted(utterance.start, utterance.end);
          const fullPendingUntilMs = fullRedaction?.pendingUntil ? new Date(fullRedaction.pendingUntil).getTime() : undefined;
          const isFullUndoAvailable =
            fullRedaction?.status === 'pending' &&
            fullPendingUntilMs !== undefined &&
            fullPendingUntilMs > Date.now();
          const fullUndoMinutesRemaining =
            isFullUndoAvailable && fullPendingUntilMs !== undefined
              ? Math.max(0, Math.ceil((fullPendingUntilMs - Date.now()) / 60000))
              : 0;
          const hasPartialRedactions = getRedactionsForUtterance(utterance.start, utterance.end)
            .some(r => r.textStart !== undefined && r.textEnd !== undefined);
          
          return (
            <div 
              key={idx}
              ref={(el) => {
                if (el) {
                  utteranceRefs.current.set(utterance.start, el);
                }
              }}
              className={cn(
                "rounded-lg border p-3 transition-all",
                fullRedaction 
                  ? (isFullUndoAvailable
                      ? "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700"
                      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800")
                  : SPEAKER_COLORS[colorIdx],
                !expandedView && "p-2",
                redactionMode && canRedact && "cursor-text hover:ring-2 hover:ring-primary/50",
                !redactionMode && hasAudioTiming && onTimestampClick && "cursor-pointer hover:ring-1 hover:ring-primary/40",
                highlightedTimestamp === utterance.start && "ring-2 ring-primary ring-offset-2"
              )}
              onMouseUp={() => {
                const selection = window.getSelection();
                if (selection && !selection.isCollapsed && selection.toString().trim()) {
                  handleTextSelection(utterance, idx);
                }
              }}
              onClick={() => handleUtteranceClick(utterance, idx)}
              data-testid={`utterance-${idx}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "text-white font-medium",
                      fullRedaction ? "bg-red-500" : SPEAKER_BADGE_COLORS[colorIdx]
                    )}
                    data-testid={`badge-speaker-label-${idx}`}
                  >
                    {utterance.speaker}
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  {fullRedaction ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2">
                          <EyeOff className={cn("w-4 h-4 flex-shrink-0", isFullUndoAvailable ? "text-amber-600 dark:text-amber-400" : "text-red-500")} />
                          <span className={cn(
                            isFullUndoAvailable
                              ? "text-amber-700 dark:text-amber-300 font-medium italic"
                              : "text-red-600 dark:text-red-400 font-medium italic",
                            expandedView ? "text-sm" : "text-xs"
                          )}>
                            [REDACTED]
                          </span>
                          {isFullUndoAvailable && (
                            <span className={cn("text-xs", "text-amber-700 dark:text-amber-300")}>
                              Undo available
                            </span>
                          )}
                          {redactionMode && canRedact && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveRedaction?.(utterance.start, utterance.end);
                              }}
                              data-testid={`button-remove-redaction-${idx}`}
                            >
                              <X className="w-3 h-3 mr-1" />
                              Remove
                            </Button>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="font-medium">Redaction Reason:</p>
                        <p className="text-muted-foreground">{formatReasonType(fullRedaction.reasonType)}</p>
                        {fullRedaction.reasonNotes && (
                          <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{fullRedaction.reasonNotes}</p>
                        )}
                        {isFullUndoAvailable && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Undo window: {fullUndoMinutesRemaining}m remaining
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Redacted on {new Date(fullRedaction.timestamp).toLocaleDateString()}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <div className="flex items-start gap-2">
                      {isLowConfidence(utterance.confidence) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex-shrink-0 mt-0.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-xs">
                              Low transcription confidence: {formatConfidence(utterance.confidence)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              This segment may contain errors
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <p 
                        className={cn(
                          "text-foreground select-text whitespace-pre-wrap break-words",
                          expandedView ? "text-sm leading-relaxed" : "text-xs leading-relaxed",
                          isLowConfidence(utterance.confidence) && "bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded border-l-2 border-amber-400"
                        )}
                      >
                        {hasPartialRedactions 
                          ? renderTextWithRedactions(utterance.text, utterance.start, utterance.end, idx)
                          : <span data-testid={`text-utterance-${idx}`}>{utterance.text}</span>
                        }
                      </p>
                    </div>
                  )}
                </div>
                {hasAudioTiming && showTimestamps && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTimestampClick?.(utterance.start);
                    }}
                    disabled={!onTimestampClick}
                    className={cn(
                      "flex-shrink-0 text-xs font-mono px-2 py-1 rounded transition-colors",
                      onTimestampClick 
                        ? "text-primary hover:bg-primary/10 cursor-pointer underline underline-offset-2" 
                        : "text-muted-foreground cursor-default"
                    )}
                    title={onTimestampClick ? `Jump to ${formatTimestamp(utterance.start)}` : undefined}
                    data-testid={`timestamp-${idx}`}
                  >
                    {formatTimestamp(utterance.start)}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
