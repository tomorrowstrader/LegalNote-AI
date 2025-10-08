import { Link, useLocation } from "wouter";
import { Scale, Menu, User } from "lucide-react";
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

const navLinks = [
  { path: "/", label: "Dashboard" },
  { path: "/new-note", label: "New Note" },
  { path: "/cases", label: "Saved Cases" },
  { path: "/settings", label: "Settings" },
];

export default function TopNavigation() {
  const [location] = useLocation();

  return (
    <nav className="sticky top-0 z-50 bg-gradient-to-r from-primary via-black to-primary border-b border-primary-border shadow-lg">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center h-16 gap-2">
          <Link href="/" data-testid="link-home">
            <div className="flex items-center gap-2 hover-elevate active-elevate-2 rounded-md px-2 py-1 -ml-2 flex-shrink-0">
              <Scale className="w-6 h-6 text-accent" />
              <span className="text-lg font-semibold text-primary-foreground whitespace-nowrap">
                LegalNote AI
              </span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1 flex-1 min-w-0 ml-6">
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
            <div className="hidden xl:block">
              <GlobalSearch />
            </div>
            
            <QuickRecordButton />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-primary-foreground" data-testid="button-user-menu">
                  <User className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">John Smith</p>
                  <p className="text-xs text-muted-foreground">j.smith@lawfirm.co.uk</p>
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
                <DropdownMenuSeparator />
                <DropdownMenuItem data-testid="menu-item-logout">Log Out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="icon" className="md:hidden text-primary-foreground" data-testid="button-mobile-menu">
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
