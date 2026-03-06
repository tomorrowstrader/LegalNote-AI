import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, FileText, ArrowRight } from "lucide-react";
import { SiGoogle } from "react-icons/si";
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

  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-6">
            <Logo variant="wordmark" size="lg" animate />
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
            Compliance-first meeting documentation for solicitors and law firms
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-lg font-semibold text-foreground">Sign in to your account</h2>
              <p className="text-xs text-muted-foreground">
                Access your cases, transcripts, and documents securely
              </p>
            </div>

            {authError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2" data-testid="alert-auth-error">
                <p className="text-xs text-destructive">
                  Authentication failed. Please try again or contact support.
                </p>
              </div>
            )}

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

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Shield className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>GDPR-compliant data handling with full audit trail</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Lock className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>End-to-end encrypted sessions with 4-hour timeout</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <FileText className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>SRA-defensible contemporaneous documentation</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            By signing in, you agree to our{" "}
            <a href="/terms" className="underline" data-testid="link-terms">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" className="underline" data-testid="link-privacy">
              Privacy Policy
            </a>
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Badge variant="secondary" className="text-[10px]">SOC 2 Ready</Badge>
            <Badge variant="secondary" className="text-[10px]">UK GDPR</Badge>
            <Badge variant="secondary" className="text-[10px]">ICO Registered</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
