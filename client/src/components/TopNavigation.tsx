import { Link, useLocation } from "wouter";
import { User, HelpCircle, Shield, Home, Mic, FolderOpen, Settings, CheckSquare, Users, Clock, ChevronDown, BadgePoundSterling, Link2 } from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import GlobalSearch from "@/components/GlobalSearch";
import QuickRecordButton from "@/components/QuickRecordButton";
import CaseQuickSwitch from "@/components/CaseQuickSwitch";
import ThemeToggle from "@/components/ThemeToggle";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { useAuth } from "@/hooks/useAuth";
import AdminQuickAccess from "@/components/AdminQuickAccess";
import { isFeatureVisible } from "@/lib/features";

const firmComplianceDashboardVisible = isFeatureVisible("firmComplianceDashboard");

interface TopNavigationProps {
  onRestartTour: () => void;
}

interface NavLinkItem {
  path: string;
  label: string;
  icon: typeof Home;
  testId?: string;
}

const primaryNavLinks: NavLinkItem[] = [
  { path: "/", label: "Dashboard", testId: "link-dashboard", icon: Home },
  { path: "/capture", label: "Capture", testId: "link-capture", icon: Mic },
  { path: "/cases", label: "Cases", testId: "link-cases", icon: FolderOpen },
];

const moreNavLinks: NavLinkItem[] = [
  { path: "/my-actions", label: "My Obligations", icon: CheckSquare },
  { path: "/clients", label: "Clients", icon: Users },
  { path: "/time-summary", label: "Time Summary", icon: Clock },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function TopNavigation({ onRestartTour }: TopNavigationProps) {
  const [location, setLocation] = useLocation();
  const { user, isAdmin, isFirmAdmin, canAccessFirmCompliance } = useAuth();
  const visibleMoreNavLinks = moreNavLinks;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-primary via-black to-primary dark:from-transparent dark:via-transparent dark:to-transparent border-b border-primary-border shadow-lg legalnote-nav pt-[env(safe-area-inset-top,0px)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-2">
          <Link href="/" data-testid="link-home">
            <div className="hover-elevate active-elevate-2 rounded-md px-2 py-1 -ml-2 flex-shrink-0">
              <Logo variant="wordmark" size="md" tone="dark" animate />
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-1 flex-shrink-0">
            {primaryNavLinks.map((link) => {
              const isActive = location === link.path || (link.path !== "/" && location.startsWith(link.path));
              return (
                <Link key={link.path} href={link.path} data-testid={link.testId}>
                  <button
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                      isActive
                        ? "text-primary-foreground border-b-2 border-accent"
                        : "text-primary-foreground/80 hover-elevate active-elevate-2"
                    }`}
                  >
                    {link.label}
                  </button>
                </Link>
              );
            })}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1 ${
                    visibleMoreNavLinks.some(l => location === l.path)
                      ? "text-primary-foreground border-b-2 border-accent"
                      : "text-primary-foreground/80 hover-elevate active-elevate-2"
                  }`}
                  data-testid="button-more-nav"
                >
                  More
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {visibleMoreNavLinks.map((link) => {
                  const isActive = location === link.path;
                  const Icon = link.icon;
                  return (
                    <DropdownMenuItem
                      key={link.path}
                      onClick={() => setLocation(link.path)}
                      className={isActive ? "bg-accent/20" : ""}
                      data-testid={`more-link-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {link.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            {/* Always mounted so bottom-nav Search can open the dialog on phones */}
            <GlobalSearch />

            <div className="hidden lg:contents">
              <CaseQuickSwitch />
              <QuickRecordButton />
            </div>

            <NotificationsPanel />

            <div className="hidden lg:contents">
              <ThemeToggle />

              {isAdmin && <AdminQuickAccess />}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-primary-foreground" data-testid="button-user-menu">
                    <User className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">
                      {user?.firstName && user?.lastName 
                        ? `${user.firstName} ${user.lastName}` 
                        : user?.email?.split('@')[0] || 'User'}
                    </p>
                    <p className="text-xs text-muted-foreground">{user?.email || ''}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild data-testid="menu-item-profile">
                    <Link href="/profile">My Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild data-testid="menu-item-firm-settings">
                    <Link href="/settings">Firm Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild data-testid="menu-item-undertakings">
                    <Link href="/undertakings">Undertakings Register</Link>
                  </DropdownMenuItem>
                  {canAccessFirmCompliance && firmComplianceDashboardVisible && (
                    <DropdownMenuItem asChild data-testid="menu-item-firm-compliance">
                      <Link href="/compliance">
                        <BadgePoundSterling className="w-4 h-4 mr-2" />
                        Firm Compliance
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <>
                      <DropdownMenuItem asChild data-testid="menu-item-audit-logs">
                        <Link href="/audit-logs">Audit Logs</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild data-testid="menu-item-security">
                        <Link href="/app/security">
                          <Shield className="w-4 h-4 mr-2" />
                          Security & Compliance
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild data-testid="menu-item-demo-generator">
                        <Link href="/demo-generator">
                          <Link2 className="w-4 h-4 mr-2" />
                          Demo Link Generator
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  {isFirmAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild data-testid="menu-item-team-management">
                        <Link href="/team">Team Management</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild data-testid="menu-item-firm-overview">
                        <Link href="/firm">Firm Overview</Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild data-testid="menu-item-admin-dashboard">
                        <Link href="/admin">Admin Dashboard</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild data-testid="menu-item-admin-provision-firm-nav">
                        <Link href="/admin/provision-firm">Provision evaluation firm</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild data-testid="menu-item-admin-dpa-mint-nav">
                        <Link href="/admin/dpa-mint">Mint DPA Link</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild data-testid="menu-item-admin-dpa-acceptances-nav">
                        <Link href="/admin/dpa-acceptances">DPA Acceptances</Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onRestartTour} data-testid="menu-item-restart-tour">
                    <HelpCircle className="w-4 h-4 mr-2" />
                    Restart Tour
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => window.location.href = '/api/logout'} 
                    data-testid="menu-item-logout"
                  >
                    Log Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
