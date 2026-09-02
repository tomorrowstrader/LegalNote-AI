import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, FileText, Users, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ScenarioStep = "inception" | "meeting" | "mlro" | "timeline";

const STEP_CONTENT: Record<
  ScenarioStep,
  { title: string; subtitle: string; items: { icon: typeof FileText; text: string }[] }
> = {
  inception: {
    title: "Week two — client conference",
    subtitle: "Employment matter · month 2 of 6",
    items: [
      { icon: Clock, text: "Meeting captured — solicitor stays present with the client" },
      { icon: FileText, text: "Attendance note on the matter within minutes" },
      { icon: CheckCircle2, text: "Required topics documented as the conversation happens" },
    ],
  },
  meeting: {
    title: "Partner review — same week",
    subtitle: "Managing partner · file check",
    items: [
      { icon: Users, text: "Timeline shows every meeting — not just the latest note" },
      { icon: AlertCircle, text: "Gap visible: a required discussion not yet on the file" },
      { icon: CheckCircle2, text: "Raised in week two — not at matter completion" },
    ],
  },
  mlro: {
    title: "Fee earner follows up",
    subtitle: "Before the sensitive stage",
    items: [
      { icon: FileText, text: "Client conversation happens while trust is still intact" },
      { icon: CheckCircle2, text: "Explanation documented on the matter — same standard" },
      { icon: Clock, text: "Matter stays on track; no cliff-edge surprises" },
    ],
  },
  timeline: {
    title: "Complete matter picture",
    subtitle: "Every meeting · one place",
    items: [
      { icon: FileText, text: "Six months of client interactions on one timeline" },
      { icon: Users, text: "Every fee earner — same workflow, same quality" },
      { icon: CheckCircle2, text: "Referral-ready service that scales with your firm" },
    ],
  },
};

interface FunnelProductFrameProps {
  step: ScenarioStep;
  className?: string;
}

export function FunnelProductFrame({ step, className }: FunnelProductFrameProps) {
  const content = STEP_CONTENT[step];

  return (
    <div className={cn("funnel-phone-frame", className)}>
      <div className="funnel-phone-notch" aria-hidden />
      <div className="funnel-phone-screen">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="text-[10px] uppercase tracking-widest text-white/40">Patterson matter</span>
          <span className="text-[10px] text-emerald-400/90 font-medium">On the matter</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="p-4 space-y-4"
          >
            <div>
              <p className="text-xs text-amber-400/90 font-medium mb-0.5">{content.subtitle}</p>
              <h3 className="text-base font-semibold text-white tracking-tight">{content.title}</h3>
            </div>

            <div className="space-y-2.5">
              {content.items.map((item, i) => (
                <motion.div
                  key={item.text}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 * i, duration: 0.3 }}
                  className="flex items-start gap-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] px-3 py-2.5"
                >
                  <item.icon className="h-3.5 w-3.5 text-amber-400/80 mt-0.5 shrink-0" />
                  <p className="text-[11px] leading-snug text-white/75">{item.text}</p>
                </motion.div>
              ))}
            </div>

            <div className="flex gap-1 pt-1">
              {(["inception", "meeting", "mlro", "timeline"] as ScenarioStep[]).map((s) => (
                <div
                  key={s}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors duration-300",
                    s === step ? "bg-amber-400/90" : "bg-white/10",
                  )}
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
