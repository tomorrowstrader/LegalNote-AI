import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  autoLeaveDeadlineSeconds,
  formatWaitRemaining,
} from "@shared/liveBotLifecycle";

const STORAGE_KEY = "ln-live-bot-session";

export type LiveBotPhase =
  | "joining"
  | "waiting"
  | "recording"
  | "ended"
  | "processing"
  | "complete"
  | "awaiting_assignment"
  | "error";

export interface LiveBotSession {
  importId: string;
  botId: string;
  caseId?: string | null;
  caseTitle?: string | null;
  meetingUrl?: string | null;
  consentMode?: "pre_confirmed" | "in_meeting";
  startedAt: number;
}

interface BotPollResponse {
  importId: string;
  botId: string;
  botStatus: string;
  importStatus: string;
  statusLabel?: string;
  consentMode?: string;
  consentConfirmed?: boolean;
  participants?: Array<{ name: string }>;
  subCode?: string | null;
  errorMessage?: string | null;
}

interface LiveBotSessionContextType {
  session: LiveBotSession | null;
  phase: LiveBotPhase;
  botStatus: string | null;
  importStatus: string | null;
  subCode: string | null;
  errorMessage: string | null;
  consentConfirmed: boolean;
  elapsedSeconds: number;
  /** Seconds until Recall auto-leave while waiting; null when not applicable. */
  waitRemainingSeconds: number | null;
  waitRemainingLabel: string | null;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  /** True while any LiveBotModal instance is open — hides the floating pill. */
  liveBotModalOpen: boolean;
  setLiveBotModalOpen: (open: boolean) => void;
  startSession: (session: Omit<LiveBotSession, "startedAt"> & { startedAt?: number }) => void;
  clearSession: () => void;
  /** Leave the call and clear the session (waiting / pre-recording cancel). */
  cancelSession: () => Promise<{ success: boolean; errorMessage?: string }>;
  cancelling: boolean;
}

const LiveBotSessionContext = createContext<LiveBotSessionContextType | undefined>(undefined);

function phaseFromStatuses(botStatus: string | null, importStatus: string | null): LiveBotPhase {
  if (importStatus === "failed") return "error";
  if (importStatus === "completed") return "complete";
  if (importStatus === "awaiting_assignment") return "awaiting_assignment";
  if (importStatus === "transcribing" || importStatus === "pending") return "processing";
  if (botStatus === "fatal") return "error";
  if (botStatus === "left_user_cancelled" || botStatus === "left_consent_declined") return "error";
  if (botStatus === "call_ended" || botStatus === "done" || botStatus === "recording_done") return "ended";
  if (botStatus === "in_call_recording") return "recording";
  if (botStatus === "in_waiting_room" || botStatus === "joining_call" || botStatus === "joining") return "waiting";
  if (botStatus === "in_call_not_recording") return "joining";
  return "joining";
}

