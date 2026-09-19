import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from './ui/Button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled UI error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleHardReset = () => {
    try {
      localStorage.removeItem('wlo_dataset');
      localStorage.removeItem('wlo_prefs');
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-[#0a0a0f] text-center select-text">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4 shadow-lg shadow-red-500/5">
            <AlertTriangle size={28} />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">
            {this.props.fallbackTitle || 'Interface Error Encountered'}
          </h2>
          <p className="text-xs text-[#8080a0] max-w-lg mb-4 font-mono leading-relaxed bg-[#111118] p-3 rounded-lg border border-[#1e1e2e] text-left overflow-x-auto">
            {this.state.error?.message || 'An unexpected error occurred while rendering the application.'}
          </p>
          <div className="flex items-center gap-3">
            <Button variant="primary" size="sm" onClick={this.handleReset}>
              <RefreshCw size={13} /> Try Recovering
            </Button>
            <Button variant="outline" size="sm" onClick={this.handleHardReset}>
              <RotateCcw size={13} /> Reset Dataset Cache & Reload
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
