import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Clock,
  ExternalLink,
  ListChecks,
  ListTodo,
  Maximize2,
  MessageSquare,
  Minimize2,
  PenLine,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import { cn } from "@/lib/utils";
import {
  type MeetingNotesDraftKey,
  hasMeetingNotesDraft,
  readMeetingNotesDraft,
  subscribeMeetingNotesDraft,
  writeMeetingNotesDraft,
} from "@/lib/meetingNotesDraft";

type PanelMode = "collapsed" | "open" | "focus";

/** Landing-page terracotta — primary brand accent on marketing surfaces. */
const BRAND = "hsl(18, 70%, 42%)";
const BRAND_HOVER = "hsl(18, 72%, 36%)";
/** Warm tapioca / brownie milk — notepad header wash. */
const TAPIOCA = "hsl(28, 42%, 86%)";
const TAPIOCA_DEEP = "hsl(24, 38%, 78%)";
const PAPER_WHITE = "hsl(40, 40%, 99%)";
const PAPER_LINE = "hsl(30, 18%, 88%)";
const INK = "hsl(220, 20%, 16%)";

const SECONDARY_SNIPPETS: { id: string; label: string; icon: typeof Users; text: string }[] = [
  { id: "instructions", label: "Instructions", icon: MessageSquare, text: "Client instructions:\n" },
  { id: "actions", label: "Actions", icon: ListChecks, text: "Action points:\n- " },
  { id: "followups", label: "Follow-ups", icon: ListTodo, text: "Follow-ups:\n- " },
];

const ATTENDEES_SNIPPET = "Attendees:\n- ";

