import { useCallback, useEffect, useRef, useState } from "react";
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
  const lastDraftKeyRef = useRef<MeetingNotesDraftKey | null>(draftKey);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // Close the previous companion when the draft key is cleared or replaced
  // (e.g. recording reset) — otherwise a stale timer keeps ticking in the old window.
  useEffect(() => {
    const prev = lastDraftKeyRef.current;
    if (prev && prev !== draftKey) {
      requestCloseMeetingNotesPopout(prev);
      setPopoutOpen(false);
    }
    lastDraftKeyRef.current = draftKey;
  }, [draftKey]);

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
    }
    setPopoutOpen(false);
  }, [draftKey, active, popoutOpen]);

  const openPopout = useCallback((extra?: { reservedWindow?: Window | null }): boolean => {
    if (!draftKey) return false;
    const latest = optsRef.current;
    const win = openMeetingNotesPopout({
      draftKey,
      caseTitle: latest?.caseTitle,
      liveLabel: latest?.liveLabel,
      elapsedSeconds: latest?.elapsedSeconds,
      reservedWindow: extra?.reservedWindow,
    });
    if (!win) return false;
    setPopoutOpen(true);
    return true;
  }, [draftKey]);

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
