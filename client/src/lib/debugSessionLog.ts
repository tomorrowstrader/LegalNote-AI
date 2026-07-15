export function debugSessionLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
) {
  // #region agent log
  fetch("/api/_debug/client-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location, message, data, timestamp: Date.now(), hypothesisId }),
  }).catch(() => {});
  // #endregion
}
