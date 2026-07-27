import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Clock,
  ListChecks,
  ListTodo,
  Maximize2,
  MessageSquare,
  Minimize2,
  PenLine,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type MeetingNotesDraftKey,
  hasMeetingNotesDraft,
  readMeetingNotesDraft,
  writeMeetingNotesDraft,
} from "@/lib/meetingNotesDraft";

type PanelMode = "collapsed" | "open" | "focus";

const SNIPPETS: { id: string; label: string; icon: typeof Users; text: string }[] = [
  { id: "attendees", label: "Attendees", icon: Users, text: "Attendees:\n- " },
  { id: "instructions", label: "Instructions", icon: MessageSquare, text: "Client instructions:\n" },
  { id: "actions", label: "Actions", icon: ListChecks, text: "Action points:\n- " },
  { id: "followups", label: "Follow-ups", icon: ListTodo, text: "Follow-ups:\n- " },
];

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
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
   * inline — fills parent (new session modal)
   */
  variant?: "floating" | "inline";
  className?: string;
  /** Prefer open on first show when empty (subtle invite). */
  defaultOpen?: boolean;
  /** Optional live status label shown on the collapsed chip (e.g. "Recording"). */
  liveLabel?: string | null;
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
}: MeetingNotesCaptureProps) {
  const [mode, setMode] = useState<PanelMode>(() =>
    defaultOpen || hasMeetingNotesDraft(draftKey) ? "open" : "collapsed",
  );
  const [content, setContent] = useState(() => readMeetingNotesDraft(draftKey));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftKeyRef = useRef(draftKey);
  const contentRef = useRef(content);
  draftKeyRef.current = draftKey;
  contentRef.current = content;

  // Reload draft when key changes (e.g. new import)
  useEffect(() => {
    const next = readMeetingNotesDraft(draftKey);
    setContent(next);
    if (next.trim()) {
      setMode((m) => (m === "collapsed" ? "open" : m));
    }
  }, [draftKey]);

  // Persist with debounce
  const persist = useCallback((value: string) => {
    writeMeetingNotesDraft(draftKeyRef.current, value);
    setSaveState("saved");
    if (savedClearRef.current) clearTimeout(savedClearRef.current);
    savedClearRef.current = setTimeout(() => setSaveState("idle"), 1600);
  }, []);

  const handleChange = (value: string) => {
    setContent(value);
    setSaveState("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => persist(value), 450);
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
    [persist],
  );

  const insertTimestamp = useCallback(() => {
    insertAtCursor(formatTimestamp(elapsedSeconds));
  }, [elapsedSeconds, insertAtCursor]);

  // Keyboard shortcuts while panel focused
  useEffect(() => {
    if (!active || mode === "collapsed") return;

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
      if (e.key === "Escape" && mode !== "collapsed") {
        e.preventDefault();
        setMode("collapsed");
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, mode, content, persist, insertTimestamp]);

  if (!active) return null;

  const hasContent = content.trim().length > 0;

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
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <PenLine className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-medium tracking-tight">Notes</span>
          {liveLabel && (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{liveLabel}</span>
          )}
          {typeof elapsedSeconds === "number" && (
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {formatElapsed(elapsedSeconds)}
            </span>
          )}
          {hasContent && (
            <span
              className="h-1.5 w-1.5 rounded-full bg-accent"
              aria-label="Has draft notes"
              data-testid="indicator-meeting-notes-draft"
            />
          )}
        </button>
      </div>
    );
  }

  const panel = (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden border border-border/70 bg-card shadow-xl",
        variant === "floating" && "rounded-xl",
        variant === "inline" && "rounded-lg h-full min-h-[280px]",
        mode === "focus" && variant === "floating" && "h-[min(72vh,560px)]",
        mode === "open" && variant === "floating" && "h-[380px]",
        className,
      )}
      data-testid="meeting-notes-panel"
    >
      {/* Ambient paper wash */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(120% 80% at 0% 0%, hsl(45 40% 96% / 0.9) 0%, transparent 55%), linear-gradient(180deg, hsl(40 20% 99%) 0%, hsl(0 0% 100%) 100%)",
        }}
        aria-hidden
      />

      <header className="relative z-10 flex items-start justify-between gap-3 border-b border-border/50 px-4 pt-3.5 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <PenLine className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <h3 className="text-sm font-medium tracking-tight">Meeting notes</h3>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {caseTitle?.trim() || "Optional — saved to the matter when the call ends"}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {typeof elapsedSeconds === "number" && (
            <span className="mr-1 font-mono text-[11px] tabular-nums text-muted-foreground" data-testid="text-meeting-notes-elapsed">
              {formatElapsed(elapsedSeconds)}
            </span>
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

      <div className="relative z-10 flex flex-wrap gap-1.5 px-3 pt-2.5">
        <button
          type="button"
          onClick={insertTimestamp}
          className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
          data-testid="button-insert-timestamp"
        >
          <Clock className="h-3 w-3" />
          Timestamp
        </button>
        {SNIPPETS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => insertAtCursor(s.text, { newLineBefore: true })}
            className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
            data-testid={`button-snippet-${s.id}`}
          >
            <s.icon className="h-3 w-3" />
            {s.label}
          </button>
        ))}
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-3 pb-2 pt-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Capture instructions, undertakings, or anything the attendance note may miss…"
          className={cn(
            "min-h-0 w-full flex-1 resize-none rounded-md border-0 bg-transparent px-1 py-1",
            "text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/55",
            "focus-visible:outline-none",
          )}
          style={{ fontFamily: "var(--font-serif)" }}
          spellCheck
          data-testid="textarea-meeting-notes"
        />
      </div>

      <footer className="relative z-10 flex items-center justify-between gap-2 border-t border-border/50 px-4 py-2">
        <p className="text-[11px] text-muted-foreground">
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && (
            <span className="inline-flex items-center gap-1 text-foreground/70">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
          {saveState === "idle" && (hasContent ? "Draft kept until the meeting ends" : "⌘⇧T timestamp · Esc collapse")}
        </p>
        {!caseTitle && (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Unassigned</span>
        )}
      </footer>
    </div>
  );

  if (variant === "inline") {
    return (
      <div className={cn("relative", className)} data-testid="meeting-notes-inline">
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
