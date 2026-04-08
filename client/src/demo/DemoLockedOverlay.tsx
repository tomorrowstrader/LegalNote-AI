import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const LOCKED_CASE_IDS = [
  "demo-case-002",
  "demo-case-003",
  "demo-case-004",
  "demo-case-005",
  "demo-case-006",
  "demo-case-007",
];

export function isDemoCaseLocked(caseId: string): boolean {
  return LOCKED_CASE_IDS.includes(caseId);
}

interface OverlayRect {
  id: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

function computeOverlays(): OverlayRect[] {
  const rects: OverlayRect[] = [];
  for (const caseId of LOCKED_CASE_IDS) {
    const el = document.querySelector(`[data-testid="row-case-${caseId}"]`);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    rects.push({
      id: caseId,
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height,
    });
  }
  return rects;
}

function LockedOverlayItem({ overlay }: { overlay: OverlayRect }) {
  const { toast } = useToast();
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      toast({
        title: "Locked in demo environment",
        description: "Only the demo case is accessible. Book a call to see the full product.",
        duration: 4000,
      });
    },
    [toast]
  );

  return (
    <div
      data-testid={`demo-locked-overlay-${overlay.id}`}
      onClick={handleClick}
      className="flex flex-col items-center justify-center gap-1 cursor-pointer"
      style={{
        position: "absolute",
        top: overlay.top,
        left: overlay.left,
        width: overlay.width,
        height: overlay.height,
        zIndex: 40,
        backdropFilter: "blur(2px)",
        background: "rgba(0,0,0,0.18)",
        borderRadius: "4px",
      }}
    >
      <Lock className="w-4 h-4 text-white/90" />
      <span className="text-[11px] font-semibold text-white/90">Locked in demo</span>
    </div>
  );
}

export function DemoLockedOverlayManager() {
  const [overlays, setOverlays] = useState<OverlayRect[]>([]);
  const rafRef = useRef<number | null>(null);

  const refresh = useCallback(() => {
    setOverlays(computeOverlays());
  }, []);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(refresh);
    };

    scheduleRefresh();

    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.body, { childList: true, subtree: true, attributes: false });

    window.addEventListener("scroll", scheduleRefresh, { passive: true });
    window.addEventListener("resize", scheduleRefresh, { passive: true });

    const interval = setInterval(scheduleRefresh, 2000);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", scheduleRefresh);
      window.removeEventListener("resize", scheduleRefresh);
      clearInterval(interval);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [refresh]);

  if (overlays.length === 0) return null;

  return createPortal(
    <>
      {overlays.map((o) => (
        <LockedOverlayItem key={o.id} overlay={o} />
      ))}
    </>,
    document.body
  );
}
