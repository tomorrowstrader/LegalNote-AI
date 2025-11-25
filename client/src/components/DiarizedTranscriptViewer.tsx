import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SpeakerUtterance {
  speaker: string;
  text: string;
  start: number;
  end: number;
  confidence: number;
}

interface DiarizedTranscriptViewerProps {
  utterances: SpeakerUtterance[];
  speakerCount?: number;
  fallbackContent?: string;
  onTimestampClick?: (timestampMs: number) => void;
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

export default function DiarizedTranscriptViewer({
  utterances,
  speakerCount,
  fallbackContent,
  onTimestampClick,
}: DiarizedTranscriptViewerProps) {
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [expandedView, setExpandedView] = useState(true);

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

  return (
    <div className="space-y-4" data-testid="container-diarized-transcript">
      <div className="flex flex-wrap items-center gap-4 pb-4 border-b">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {speakerCount || uniqueSpeakers.length} speaker{(speakerCount || uniqueSpeakers.length) !== 1 ? 's' : ''} detected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {formatTimestamp(totalDuration)} duration
          </span>
        </div>
        <div className="flex gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTimestamps(!showTimestamps)}
            className="gap-1"
            data-testid="button-toggle-timestamps"
          >
            <Clock className="w-3 h-3" />
            {showTimestamps ? 'Hide' : 'Show'} Times
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedView(!expandedView)}
            className="gap-1"
            data-testid="button-toggle-view"
          >
            {expandedView ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expandedView ? 'Compact' : 'Expanded'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pb-4">
        {uniqueSpeakers.map((speaker, idx) => {
          const colorIdx = getSpeakerIndex(speaker) % SPEAKER_BADGE_COLORS.length;
          return (
            <Badge 
              key={speaker} 
              variant="outline" 
              className="gap-1"
              data-testid={`badge-speaker-${speaker}`}
            >
              <span 
                className={cn(
                  "w-2 h-2 rounded-full",
                  SPEAKER_BADGE_COLORS[colorIdx]
                )} 
              />
              Speaker {speaker}
            </Badge>
          );
        })}
      </div>

      <div className={cn("space-y-3", !expandedView && "space-y-1")}>
        {utterances.map((utterance, idx) => {
          const colorIdx = getSpeakerIndex(utterance.speaker) % SPEAKER_COLORS.length;
          
          return (
            <div 
              key={idx}
              className={cn(
                "rounded-lg border p-3 transition-colors",
                SPEAKER_COLORS[colorIdx],
                !expandedView && "p-2"
              )}
              data-testid={`utterance-${idx}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "text-white font-medium",
                      SPEAKER_BADGE_COLORS[colorIdx]
                    )}
                    data-testid={`badge-speaker-label-${idx}`}
                  >
                    {utterance.speaker}
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <p 
                    className={cn(
                      "text-foreground",
                      expandedView ? "text-sm leading-relaxed" : "text-xs"
                    )}
                    data-testid={`text-utterance-${idx}`}
                  >
                    {utterance.text}
                  </p>
                </div>
                {showTimestamps && (
                  <button
                    type="button"
                    onClick={() => onTimestampClick?.(utterance.start)}
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
