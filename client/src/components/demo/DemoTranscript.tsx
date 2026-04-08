import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, ChevronLeft, Clock, FileText, CheckCircle2 } from "lucide-react";
import type { DemoLeadMatter } from "@/data/demoData";

interface DemoTranscriptProps {
  matter: DemoLeadMatter;
  onBack: () => void;
}

const SPEAKER_STYLES: Record<string, string> = {
  Solicitor: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  Client: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
  Counsel: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  Witness: "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800",
};

export function DemoTranscript({ matter, onBack }: DemoTranscriptProps) {
  const speakers = Array.from(new Set(matter.transcript.map((t) => t.speaker)));

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <button onClick={onBack} className="hover:text-foreground transition-colors">
          Case Detail
        </button>
        <span>/</span>
        <span className="text-foreground font-medium">Transcript — Initial Consultation</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4" data-testid="transcript-header">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Transcript</h2>
            <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Verified
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground font-medium">{matter.title}</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {matter.transcriptDuration ?? `${Math.round(matter.transcript.length * 0.5)} min`}
            </span>
            <span>&middot;</span>
            <span>{(matter.transcriptWordCount ?? matter.transcript.reduce((n, t) => n + t.text.split(" ").length, 0)).toLocaleString()} words</span>
            <span>&middot;</span>
            <span>{matter.transcript.length} speaker turns</span>
            <span>&middot;</span>
            <span>Diarized, {speakers.length} speakers</span>
          </div>
        </div>
      </div>

      {/* AI production notice */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground">
        <FileText className="w-4 h-4 flex-shrink-0 text-primary mt-0.5" />
        <div>
          <p className="font-medium text-foreground mb-0.5">Transcript produced from {matter.transcriptDuration} recording</p>
          <p>This diarized transcript was generated automatically by LegalNote AI. Each speaker turn is labelled and timestamped. Word-level timestamps are available in the full export.</p>
        </div>
      </div>

      {/* Speaker legend */}
      <div className="flex flex-wrap gap-2">
        {speakers.map((speaker) => (
          <Badge
            key={speaker}
            variant="outline"
            className={`text-xs ${SPEAKER_STYLES[speaker] || ""}`}
          >
            {speaker}
          </Badge>
        ))}
      </div>

      {/* Transcript turns */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="space-y-4">
            {matter.transcript.map((turn) => (
              <div
                key={turn.id}
                className="flex gap-3"
                data-testid={`transcript-turn-${turn.id}`}
              >
                <div className="flex flex-col items-center gap-1 flex-shrink-0 w-28">
                  <Badge
                    variant="outline"
                    className={`text-xs w-full justify-center ${SPEAKER_STYLES[turn.speaker] || ""}`}
                  >
                    {turn.speaker}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">{turn.timestamp}</span>
                </div>
                <p className="text-sm leading-relaxed text-foreground/90 flex-1">
                  {turn.text}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Footer notice */}
      <div className="text-xs text-muted-foreground text-center py-2">
        End of transcript &mdash; {(matter.transcriptWordCount ?? matter.transcript.reduce((n, t) => n + t.text.split(" ").length, 0)).toLocaleString()} words &middot; HMAC-SHA256 signed &middot; Stored encrypted at rest
      </div>
    </div>
  );
}
