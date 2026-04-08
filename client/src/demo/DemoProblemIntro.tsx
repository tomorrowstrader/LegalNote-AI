import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Phone,
  FileCheck,
  AlertCircle,
  Shield,
  FileQuestion,
  Brain,
  ArrowRight,
  CheckCircle,
  Scale,
  Users,
  FileText,
  ChevronLeft,
} from "lucide-react";

interface DemoProblemIntroProps {
  onComplete: () => void;
}

const SLIDES = [
  {
    id: 1,
    headline: "Every undocumented client interaction is a regulatory exposure.",
    subtext:
      "The SRA Code of Conduct requires a contemporaneous record of every material piece of advice. If you cannot produce it on inspection, you cannot defend the file.",
  },
  {
    id: 2,
    headline: "When a client challenges your advice, what is your evidence?",
    subtext:
      "A PI claim without a timestamped, auditable attendance note is very difficult to defend. Your insurer will ask for the advice trail before anything else.",
  },
  {
    id: 3,
    headline:
      "Writing attendance notes after every meeting is a significant neurological load.",
    subtext:
      "For neurodivergent solicitors — and for any fee earner managing a full caseload — detailed post-meeting documentation is a recognised workplace barrier. Removing it is both good practice and a reasonable adjustment under the Equality Act 2010.",
  },
  {
    id: 4,
    headline:
      "Compliance gaps, defensibility gaps, and staff welfare gaps — all from the same missing document.",
    subtext:
      "An attendance note is not an administrative task. It is the legal record of professional judgement. It protects the client, the solicitor, and the firm.",
  },
  {
    id: 5,
    headline: "Every session documented. Every record defensible. No additional effort.",
    subtext: "A 2-minute walkthrough using your practice area and your workflows.",
  },
];

function Slide1Visual() {
  const rows = [
    { label: "Initial consultation — 12 Jan", documented: true },
    { label: "Follow-up call — 19 Jan", documented: true },
    { label: "Counsel advice — 26 Jan", documented: true },
    { label: "Client update — 2 Feb", documented: true },
    { label: "Settlement discussion — 9 Feb", documented: false },
  ];
  return (
    <div className="flex flex-col gap-2 w-full max-w-sm mx-auto">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-md bg-white/5">
          <Phone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground flex-1 truncate">{row.label}</span>
          {row.documented ? (
            <div className="flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-emerald-400">Documented</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs text-red-400">No record</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Slide2Visual() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-end gap-6">
        <div className="relative">
          <Shield className="w-16 h-16 text-muted-foreground/40" />
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-red-500/20 rounded-b-full" />
          <AlertCircle className="absolute -bottom-1 -right-1 w-5 h-5 text-red-400" />
        </div>
        <FileQuestion className="w-10 h-10 text-muted-foreground/40" />
      </div>
      <div className="flex gap-2 flex-wrap justify-center">
        {["SRA inspection", "PI claim", "Court disclosure"].map((label) => (
          <span
            key={label}
            className="px-2.5 py-1 rounded-md text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/20"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Slide3Visual() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <Brain className="w-12 h-12 text-muted-foreground/50" />
          <span className="text-xs text-muted-foreground">Manual effort</span>
        </div>
        <ArrowRight className="w-6 h-6 text-muted-foreground/40" />
        <div className="flex flex-col items-center gap-1">
          <CheckCircle className="w-12 h-12 text-emerald-400/80" />
          <span className="text-xs text-emerald-400">Note ready</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground/60 text-center max-w-xs">
        Equality Act 2010, s.20 — duty to make reasonable adjustments
      </p>
    </div>
  );
}

function Slide4Visual() {
  const pillars = [
    { icon: Scale, label: "SRA" },
    { icon: Shield, label: "PI Insurer" },
    { icon: Users, label: "Your Team" },
  ];
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-6">
        {pillars.map(({ icon: Icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-1.5">
            <div className="relative">
              <Icon className="w-8 h-8 text-muted-foreground/50" />
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                <AlertCircle className="w-2.5 h-2.5 text-amber-950" />
              </span>
            </div>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="w-px h-5 bg-muted-foreground/20" />
        <FileText className="w-8 h-8 text-muted-foreground/50" />
        <span className="text-xs text-muted-foreground">Missing attendance note</span>
      </div>
    </div>
  );
}

const VISUALS = [Slide1Visual, Slide2Visual, Slide3Visual, Slide4Visual, null];

export function DemoProblemIntro({ onComplete }: DemoProblemIntroProps) {
  const [slide, setSlide] = useState(0);
  const current = SLIDES[slide];
  const Visual = VISUALS[slide];

  const handleNext = () => {
    if (slide < SLIDES.length - 1) {
      setSlide((s) => s + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (slide > 0) setSlide((s) => s - 1);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background">
      <div className="relative w-full max-w-xl mx-auto px-6 flex flex-col items-center min-h-screen justify-center gap-8">

        <div className="flex flex-col items-center gap-6 w-full">
          {Visual && (
            <div className="w-full flex justify-center py-2">
              <Visual />
            </div>
          )}

          <div className="text-center flex flex-col gap-3 max-w-md">
            <h2 className="text-xl font-semibold leading-snug text-foreground">
              {current.headline}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {current.subtext}
            </p>
          </div>

          {slide === SLIDES.length - 1 && (
            <Button
              className="w-full max-w-xs text-sm font-semibold"
              style={{ background: "hsl(18 70% 42%)", color: "#fff" }}
              size="lg"
              onClick={onComplete}
              data-testid="button-demo-intro-cta"
            >
              Show me how
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between w-full max-w-sm">
          <button
            onClick={() => onComplete()}
            className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            data-testid="button-demo-intro-skip"
          >
            Skip intro
          </button>

          <div className="flex gap-1.5">
            {SLIDES.map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full transition-colors"
                style={{
                  background: i === slide ? "hsl(18 70% 42%)" : "hsl(var(--muted-foreground) / 0.3)",
                }}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {slide > 0 && (
              <button
                onClick={handleBack}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-demo-intro-back"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            {slide < SLIDES.length - 1 && (
              <Button size="sm" onClick={handleNext} data-testid="button-demo-intro-next">
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
