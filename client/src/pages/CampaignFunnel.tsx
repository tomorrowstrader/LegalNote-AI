import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ChevronDown,
  Calendar,
  Shield,
  Users,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { EarlyAccessForm } from "@/components/EarlyAccessForm";
import { FunnelProductFrame, type ScenarioStep } from "@/components/funnel/FunnelProductFrame";
import { FunnelMiniCalculator } from "@/components/funnel/FunnelMiniCalculator";
import { useFunnelScroll, getCampaignSource } from "@/components/funnel/useFunnelScroll";
import { cn } from "@/lib/utils";

const CALENDLY_URL = "https://calendly.com/legalnote/demo";

const FUNNEL_SECTIONS = [
  { id: "funnel-hero", label: "Start" },
  { id: "funnel-problem", label: "Problem" },
  { id: "funnel-promise", label: "Promise" },
  { id: "funnel-scenario", label: "Scenario" },
  { id: "funnel-trust", label: "Trust" },
  { id: "funnel-value", label: "Value" },
  { id: "funnel-cta", label: "Action" },
] as const;

const SCENARIO_STEPS: { id: ScenarioStep; label: string; headline: string }[] = [
  { id: "inception", label: "01", headline: "Client meeting captured — attendance note on the matter in minutes" },
  { id: "meeting", label: "02", headline: "Partner reviews the timeline — gaps visible in week two, not at completion" },
  { id: "mlro", label: "03", headline: "Required conversation happens early — while client trust is intact" },
  { id: "timeline", label: "04", headline: "Six months of meetings, one place — referral-ready from day one" },
];

const STACK_LAYERS = [
  { label: "CRM", role: "Pipeline & relationships" },
  { label: "PMS", role: "Matter admin & billing" },
  { label: "LegalNote", role: "Client meetings → matter file", highlight: true },
];

const GROWTH_PAIN_CARDS = [
  {
    quote: "We're hiring, but I can't be in every meeting. How do I know the notes are up to our standard?",
    role: "Managing Partner",
  },
  {
    quote: "Attendance notes eat three hours every Friday. That's time I'm not with clients or winning work.",
    role: "Senior Partner",
  },
  {
    quote: "When we grow, quality slips. Clients notice before we do — and referrals dry up.",
    role: "Founder, 5 fee earners",
  },
];

const TRUST_PILLARS = [
  {
    icon: Users,
    title: "Same standard, every fee earner",
    body: "Structured attendance notes from every client meeting — whether it's you, a new starter, or your third hire.",
  },
  {
    icon: TrendingUp,
    title: "Catch gaps early, not at completion",
    body: "See what was — and wasn't — discussed in every meeting. Review the timeline before a matter reaches the cliff edge.",
  },
  {
    icon: Shield,
    title: "Defensible when it matters",
    body: "Structured attendance notes, EU-only processing, tamper-evident audit trail. Premium quality that's also audit-ready.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  }),
};

function ScrollHint({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="funnel-scroll-hint group"
      aria-label="Continue to next section"
    >
      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground group-hover:text-foreground transition-colors">
        Continue
      </span>
      <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground animate-bounce transition-colors" />
    </button>
  );
}

function SectionShell({
  id,
  children,
  className,
  dark = false,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        "funnel-section",
        dark && "funnel-section-dark",
        className,
      )}
    >
      <div className="funnel-section-inner">{children}</div>
    </section>
  );
}

