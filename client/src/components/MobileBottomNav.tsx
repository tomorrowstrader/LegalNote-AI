import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Home,
  FolderOpen,
  Mic,
  Search,
  MoreHorizontal,
  CheckSquare,
  Users,
  Clock,
  Settings,
  User,
  Moon,
  Sun,
  HelpCircle,
  Shield,
  BadgePoundSterling,
  Link2,
  LogOut,
  Mic2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { openGlobalSearch, openVoiceCommand } from "@/lib/mobileChromeEvents";
import { useAuth } from "@/hooks/useAuth";
import { isFeatureVisible } from "@/lib/features";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const firmComplianceDashboardVisible = isFeatureVisible("firmComplianceDashboard");

interface MobileBottomNavProps {
  onRestartTour: () => void;
}

const moreNavLinks = [
  { path: "/my-actions", label: "My Obligations", icon: CheckSquare },
  { path: "/clients", label: "Clients", icon: Users },
  { path: "/time-summary", label: "Time Summary", icon: Clock },
  { path: "/settings", label: "Settings", icon: Settings },
] as const;

function useThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem("theme") as "light" | "dark") || "light";
  });

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  return { theme, toggle };
}

export default function MobileBottomNav({ onRestartTour }: MobileBottomNavProps) {
  const [location, setLocation] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { user, isAdmin, isFirmAdmin, canAccessFirmCompliance } = useAuth();
  const { theme, toggle: toggleTheme } = useThemeToggle();

  const isHome = location === "/";
  const isCases = location === "/cases" || location.startsWith("/case/");
  const isCapture = location === "/capture" || location.startsWith("/capture");
  const moreActive = moreNavLinks.some((l) => location === l.path) || moreOpen;

  const go = (path: string) => {
    setLocation(path);
    setMoreOpen(false);
  };

  const tabClass = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-0 px-1 py-1",
      "text-[10px] font-medium tracking-tight transition-colors",
      active ? "text-foreground" : "text-muted-foreground",
    );

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/90 pb-[env(safe-area-inset-bottom,0px)]"
        aria-label="Primary"
        data-testid="mobile-bottom-nav"
      >
        <div className="flex items-end h-16 max-w-7xl mx-auto px-1">
          <Link href="/" className={tabClass(isHome)} data-testid="mobile-tab-home">
            <Home className={cn("w-5 h-5", isHome && "text-foreground")} strokeWidth={isHome ? 2.25 : 1.75} />
            <span>Home</span>
          </Link>

          <Link href="/cases" className={tabClass(isCases)} data-testid="mobile-tab-cases">
            <FolderOpen className={cn("w-5 h-5", isCases && "text-foreground")} strokeWidth={isCases ? 2.25 : 1.75} />
            <span>Cases</span>
          </Link>

          <Link
            href="/capture"
            className="relative flex flex-1 flex-col items-center justify-end min-h-[44px] -mt-5 pb-1"
            data-testid="mobile-tab-capture"
          >
            <span
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full shadow-lg border-4 border-background",
                "bg-red-600 text-white",
                isCapture && "ring-2 ring-red-600/40",
              )}
            >
              <Mic className="w-6 h-6" />
            </span>
            <span className={cn("text-[10px] font-medium mt-0.5", isCapture ? "text-foreground" : "text-muted-foreground")}>
              Capture
            </span>
          </Link>

          <button
            type="button"
            className={tabClass(false)}
            onClick={() => openGlobalSearch()}
            data-testid="mobile-tab-search"
          >
            <Search className="w-5 h-5" strokeWidth={1.75} />
            <span>Search</span>
          </button>

          <button
            type="button"
            className={tabClass(moreActive)}
            onClick={() => setMoreOpen(true)}
            data-testid="mobile-tab-more"
            aria-expanded={moreOpen}
          >
            <MoreHorizontal className={cn("w-5 h-5", moreActive && "text-foreground")} strokeWidth={moreActive ? 2.25 : 1.75} />
            <span>More</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="lg:hidden rounded-t-2xl max-h-[85vh] overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <SheetHeader className="text-left pb-2">
            <SheetTitle className="font-serif text-xl">More</SheetTitle>
            <p className="text-sm text-muted-foreground truncate">
              {user?.firstName && user?.lastName
                ? `${user.firstName} ${user.lastName}`
                : user?.email?.split("@")[0] || "Account"}
            </p>
          </SheetHeader>

          <div className="grid gap-1 py-2">
            {moreNavLinks.map((link) => {
              const Icon = link.icon;
              const active = location === link.path;
              return (
                <button
                  key={link.path}
                  type="button"
                  onClick={() => go(link.path)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium min-h-[44px]",
                    active ? "bg-accent/20 text-foreground" : "hover:bg-muted text-foreground",
                  )}
                  data-testid={`mobile-more-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Icon className="w-5 h-5 text-muted-foreground" />
                  {link.label}
                </button>
              );
            })}
          </div>

          <Separator className="my-2" />

          <div className="grid gap-1 py-1">
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                openVoiceCommand();
              }}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium min-h-[44px] hover:bg-muted"
              data-testid="mobile-more-voice"
            >
              <Mic2 className="w-5 h-5 text-muted-foreground" />
              Voice command
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium min-h-[44px] hover:bg-muted"
              data-testid="mobile-more-theme"
            >
              {theme === "light" ? (
                <Moon className="w-5 h-5 text-muted-foreground" />
              ) : (
                <Sun className="w-5 h-5 text-muted-foreground" />
              )}
              {theme === "light" ? "Dark mode" : "Light mode"}
            </button>
            <button
              type="button"
              onClick={() => go("/profile")}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium min-h-[44px] hover:bg-muted"
              data-testid="mobile-more-profile"
            >
              <User className="w-5 h-5 text-muted-foreground" />
              My Profile
            </button>
            <button
              type="button"
              onClick={() => go("/undertakings")}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium min-h-[44px] hover:bg-muted"
              data-testid="mobile-more-undertakings"
            >
              <Shield className="w-5 h-5 text-muted-foreground" />
              Undertakings Register
            </button>
            {canAccessFirmCompliance && firmComplianceDashboardVisible && (
              <button
                type="button"
                onClick={() => go("/compliance")}
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium min-h-[44px] hover:bg-muted"
                data-testid="mobile-more-compliance"
              >
                <BadgePoundSterling className="w-5 h-5 text-muted-foreground" />
                Firm Compliance
              </button>
            )}
            {isFirmAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => go("/team")}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium min-h-[44px] hover:bg-muted"
                  data-testid="mobile-more-team"
                >
                  <Users className="w-5 h-5 text-muted-foreground" />
                  Team Management
                </button>
                <button
                  type="button"
                  onClick={() => go("/firm")}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium min-h-[44px] hover:bg-muted"
                  data-testid="mobile-more-firm"
                >
                  <Settings className="w-5 h-5 text-muted-foreground" />
                  Firm Overview
                </button>
              </>
            )}
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => go("/admin")}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium min-h-[44px] hover:bg-muted"
                  data-testid="mobile-more-admin"
                >
                  <Shield className="w-5 h-5 text-muted-foreground" />
                  Admin Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => go("/demo-generator")}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium min-h-[44px] hover:bg-muted"
                  data-testid="mobile-more-demo"
                >
                  <Link2 className="w-5 h-5 text-muted-foreground" />
                  Demo Link Generator
                </button>
              </>
            )}
          </div>

          <Separator className="my-2" />

          <div className="grid gap-1 py-1">
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                onRestartTour();
              }}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium min-h-[44px] hover:bg-muted"
              data-testid="mobile-more-tour"
            >
              <HelpCircle className="w-5 h-5 text-muted-foreground" />
              Restart Tour
            </button>
            <Button
              variant="ghost"
              className="justify-start gap-3 px-3 py-3 h-auto min-h-[44px] text-destructive hover:text-destructive"
              onClick={() => {
                window.location.href = "/api/logout";
              }}
              data-testid="mobile-more-logout"
            >
              <LogOut className="w-5 h-5" />
              Log Out
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
