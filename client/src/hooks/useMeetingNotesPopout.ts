import { useCallback, useEffect, useState } from "react";
import type { MeetingNotesDraftKey } from "@/lib/meetingNotesDraft";
import {
  focusMeetingNotesPopout,
  isMeetingNotesPopoutWindowOpen,
  openMeetingNotesPopout,
  publishMeetingNotesPopout,
  requestCloseMeetingNotesPopout,
  subscribeMeetingNotesPopout,
} from "@/lib/meetingNotesPopout";

/**
 * Tracks whether the companion notes window is open for a draft key,
 * and keeps elapsed/meta in sync while it is.
 */
export function useMeetingNotesPopout(
  draftKey: MeetingNotesDraftKey | null,
  opts?: {
    caseTitle?: string | null;
    liveLabel?: string | null;
    elapsedSeconds?: number;
    /** When false, close any open pop-out for this draft. */
    active?: boolean;
  },
) {
  const [popoutOpen, setPopoutOpen] = useState(false);
  const active = opts?.active !== false;

  useEffect(() => {
    if (!draftKey) {
      setPopoutOpen(false);
      return;
    }

    return subscribeMeetingNotesPopout((message) => {
      if (message.draftKey !== draftKey) return;
      if (message.type === "presence") {
        setPopoutOpen(message.open);
      }
      if (message.type === "dock-request") {
        setPopoutOpen(false);
      }
    });
  }, [draftKey]);

  // Recover if the OS closed the window without a presence message
  useEffect(() => {
    if (!draftKey || !popoutOpen) return;
    const id = window.setInterval(() => {
      if (isMeetingNotesPopoutWindowOpen(draftKey) === false) {
        setPopoutOpen(false);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [draftKey, popoutOpen]);

  // Push elapsed + meta while the companion is open
  useEffect(() => {
    if (!draftKey || !popoutOpen || !active) return;
    publishMeetingNotesPopout({
      type: "meta",
      draftKey,
      caseTitle: opts?.caseTitle ?? null,
      liveLabel: opts?.liveLabel ?? null,
    });
    if (typeof opts?.elapsedSeconds === "number") {
      publishMeetingNotesPopout({
        type: "elapsed",
        draftKey,
        seconds: opts.elapsedSeconds,
      });
    }
  }, [draftKey, popoutOpen, active, opts?.caseTitle, opts?.liveLabel, opts?.elapsedSeconds]);

  // Close companion when the capture session ends
  useEffect(() => {
    if (!draftKey || active) return;
    if (popoutOpen) {
      requestCloseMeetingNotesPopout(draftKey);
      setPopoutOpen(false);
    }
  }, [draftKey, active, popoutOpen]);

  const openPopout = useCallback((): boolean => {
    if (!draftKey) return false;
    const win = openMeetingNotesPopout({
      draftKey,
      caseTitle: opts?.caseTitle,
      liveLabel: opts?.liveLabel,
      elapsedSeconds: opts?.elapsedSeconds,
    });
    if (!win) return false;
    setPopoutOpen(true);
    return true;
  }, [draftKey, opts?.caseTitle, opts?.liveLabel, opts?.elapsedSeconds]);

  const focusPopout = useCallback(() => {
    if (!draftKey) return;
    focusMeetingNotesPopout(draftKey);
  }, [draftKey]);

  const closePopout = useCallback(() => {
    if (!draftKey) return;
    requestCloseMeetingNotesPopout(draftKey);
    setPopoutOpen(false);
  }, [draftKey]);

  return {
    popoutOpen,
    openPopout,
    focusPopout,
    closePopout,
  };
}
