import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./ui";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled render error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="m-4 rounded-lg border border-rose-200 bg-rose-50/60 p-6 text-slate-800 shadow-xs">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-rose-900 text-sm">
                {this.props.fallbackTitle || "An unexpected view rendering error occurred"}
              </h3>
              <p className="text-xs text-rose-700">
                {this.props.fallbackMessage || "The component encountered an error during update. Workspace data remains safe."}
              </p>
            </div>
          </div>
          {this.state.error?.message && (
            <div className="mb-4 rounded bg-white p-3 font-mono text-xs text-rose-900 border border-rose-200 overflow-x-auto">
              {this.state.error.message}
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={this.handleReset} className="gap-1.5 border-rose-300 text-rose-800 hover:bg-rose-100">
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
