import { useEffect, useState } from "react";

/**
 * A fixed strip across every page of the staging copy, so a tester (or Jazz) can never
 * mistake it for live. Live never shows it: the server says "live" there.
 */
export function StagingBanner() {
  const [staging, setStaging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/environment", { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { environment?: string } | null) => {
        if (!cancelled && body?.environment === "staging") {
          setStaging(true);
          if (!document.title.startsWith("[STAGING]")) document.title = `[STAGING] ${document.title}`;
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!staging) return null;
  return (
    <div
      role="status"
      data-testid="staging-banner"
      className="pointer-events-none fixed inset-x-0 top-0 z-[2147483647] bg-amber-400 py-0.5 text-center text-xs font-semibold uppercase tracking-wide text-black"
    >
      Staging: test data only. Nothing here reaches a real client.
    </div>
  );
}
