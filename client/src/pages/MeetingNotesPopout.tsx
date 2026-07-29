import { useEffect, useMemo, useState } from "react";
import { ExternalLink, PanelBottom } from "lucide-react";
import MeetingNotesCapture from "@/components/MeetingNotesCapture";
import { Button } from "@/components/ui/button";
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
 * Lightweight companion window for typing meeting notes beside Zoom/Teams/Meet.
 * Shares drafts with the main app via localStorage; closes when the session ends.
 */
export default function MeetingNotesPopoutPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const draftKey = parseDraftKey(params.get("draftKey"));
  const [caseTitle, setCaseTitle] = useState(params.get("caseTitle"));
  const [liveLabel, setLiveLabel] = useState(params.get("liveLabel"));
  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    const n = Number(params.get("elapsed"));
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  });

  useEffect(() => {
    document.title = caseTitle?.trim()
      ? `Meeting notes — ${caseTitle.trim()}`
      : "Meeting notes — LegalNote";
  }, [caseTitle]);

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
        setElapsedSeconds(message.seconds);
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <ExternalLink className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          This notes window is missing a meeting session. Close it and pop out again from LegalNote.
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex h-[100dvh] flex-col bg-background"
      data-testid="meeting-notes-popout-page"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <p className="truncate text-[11px] text-muted-foreground">
          Companion window — keep beside your video call
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 shrink-0 text-xs"
          onClick={dockBack}
          data-testid="button-dock-meeting-notes"
        >
          <PanelBottom className="h-3.5 w-3.5" />
          Dock back
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <MeetingNotesCapture
          draftKey={draftKey}
          caseTitle={caseTitle}
          elapsedSeconds={elapsedSeconds}
          active
          variant="companion"
          defaultOpen
          liveLabel={liveLabel}
          className="h-full rounded-none border-0 shadow-none"
        />
      </div>
    </div>
  );
}
