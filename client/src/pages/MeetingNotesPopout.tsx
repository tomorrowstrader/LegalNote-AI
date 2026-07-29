import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import MeetingNotesCapture from "@/components/MeetingNotesCapture";
import type { MeetingNotesDraftKey } from "@/lib/meetingNotesDraft";
import {
  publishMeetingNotesPopout,
  subscribeMeetingNotesPopout,
} from "@/lib/meetingNotesPopout";

function parseDraftKey(raw: string | null): MeetingNotesDraftKey | null {
  if (!raw) return null;
  if (raw.startsWith("live:") || raw.startsWith("session:")) {
    return raw as MeetingNotesDraftKey;
  }
  return null;
}

/**
 * Lightweight companion window for typing meeting notes beside Zoom/Teams/Meet
 * (or beside Capture recording). Shares drafts with the main app via localStorage.
 *
 * Elapsed time is driven by BroadcastChannel sync from the main recorder, with a
 * local monotonic tick between messages so the display does not freeze — never a
 * second independent recording clock.
 */
export default function MeetingNotesPopoutPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const draftKey = parseDraftKey(params.get("draftKey"));
  const [caseTitle, setCaseTitle] = useState(params.get("caseTitle"));
  const [liveLabel, setLiveLabel] = useState(params.get("liveLabel"));
  const initialElapsed = (() => {
    const n = Number(params.get("elapsed"));
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  })();
  const [elapsedSeconds, setElapsedSeconds] = useState(initialElapsed);
  const syncRef = useRef({ seconds: initialElapsed, atMs: Date.now() });

  useEffect(() => {
    document.title = caseTitle?.trim()
      ? `Meeting notes — ${caseTitle.trim()}`
      : "Meeting notes — LegalNote";
  }, [caseTitle]);

  // Force light notepad chrome regardless of the solicitor's dark-mode preference
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    root.classList.remove("dark");
    root.dataset.meetingNotesPopout = "1";
    return () => {
      delete root.dataset.meetingNotesPopout;
      if (hadDark) root.classList.add("dark");
    };
  }, []);

  // Smooth display between authoritative sync messages from the main window
  useEffect(() => {
    const id = window.setInterval(() => {
      const { seconds, atMs } = syncRef.current;
      const next = seconds + (Date.now() - atMs) / 1000;
      setElapsedSeconds(Math.max(0, Math.floor(next)));
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!draftKey) return;

    const announceOpen = () => {
      publishMeetingNotesPopout({ type: "presence", draftKey, open: true });
    };
    announceOpen();
    const heartbeat = window.setInterval(announceOpen, 2500);

    const onUnload = () => {
      publishMeetingNotesPopout({ type: "presence", draftKey, open: false });
    };
    window.addEventListener("pagehide", onUnload);

    const unsubscribe = subscribeMeetingNotesPopout((message) => {
      if (message.draftKey !== draftKey) return;
      if (message.type === "elapsed") {
        const seconds = Math.max(0, Math.floor(message.seconds));
        syncRef.current = { seconds, atMs: Date.now() };
        setElapsedSeconds(seconds);
      }
      if (message.type === "meta") {
        setCaseTitle(message.caseTitle);
        if (message.liveLabel !== undefined) setLiveLabel(message.liveLabel ?? null);
      }
      if (message.type === "close-request") {
        window.close();
      }
      if (message.type === "focus-request") {
        try {
          window.focus();
        } catch {
          // ignore
        }
      }
    });

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("pagehide", onUnload);
      unsubscribe();
      publishMeetingNotesPopout({ type: "presence", draftKey, open: false });
    };
  }, [draftKey]);

  const dockBack = () => {
    if (draftKey) {
      publishMeetingNotesPopout({ type: "dock-request", draftKey });
      publishMeetingNotesPopout({ type: "presence", draftKey, open: false });
    }
    window.close();
  };

  if (!draftKey) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center"
        style={{
          background: `
            linear-gradient(
              180deg,
              hsl(28, 42%, 86%) 0%,
              hsl(28, 42%, 86%) 32%,
              hsl(36, 30%, 97%) 52%,
              hsl(40, 40%, 99%) 62%,
              hsl(40, 40%, 99%) 100%
            )
          `,
        }}
      >
        <ExternalLink className="h-8 w-8 text-[hsl(18,50%,45%)]" />
        <p className="text-sm text-[hsl(220,12%,40%)]">
          This notes window is missing a meeting session. Close it and pop out again from LegalNote.
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex h-[100dvh] flex-col"
      style={{
        background: `
          radial-gradient(120% 55% at 12% 0%, hsl(24, 38%, 78%) 0%, transparent 55%),
          radial-gradient(90% 45% at 88% 8%, hsl(18, 48%, 82% / 0.55) 0%, transparent 50%),
          linear-gradient(
            180deg,
            hsl(28, 42%, 86%) 0%,
            hsl(28, 42%, 86%) 32%,
            hsl(30, 36%, 92%) 40%,
            hsl(36, 30%, 97%) 52%,
            hsl(40, 40%, 99%) 62%,
            hsl(40, 40%, 99%) 100%
          )
        `,
      }}
      data-testid="meeting-notes-popout-page"
    >
      <div className="min-h-0 flex-1">
        <MeetingNotesCapture
          draftKey={draftKey}
          caseTitle={caseTitle}
          elapsedSeconds={elapsedSeconds}
          active
          variant="companion"
          defaultOpen
          liveLabel={liveLabel}
          onDockBack={dockBack}
          className="h-full rounded-none border-0 shadow-none"
        />
      </div>
    </div>
  );
}
