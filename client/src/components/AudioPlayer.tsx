import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDistanceToNow } from "date-fns";

interface AudioPlayerProps {
  audioUrl: string | null;
  expiresAt: Date | null;
  onExpired?: () => void;
}

export function AudioPlayer({ audioUrl, expiresAt, onExpired }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const timelineRef = useRef<HTMLInputElement>(null);
  const isSeekingRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

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

    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);

    const updateDuration = () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        console.log('Audio duration loaded:', audio.duration);
      }
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(audio.duration);
    };

    const updateTimeSmooth = () => {
      if (!isSeekingRef.current && audio && !audio.paused) {
        setCurrentTime(audio.currentTime);
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

    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, [audioUrl]);

  const togglePlayPause = () => {
    if (!audioRef.current || isExpired || duration === 0) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
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

  const handleTimelineMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
    if (!audioRef.current || isExpired) return;
    const newTime = parseFloat((e.target as HTMLInputElement).value);
    if (!isFinite(newTime)) return;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    isSeekingRef.current = false;
  };

  const handleTimelineTouchEnd = (e: React.TouchEvent<HTMLInputElement>) => {
    if (!audioRef.current || isExpired) return;
    const newTime = parseFloat((e.target as HTMLInputElement).value);
    if (!isFinite(newTime)) return;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    isSeekingRef.current = false;
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
            disabled={duration === 0}
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
              max={duration > 0 ? duration : 1}
              step={0.01}
              value={currentTime}
              onMouseDown={handleTimelineMouseDown}
              onTouchStart={handleTimelineMouseDown}
              onChange={handleTimelineChange}
              onMouseUp={handleTimelineMouseUp}
              onTouchEnd={handleTimelineTouchEnd}
              disabled={duration === 0}
              className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
              data-testid="slider-timeline"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span data-testid="text-current-time">{formatTime(currentTime)}</span>
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
      </div>
    </div>
  );
}
