import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Clock, ChevronDown, ChevronUp, EyeOff, Eye, Shield, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export default function DiarizedTranscriptViewer({
  utterances,
  speakerCount,
  fallbackContent,
  onTimestampClick,
  redactions = [],
  onRedact,
  onRemoveRedaction,
  canRedact = false,
}: DiarizedTranscriptViewerProps) {
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [expandedView, setExpandedView] = useState(true);
  const [redactionMode, setRedactionMode] = useState(false);
  const [pendingRedaction, setPendingRedaction] = useState<{ 
    start: number; 
    end: number; 
    text: string;
    textStart?: number;
    textEnd?: number;
    isPartial?: boolean;
  } | null>(null);
  const [redactionReason, setRedactionReason] = useState("");

  if (!utterances || utterances.length === 0) {
    if (fallbackContent) {
      return (
        <div className="space-y-4">
          <p className="text-foreground whitespace-pre-wrap" data-testid="text-transcript-fallback">
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
  const totalDuration = utterances.length > 0 
    ? utterances[utterances.length - 1].end 
    : 0;

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

    setPendingRedaction({
      start: utterance.start,
      end: utterance.end,
      text: actualSelectedText.trim() || selectedText.trim(),
      textStart: startOffset,
      textEnd: endOffset,
      isPartial: (endOffset - startOffset) < utteranceText.length,
    });
    
    selection.removeAllRanges();
  };

  const handleUtteranceClick = (utterance: SpeakerUtterance, utteranceIdx: number) => {
    if (!redactionMode || !canRedact) return;
    
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim()) {
      handleTextSelection(utterance, utteranceIdx);
      return;
    }
    
    const fullRedaction = isFullyRedacted(utterance.start, utterance.end);
    if (fullRedaction) {
      onRemoveRedaction?.(utterance.start, utterance.end);
    } else {
      setPendingRedaction({
        start: utterance.start,
        end: utterance.end,
        text: utterance.text,
        isPartial: false,
      });
    }
  };

  const handleConfirmRedaction = () => {
    if (!pendingRedaction || !redactionReason.trim()) return;
    
    onRedact?.({
      start: pendingRedaction.start,
      end: pendingRedaction.end,
      reason: redactionReason.trim(),
      textStart: pendingRedaction.textStart,
      textEnd: pendingRedaction.textEnd,
      selectedText: pendingRedaction.text,
    });
    
    setPendingRedaction(null);
    setRedactionReason("");
  };

  const handleCancelRedaction = () => {
    setPendingRedaction(null);
    setRedactionReason("");
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
            return (
              <Tooltip key={idx}>
                <TooltipTrigger asChild>
                  <span 
                    className="bg-red-200 dark:bg-red-800/50 text-red-700 dark:text-red-300 px-1 rounded cursor-pointer"
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
                  <p className="text-muted-foreground">{seg.redaction?.reason}</p>
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
    <div className="space-y-4" data-testid="container-diarized-transcript">
      {/* Sticky transcript controls header - responsive offset for document viewer header */}
      <div className="sticky top-44 sm:top-20 z-30 bg-background pb-3 pt-2 border-b">
        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground pb-2">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            <span>{speakerCount || uniqueSpeakers.length} speaker{(speakerCount || uniqueSpeakers.length) !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>{formatTimestamp(totalDuration)}</span>
          </div>
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
            {uniqueSpeakers.map((speaker) => {
              const colorIdx = getSpeakerIndex(speaker) % SPEAKER_BADGE_COLORS.length;
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
          const colorIdx = getSpeakerIndex(utterance.speaker) % SPEAKER_COLORS.length;
          const fullRedaction = isFullyRedacted(utterance.start, utterance.end);
          const hasPartialRedactions = getRedactionsForUtterance(utterance.start, utterance.end)
            .some(r => r.textStart !== undefined && r.textEnd !== undefined);
          
          return (
            <div 
              key={idx}
              className={cn(
                "rounded-lg border p-3 transition-colors",
                fullRedaction 
                  ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" 
                  : SPEAKER_COLORS[colorIdx],
                !expandedView && "p-2",
                redactionMode && canRedact && "cursor-text hover:ring-2 hover:ring-primary/50"
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
                          <EyeOff className="w-4 h-4 text-red-500 flex-shrink-0" />
                          <span className={cn(
                            "text-red-600 dark:text-red-400 font-medium italic",
                            expandedView ? "text-sm" : "text-xs"
                          )}>
                            [REDACTED]
                          </span>
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
                        <p className="text-muted-foreground">{fullRedaction.reason}</p>
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
                          "text-foreground select-text",
                          expandedView ? "text-sm leading-relaxed" : "text-xs",
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
                {showTimestamps && (
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

      <Dialog open={!!pendingRedaction} onOpenChange={(open) => !open && handleCancelRedaction()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Redaction</DialogTitle>
            <DialogDescription>
              This segment will be hidden from all exports and shared documents. You can remove the redaction later if needed.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm font-medium text-muted-foreground mb-1">Text to be redacted:</p>
              <p className="text-sm italic">"{pendingRedaction?.text}"</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="redaction-reason">Reason for redaction (required)</Label>
              <Textarea
                id="redaction-reason"
                placeholder="e.g., Contains sensitive personal information, Client requested removal, Privileged information..."
                value={redactionReason}
                onChange={(e) => setRedactionReason(e.target.value)}
                className="min-h-[80px]"
                data-testid="input-redaction-reason"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelRedaction} data-testid="button-cancel-redaction">
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmRedaction} 
              disabled={!redactionReason.trim()}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-redaction"
            >
              <EyeOff className="w-4 h-4 mr-2" />
              Confirm Redaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
