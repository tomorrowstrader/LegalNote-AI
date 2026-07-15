type DebugPayload = {
  location: string;
  message: string;
  data?: Record<string, unknown>;
  hypothesisId?: string;
  runId?: string;
};

/** Dual-write debug events to local ingest + production in-memory buffer. */
export function debugClientLog(payload: DebugPayload) {
  const body = {
    sessionId: "95f25d",
    location: payload.location,
    message: payload.message,
    data: payload.data || {},
    hypothesisId: payload.hypothesisId || "X",
    runId: payload.runId || "white-screen",
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
    timestamp: Date.now(),
  };

  // #region agent log
  fetch("http://127.0.0.1:7671/ingest/dfbc9758-293a-480b-a080-cbd261ef30c7", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "95f25d" },
    body: JSON.stringify(body),
  }).catch(() => {});

  fetch("/api/_debug/client-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  }).catch(() => {});
  // #endregion

  try {
    if (typeof sessionStorage !== "undefined" && payload.message.toLowerCase().includes("crash")) {
      sessionStorage.setItem("legalnote-debug-last-crash", JSON.stringify(body));
    }
  } catch {
    /* ignore */
  }
}
