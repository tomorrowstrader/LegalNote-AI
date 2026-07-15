import { Component, type ErrorInfo, type ReactNode } from "react";
import { debugClientLog } from "@/lib/debugClientLog";

interface Props {
  children: ReactNode;
  scope?: string;
}

interface State {
  error: Error | null;
  errorInfo: string | null;
}

/** Captures render crashes that otherwise produce a blank white screen. */
export class CasePageErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const stack = error?.stack || String(error);
    const componentStack = info?.componentStack || "";
    debugClientLog({
      location: `CasePageErrorBoundary:${this.props.scope || "case"}`,
      message: "Case page crash caught",
      hypothesisId: "A",
      data: {
        scope: this.props.scope || "case",
        name: error?.name,
        message: error?.message,
        stack: stack.slice(0, 2000),
        componentStack: componentStack.slice(0, 2000),
      },
    });
    this.setState({ errorInfo: componentStack.slice(0, 2000) });
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="min-h-[50vh] flex items-center justify-center p-8 bg-background text-foreground"
          data-testid="case-page-error-boundary"
        >
          <div className="max-w-xl space-y-3 border border-destructive/40 rounded-md p-4 bg-destructive/5">
            <p className="font-semibold text-sm">Case page error (debug)</p>
            <p className="text-sm text-destructive font-mono break-words" data-testid="case-page-error-message">
              {this.state.error.name}: {this.state.error.message}
            </p>
            {this.state.error.stack && (
              <pre className="text-[10px] whitespace-pre-wrap overflow-auto max-h-48 text-muted-foreground" data-testid="case-page-error-stack">
                {this.state.error.stack.slice(0, 2500)}
              </pre>
            )}
            {this.state.errorInfo && (
              <pre className="text-[10px] whitespace-pre-wrap overflow-auto max-h-40 text-muted-foreground" data-testid="case-page-error-component-stack">
                {this.state.errorInfo}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
