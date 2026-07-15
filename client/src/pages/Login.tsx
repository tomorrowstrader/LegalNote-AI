import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, FileText, ArrowRight } from "lucide-react";
import { SiGoogle, SiMicrosoft } from "react-icons/si";
import Logo from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";

export default function Login() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  const urlParams = new URLSearchParams(window.location.search);
  const authError = urlParams.get("error");

  const authErrorMessage =
    authError === "email_already_registered"
      ? "This email address is already registered. Sign in using the method you used originally."
      : authError
        ? "Authentication failed. Please try again or contact support."
        : null;

  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  const handleMicrosoftLogin = () => {
    window.location.href = "/api/auth/microsoft";
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center"
        style={{ background: "linear-gradient(135deg, hsl(0,0%,6%) 0%, hsl(220,12%,15%) 50%, hsl(0,0%,8%) 100%)" }}>
        {/* Warm glow accents */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl"
            style={{ background: "radial-gradient(circle, hsl(18,60%,70%) 0%, transparent 70%)" }} />
          <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full opacity-15 blur-3xl"
            style={{ background: "radial-gradient(circle, hsl(25,50%,75%) 0%, transparent 70%)" }} />
          <div className="absolute top-2/3 left-1/3 w-64 h-64 rounded-full opacity-10 blur-3xl"
            style={{ background: "radial-gradient(circle, hsl(45,85%,55%) 0%, transparent 70%)" }} />
        </div>

        {/* Metallic shimmer overlay */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div 
            className="absolute inset-0 opacity-[0.04]"
            style={{
              background: "linear-gradient(105deg, transparent 20%, hsl(220 60% 80%) 50%, transparent 80%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 8s ease-in-out infinite",
            }}
          />
          <div 
            className="absolute inset-0 opacity-[0.06]"
            style={{
              background: "linear-gradient(135deg, hsl(0,0%,100%) 0%, transparent 40%, transparent 60%, hsl(0,0%,100%) 100%)",
            }}
          />
        </div>

        <div className="relative z-10 max-w-md px-12 space-y-8">
          <Logo variant="wordmark" size="lg" tone="dark" animate />
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold text-white leading-tight" data-testid="text-login-headline">
              The defensible record for every client meeting.
            </h1>
            <p className="text-white/60 text-sm leading-relaxed" data-testid="text-login-description">
              Compliance-first, audit-ready documentation aligned with SRA expectations. Meeting-to-Matter™ captures contemporaneous attendance notes with cryptographic tamper detection, reducing PI exposure and building defensible records from the moment you press record.
            </p>
          </div>
          <div className="space-y-3 pt-4 border-t border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[hsl(18,70%,42%)]" />
              <span className="text-white/50 text-xs" data-testid="text-login-feature-1">Meeting-to-Matter™ contemporaneous capture</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[hsl(18,70%,42%)]" />
              <span className="text-white/50 text-xs" data-testid="text-login-feature-2">Cryptographic audit trail: un-tamperable, SRA-defensible</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[hsl(18,70%,42%)]" />
              <span className="text-white/50 text-xs" data-testid="text-login-feature-3">Consent-first recording, GDPR-compliant</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — login */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo — only visible on small screens */}
          <div className="lg:hidden text-center mb-4">
            <Logo variant="wordmark" size="lg" animate />
            <p className="text-muted-foreground text-xs mt-2">
              Compliance-first meeting documentation
            </p>
          </div>

          <div className="space-y-2">
            <div className="w-10 h-1 rounded-full bg-[hsl(18,70%,42%)] mb-4" />
            <h2 className="text-2xl font-semibold text-foreground">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Sign in to access your cases and documents
            </p>
          </div>

          {authErrorMessage && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2" data-testid="alert-auth-error">
              <p className="text-xs text-destructive">
                {authErrorMessage}
              </p>
            </div>
          )}

          <div className="space-y-4">
            <Button
              onClick={handleGoogleLogin}
              className="w-full gap-3"
              size="lg"
              data-testid="button-google-login"
            >
              <SiGoogle className="w-4 h-4" />
              Continue with Google
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>
            <Button
              onClick={handleMicrosoftLogin}
              variant="outline"
              className="w-full gap-3"
              size="lg"
              data-testid="button-microsoft-login"
            >
              <SiMicrosoft className="w-4 h-4" />
              Continue with Microsoft
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>
          </div>

          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center gap-3 text-xs text-muted-foreground" data-testid="text-trust-pi-protection">
              <Shield className="w-4 h-4 shrink-0 text-[hsl(18,70%,42%)]" />
              <span>Reduces PI exposure with tamper-proof, SRA-aligned records</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground" data-testid="text-trust-encryption">
              <Lock className="w-4 h-4 shrink-0 text-[hsl(18,70%,42%)]" />
              <span>Cryptographic audit trail meets SRA defensibility expectations</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground" data-testid="text-trust-compliance">
              <FileText className="w-4 h-4 shrink-0 text-[hsl(18,70%,42%)]" />
              <span>GDPR-compliant consent-first recording and documentation</span>
            </div>
          </div>

          <div className="space-y-3 pt-4">
            <p className="text-xs text-muted-foreground text-center">
              By signing in, you agree to our{" "}
              <a href="/terms" className="underline" data-testid="link-terms">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" className="underline" data-testid="link-privacy">
                Privacy Policy
              </a>
            </p>
            <div className="flex items-center justify-center gap-2">
              <Badge variant="secondary" className="text-[10px]">SOC 2 Ready</Badge>
              <Badge variant="secondary" className="text-[10px]">UK GDPR</Badge>
              <Badge variant="secondary" className="text-[10px]">ICO Registered</Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
