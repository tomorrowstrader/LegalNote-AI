import { useState, useRef, useEffect, useImperativeHandle, useCallback, type Ref } from "react";
import { Play, Pause, Volume2, VolumeX, Clock, SkipBack, SkipForward, ShieldCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatDistanceToNow, differenceInDays, differenceInHours, differenceInMinutes } from "date-fns";
import { logAuditEvent } from "@/lib/auditLogger";

const BAR_COUNT = 60;

function generateWaveformBars(): number[] {
  const bars: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const t = i / (BAR_COUNT - 1);
    const envelope = Math.sin(t * Math.PI);
    const variation = 0.15 * Math.sin(t * Math.PI * 7) + 0.1 * Math.sin(t * Math.PI * 13);
    bars.push(Math.max(0.08, Math.min(1, envelope * 0.7 + 0.2 + variation)));
  }
  return bars;
}

const WAVEFORM_BARS = generateWaveformBars();

function getEffectiveDuration(elementDuration: number, knownDurationSeconds?: number): number {
  if (isFinite(elementDuration) && elementDuration > 0) return elementDuration;
  if (knownDurationSeconds && knownDurationSeconds > 0) return knownDurationSeconds;
  return 0;
}

export interface AudioPlayerHandle {
  seekTo: (timeMs: number) => void;
}

interface AudioPlayerProps {
  audioUrl: string | null;
  expiresAt: Date | null;
  onExpired?: () => void;
  caseId?: string;
  audioRecordingId?: string;
  playerRef?: Ref<AudioPlayerHandle>;
  knownDurationSeconds?: number;
  litigationHold?: boolean;
  litigationHoldReason?: string | null;
}