function readStoredSession(): LiveBotSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LiveBotSession;
    if (!parsed?.botId || !parsed?.importId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredSession(session: LiveBotSession | null) {
  try {
    if (!session) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore quota / private mode
  }
}

export function LiveBotSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<LiveBotSession | null>(() => readStoredSession());
  const [botStatus, setBotStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [subCode, setSubCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [liveBotModalOpen, setLiveBotModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifiedEndRef = useRef(false);
  const liveBotModalOpenRef = useRef(false);
  liveBotModalOpenRef.current = liveBotModalOpen;

  const phase = useMemo(
    () => phaseFromStatuses(botStatus, importStatus),
    [botStatus, importStatus],
  );

  const waitRemainingSeconds = useMemo(() => {
    if (!session) return null;
    if (phase !== "waiting" && phase !== "joining") return null;
    const deadline = autoLeaveDeadlineSeconds(botStatus);
    if (deadline == null) return null;
    return Math.max(0, deadline - elapsedSeconds);
  }, [session, phase, botStatus, elapsedSeconds]);

  const waitRemainingLabel = useMemo(() => {
    if (waitRemainingSeconds == null) return null;
    return formatWaitRemaining(waitRemainingSeconds);
  }, [waitRemainingSeconds]);

  const clearSession = useCallback(() => {
    setSession(null);
    writeStoredSession(null);
    setBotStatus(null);
    setImportStatus(null);
    setSubCode(null);
    setErrorMessage(null);
    setConsentConfirmed(false);
    setElapsedSeconds(0);
    setPanelOpen(false);
    setCancelling(false);
    notifiedEndRef.current = false;
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    pollRef.current = null;
    timerRef.current = null;
  }, []);

  const startSession = useCallback(
    (next: Omit<LiveBotSession, "startedAt"> & { startedAt?: number }) => {
      const full: LiveBotSession = {
        ...next,
        startedAt: next.startedAt ?? Date.now(),
      };
      setSession(full);
      writeStoredSession(full);
      setBotStatus("joining_call");
      setImportStatus("live");
      setSubCode(null);
      setErrorMessage(null);
      setConsentConfirmed(next.consentMode === "pre_confirmed");
      setElapsedSeconds(0);
      notifiedEndRef.current = false;
      setPanelOpen(false);
    },
    [],
  );

  const cancelSession = useCallback(async () => {
    if (!session?.botId) return { success: false, errorMessage: "No active session" };
    setCancelling(true);
    try {
      const data = await apiRequest<{
        success: boolean;
        errorMessage?: string;
        importStatus?: string;
      }>("POST", `/api/recall/bot/${session.botId}/cancel`, {});
      setImportStatus("failed");
      setBotStatus("left_user_cancelled");
      setErrorMessage(data.errorMessage || "Cancelled — LegalNote left before the meeting started.");
      setPanelOpen(true);
      if (session.caseId) {
        queryClient.invalidateQueries({ queryKey: [`/api/cases/${session.caseId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/cases/${session.caseId}/live-import`] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/recall/meetings"] });
      return { success: true, errorMessage: data.errorMessage || undefined };
    } catch (err: any) {
      const msg = err?.message || "Could not cancel LegalNote";
      setErrorMessage(msg);
      return { success: false, errorMessage: msg };
    } finally {
      setCancelling(false);
    }
  }, [session]);

  // Elapsed timer while session is active and not terminal
  useEffect(() => {
    if (!session) return;
    if (phase === "complete" || phase === "error" || phase === "awaiting_assignment") return;

    const tick = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000)));
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session, phase]);

  // Global poll — survives modal close
  useEffect(() => {
    if (!session?.botId) return;

    const poll = async () => {
      try {
        const data = await apiRequest<BotPollResponse>("GET", `/api/recall/bot/${session.botId}`);
        setBotStatus(data.botStatus);
        setImportStatus(data.importStatus);
        if (data.subCode) setSubCode(data.subCode);
        if (data.errorMessage) setErrorMessage(data.errorMessage);
        if (data.consentConfirmed) setConsentConfirmed(true);

        const nextPhase = phaseFromStatuses(data.botStatus, data.importStatus);

        if (
          !notifiedEndRef.current &&
          (nextPhase === "ended" ||
            nextPhase === "processing" ||
            nextPhase === "complete" ||
            nextPhase === "awaiting_assignment" ||
            nextPhase === "error")
        ) {
          notifiedEndRef.current = true;
          if (!liveBotModalOpenRef.current) {
            setPanelOpen(true);
          }
          if (session.caseId) {
            queryClient.invalidateQueries({ queryKey: [`/api/cases/${session.caseId}`] });
            queryClient.invalidateQueries({ queryKey: [`/api/cases/${session.caseId}/live-import`] });
            queryClient.invalidateQueries({ queryKey: ["/api/recall/meetings"] });
          }
          queryClient.invalidateQueries({ queryKey: ["/api/recall/imports/unassigned"] });
        }

        if (nextPhase === "complete" || nextPhase === "error") {
          if (session.caseId) {
            queryClient.invalidateQueries({ queryKey: [`/api/cases/${session.caseId}`] });
            queryClient.invalidateQueries({ queryKey: [`/api/cases/${session.caseId}/documents`] });
          }
        }
      } catch {
        // Ignore transient poll errors
      }
    };

    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [session?.botId, session?.caseId]);

  const value = useMemo(
    () => ({
      session,
      phase,
      botStatus,
      importStatus,
      subCode,
      errorMessage,
      consentConfirmed,
      elapsedSeconds,
      waitRemainingSeconds,
      waitRemainingLabel,
      panelOpen,
      setPanelOpen,
      liveBotModalOpen,
      setLiveBotModalOpen,
      startSession,
      clearSession,
      cancelSession,
      cancelling,
    }),
    [
      session,
      phase,
      botStatus,
      importStatus,
      subCode,
      errorMessage,
      consentConfirmed,
      elapsedSeconds,
      waitRemainingSeconds,
      waitRemainingLabel,
      panelOpen,
      liveBotModalOpen,
      startSession,
      clearSession,
      cancelSession,
      cancelling,
    ],
  );

  return (
    <LiveBotSessionContext.Provider value={value}>{children}</LiveBotSessionContext.Provider>
  );
}

export function useLiveBotSession() {
  const ctx = useContext(LiveBotSessionContext);
  if (!ctx) {
    throw new Error("useLiveBotSession must be used within a LiveBotSessionProvider");
  }
  return ctx;
}

/** Safe hook for components that may render outside the provider (e.g. tests). */
export function useLiveBotSessionOptional() {
  return useContext(LiveBotSessionContext);
}
