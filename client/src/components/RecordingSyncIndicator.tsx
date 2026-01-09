import { useState, useEffect } from "react";
import { Cloud, CloudOff, CheckCircle, AlertTriangle, Loader2, Wifi, WifiOff, BatteryLow } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface RecordingSyncIndicatorProps {
  isRecording: boolean;
  chunksUploaded: number;
  lastSyncTime: Date | null;
  networkOnline: boolean;
  pendingChunks: number;
  batteryLevel?: number;
  className?: string;
}

export function RecordingSyncIndicator({
  isRecording,
  chunksUploaded,
  lastSyncTime,
  networkOnline,
  pendingChunks,
  batteryLevel,
  className,
}: RecordingSyncIndicatorProps) {
  const [pulseVisible, setPulseVisible] = useState(false);
  const [timeSinceSync, setTimeSinceSync] = useState<string>("--");

  useEffect(() => {
    if (!lastSyncTime) {
      setTimeSinceSync("--");
      return;
    }

    const updateTime = () => {
      const seconds = Math.floor((Date.now() - lastSyncTime.getTime()) / 1000);
      if (seconds < 5) {
        setTimeSinceSync("Just now");
      } else if (seconds < 60) {
        setTimeSinceSync(`${seconds}s ago`);
      } else {
        const minutes = Math.floor(seconds / 60);
        setTimeSinceSync(`${minutes}m ago`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [lastSyncTime]);

  useEffect(() => {
    if (chunksUploaded > 0) {
      setPulseVisible(true);
      const timeout = setTimeout(() => setPulseVisible(false), 500);
      return () => clearTimeout(timeout);
    }
  }, [chunksUploaded]);

  if (!isRecording) return null;

  const showBatteryWarning = batteryLevel !== undefined && batteryLevel < 20;
  const hasIssues = !networkOnline || pendingChunks > 2 || showBatteryWarning;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
        hasIssues ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        className
      )}
      data-testid="recording-sync-indicator"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            {networkOnline ? (
              pendingChunks > 0 ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <div className="relative">
                  <Cloud className={cn("w-4 h-4", pulseVisible && "animate-pulse")} />
                  {pulseVisible && (
                    <span className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" />
                  )}
                </div>
              )
            ) : (
              <CloudOff className="w-4 h-4" />
            )}
            
            <span className="font-medium">{timeSinceSync}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {networkOnline ? (
                <>
                  <Wifi className="w-4 h-4 text-emerald-500" />
                  <span>Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-amber-500" />
                  <span>Offline - chunks saved locally</span>
                </>
              )}
            </div>
            <div className="text-muted-foreground">
              {chunksUploaded} chunks synced to cloud
              {pendingChunks > 0 && ` (${pendingChunks} pending)`}
            </div>
            {lastSyncTime && (
              <div className="text-muted-foreground text-xs">
                Last sync: {lastSyncTime.toLocaleTimeString()}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      {showBatteryWarning && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <BatteryLow className="w-4 h-4" />
              <span className="text-xs">{batteryLevel}%</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Low battery - your recording is safely synced. Consider plugging in.</span>
            </div>
          </TooltipContent>
        </Tooltip>
      )}

      {!networkOnline && pendingChunks > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs">{pendingChunks} pending</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <span>Chunks saved locally. Will sync when back online.</span>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
