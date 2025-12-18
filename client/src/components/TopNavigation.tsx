import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, User, HelpCircle, Shield, Home, FileText, FolderOpen, Settings, X } from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import GlobalSearch from "@/components/GlobalSearch";
import QuickRecordButton from "@/components/QuickRecordButton";
import CaseQuickSwitch from "@/components/CaseQuickSwitch";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";

interface TopNavigationProps {
  onRestartTour: () => void;
}

const navLinks = [
  { path: "/", label: "Dashboard", icon: Home },
  { path: "/new-note", label: "New Note", icon: FileText },
  { path: "/cases", label: "Saved Cases", icon: FolderOpen },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function TopNavigation({ onRestartTour }: TopNavigationProps) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Admin check via isAdmin flag from backend (configurable via ADMIN_USER_ID env var)
  const isAdmin = (user as any)?.isAdmin === true;

  const handleNavClick = (path: string) => {
    setLocation(path);
    setMobileMenuOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 bg-gradient-to-r from-primary via-black to-primary border-b border-primary-border shadow-lg">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-[auto_1fr_auto] items-center h-16 gap-4 md:gap-4">
          <Link href="/" data-testid="link-home">
            <div className="hover-elevate active-elevate-2 rounded-md px-2 py-1 -ml-2 flex-shrink-0">
              <Logo variant="wordmark" size="md" tone="dark" animate />
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-1 min-w-0 overflow-hidden">
            {navLinks.map((link) => {
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
          </div>

          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <CaseQuickSwitch />
            
            <GlobalSearch />
            
            <QuickRecordButton />
            
            <ThemeToggle />
            
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
                <DropdownMenuItem asChild data-testid="menu-item-audit-logs">
                  <Link href="/audit-logs">Audit Logs</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild data-testid="menu-item-security">
                  <Link href="/security">
                    <Shield className="w-4 h-4 mr-2" />
                    Security & Compliance
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild data-testid="menu-item-admin-dashboard">
                      <Link href="/admin">Admin Dashboard</Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onRestartTour} data-testid="menu-item-restart-tour">
                  <HelpCircle className="w-4 h-4 mr-2" />
                  Restart Tour
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem data-testid="menu-item-logout">Log Out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden text-primary-foreground" 
              data-testid="button-mobile-menu"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="right" className="w-72 bg-gradient-to-b from-primary via-black to-primary border-l border-primary-border p-0">
          <SheetHeader className="p-4 border-b border-primary-border/50">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-primary-foreground">
                <Logo variant="wordmark" size="sm" tone="dark" />
              </SheetTitle>
              <SheetClose asChild>
                <Button variant="ghost" size="icon" className="text-primary-foreground">
                  <X className="w-5 h-5" />
                </Button>
              </SheetClose>
            </div>
          </SheetHeader>
          
          <nav className="flex flex-col p-4 gap-1">
            {navLinks.map((link) => {
              const isActive = location === link.path;
              const Icon = link.icon;
              return (
                <button
                  key={link.path}
                  onClick={() => handleNavClick(link.path)}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? "bg-accent/20 text-primary-foreground border-l-2 border-accent"
                      : "text-primary-foreground/80 hover:bg-white/10"
                  }`}
                  data-testid={`mobile-link-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Icon className="w-5 h-5" />
                  {link.label}
                </button>
              );
            })}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-primary-border/50">
            <div className="text-xs text-primary-foreground/60 text-center">
              {user?.email || 'Not signed in'}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
