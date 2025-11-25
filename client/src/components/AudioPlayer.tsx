import { useState, useRef, useEffect, useImperativeHandle, forwardRef, type Ref } from "react";
import { Play, Pause, Volume2, VolumeX, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDistanceToNow, differenceInDays, differenceInHours, differenceInMinutes } from "date-fns";
import { logAuditEvent } from "@/lib/auditLogger";

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
}

export function AudioPlayer({ audioUrl, expiresAt, onExpired, caseId, audioRecordingId, playerRef }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const timelineRef = useRef<HTMLInputElement>(null);
  const isSeekingRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const currentTimeDisplayRef = useRef<HTMLSpanElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  useImperativeHandle(playerRef, () => ({
    seekTo: async (timeMs: number) => {
      if (!audioRef.current || isExpired) return;
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
  }), [isExpired, caseId, audioRecordingId]);

  useEffect(() => {
    setIsExpired(false);
  }, [audioUrl, expiresAt]);

  useEffect(() => {
    if (!expiresAt) return;

    const checkExpiration = () => {
      if (new Date() > expiresAt) {
        setIsExpired(true);
        if (audioRef.current) {
          audioRef.current.pause();
        }
        onExpired?.();
      }
    };

    checkExpiration();
    const interval = setInterval(checkExpiration, 60000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    console.log('AudioPlayer effect running, audioUrl:', audioUrl);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);

    const updateDuration = () => {
      console.log('updateDuration called, audio.duration:', audio.duration);
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        console.log('Audio duration set to:', audio.duration);
      } else {
        console.log('Duration not ready yet:', audio.duration);
      }
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(audio.duration);
    };

    const updateTimeSmooth = () => {
      if (!isSeekingRef.current && audio && !audio.paused) {
        // Update DOM directly via refs to avoid React re-renders on every frame
        if (timelineRef.current) {
          timelineRef.current.value = String(audio.currentTime);
        }
        if (currentTimeDisplayRef.current) {
          currentTimeDisplayRef.current.textContent = formatTime(audio.currentTime);
        }
        // Only update React state occasionally for other UI needs
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
      if (!isSeekingRef.current) {
        setCurrentTime(audio.currentTime);
      }
    };

    const handleError = (e: Event) => {
      console.error('Audio error event:', e);
      console.error('Audio error details:', audio.error);
    };

    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    audio.addEventListener("canplay", updateDuration);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("error", handleError);
    
    // Force load to ensure metadata loads
    console.log('Calling audio.load() to force metadata loading');
    audio.load();
    
    // Check if duration is already loaded (after a small delay)
    const checkDuration = () => {
      console.log('Checking duration, readyState:', audio.readyState, 'duration:', audio.duration);
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
  }, [audioUrl]);

  const togglePlayPause = async () => {
    if (!audioRef.current || isExpired) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      
      // Log audio playback paused
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
        
        // Log audio playback started
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

  const handleTimelineMouseDown = () => {
    isSeekingRef.current = true;
  };

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current || isExpired) return;
    const newTime = parseFloat(e.target.value);
    if (!isFinite(newTime)) return;
    setCurrentTime(newTime);
  };

  const handleTimelineMouseUp = async (e: React.MouseEvent<HTMLInputElement>) => {
    if (!audioRef.current || isExpired) return;
    const newTime = parseFloat((e.target as HTMLInputElement).value);
    if (!isFinite(newTime)) return;
    const previousTime = audioRef.current.currentTime;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    isSeekingRef.current = false;

    // Log audio seek event
    await logAuditEvent({
      eventType: "audio_seeked",
      caseId,
      audioRecordingId,
      metadata: { 
        from: previousTime,
        to: newTime,
        duration: audioRef.current.duration,
      },
      severity: "info",
    });
  };

  const handleTimelineTouchEnd = async (e: React.TouchEvent<HTMLInputElement>) => {
    if (!audioRef.current || isExpired) return;
    const newTime = parseFloat((e.target as HTMLInputElement).value);
    if (!isFinite(newTime)) return;
    const previousTime = audioRef.current.currentTime;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    isSeekingRef.current = false;

    // Log audio seek event
    await logAuditEvent({
      eventType: "audio_seeked",
      caseId,
      audioRecordingId,
      metadata: { 
        from: previousTime,
        to: newTime,
        duration: audioRef.current.duration,
      },
      severity: "info",
    });
  };

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
    if (!expiresAt || isExpired) return null;
    const now = new Date();
    const days = differenceInDays(expiresAt, now);
    const hours = differenceInHours(expiresAt, now) % 24;
    const minutes = differenceInMinutes(expiresAt, now) % 60;
    
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 && days === 0) parts.push(`${minutes}m`);
    
    const timeString = parts.join(' ') || 'less than 1 minute';
    const isUrgent = days === 0 && hours < 24;
    
    return (
      <div 
        className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-md ${
          isUrgent 
            ? 'bg-destructive/10 text-destructive border border-destructive/20' 
            : 'bg-muted text-muted-foreground'
        }`}
        data-testid="text-retention-countdown"
      >
        <Clock className="h-3 w-3" />
        <span>Audio retained for: <strong>{timeString}</strong></span>
      </div>
    );
  };

  const getExpirationWarning = () => {
    if (!expiresAt || isExpired) return null;
    const now = new Date();
    const hoursLeft = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursLeft < 24) {
      return (
        <Alert variant="destructive" className="mb-4" data-testid="alert-audio-expiring">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Audio expires {formatDistanceToNow(expiresAt, { addSuffix: true })}. Permanent transcript will be retained.
          </AlertDescription>
        </Alert>
      );
    }
    return null;
  };

  if (isExpired) {
    return (
      <Alert className="mb-4" data-testid="alert-audio-expired">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Audio recording has expired (24hr retention policy). The transcript remains available below.
        </AlertDescription>
      </Alert>
    );
  }

  if (!audioUrl) {
    return null;
  }

  return (
    <div className="space-y-4">
      {getExpirationWarning()}
      
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      <div className="bg-card border-2 rounded-lg p-4 space-y-3" data-testid="audio-player">
        <div className="flex items-center gap-4">
          <Button
            size="icon"
            variant="outline"
            onClick={togglePlayPause}
            data-testid="button-play-pause"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>

          <div className="flex-1 space-y-1">
            <input
              ref={timelineRef}
              type="range"
              min={0}
              max={duration > 0 ? duration : 100}
              step={0.01}
              value={currentTime}
              onMouseDown={handleTimelineMouseDown}
              onTouchStart={handleTimelineMouseDown}
              onChange={handleTimelineChange}
              onMouseUp={handleTimelineMouseUp}
              onTouchEnd={handleTimelineTouchEnd}
              className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
              data-testid="slider-timeline"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span ref={currentTimeDisplayRef} data-testid="text-current-time">{formatTime(currentTime)}</span>
              <span data-testid="text-duration">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 min-w-[120px]">
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleMute}
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
              className="w-16"
              data-testid="slider-volume"
            />
          </div>
        </div>
        
        {/* GDPR Retention Countdown */}
        <div className="flex justify-end">
          {getRetentionCountdown()}
        </div>
      </div>
    </div>
  );
}