export function AudioPlayer({ audioUrl, expiresAt, onExpired, caseId, audioRecordingId, playerRef, knownDurationSeconds, litigationHold, litigationHoldReason }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartTimeRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const currentTimeDisplayRef = useRef<HTMLSpanElement>(null);
  const barRefsArray = useRef<(HTMLDivElement | null)[]>([]);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [elementDuration, setElementDuration] = useState(0);
  const duration = getEffectiveDuration(elementDuration, knownDurationSeconds);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isPastRetentionExpiry, setIsPastRetentionExpiry] = useState(false);

  const isPlaybackBlocked = isPastRetentionExpiry && !litigationHold;

  useImperativeHandle(playerRef, () => ({
    seekTo: async (timeMs: number) => {
      if (!audioRef.current || isPlaybackBlocked) return;
      const timeSeconds = timeMs / 1000;
      if (!isFinite(timeSeconds)) return;
      const previousTime = audioRef.current.currentTime;
      audioRef.current.currentTime = timeSeconds;
      setCurrentTime(timeSeconds);
      
      await logAuditEvent({
        eventType: "audio_seeked",
        caseId,
        audioRecordingId,
        metadata: { 
          from: previousTime,
          to: timeSeconds,
          duration: audioRef.current.duration,
          source: "transcript_timestamp",
        },
        severity: "info",
      });
    },
  }), [isPlaybackBlocked, caseId, audioRecordingId]);

  useEffect(() => {
    setIsPastRetentionExpiry(false);
  }, [audioUrl, expiresAt, litigationHold]);

  useEffect(() => {
    if (!expiresAt) return;

    const checkExpiration = () => {
      const past = new Date() > expiresAt;
      setIsPastRetentionExpiry(past);
      if (past && !litigationHold) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        onExpired?.();
      }
    };

    checkExpiration();
    const interval = setInterval(checkExpiration, 60000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired, litigationHold]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentTime(0);
    setElementDuration(0);
    setIsPlaying(false);

    const updateDuration = () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setElementDuration(audio.duration);
      }
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      const endedAt = getEffectiveDuration(audio.duration, knownDurationSeconds);
      setCurrentTime(endedAt > 0 ? endedAt : audio.currentTime);
    };

    const updateTimeSmooth = () => {
      if (!isDraggingRef.current && audio && !audio.paused) {
        const timelineDuration = getEffectiveDuration(audio.duration, knownDurationSeconds);
        const progress = timelineDuration > 0 ? audio.currentTime / timelineDuration : 0;
        const playedBars = Math.floor(progress * BAR_COUNT);
        barRefsArray.current.forEach((bar, i) => {
          if (bar) {
            bar.style.backgroundColor = i < playedBars
              ? 'hsl(var(--primary))'
              : 'hsl(var(--muted-foreground) / 0.25)';
          }
        });
        if (currentTimeDisplayRef.current) {
          currentTimeDisplayRef.current.textContent = formatTime(audio.currentTime);
        }
        if (Math.abs(audio.currentTime - currentTime) > 0.5) {
          setCurrentTime(audio.currentTime);
        }
      }
      if (audio && !audio.paused) {
        animationFrameRef.current = requestAnimationFrame(updateTimeSmooth);
      }
    };

    const handlePlay = () => {
      updateTimeSmooth();
    };

    const handlePause = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (!isDraggingRef.current) {
        setCurrentTime(audio.currentTime);
      }
    };

    const handleError = (e: Event) => {
      console.error('Audio error event:', e);
    };

    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    audio.addEventListener("canplay", updateDuration);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("error", handleError);
    
    audio.load();
    
    const checkDuration = () => {
      if (audio.readyState >= 1) {
        updateDuration();
      }
    };
    setTimeout(checkDuration, 100);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
      audio.removeEventListener("canplay", updateDuration);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("error", handleError);
    };
  }, [audioUrl, knownDurationSeconds]);

  const togglePlayPause = async () => {
    if (!audioRef.current || isPlaybackBlocked) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      
      await logAuditEvent({
        eventType: "audio_playback_paused",
        caseId,
        audioRecordingId,
        metadata: { 
          pausedAt: audioRef.current.currentTime,
          duration: audioRef.current.duration,
        },
        severity: "info",
      });
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        
        await logAuditEvent({
          eventType: "audio_playback_started",
          caseId,
          audioRecordingId,
          metadata: { 
            startedAt: audioRef.current.currentTime,
            duration: audioRef.current.duration,
          },
          severity: "info",
        });
      } catch (error) {
        console.error('Play failed:', error);
      }
    }
  };

  const skipBy = useCallback(async (seconds: number) => {
    if (!audioRef.current || isPlaybackBlocked || duration <= 0) return;
    const prevTime = audioRef.current.currentTime;
    const newTime = Math.max(0, Math.min(duration, prevTime + seconds));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);

    await logAuditEvent({
      eventType: "audio_seeked",
      caseId,
      audioRecordingId,
      metadata: { from: prevTime, to: newTime, duration, source: "skip_button" },
      severity: "info",
    });
  }, [isPlaybackBlocked, duration, caseId, audioRecordingId]);

  const seekToFraction = useCallback((clientX: number) => {
    if (!audioRef.current || duration <= 0) return;
    const container = waveformRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newTime = fraction * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  const handleWaveformPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!audioRef.current || isPlaybackBlocked || duration <= 0) return;
    dragStartTimeRef.current = audioRef.current.currentTime;
    isDraggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    seekToFraction(e.clientX);
  }, [isPlaybackBlocked, duration, seekToFraction]);

  const handleWaveformPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    seekToFraction(e.clientX);
  }, [seekToFraction]);

  const handleWaveformPointerUp = useCallback(async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !audioRef.current) return;
    isDraggingRef.current = false;
    seekToFraction(e.clientX);

    await logAuditEvent({
      eventType: "audio_seeked",
      caseId,
      audioRecordingId,
      metadata: {
        from: dragStartTimeRef.current,
        to: audioRef.current.currentTime,
        duration: audioRef.current.duration,
      },
      severity: "info",
    });
  }, [caseId, audioRecordingId, seekToFraction]);

  const handleWaveformKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!audioRef.current || isPlaybackBlocked || duration <= 0) return;
    let seekDelta = 0;
    switch (e.key) {
      case 'ArrowRight': seekDelta = 5; break;
      case 'ArrowLeft': seekDelta = -5; break;
      case 'Home':
        audioRef.current.currentTime = 0;
        setCurrentTime(0);
        e.preventDefault();
        return;
      case 'End':
        audioRef.current.currentTime = duration;
        setCurrentTime(duration);
        e.preventDefault();
        return;
      default: return;
    }
    e.preventDefault();
    const newTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seekDelta));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [isPlaybackBlocked, duration]);

  const handleVolumeChange = (value: number[]) => {
    if (!audioRef.current) return;
    const newVolume = value[0];
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const newMuted = !isMuted;
    audioRef.current.muted = newMuted;
    setIsMuted(newMuted);
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getRetentionCountdown = () => {
    if (!expiresAt || isPastRetentionExpiry) return null;
    const isDemoMode = window.location.pathname.startsWith("/demo/");
    const now = new Date();
    const days = differenceInDays(expiresAt, now);
    const hours = differenceInHours(expiresAt, now) % 24;
    const minutes = differenceInMinutes(expiresAt, now) % 60;
    
    let timeString: string;
    if (isDemoMode) {
      timeString = "6d 23hrs 58mins";
    } else {
      const parts: string[] = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0 && days === 0) parts.push(`${minutes}m`);
      timeString = parts.join(' ') || 'less than 1 minute';
    }
    const isUrgent = days === 0 && hours < 24;
    
    return (
      <div 
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
          isUrgent 
            ? 'bg-destructive/10 text-destructive border-destructive/20' 
            : 'bg-muted/40 text-muted-foreground border-border/40'
        }`}
        data-testid="audio-retention-countdown"
      >
        <Clock className="h-3 w-3" />
        <span>Audio retained for: <strong>{timeString}</strong></span>
      </div>
    );
  };

  const getExpirationWarning = () => {
    if (!expiresAt || isPastRetentionExpiry) return null;
    const now = new Date();
    const hoursLeft = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursLeft < 24) {
      return (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 mb-2" data-testid="alert-audio-expiring">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>Audio expires {formatDistanceToNow(expiresAt, { addSuffix: true })}. Permanent transcript will be retained.</span>
        </div>
      );
    }
    return null;
  };

  if (!audioUrl || isPlaybackBlocked) {
    return (
      <div className="relative" data-testid="audio-player-expired">
        <div className="bg-gradient-to-b from-card to-muted/20 border border-border/60 rounded-2xl px-3 py-3 sm:px-5 sm:py-4 opacity-40 pointer-events-none select-none overflow-hidden">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center justify-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                <SkipBack className="h-3 w-3 text-muted-foreground/50" />
              </div>
              <div className="w-12 h-12 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                <Play className="h-5 w-5 text-muted-foreground/50 ml-0.5" />
              </div>
              <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                <SkipForward className="h-3 w-3 text-muted-foreground/50" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-end gap-px sm:gap-[2px] h-8 w-full overflow-hidden">
                {WAVEFORM_BARS.map((height, i) => (
                  <div
                    key={i}
                    className="flex-1 min-w-0 rounded-full bg-muted-foreground/15"
                    style={{ height: `${height * 100}%` }}
                  />
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground/50 mt-1">
                <span>0:00</span>
                <span>0:00</span>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 bg-card/95 backdrop-blur-sm border rounded-md px-4 py-2.5 shadow-sm">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-medium">Recording securely deleted</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid={isPastRetentionExpiry && litigationHold ? "audio-player-litigation-hold-preserved" : undefined}>
      {isPastRetentionExpiry && litigationHold && (
        <div
          className="flex items-start gap-2 text-xs bg-red-50 dark:bg-red-950/30 border border-red-400/60 dark:border-red-700/60 rounded-md px-3 py-2"
          data-testid="alert-audio-litigation-hold-preserved"
        >
          <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-700 dark:text-red-400" />
          <div>
            <p className="font-medium text-red-900 dark:text-red-200">
              This recording is preserved under litigation hold
            </p>
            {litigationHoldReason && (
              <p className="text-red-800/80 dark:text-red-300/80 mt-0.5">{litigationHoldReason}</p>
            )}
          </div>
        </div>
      )}
      {getExpirationWarning()}
      
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      <div className="bg-gradient-to-b from-card to-muted/20 border border-border/60 rounded-2xl px-3 py-3 sm:px-5 sm:py-4 shadow-sm overflow-hidden" data-testid="audio-player">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center justify-center gap-2 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => skipBy(-15)}
              className="rounded-full w-9 h-9 text-muted-foreground hover:text-foreground"
              data-testid="button-skip-back"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </Button>

            <button
              onClick={togglePlayPause}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center transition-all active:scale-95 shadow-md hover:shadow-lg hover:brightness-105"
              data-testid="button-play-pause"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </button>

            <Button
              size="icon"
              variant="ghost"
              onClick={() => skipBy(15)}
              className="rounded-full w-9 h-9 text-muted-foreground hover:text-foreground"
              data-testid="button-skip-forward"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div
              ref={waveformRef}
              className="flex items-end gap-px sm:gap-[2px] h-10 sm:h-12 w-full overflow-hidden cursor-pointer select-none rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary touch-none"
              onPointerDown={handleWaveformPointerDown}
              onPointerMove={handleWaveformPointerMove}
              onPointerUp={handleWaveformPointerUp}
              onPointerCancel={() => { isDraggingRef.current = false; }}
              onLostPointerCapture={() => { isDraggingRef.current = false; }}
              onKeyDown={handleWaveformKeyDown}
              data-testid="waveform-timeline"
              role="slider"
              aria-label="Audio timeline"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={currentTime}
              aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
              tabIndex={0}
            >
              {WAVEFORM_BARS.map((height, i) => {
                const progress = duration > 0 ? currentTime / duration : 0;
                const isPlayed = i < Math.floor(progress * BAR_COUNT);
                return (
                  <div
                    key={i}
                    ref={el => { barRefsArray.current[i] = el; }}
                    className="flex-1 min-w-0 rounded-full"
                    style={{
                      height: `${height * 100}%`,
                      backgroundColor: isPlayed
                        ? 'hsl(var(--primary))'
                        : 'hsl(var(--muted-foreground) / 0.25)',
                    }}
                    data-testid={`waveform-bar-${i}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span ref={currentTimeDisplayRef} data-testid="text-current-time" className="font-medium tabular-nums">{formatTime(currentTime)}</span>
              <span data-testid="text-duration" className="tabular-nums">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 sm:pl-2 sm:border-l sm:border-border/40">
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleMute}
              className="shrink-0"
              data-testid="button-mute"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              max={1}
              step={0.01}
              onValueChange={handleVolumeChange}
              className="flex-1 sm:flex-none sm:w-16"
              data-testid="slider-volume"
            />
          </div>
        </div>
        
        <div className="flex justify-end mt-3">
          {getRetentionCountdown()}
        </div>
      </div>
    </div>
  );
}