export default function CampaignFunnel() {
  const [showForm, setShowForm] = useState(false);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [formSource, setFormSource] = useState("campaign_funnel");
  const { activeIndex, scrollToSection, scrollToNext } = useFunnelScroll(
    useMemo(() => [...FUNNEL_SECTIONS], []),
  );

  useEffect(() => {
    setFormSource(getCampaignSource());
  }, []);

  const currentScenario = SCENARIO_STEPS[scenarioIndex];

  const openCalendly = () => {
    window.open(CALENDLY_URL, "_blank", "noopener,noreferrer");
  };

  const openEvaluation = (source: string) => {
    setFormSource(source);
    setShowForm(true);
  };

  return (
    <div className="funnel-root" data-testid="campaign-funnel">
      <div className="funnel-grain" aria-hidden />

      {/* Fixed chrome */}
      <header className="funnel-header">
        <Link href="/">
          <Logo variant="wordmark" size="sm" tone="light" className="opacity-90 hover:opacity-100 transition-opacity" />
        </Link>
        <Button
          size="sm"
          className="funnel-cta-primary hidden sm:inline-flex"
          onClick={openCalendly}
          data-testid="button-header-book-demo"
        >
          Book 15-min call
        </Button>
      </header>

      {/* Progress rail */}
      <nav className="funnel-progress" aria-label="Funnel progress">
        {FUNNEL_SECTIONS.map((section, i) => (
          <button
            key={section.id}
            type="button"
            onClick={() => scrollToSection(section.id)}
            className={cn("funnel-progress-dot", i === activeIndex && "funnel-progress-dot-active")}
            aria-label={section.label}
            aria-current={i === activeIndex ? "step" : undefined}
          />
        ))}
      </nav>

      {/* ── 1. Hero ── */}
      <SectionShell id="funnel-hero">
        <motion.div
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center text-center max-w-3xl mx-auto"
        >
          <motion.div variants={fadeUp} custom={0} className="funnel-badge mb-8">
            <Sparkles className="h-3 w-3" />
            LegalNote v2.0 — founding firm cohort
          </motion.div>

          <motion.h1
            variants={fadeUp}
            custom={1}
            className="funnel-headline text-balance"
          >
            Grow your firm without the{" "}
            <span className="funnel-accent-text">quality slipping.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={2}
            className="funnel-subhead mt-6 max-w-xl text-balance"
          >
            Your Meeting-to-Matter system — every client conference captured, documented,
            and on the file. So you grow the team without losing sight of what happened in the room.
          </motion.p>

          <motion.div variants={fadeUp} custom={3} className="mt-10 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button
              size="lg"
              className="funnel-cta-primary h-12 px-8 text-base w-full sm:w-auto"
              onClick={openCalendly}
              data-testid="button-hero-book-demo"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Book a 15-minute discovery call
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-8 text-base w-full sm:w-auto border-foreground/15 bg-background/50 backdrop-blur-sm"
              onClick={() => openEvaluation(`${formSource}_hero`)}
              data-testid="button-hero-evaluation"
            >
              Start governed evaluation
            </Button>
          </motion.div>

          <motion.p variants={fadeUp} custom={4} className="mt-6 text-xs text-muted-foreground">
            For UK firms turning £750k–£1.5m · 30-day governed evaluation · No annual commitment
          </motion.p>
        </motion.div>

        <ScrollHint onClick={scrollToNext} />
      </SectionShell>

      {/* ── 2. Problem ── */}
      <SectionShell id="funnel-problem" className="funnel-section-alt">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto text-center mb-10 sm:mb-14"
        >
          <p className="funnel-eyebrow">When visibility comes too late</p>
          <h2 className="funnel-section-title text-balance">
            Six months of meetings. One conversation missed. Matter lost at the final review.
          </h2>
        </motion.div>

        <motion.article
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="funnel-story-card max-w-3xl mx-auto mb-10 sm:mb-12"
        >
          <p className="text-base sm:text-lg leading-relaxed text-foreground/90">
            A partner told me about a deal that ran six months through three people. At the final check,
            he found a required client conversation had never happened. He called the client to explain —
            at the most sensitive point in the matter. The client hadn't understood. They pulled out.
          </p>
          <p className="mt-4 text-sm sm:text-base leading-relaxed text-muted-foreground">
            The problem wasn't negligence. Nobody could see what happened in the meetings until the end.
            If it had been visible in week two, the conversation would have happened while trust was still intact.
          </p>
          <p className="mt-6 text-xs uppercase tracking-widest text-[hsl(18,70%,42%)]">
            The same pattern plays out on every long matter — in every growing firm.
          </p>
        </motion.article>

        <div className="funnel-fear-scroll">
          {GROWTH_PAIN_CARDS.map((card, i) => (
            <motion.article
              key={card.role}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="funnel-fear-card"
            >
              <p className="text-lg sm:text-xl leading-relaxed font-medium text-foreground/90">
                "{card.quote}"
              </p>
              <p className="mt-6 text-xs uppercase tracking-widest text-muted-foreground">
                {card.role}
              </p>
            </motion.article>
          ))}
        </div>

        <ScrollHint onClick={scrollToNext} />
      </SectionShell>

      {/* ── 3. Promise ── */}
      <SectionShell id="funnel-promise" dark>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center max-w-3xl mx-auto"
        >
          <p className="text-xs uppercase tracking-[0.25em] text-amber-400/70 mb-6">Meeting-to-Matter™</p>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-white leading-[1.08]">
            Your system for
            <br />
            <span className="text-amber-400/95">client meetings.</span>
          </h2>
          <p className="mt-8 text-base sm:text-lg text-white/60 max-w-lg mx-auto leading-relaxed">
            You have a system for your pipeline. A system for your matters.
            LegalNote is the system for what happens when your solicitors sit down with clients —
            captured, documented, and on the matter from day one.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center max-w-2xl mx-auto">
            {STACK_LAYERS.map((layer) => (
              <div
                key={layer.label}
                className={cn(
                  "flex-1 rounded-xl px-4 py-3 border text-left",
                  layer.highlight
                    ? "border-amber-400/40 bg-amber-400/10"
                    : "border-white/10 bg-white/[0.04]",
                )}
              >
                <p className={cn(
                  "text-sm font-semibold",
                  layer.highlight ? "text-amber-300" : "text-white/70",
                )}>
                  {layer.label}
                </p>
                <p className="text-xs text-white/45 mt-0.5">{layer.role}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <ScrollHint onClick={scrollToNext} />
      </SectionShell>

      {/* ── 4. Scenario demo ── */}
      <SectionShell id="funnel-scenario">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center max-w-5xl mx-auto w-full">
          <div>
            <p className="funnel-eyebrow">Meeting-to-Matter in practice</p>
            <h2 className="funnel-section-title mb-8">
              Catch what wasn't said — in week two, not at completion.
            </h2>

            <div className="space-y-2 mb-8">
              {SCENARIO_STEPS.map((step, i) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setScenarioIndex(i)}
                  className={cn(
                    "funnel-scenario-tab w-full text-left",
                    i === scenarioIndex && "funnel-scenario-tab-active",
                  )}
                  data-testid={`button-scenario-${step.id}`}
                >
                  <span className="text-[10px] font-mono text-muted-foreground mr-3">{step.label}</span>
                  <span className="text-sm font-medium">{step.headline}</span>
                </button>
              ))}
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed hidden sm:block">
              Attendance notes are the most meticulous output — but the value is the full meeting record
              on the matter. Every fee earner, every conference, visible before it becomes a problem.
            </p>
          </div>

          <div className="flex justify-center lg:justify-end">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentScenario.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
              >
                <FunnelProductFrame step={currentScenario.id} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="flex justify-center gap-2 mt-10 lg:hidden">
          {SCENARIO_STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setScenarioIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === scenarioIndex ? "w-8 bg-[hsl(18,70%,42%)]" : "w-1.5 bg-foreground/15",
              )}
              aria-label={`Scenario step ${i + 1}`}
            />
          ))}
        </div>

        <ScrollHint onClick={scrollToNext} />
      </SectionShell>

      {/* ── 5. Trust ── */}
      <SectionShell id="funnel-trust" className="funnel-section-alt">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <p className="funnel-eyebrow">Built for growing firms</p>
          <h2 className="funnel-section-title">
            Scale your team. Keep your standard. Win the referrals.
          </h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto w-full">
          {TRUST_PILLARS.map((pillar, i) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.45 }}
              className="funnel-trust-card"
            >
              <div className="funnel-trust-icon">
                <pillar.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{pillar.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{pillar.body}</p>
            </motion.div>
          ))}
        </div>

        <ScrollHint onClick={scrollToNext} />
      </SectionShell>

      {/* ── 6. Value calculator ── */}
      <SectionShell id="funnel-value">
        <div className="max-w-2xl mx-auto text-center mb-10">
          <p className="funnel-eyebrow">The numbers</p>
          <h2 className="funnel-section-title text-balance">
            How much time are attendance notes costing your growth?
          </h2>
          <p className="mt-4 text-muted-foreground text-sm sm:text-base">
            Every hour on documentation is an hour not spent with clients, training your team, or winning new work.
          </p>
        </div>

        <FunnelMiniCalculator />

        <ScrollHint onClick={scrollToNext} />
      </SectionShell>

      {/* ── 7. CTA ── */}
      <SectionShell id="funnel-cta" dark className="!min-h-[85vh]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-xs text-amber-300/90 mb-8">
            <TrendingUp className="h-3.5 w-3.5" />
            5 founding firm slots before v2.0 launch
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-white tracking-tight leading-tight">
            Ready to grow without sacrificing the standard your clients expect?
          </h2>
          <p className="mt-6 text-white/55 text-base sm:text-lg leading-relaxed">
            Book a 15-minute discovery call — or start a governed 30-day evaluation with your team.
            We'll show you how LegalNote fits between your meetings and your matter files.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="funnel-cta-gold h-12 px-8 text-base w-full sm:w-auto"
              onClick={openCalendly}
              data-testid="button-final-book-demo"
            >
              Book discovery call
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-8 text-base w-full sm:w-auto border-white/20 text-white bg-white/5 hover:bg-white/10 hover:text-white"
              onClick={() => openEvaluation(`${formSource}_cta`)}
              data-testid="button-final-evaluation"
            >
              Request governed evaluation
            </Button>
          </div>

          <p className="mt-8 text-xs text-white/35">
            © {new Date().getFullYear()} LegalNote Technologies Ltd ·{" "}
            <Link href="/privacy" className="underline hover:text-white/50">Privacy</Link>
            {" · "}
            <Link href="/terms" className="underline hover:text-white/50">Terms</Link>
          </p>
        </motion.div>
      </SectionShell>

      {/* Mobile sticky CTA */}
      <div className="funnel-sticky-cta sm:hidden">
        <Button
          className="funnel-cta-primary flex-1 h-11"
          onClick={openCalendly}
          data-testid="button-sticky-book-demo"
        >
          Book 15-min call
        </Button>
        <Button
          variant="outline"
          className="h-11 px-4 border-foreground/15"
          onClick={() => openEvaluation(`${formSource}_sticky`)}
          data-testid="button-sticky-evaluation"
        >
          Evaluate
        </Button>
      </div>

      <EarlyAccessForm
        open={showForm}
        onOpenChange={setShowForm}
        source={formSource}
      />
    </div>
  );
}
