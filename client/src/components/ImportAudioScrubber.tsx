import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatRecordingClock } from "@shared/assignableRecording";
import { logAuditEvent } from "@/lib/auditLogger";

interface ImportAudioScrubberProps {
  importId: string;
  knownDurationSeconds?: number | null;
}

/**
 * Lightweight player for an unassigned video-call recording.
 * Skip and drag are the point: empty joins and reconnect attempts are mostly silence.
 */
export function ImportAudioScrubber({ importId, knownDurationSeconds }: ImportAudioScrubberProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const loggedPlay = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(knownDurationSeconds ?? 0);
  const [error, setError] = useState(false);

  useEffect(() => {
    setPlaying(false);
    setTime(0);
    setError(false);
    setDuration(knownDurationSeconds && knownDurationSeconds > 0 ? knownDurationSeconds : 0);
    loggedPlay.current = false;
  }, [importId, knownDurationSeconds]);

  const length = duration > 0 ? duration : knownDurationSeconds && knownDurationSeconds > 0 ? knownDurationSeconds : 0;

  const seekTo = (next: number) => {
    const audio = audioRef.current;
    if (!audio || error) return;
    const cap = length || (Number.isFinite(audio.duration) ? audio.duration : next);
    const clamped = Math.min(Math.max(0, next), cap || next);
    audio.currentTime = clamped;
    setTime(clamped);
  };

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || error) return;
    if (audio.paused) {
      try {
        await audio.play();
        if (!loggedPlay.current) {
          loggedPlay.current = true;
          void logAuditEvent({
            eventType: "meeting_import_audio_previewed",
            metadata: { importId },
          });
        }
      } catch {
        setError(true);
      }
    } else {
      audio.pause();
    }
  };

  if (error) {
    return (
      <p className="text-xs text-muted-foreground" data-testid="text-import-audio-error">
        Couldn’t load the audio. You can still assign this recording or delete it.
      </p>
    );
  }

  const shown = formatRecordingClock(time) ?? "0:00";
  const total = formatRecordingClock(length);

  return (
    <div className="space-y-2" data-testid="import-audio-scrubber">
      <audio
        ref={audioRef}
        src={`/api/recall/import/${importId}/audio`}
        preload="metadata"
        onLoadedMetadata={(event) => {
          const next = event.currentTarget.duration;
          if (Number.isFinite(next) && next > 0) setDuration(next);
        }}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setError(true)}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8 shrink-0"
          onClick={() => seekTo(time - 15)}
          aria-label="Back 15 seconds"
          data-testid="button-audio-back-15"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => void toggle()}
          aria-label={playing ? "Pause" : "Play"}
          data-testid="button-audio-play"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8 shrink-0"
          onClick={() => seekTo(time + 30)}
          aria-label="Forward 30 seconds"
          data-testid="button-audio-forward-30"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </Button>
        <Slider
          value={[length > 0 ? Math.min(time, length) : 0]}
          max={length > 0 ? length : 1}
          step={0.1}
          disabled={length <= 0}
          onValueChange={([value]) => seekTo(value)}
          aria-label="Recording position"
          className="flex-1"
          data-testid="slider-import-audio"
        />
        <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground whitespace-nowrap">
          {shown}{total ? ` / ${total}` : ""}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => seekTo(time + 120)}
          data-testid="button-audio-skip-2m"
        >
          Skip 2 min
        </Button>
        {length > 30 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => seekTo(Math.max(0, length - 20))}
            data-testid="button-audio-near-end"
          >
            Near the end
          </Button>
        )}
      </div>
    </div>
  );
}
