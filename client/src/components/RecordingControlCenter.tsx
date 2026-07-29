import { useEffect, useState, Children, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  BatteryLow,
  CloudUpload,
  Loader2,
  Mic,
  Minimize2,
  Shield,
  Video,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ControlCenterTone =
  | "recording"
  | "countdown"
  | "live"
  | "processing"
  | "warning";

export interface RecordingControlCenterSafeguards {
  protected?: boolean;
  online?: boolean;
  isUploading?: boolean;
  chunksUploaded?: number;
  showChunkStatus?: boolean;
}

export interface RecordingControlCenterAlerts {
  isSilent?: boolean;
  batteryLevel?: number | null;
}

export interface RecordingControlCenterProps {
  tone?: ControlCenterTone;
  statusLabel: string;
  title?: string | null;
  subtitle?: string | null;
  elapsedSeconds?: number;
  countdown?: number | null;
  safeguards?: RecordingControlCenterSafeguards;
  alerts?: RecordingControlCenterAlerts;
  /** Primary control row (Stop, Confirm, Cancel, Open status, etc.) */
  actions?: ReactNode;
  /** Optional expanded body (e.g. meeting notes) */
  children?: ReactNode;
  icon?: "mic" | "video";
  /** Force expanded (e.g. stop confirm pending) */
  forceExpanded?: boolean;
  /** Allow collapse to a compact chip. Default true. */
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
  "data-testid"?: string;
}

function formatElapsed(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const toneStyles: Record<
  ControlCenterTone,
  { pill: string; glow: string; pulse: boolean; chipDot: string }
> = {
  recording: {
    pill: "bg-destructive text-destructive-foreground",
    glow: "from-destructive/15 via-transparent to-transparent",
    pulse: true,
    chipDot: "bg-destructive",
  },
  countdown: {
    pill: "bg-destructive/90 text-destructive-foreground",
    glow: "from-destructive/20 via-transparent to-transparent",
    pulse: true,
    chipDot: "bg-destructive",
  },
  live: {
    pill: "bg-foreground text-background",
    glow: "from-foreground/8 via-transparent to-transparent",
    pulse: false,
    chipDot: "bg-foreground",
  },
  processing: {
    pill: "bg-accent text-accent-foreground",
    glow: "from-accent/20 via-transparent to-transparent",
    pulse: false,
    chipDot: "bg-accent",
  },
  warning: {
    pill: "bg-amber-500/90 text-white",
    glow: "from-amber-500/15 via-transparent to-transparent",
    pulse: true,
    chipDot: "bg-amber-500",
  },
};

/**
 * Bottom-right meeting control center — shared shell for Quick Record,
 * live video bots, and any in-progress capture session.
 *
 * Always opaque (`bg-card`) so theme switches mid-call keep readable contrast.
 */
export default function RecordingControlCenter({
  tone = "recording",
  statusLabel,
  title,
  subtitle,
  elapsedSeconds,
  countdown = null,
  safeguards,
  alerts,
  actions,
  children,
  icon = "mic",
  forceExpanded = false,
  collapsible = true,
  defaultCollapsed = false,
  className,
  "data-testid": testId = "recording-control-center",
}: RecordingControlCenterProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const styles = toneStyles[tone];
  const Icon = icon === "video" ? Video : Mic;
  const showProtected = safeguards?.protected === true;
  // Quiet by default: only surface sync when uploading or offline
  const showNetwork =
    !!safeguards?.showChunkStatus &&
    (!!safeguards.isUploading || safeguards.online === false);
  const batteryLow =
    alerts?.batteryLevel != null && alerts.batteryLevel < 20
      ? alerts.batteryLevel
      : null;

  const isCollapsed = collapsible && collapsed && !forceExpanded;
  // Conditional `{cond && <Node />}` children are still a truthy array — only count real nodes
  const hasNotepadBody = Children.toArray(children).some(Boolean);
  const displayTitle =
    title?.trim() || (icon === "video" ? "Video meeting" : "Quick Record");
  const timerLabel =
    countdown !== null
      ? String(countdown)
      : typeof elapsedSeconds === "number"
        ? formatElapsed(elapsedSeconds)
        : null;

  useEffect(() => {
    if (forceExpanded) setCollapsed(false);
  }, [forceExpanded]);

  const chip = (
    <div
      className={cn(
        "fixed bottom-5 right-5 z-[60]",
        "animate-in fade-in-0 zoom-in-95 duration-200",
        className,
      )}
      data-testid={testId}
      data-collapsed="true"
    >
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className={cn(
          "group flex items-center gap-2.5 rounded-full border border-border bg-card px-3.5 py-2.5",
          "shadow-[0_12px_40px_-18px_rgba(15,18,28,0.55)]",
          "transition-all duration-200 hover:shadow-lg hover:border-border",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        data-testid="button-expand-control-center"
        aria-label={`Expand ${statusLabel} controls`}
      >
        <span
          className={cn(
            "h-2 w-2 rounded-full shrink-0",
            styles.chipDot,
            styles.pulse && "animate-pulse",
          )}
        />
        <span className="text-sm font-medium tracking-tight text-foreground">
          {statusLabel}
        </span>
        {timerLabel && (
          <span
            className="min-w-[4.5ch] text-right font-mono text-sm font-semibold tabular-nums text-foreground/80"
            data-testid="text-control-center-duration"
          >
            {timerLabel}
          </span>
        )}
        {(alerts?.isSilent || batteryLow != null || showNetwork) && (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            {alerts?.isSilent && <AlertTriangle className="h-3 w-3" />}
            {batteryLow != null && <BatteryLow className="h-3 w-3" />}
            {showNetwork &&
              (safeguards?.isUploading ? (
                <CloudUpload className="h-3 w-3 animate-pulse text-blue-600" />
              ) : (
                <WifiOff className="h-3 w-3" />
              ))}
          </span>
        )}
        {showProtected && !alerts?.isSilent && batteryLow == null && !showNetwork && (
          <Shield className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
        )}
      </button>
    </div>
  );

  const panel = (
    <div
      className={cn(
        "fixed bottom-5 right-5 z-[60]",
        hasNotepadBody
          ? "w-[min(380px,calc(100vw-1.5rem))]"
          : "w-[min(340px,calc(100vw-1.5rem))]",
        "animate-in fade-in-0 slide-in-from-bottom-3 duration-300",
        className,
      )}
      data-testid={testId}
      data-collapsed="false"
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border bg-card",
          "shadow-[0_18px_50px_-20px_rgba(15,18,28,0.55)]",
          hasNotepadBody && "shadow-[0_18px_50px_-18px_rgba(60,35,20,0.35)] dark:shadow-[0_18px_50px_-20px_rgba(15,18,28,0.55)]",
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90",
            styles.glow,
          )}
          aria-hidden
        />
        {hasNotepadBody && (
          <div
            className="pointer-events-none absolute bottom-0 left-0 top-0 w-[3px] bg-accent/70 dark:bg-accent/50"
            aria-hidden
          />
        )}

        <div className="relative z-10 p-4 text-foreground">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
                    styles.pill,
                    styles.pulse && "animate-pulse",
                  )}
                  data-testid="badge-control-center-status"
                >
                  {tone === "processing" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-90" />
                  )}
                  {statusLabel}
                </span>
              </div>
              <div className="mt-2.5 flex items-center gap-2 min-w-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium tracking-tight text-foreground">
                    {displayTitle}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {subtitle?.trim() ||
                      (countdown !== null
                        ? "Starting shortly"
                        : tone === "processing"
                          ? "Meeting-to-Matter in progress"
                          : "Stays on screen while active")}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
              {collapsible && (
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Minimize control center"
                  data-testid="button-collapse-control-center"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>
              )}
              {countdown !== null ? (
                <p
                  className="min-w-[2ch] text-right font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground"
                  data-testid="text-control-center-countdown"
                >
                  {countdown}
                </p>
              ) : typeof elapsedSeconds === "number" ? (
                <p
                  className="min-w-[5ch] text-right font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground"
                  data-testid="text-control-center-duration"
                >
                  {formatElapsed(elapsedSeconds)}
                </p>
              ) : null}
            </div>
          </div>

          {(showProtected || showNetwork || alerts?.isSilent || batteryLow != null) && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {showProtected && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400"
                      data-testid="indicator-control-center-protected"
                    >
                      <Shield className="h-3 w-3" />
                      Protected
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px] text-xs">
                    Safeguards active: tab-close warning, consent segment, and recovery available.
                  </TooltipContent>
                </Tooltip>
              )}

              {showNetwork && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        safeguards?.isUploading
                          ? "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-400"
                          : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
                      )}
                      data-testid="indicator-control-center-sync"
                    >
                      {safeguards?.isUploading ? (
                        <CloudUpload className="h-3 w-3 animate-pulse" />
                      ) : (
                        <WifiOff className="h-3 w-3" />
                      )}
                      {safeguards?.isUploading ? "Syncing" : "Offline"}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px] text-xs">
                    {safeguards?.isUploading
                      ? "Uploading the latest audio chunk to secure storage."
                      : "Offline — chunks will upload when you reconnect."}
                  </TooltipContent>
                </Tooltip>
              )}

              {alerts?.isSilent && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 animate-pulse"
                      data-testid="indicator-control-center-silence"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Silence
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px] text-xs">
                    No audio detected for 30+ seconds. Check your microphone.
                  </TooltipContent>
                </Tooltip>
              )}

              {batteryLow != null && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400"
                      data-testid="indicator-control-center-battery"
                    >
                      <BatteryLow className="h-3 w-3" />
                      {batteryLow}%
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px] text-xs">
                    Low battery. Recording remains protected — consider plugging in.
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}

          {actions && <div className="mt-3.5 flex flex-col gap-2">{actions}</div>}
        </div>

        {children && <div className="relative z-10">{children}</div>}
      </div>
    </div>
  );

  const content = isCollapsed ? chip : panel;
  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}

export function ControlCenterActionButton({
  children,
  onClick,
  variant = "default",
  "data-testid": testId,
  className,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive" | "outline" | "confirm";
  pending?: boolean;
  "data-testid"?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-10 w-full gap-2 rounded-xl text-sm font-medium shadow-none",
        variant === "confirm" &&
          "border border-amber-500/40 bg-amber-500/15 text-amber-800 hover:bg-amber-500/25 dark:text-amber-300 animate-pulse",
        className,
      )}
      variant={
        variant === "outline" || variant === "confirm"
          ? "outline"
          : variant === "destructive"
            ? "destructive"
            : "default"
      }
      data-testid={testId}
    >
      {children}
    </Button>
  );
}
