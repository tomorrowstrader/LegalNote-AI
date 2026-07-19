import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield, Play, Pause, Clock, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  RECORDING_TYPE_LABELS,
  type ConsentLog,
  type MeetingSession,
  type RecordingType,
} from "@shared/schema";

interface CaseAudioRecording {
  id: string;
  meetingSessionId: string | null;
  consentSegmentPath: string | null;
  consentDurationSeconds: number | null;
  duration: number | null;
  recordedAt: string | Date;
  expiresAt: string | Date;
  deletedAt: string | Date | null;
}

interface ConsentEvidenceProps {
  caseId: string;
  sessions: MeetingSession[];
  consentLogs: ConsentLog[];
  focusSessionId?: string | null;
}

function formatConsentDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function modalityLabel(modality: string | null | undefined): string {
  if (modality === "verbal_recorded") return "Verbal (Recorded)";
  if (modality === "verbal_witnessed" || modality === "verbal_attested") return "Verbal (Witnessed)";
  if (modality === "written") return "Written";
  return modality || "Unknown";
}

function SessionConsentRow({
  sessionNumber,
  sessionTotal,
  session,
  recording,
  consentLog,
  isFocused,
}: {
  sessionNumber: number;
  sessionTotal: number;
  session: MeetingSession;
  recording?: CaseAudioRecording;
  consentLog?: ConsentLog;
  isFocused?: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [playError, setPlayError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const consentSegmentUrl = recording?.id
    ? `/api/audio/${recording.id}/consent-segment`
    : null;
  const consentGiven = consentLog?.consentGiven === true && !consentLog.consentWithdrawn;
  const consentDeclined = consentLog?.consentGiven === false;
  const consentWithdrawn = consentLog?.consentWithdrawn === true;
  const canPlayRecordedConsent =
    !!recording?.consentSegmentPath &&
    consentGiven &&
    consentLog?.consentModality === "verbal_recorded";

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const handlePlayPause = async () => {
    if (!consentSegmentUrl) return;
    setPlayError(false);

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch {
          setIsPlaying(false);
          setPlayError(true);
        }
      }
      return;
    }

    setIsLoadingAudio(true);
    try {
      const response = await fetch(consentSegmentUrl, { credentials: "include" });
      if (!response.ok) throw new Error(`Failed to load consent segment (${response.status})`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      blobUrlRef.current = objectUrl;
      const audio = new Audio(objectUrl);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setIsPlaying(false);
        setPlayError(true);
      };
      audioRef.current = audio;
      await audio.play();
      setIsPlaying(true);
    } catch {
      setPlayError(true);
      setIsPlaying(false);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const sessionLabel =
    session.sessionTitle ||
    RECORDING_TYPE_LABELS[session.recordingType as RecordingType] ||
    session.recordingType;

  const sessionDate = session.startedAt
    ? format(new Date(session.startedAt), "d MMM yyyy")
    : null;

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-3 rounded-lg bg-background border transition-colors",
        isFocused && "ring-1 ring-accent/40 border-accent/30 bg-accent/[0.03]",
      )}
      data-testid={`consent-session-row-${session.id}`}
    >
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
            data-testid={`text-consent-session-of-${session.id}`}
          >
            Session {sessionNumber} of {sessionTotal}
          </span>
          {consentGiven ? (
            <Badge
              variant="outline"
              className="text-[10px] bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30 no-default-hover-elevate no-default-active-elevate"
              data-testid={`badge-consent-status-${session.id}`}
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Confirmed
            </Badge>
          ) : consentWithdrawn ? (
            <Badge
              variant="outline"
              className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 no-default-hover-elevate no-default-active-elevate"
              data-testid={`badge-consent-status-${session.id}`}
            >
              Withdrawn
            </Badge>
          ) : consentDeclined ? (
            <Badge
              variant="outline"
              className="text-[10px] bg-destructive/10 text-destructive border-destructive/30 no-default-hover-elevate no-default-active-elevate"
              data-testid={`badge-consent-status-${session.id}`}
            >
              <XCircle className="w-3 h-3 mr-1" />
              Declined
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[10px] text-muted-foreground no-default-hover-elevate no-default-active-elevate"
              data-testid={`badge-consent-status-${session.id}`}
            >
              Not recorded
            </Badge>
          )}
        </div>

        <p className="text-sm font-medium text-foreground truncate" data-testid={`text-consent-session-title-${session.id}`}>
          {sessionLabel}
        </p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {sessionDate && (
            <span className="flex items-center gap-1" data-testid={`text-consent-session-date-${session.id}`}>
              <Clock className="w-3 h-3" />
              {sessionDate}
            </span>
          )}
          {consentLog && (
            <span data-testid={`text-consent-timestamp-${session.id}`}>
              {format(new Date(consentLog.consentTimestamp), "dd MMM yyyy 'at' HH:mm")}
            </span>
          )}
          {consentLog?.consentModality && (
            <Badge variant="secondary" className="text-[10px] h-5 no-default-hover-elevate no-default-active-elevate" data-testid={`badge-consent-modality-${session.id}`}>
              {modalityLabel(consentLog.consentModality)}
            </Badge>
          )}
          {recording?.consentDurationSeconds != null && (
            <span data-testid={`text-consent-duration-${session.id}`}>
              Snippet {formatConsentDuration(recording.consentDurationSeconds)}
            </span>
          )}
        </div>

        {playError && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Unable to play consent snippet</span>
          </div>
        )}
      </div>

      {canPlayRecordedConsent && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => void handlePlayPause()}
          disabled={isLoadingAudio}
          className={cn(
            "h-11 w-11 rounded-full shrink-0",
            isPlaying && "bg-accent/10 border-accent/40",
          )}
          aria-label={isPlaying ? "Pause consent snippet" : "Play consent snippet"}
          data-testid={`button-play-consent-${session.id}`}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </Button>
      )}
    </div>
  );
}

