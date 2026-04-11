import { createPortal } from "react-dom";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

const CALENDLY_URL = "https://calendly.com/legalnote/demo";

export function DemoBadge() {
  return (
    <>
      {createPortal(
        <div
          className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 px-6 py-3"
          style={{ background: "linear-gradient(90deg, #1a1a2e 0%, #16213e 100%)", borderTop: "1px solid rgba(255,255,255,0.08)" }}
          data-testid="demo-cta-bar"
        >
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold text-white">Exploring the demo?</p>
            <p className="text-xs text-white/60">Book a 15-minute call to see LegalNote for your firm — no obligation.</p>
          </div>
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-book-demo-call"
          >
            <Button
              size="sm"
              className="gap-1.5 whitespace-nowrap flex-shrink-0"
              style={{ background: "#c05640", color: "#fff", borderColor: "#c05640" }}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Book a call
            </Button>
          </a>
        </div>,
        document.body
      )}
    </>
  );
}
