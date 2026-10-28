import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  onFallbackTo2D: () => void;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class Tactical3DErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'WebGL context error occurred in 3D tracking engine.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('Tactical3DErrorBoundary caught an error:', error, errorInfo);
  }

  private handleSwitchBack = () => {
    this.setState({ hasError: false, errorMessage: '' });
    this.props.onFallbackTo2D();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 w-full h-full flex flex-col items-center justify-center bg-[#0F1419] p-6 text-center select-none font-sans">
          <div className="w-12 h-12 rounded-xl bg-[#E5554F]/15 border border-[#E5554F]/40 flex items-center justify-center text-[#E5554F] mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-[#E8ECF1] mb-1">
            3D Tactical Engine Unavailable
          </h3>
          <p className="text-xs text-[#9AA5B4] max-w-md mb-4 leading-relaxed">
            {this.state.errorMessage ||
              'Your browser or graphics environment experienced a WebGL error. Fallback to high-performance 2D tracking is available.'}
          </p>
          <button
            onClick={this.handleSwitchBack}
            className="px-4 py-2 bg-[#4C8DF6] hover:bg-[#3B7DE8] text-white rounded-lg text-xs font-medium flex items-center space-x-2 transition cursor-pointer shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Return to 2D Tactical View</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