function formatElapsed(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatTimestamp(elapsedSeconds?: number): string {
  if (typeof elapsedSeconds === "number" && elapsedSeconds >= 0) {
    return `[${formatElapsed(elapsedSeconds)}] `;
  }
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `[${h}:${m}] `;
}

export interface MeetingNotesCaptureProps {
  draftKey: MeetingNotesDraftKey;
  caseTitle?: string | null;
  elapsedSeconds?: number;
  /** When false, nothing is rendered. */
  active: boolean;
  /**
   * floating — fixed bottom-right dock (live bot)
   * inline — fills parent (new session modal / control center)
   * companion — full-height pop-out window
   */
  variant?: "floating" | "inline" | "companion";
  className?: string;
  /** Prefer open on first show when empty (subtle invite). */
  defaultOpen?: boolean;
  /** Optional live status label shown on the collapsed chip (e.g. "Recording"). */
  liveLabel?: string | null;
  /** Opens the companion notes window (omit to hide Pop out). */
  onPopOut?: () => void;
  /** Companion chrome: dock-back control rendered in the notepad header. */
  onDockBack?: () => void;
}

export default function MeetingNotesCapture({
  draftKey,
  caseTitle,
  elapsedSeconds,
  active,
  variant = "floating",
  className,
  defaultOpen = false,
  liveLabel,
  onPopOut,
  onDockBack,
}: MeetingNotesCaptureProps) {
  const [mode, setMode] = useState<PanelMode>(() =>
    defaultOpen || hasMeetingNotesDraft(draftKey) || variant === "companion"
      ? "open"
      : "collapsed",
  );
  const [content, setContent] = useState(() => readMeetingNotesDraft(draftKey));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftKeyRef = useRef(draftKey);
  const contentRef = useRef(content);
  const applyingRemoteRef = useRef(false);
  draftKeyRef.current = draftKey;
  contentRef.current = content;

  const isCompanion = variant === "companion";
  const isDocked = variant === "inline";
  const isNotepad = isCompanion || isDocked;

  // Reload draft when key changes (e.g. new import)
  useEffect(() => {
    const next = readMeetingNotesDraft(draftKey);
    setContent(next);
    if (next.trim() || variant === "companion") {
      setMode((m) => (m === "collapsed" ? "open" : m));
    }
  }, [draftKey, variant]);

  // Sync from other windows (pop-out ↔ main)
  useEffect(() => {
    return subscribeMeetingNotesDraft(draftKey, (next) => {
      if (next === contentRef.current) return;
      applyingRemoteRef.current = true;
      setContent(next);
      contentRef.current = next;
      setSaveState("saved");
      if (savedClearRef.current) clearTimeout(savedClearRef.current);
      savedClearRef.current = setTimeout(() => setSaveState("idle"), 1600);
      requestAnimationFrame(() => {
        applyingRemoteRef.current = false;
      });
    });
  }, [draftKey]);

  // Persist immediately so pop-out ↔ main and end-of-call flush never miss keystrokes
  const persist = useCallback((value: string) => {
    writeMeetingNotesDraft(draftKeyRef.current, value);
    setSaveState("saved");
    if (savedClearRef.current) clearTimeout(savedClearRef.current);
    savedClearRef.current = setTimeout(() => setSaveState("idle"), 1600);
  }, []);

  const handleChange = (value: string) => {
    if (applyingRemoteRef.current) return;
    setContent(value);
    contentRef.current = value;
    setSaveState("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    writeMeetingNotesDraft(draftKeyRef.current, value);
    saveTimerRef.current = setTimeout(() => {
      setSaveState("saved");
      if (savedClearRef.current) clearTimeout(savedClearRef.current);
      savedClearRef.current = setTimeout(() => setSaveState("idle"), 1600);
    }, 280);
  };

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedClearRef.current) clearTimeout(savedClearRef.current);
      writeMeetingNotesDraft(draftKeyRef.current, contentRef.current);
    };
  }, []);

  const insertAtCursor = useCallback(
    (snippet: string, { newLineBefore = false }: { newLineBefore?: boolean } = {}) => {
      const el = textareaRef.current;
      const current = contentRef.current;
      let next: string;
      let caret: number;

      if (el) {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const before = current.slice(0, start);
        const after = current.slice(end);
        const needsGap =
          newLineBefore && before.length > 0 && !before.endsWith("\n");
        const gap = needsGap ? "\n\n" : "";
        next = before + gap + snippet + after;
        caret = (before + gap + snippet).length;
      } else {
        const gap = current.trim() ? "\n\n" : "";
        next = current + gap + snippet;
        caret = next.length;
      }

      handleChange(next);
      requestAnimationFrame(() => {
        const t = textareaRef.current;
        if (!t) return;
        t.focus();
        t.setSelectionRange(caret, caret);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleChange closes over persist via debounce
    [persist],
  );

  const insertTimestamp = useCallback(() => {
    insertAtCursor(formatTimestamp(elapsedSeconds));
  }, [elapsedSeconds, insertAtCursor]);

  // Keyboard shortcuts while panel focused
  useEffect(() => {
    if (!active || (mode === "collapsed" && variant !== "companion")) return;

    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "s") {
        e.preventDefault();
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        persist(content);
      }
      if (meta && e.shiftKey && (e.key === "t" || e.key === "T")) {
        e.preventDefault();
        insertTimestamp();
      }
      if (e.key === "Escape" && mode !== "collapsed" && variant !== "companion") {
        e.preventDefault();
        setMode("collapsed");
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, mode, content, persist, insertTimestamp, variant]);

  if (!active) return null;

  const hasContent = content.trim().length > 0;
  const showPopOut = !!onPopOut && variant !== "companion";

  if (variant === "floating" && mode === "collapsed") {
    return (
      <div className={cn("fixed bottom-6 right-6 z-[60]", className)} data-testid="meeting-notes-collapsed">
        <button
          type="button"
          onClick={() => setMode("open")}
          className={cn(
            "group flex items-center gap-2.5 rounded-full border border-border/80 bg-card/95 px-4 py-2.5 shadow-lg backdrop-blur-sm",
            "transition-all duration-300 hover:shadow-xl hover:border-accent/40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          data-testid="button-open-meeting-notes"
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: BRAND }}
          >
            <PenLine className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-medium tracking-tight">Notes</span>
          {liveLabel && (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{liveLabel}</span>
          )}
          {typeof elapsedSeconds === "number" && (
            <span className="min-w-[4.5ch] text-right font-mono text-xs tabular-nums text-muted-foreground">
              {formatElapsed(elapsedSeconds)}
            </span>
          )}
          {hasContent && (
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: BRAND }}
              aria-label="Has draft notes"
              data-testid="indicator-meeting-notes-draft"
            />
          )}
        </button>
      </div>
    );
  }

  const primaryActionClass = cn(
    "inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5",
    "text-sm font-medium text-white transition-all duration-150",
    "shadow-[0_2px_8px_rgba(140,55,25,0.35),0_1px_2px_rgba(0,0,0,0.12)]",
    "hover:shadow-[0_4px_14px_rgba(140,55,25,0.4),0_2px_4px_rgba(0,0,0,0.14)] hover:-translate-y-px",
    "active:translate-y-0 active:shadow-[0_1px_4px_rgba(140,55,25,0.3)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "min-h-[42px] min-w-0",
  );

  const secondaryActionClass = cn(
    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
    isNotepad
      ? "border-[hsl(30,20%,82%)] bg-white/70 text-[hsl(220,15%,35%)] hover:border-[hsl(18,40%,70%)] hover:text-[hsl(18,70%,32%)]"
      : "border-border/60 bg-background/80 text-muted-foreground hover:border-foreground/20 hover:text-foreground",
  );

  const panel = (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden",
        isCompanion &&
          "border border-[hsl(30,18%,84%)] shadow-[0_8px_30px_rgba(40,30,20,0.12)]",
        isDocked && "border-0 bg-transparent shadow-none",
        !isNotepad && "border border-border/70 bg-card shadow-xl",
        variant === "floating" && "rounded-xl",
        variant === "inline" && "h-full min-h-[260px] rounded-none",
        variant === "companion" && "h-full min-h-0 rounded-none border-0 shadow-none",
        mode === "focus" && variant === "floating" && "h-[min(72vh,560px)]",
        mode === "open" && variant === "floating" && "h-[380px]",
        className,
      )}
      style={
        isCompanion
          ? { backgroundColor: PAPER_WHITE, color: INK }
          : isDocked
            ? { color: INK, background: "transparent" }
            : undefined
      }
      data-testid="meeting-notes-panel"
    >
      {/* Companion-only full wash; docked inherits the control-center shell gradient */}
      {isCompanion ? (
        <>
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `
                radial-gradient(120% 55% at 12% 0%, ${TAPIOCA_DEEP} 0%, transparent 55%),
                radial-gradient(90% 45% at 88% 8%, hsl(18, 48%, 82% / 0.55) 0%, transparent 50%),
                linear-gradient(
                  180deg,
                  ${TAPIOCA} 0%,
                  ${TAPIOCA} 32%,
                  hsl(30, 36%, 92%) 40%,
                  hsl(36, 30%, 97%) 52%,
                  ${PAPER_WHITE} 62%,
                  ${PAPER_WHITE} 100%
                )
              `,
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute bottom-0 left-0 top-0 w-[3px]"
            style={{
              background: `linear-gradient(180deg, hsl(18, 45%, 62%) 0%, hsl(18, 35%, 72%) 40%, hsl(30, 20%, 82%) 100%)`,
            }}
            aria-hidden
          />
        </>
      ) : !isNotepad ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(120% 80% at 0% 0%, hsl(45 40% 96% / 0.9) 0%, transparent 55%), linear-gradient(180deg, hsl(40 20% 99%) 0%, hsl(0 0% 100%) 100%)",
          }}
          aria-hidden
        />
      ) : null}

      <header
        className={cn(
          "relative z-10 flex items-start justify-between gap-3 px-4",
          isDocked ? "pb-2 pt-1" : "pt-3.5 pb-3",
          isCompanion && "border-b border-[hsl(24,28%,78%/0.55)]",
          isDocked && "border-b border-[hsl(24,28%,78%/0.35)]",
          !isNotepad && "border-b border-border/50",
        )}
      >
        <div className="min-w-0 flex-1">
          {isCompanion ? (
            <div className="space-y-1.5">
              <Logo variant="wordmark" size="sm" tone="light" className="h-5 max-w-[140px]" />
              <div className="flex items-baseline gap-2 min-w-0">
                <h3
                  className="text-[13px] font-medium tracking-tight truncate"
                  style={{ fontFamily: "var(--font-serif)", color: INK }}
                >
                  Meeting notes
                </h3>
                {liveLabel && (
                  <span
                    className="shrink-0 text-[10px] uppercase tracking-wider font-medium"
                    style={{ color: BRAND }}
                  >
                    {liveLabel}
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-[hsl(220,12%,42%)]">
                {caseTitle?.trim() || "Optional — saved to the matter when recording ends"}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {isDocked ? (
                  <Logo variant="icon" size="sm" tone="light" className="h-4 w-4" />
                ) : isNotepad ? (
                  <Logo variant="icon" size="sm" tone="light" className="h-5 w-5" />
                ) : (
                  <PenLine className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <h3
                  className="text-sm font-medium tracking-tight"
                  style={isDocked ? { fontFamily: "var(--font-serif)", color: INK } : undefined}
                >
                  Meeting notes
                </h3>
                {isDocked && liveLabel && (
                  <span
                    className="shrink-0 text-[10px] uppercase tracking-wider font-medium"
                    style={{ color: BRAND }}
                  >
                    {liveLabel}
                  </span>
                )}
              </div>
              {!isDocked && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {caseTitle?.trim() || "Optional — saved to the matter when the call ends"}
                </p>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {typeof elapsedSeconds === "number" && !isDocked && (
            <span
              className={cn(
                "mr-1 min-w-[4.5ch] text-right font-mono text-[11px] tabular-nums",
                isNotepad ? "text-[hsl(220,12%,40%)]" : "text-muted-foreground",
              )}
              data-testid="text-meeting-notes-elapsed"
            >
              {formatElapsed(elapsedSeconds)}
            </span>
          )}
          {onDockBack && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs text-[hsl(220,12%,40%)] hover:text-[hsl(18,70%,32%)] hover:bg-[hsl(18,40%,94%)]"
              onClick={onDockBack}
              data-testid="button-dock-meeting-notes"
            >
              Dock back
            </Button>
          )}
          {showPopOut && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7",
                isDocked && "text-[hsl(220,12%,40%)] hover:bg-[hsl(24,30%,80%/0.45)] hover:text-[hsl(18,50%,30%)]",
              )}
              onClick={onPopOut}
              aria-label="Pop out notes to a separate window"
              title="Pop out — keep beside your video call"
              data-testid="button-popout-meeting-notes"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
          {variant === "floating" && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setMode(mode === "focus" ? "open" : "focus")}
                aria-label={mode === "focus" ? "Shrink notes" : "Expand notes"}
                data-testid="button-meeting-notes-focus"
              >
                {mode === "focus" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setMode("collapsed")}
                aria-label="Collapse notes"
                data-testid="button-collapse-meeting-notes"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Primary actions — equal size, brand colour, drop shadow */}
      <div className="relative z-10 flex gap-2.5 px-3 pt-3">
        <button
          type="button"
          onClick={insertTimestamp}
          className={primaryActionClass}
          style={{ backgroundColor: BRAND, ["--tw-ring-color" as string]: BRAND }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = BRAND_HOVER;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = BRAND;
          }}
          data-testid="button-insert-timestamp"
        >
          <Clock className="h-4 w-4 shrink-0" />
          Timestamp
        </button>
        <button
          type="button"
          onClick={() => insertAtCursor(ATTENDEES_SNIPPET, { newLineBefore: true })}
          className={primaryActionClass}
          style={{ backgroundColor: BRAND, ["--tw-ring-color" as string]: BRAND }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = BRAND_HOVER;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = BRAND;
          }}
          data-testid="button-snippet-attendees"
        >
          <Users className="h-4 w-4 shrink-0" />
          Attendees
        </button>
      </div>

      <div className="relative z-10 flex flex-wrap gap-1.5 px-3 pt-2">
        {SECONDARY_SNIPPETS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => insertAtCursor(s.text, { newLineBefore: true })}
            className={secondaryActionClass}
            data-testid={`button-snippet-${s.id}`}
          >
            <s.icon className="h-3 w-3" />
            {s.label}
          </button>
        ))}
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-3 pb-2 pt-2">
        <div
          className={cn(
            "relative min-h-0 flex-1 overflow-hidden rounded-md",
            isNotepad && "bg-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ring-1 ring-[hsl(28,22%,82%)]",
          )}
        >
          {isNotepad && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  transparent,
                  transparent 27px,
                  ${PAPER_LINE} 27px,
                  ${PAPER_LINE} 28px
                )`,
                backgroundPosition: "0 8px",
                opacity: 0.85,
              }}
              aria-hidden
            />
          )}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Capture instructions, undertakings, or anything the attendance note may miss…"
            className={cn(
              "relative z-10 min-h-0 w-full h-full resize-none border-0 bg-transparent px-3 py-2",
              "text-[15px] leading-[28px] placeholder:text-[hsl(220,10%,55%)]",
              "focus-visible:outline-none",
              !isNotepad && "px-1 py-1 leading-relaxed text-foreground placeholder:text-muted-foreground/55",
            )}
            style={{
              fontFamily: "var(--font-serif)",
              color: isNotepad ? INK : undefined,
            }}
            spellCheck
            data-testid="textarea-meeting-notes"
          />
        </div>
      </div>

      <footer
        className={cn(
          "relative z-10 flex items-center justify-between gap-2 px-4 py-2",
          isCompanion && "border-t border-[hsl(30,18%,86%)]",
          isDocked && "border-t border-[hsl(24,28%,78%/0.35)]",
          !isNotepad && "border-t border-border/50",
        )}
      >
        <p className={cn("text-[11px]", isNotepad ? "text-[hsl(220,12%,42%)]" : "text-muted-foreground")}>
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && (
            <span className="inline-flex items-center gap-1" style={isNotepad ? { color: BRAND } : undefined}>
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
          {saveState === "idle" &&
            (variant === "companion"
              ? hasContent
                ? "Draft syncs with LegalNote · saved when recording ends"
                : "⌘⇧T timestamp · dock back when finished"
              : isDocked
                ? hasContent
                  ? "Draft kept until the meeting ends"
                  : "⌘⇧T timestamp · pop out for a wider pad"
                : hasContent
                  ? "Draft kept until the meeting ends"
                  : "⌘⇧T timestamp · Esc collapse")}
        </p>
        {!caseTitle && !isDocked && (
          <span className="text-[10px] uppercase tracking-wide text-[hsl(220,10%,50%)]">Unassigned</span>
        )}
      </footer>
    </div>
  );

  if (variant === "inline" || variant === "companion") {
    return (
      <div
        className={cn("relative", variant === "companion" && "h-full min-h-0")}
        data-testid={variant === "companion" ? "meeting-notes-companion" : "meeting-notes-inline"}
      >
        {panel}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed z-[60] transition-all duration-300 ease-out",
        mode === "focus" ? "bottom-4 right-4 left-4 sm:left-auto sm:w-[min(520px,92vw)]" : "bottom-6 right-6 w-[min(400px,92vw)]",
      )}
      data-testid="meeting-notes-floating"
    >
      <div className="relative">{panel}</div>
    </div>
  );
}
