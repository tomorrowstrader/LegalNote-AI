import { Component, type ErrorInfo, type ReactNode } from "react";

function debugLog(location: string, message: string, data: Record<string, unknown>, hypothesisId: string) {
  // #region agent log
  fetch('http://127.0.0.1:7671/ingest/dfbc9758-293a-480b-a080-cbd261ef30c7',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'95f25d'},body:JSON.stringify({sessionId:'95f25d',location,message,data,timestamp:Date.now(),hypothesisId,runId:'white-screen'})}).catch(()=>{});
  // #endregion
}

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  errorInfo: string | null;
}

/** Captures case-page render crashes that otherwise produce a blank white screen. */
export class CasePageErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, errorInfo: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const stack = error?.stack || String(error);
    const componentStack = info?.componentStack || "";
    debugLog(
      "CasePageErrorBoundary.tsx:componentDidCatch",
      "Case page crashed",
      {
        name: error?.name,
        message: error?.message,
        stack: stack.slice(0, 1500),
        componentStack: componentStack.slice(0, 1500),
      },
      "A",
    );
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
