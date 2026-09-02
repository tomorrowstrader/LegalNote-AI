import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, FileText, Shield, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type ScenarioStep = "inception" | "meeting" | "mlro" | "timeline";

const STEP_CONTENT: Record<
  ScenarioStep,
  { title: string; subtitle: string; items: { icon: typeof FileText; text: string }[] }
> = {
  inception: {
    title: "Matter inception",
    subtitle: "First client meeting · 14 Mar 2026",
    items: [
      { icon: Shield, text: "Source of funds discussed and reasoned" },
      { icon: FileText, text: "Risk assessment in solicitor's own words" },
      { icon: CheckCircle2, text: "Signed, dated, tamper-evident record" },
    ],
  },
  meeting: {
    title: "Mid-matter meeting",
    subtitle: "Client conference · 2 Jun 2026",
    items: [
      { icon: FileText, text: "Attendance note from verbatim transcript" },
      { icon: Shield, text: "AML prompt surfaced — monitoring note added" },
      { icon: Clock, text: "Captured as work happened, not reconstructed" },
    ],
  },
  mlro: {
    title: "MLRO review",
    subtitle: "Escalation · 9 Jun 2026",
    items: [
      { icon: Shield, text: "Fee earner flagged concern with reasoning" },
      { icon: CheckCircle2, text: "MLRO decision documented and signed" },
      { icon: Clock, text: "Full chain visible on the matter file" },
    ],
  },
  timeline: {
    title: "Complete file picture",
    subtitle: "What you hand to the regulator",
    items: [
      { icon: FileText, text: "Every meeting linked on one timeline" },
      { icon: Shield, text: "AML decisions traceable from day one" },
      { icon: CheckCircle2, text: "Nothing missing. Nothing reconstructed." },
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
          <span className="text-[10px] text-emerald-400/90 font-medium">Audit ready</span>
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
