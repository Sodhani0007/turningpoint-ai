import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
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
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="p-4 sm:p-6 rounded-2xl bg-slate-900 border border-rose-500/30 text-slate-200 shadow-xl m-4"
          data-testid="error-boundary-fallback"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mt-0.5 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white mb-1">
                {this.props.fallbackTitle || 'Component Rendering Error'}
              </h3>
              <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                An unexpected display error occurred. The application remains running safely.
              </p>
              {this.state.error?.message && (
                <div className="text-[11px] font-mono bg-slate-950/80 text-rose-300 p-2 rounded-lg border border-slate-800 mb-3 break-all">
                  {this.state.error.message}
                </div>
              )}
              <button
                type="button"
                onClick={this.handleReset}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Dismiss & Retry
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

