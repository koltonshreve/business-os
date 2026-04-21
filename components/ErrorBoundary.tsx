import React from 'react';

interface Props {
  label?: string;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary: ${this.props.label ?? 'unknown'}]`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-8 text-center">
          <div className="text-[28px] mb-3">⚠️</div>
          <div className="text-[13px] font-semibold text-red-400 mb-1">
            {this.props.label ? `${this.props.label} failed to render` : 'Something went wrong'}
          </div>
          <div className="text-[11px] text-slate-500 mb-4 font-mono max-w-sm mx-auto truncate">
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-1.5 text-[12px] font-semibold text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