export function ConsentEvidence({ caseId, sessions, consentLogs, focusSessionId }: ConsentEvidenceProps) {
  const { data: recordings = [], isLoading: recordingsLoading } = useQuery<CaseAudioRecording[]>({
    queryKey: [`/api/cases/${caseId}/audio-recordings`],
    enabled: !!caseId,
  });

  const sessionsChronological = useMemo(
    () =>
      [...sessions].sort(
        (a, b) => new Date(a.startedAt ?? 0).getTime() - new Date(b.startedAt ?? 0).getTime(),
      ),
    [sessions],
  );

  const recordingBySessionId = useMemo(() => {
    const map = new Map<string, CaseAudioRecording>();
    for (const recording of recordings) {
      if (recording.meetingSessionId) {
        map.set(recording.meetingSessionId, recording);
      }
    }
    return map;
  }, [recordings]);

  const consentByAudioId = useMemo(() => {
    const map = new Map<string, ConsentLog>();
    for (const log of consentLogs) {
      if (log.audioRecordingId) {
        const existing = map.get(log.audioRecordingId);
        // Prefer the most recent given/withdrawn record for each recording
        if (
          !existing ||
          new Date(log.consentTimestamp).getTime() > new Date(existing.consentTimestamp).getTime()
        ) {
          map.set(log.audioRecordingId, log);
        }
      }
    }
    return map;
  }, [consentLogs]);

  // Orphan logs (no audioRecordingId) — match to nearest session by timestamp once
  const orphanLogsBySessionId = useMemo(() => {
    const map = new Map<string, ConsentLog>();
    const usedSessionIds = new Set<string>();

    for (const recording of recordings) {
      if (recording.meetingSessionId && consentByAudioId.has(recording.id)) {
        usedSessionIds.add(recording.meetingSessionId);
      }
    }

    const orphans = consentLogs
      .filter((log) => !log.audioRecordingId)
      .sort(
        (a, b) =>
          new Date(a.consentTimestamp).getTime() - new Date(b.consentTimestamp).getTime(),
      );

    for (const log of orphans) {
      let bestSession: MeetingSession | null = null;
      let bestDelta = Number.POSITIVE_INFINITY;
      for (const session of sessionsChronological) {
        if (usedSessionIds.has(session.id) || map.has(session.id)) continue;
        const delta = Math.abs(
          new Date(session.startedAt ?? 0).getTime() - new Date(log.consentTimestamp).getTime(),
        );
        if (delta < bestDelta) {
          bestDelta = delta;
          bestSession = session;
        }
      }
      if (bestSession) {
        map.set(bestSession.id, log);
      }
    }
    return map;
  }, [consentLogs, consentByAudioId, recordings, sessionsChronological]);

  const hasAnyEvidence =
    sessionsChronological.length > 0 ||
    consentLogs.length > 0 ||
    recordings.some((r) => !!r.consentSegmentPath);

  if (!hasAnyEvidence && !recordingsLoading) {
    return (
      <div className="text-center py-16 space-y-3" data-testid="consent-evidence-empty">
        <Shield className="w-8 h-8 mx-auto text-muted-foreground/40" />
        <p className="font-medium text-sm">No consent evidence yet</p>
        <p className="text-xs text-muted-foreground">
          Consent confirmation is recorded per session when a meeting is recorded.
        </p>
      </div>
    );
  }

  const verifiedCount = sessionsChronological.filter((session) => {
    const recording = recordingBySessionId.get(session.id);
    const log =
      (recording ? consentByAudioId.get(recording.id) : undefined) ||
      orphanLogsBySessionId.get(session.id);
    return log?.consentGiven === true && !log.consentWithdrawn;
  }).length;

  return (
    <Card className="border-green-500/20 bg-green-500/5" data-testid="card-consent-evidence">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base text-foreground">Consent Evidence</CardTitle>
            <CardDescription className="text-xs">
              Audio consent confirmation per recorded session · preserved for compliance
            </CardDescription>
          </div>
          {verifiedCount > 0 && (
            <Badge
              variant="outline"
              className="ml-auto shrink-0 bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30"
              data-testid="badge-consent-verified"
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              {verifiedCount}/{sessionsChronological.length || verifiedCount} verified
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {recordingsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : sessionsChronological.length > 0 ? (
          sessionsChronological.map((session, index) => {
            const recording = recordingBySessionId.get(session.id);
            const consentLog =
              (recording ? consentByAudioId.get(recording.id) : undefined) ||
              orphanLogsBySessionId.get(session.id);
            return (
              <SessionConsentRow
                key={session.id}
                sessionNumber={index + 1}
                sessionTotal={sessionsChronological.length}
                session={session}
                recording={recording}
                consentLog={consentLog}
                isFocused={focusSessionId === session.id}
              />
            );
          })
        ) : (
          // Legacy case with consent logs but no meeting sessions yet
          consentLogs.map((log) => {
            const recording = recordings.find((r) => r.id === log.audioRecordingId);
            return (
              <div
                key={log.id}
                className="flex items-center gap-4 p-3 rounded-lg bg-background border"
                data-testid={`consent-legacy-row-${log.id}`}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-medium">Consent record</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(log.consentTimestamp), "dd MMM yyyy 'at' HH:mm")}
                    {" · "}
                    {modalityLabel(log.consentModality)}
                  </p>
                </div>
                {recording?.consentSegmentPath &&
                  log.consentGiven === true &&
                  !log.consentWithdrawn &&
                  log.consentModality === "verbal_recorded" && (
                  <LegacyConsentPlayButton audioId={recording.id} />
                )}
              </div>
            );
          })
        )}

        <p className="text-xs text-muted-foreground pt-1">
          Each session&apos;s consent snippet is preserved indefinitely to document the legal basis for
          processing client data (GDPR Article 7).
        </p>
      </CardContent>
    </Card>
  );
}

function LegacyConsentPlayButton({ audioId }: { audioId: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const url = `/api/audio/${audioId}/consent-segment`;

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const handlePlayPause = async () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
      return;
    }
    setIsLoadingAudio(true);
    try {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      blobUrlRef.current = objectUrl;
      const audio = new Audio(objectUrl);
      audio.onended = () => setIsPlaying(false);
      audioRef.current = audio;
      await audio.play();
      setIsPlaying(true);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => void handlePlayPause()}
      disabled={isLoadingAudio}
      className={cn("h-11 w-11 rounded-full shrink-0", isPlaying && "bg-accent/10 border-accent/40")}
      aria-label={isPlaying ? "Pause consent snippet" : "Play consent snippet"}
      data-testid={`button-play-consent-legacy-${audioId}`}
    >
      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
    </Button>
  );
}
