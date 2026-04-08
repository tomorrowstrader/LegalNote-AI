import { Shield, Phone, ExternalLink, LayoutDashboard, FolderOpen, FileText, MessageSquare, ClipboardList, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type DemoScreen = "dashboard" | "case-detail" | "document" | "transcript" | "audit";

interface DemoShellProps {
  screen: DemoScreen;
  onNavigate: (screen: DemoScreen) => void;
  firmName: string;
  firstName: string;
  practiceAreaLabel: string;
  onRestartTour: () => void;
  children: React.ReactNode;
}

const CTA_LINK = "mailto:hello@legalnote.co.uk?subject=LegalNote%20Demo%20Enquiry&body=Hi%2C%20I%20just%20viewed%20the%20LegalNote%20demo%20and%20I%27d%20like%20to%20book%20a%2015-minute%20call.";

const SCREENS: { id: DemoScreen; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "case-detail", label: "Case Detail", icon: FolderOpen },
  { id: "document", label: "Document Viewer", icon: FileText },
  { id: "transcript", label: "Transcript", icon: MessageSquare },
  { id: "audit", label: "Audit Trail", icon: ClipboardList },
];

export function DemoShell({ screen, onNavigate, firmName, firstName, practiceAreaLabel, onRestartTour, children }: DemoShellProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div
        className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-40"
        data-testid="demo-header"
      >
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-primary flex-shrink-0" />
            <span className="font-bold text-sm tracking-tight">LegalNote</span>
            <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 ml-0.5">
              Demo
            </Badge>
            {firmName && (
              <>
                <span className="text-muted-foreground text-xs hidden sm:inline">/</span>
                <span className="text-sm font-medium hidden sm:inline truncate max-w-[180px]">{firmName}</span>
              </>
            )}
            {practiceAreaLabel && (
              <Badge variant="outline" className="text-xs hidden md:inline-flex">
                {practiceAreaLabel}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRestartTour}
              data-testid="button-replay-tour"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              <span className="hidden sm:inline">Replay tour</span>
            </Button>
            <Button size="sm" asChild data-testid="button-header-cta">
              <a href={CTA_LINK} target="_blank" rel="noopener noreferrer">
                <Phone className="w-3.5 h-3.5 mr-1.5" />
                <span className="hidden sm:inline">Book a call</span>
                <span className="sm:hidden">Book</span>
                <ExternalLink className="w-3 h-3 ml-1.5 opacity-60" />
              </a>
            </Button>
          </div>
        </div>

        {/* Screen navigation tabs */}
        <div className="max-w-6xl mx-auto px-4 flex gap-0.5 overflow-x-auto" data-testid="demo-screen-nav">
          {SCREENS.map((s) => {
            const Icon = s.icon;
            const isActive = screen === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onNavigate(s.id)}
                data-testid={`tab-${s.id}`}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 pb-20">
        {children}
      </div>

      {/* Sticky CTA Banner */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border shadow-lg"
        data-testid="cta-banner"
        data-demo-target="demo-cta-bar"
      >
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Shield className="w-4 h-4 text-primary flex-shrink-0" />
            <p className="text-sm font-medium truncate">
              Seeing this for your firm?{" "}
              <span className="text-muted-foreground font-normal hidden sm:inline">
                This is exactly what LegalNote looks like in practice.
              </span>
            </p>
          </div>
          <Button size="sm" asChild data-testid="button-cta-book-call">
            <a href={CTA_LINK} target="_blank" rel="noopener noreferrer">
              <Phone className="w-3.5 h-3.5 mr-1.5" />
              Book a 15-min call
              <ExternalLink className="w-3 h-3 ml-1.5 opacity-60" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
