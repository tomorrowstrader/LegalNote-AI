import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, User, HelpCircle, Shield, Home, FileText, FolderOpen, Settings, CheckSquare, Users, Clock, ChevronDown } from "lucide-react";
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

interface TopNavigationProps {
  onRestartTour: () => void;
}

const primaryNavLinks = [
  { path: "/", label: "Dashboard", mobileLabel: "Dashboard", icon: Home },
  { path: "/new-note", label: "New Note", mobileLabel: "New Note", icon: FileText },
  { path: "/cases", label: "Cases", mobileLabel: "Saved Cases", icon: FolderOpen },
];

const moreNavLinks = [
  { path: "/my-actions", label: "My Obligations", mobileLabel: "My Obligations", icon: CheckSquare },
  { path: "/clients", label: "Clients", mobileLabel: "Clients", icon: Users },
  { path: "/time-summary", label: "Time Summary", mobileLabel: "Time Summary", icon: Clock },
  { path: "/settings", label: "Settings", mobileLabel: "Settings", icon: Settings },
];

const allNavLinks = [...primaryNavLinks, ...moreNavLinks];

export default function TopNavigation({ onRestartTour }: TopNavigationProps) {
  const [location, setLocation] = useLocation();
  const { user, isAdmin, isFirmAdmin, canAccessFirmCompliance } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (path: string) => {
    setLocation(path);
    setMobileMenuOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-primary via-black to-primary border-b border-primary-border shadow-lg">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center h-16 gap-2">
          <Link href="/" data-testid="link-home">
            <div className="hover-elevate active-elevate-2 rounded-md px-2 py-1 -ml-2 flex-shrink-0">
              <Logo variant="wordmark" size="md" tone="dark" animate />
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-1 flex-shrink-0">
            {primaryNavLinks.map((link) => {
              const isActive = location === link.path;
              return (
                <Link key={link.path} href={link.path} data-testid={`link-${link.label.toLowerCase().replace(/\s+/g, '-')}`}>
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
                    moreNavLinks.some(l => location === l.path)
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
                {moreNavLinks.map((link) => {
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
            <CaseQuickSwitch />
            
            <GlobalSearch />
            
            <QuickRecordButton />

            <NotificationsPanel />
            
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
                {canAccessFirmCompliance && (
                  <DropdownMenuItem asChild data-testid="menu-item-firm-compliance">
                    <Link href="/compliance">
                      <Shield className="w-4 h-4 mr-2" />
                      Firm Compliance
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild data-testid="menu-item-audit-logs">
                  <Link href="/audit-logs">Audit Logs</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild data-testid="menu-item-security">
                  <Link href="/app/security">
                    <Shield className="w-4 h-4 mr-2" />
                    Security & Compliance
                  </Link>
                </DropdownMenuItem>
                {(isFirmAdmin) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild data-testid="menu-item-team-management">
                      <Link href="/team">Team Management</Link>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem asChild data-testid="menu-item-admin-dashboard">
                        <Link href="/admin">Admin Dashboard</Link>
                      </DropdownMenuItem>
                    )}
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

            <DropdownMenu open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="lg:hidden text-primary-foreground" 
                  data-testid="button-mobile-menu"
                >
                  <Menu className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {allNavLinks.map((link) => {
                  const isActive = location === link.path;
                  const Icon = link.icon;
                  return (
                    <DropdownMenuItem
                      key={link.path}
                      onClick={() => handleNavClick(link.path)}
                      className={isActive ? "bg-accent/20" : ""}
                      data-testid={`mobile-link-${link.mobileLabel.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {link.mobileLabel}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}
