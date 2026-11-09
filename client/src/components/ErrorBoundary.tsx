import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ErrorBoundaryVariant = "app" | "page";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** "app" fills the screen (nothing else is left); "page" sits inside the app shell. */
  variant?: ErrorBoundaryVariant;
  /** When this value changes (e.g. the route), a caught error is cleared. */
  resetKey?: unknown;
  /** In-app navigation to the dashboard. Without it, the button does a full page load of "/". */
  onGoHome?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render errors below it so one broken component shows a calm message
 * instead of a blank page. Never shows the error, stack or any page data to the
 * user; the details go to the browser console only.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[ErrorBoundary] A component failed to render", error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && !Object.is(prevProps.resetKey, this.props.resetKey)) {
      this.setState({ hasError: false });
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    if (this.props.onGoHome) {
      // Clear the error too, in case the user is already on the dashboard and
      // the route (resetKey) does not change.
      this.setState({ hasError: false });
      this.props.onGoHome();
    } else {
      window.location.assign("/");
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isApp = (this.props.variant ?? "page") === "app";

    return (
      <div
        role="alert"
        className={
          isApp
            ? "min-h-screen w-full flex items-center justify-center bg-background px-4"
            : "w-full flex items-center justify-center px-4 py-16"
        }
        data-testid="error-boundary-fallback"
      >
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden="true" />
              <h1 className="text-xl font-semibold text-foreground" data-testid="text-error-boundary-title">
                Something went wrong on this page
              </h1>
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-error-boundary-body">
              This part of LegalNote stopped working. Anything you have already saved is not affected.
              Reload the page to try again, or go back to your dashboard.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={this.handleReload} data-testid="button-error-boundary-reload">
                Reload
              </Button>
              <Button variant="outline" onClick={this.handleGoHome} data-testid="button-error-boundary-home">
                Back to dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}

/**
 * Boundary for the main page content: clears itself when the route changes and
 * goes to the dashboard without a full reload, so the app shell (and any live
 * recording held above it) keeps running.
 */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  return (
    <ErrorBoundary variant="page" resetKey={location} onGoHome={() => setLocation("/")}>
      {children}
    </ErrorBoundary>
  );
}
