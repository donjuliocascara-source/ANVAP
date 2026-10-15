import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  viewName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ViewErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-slate-900 rounded-2xl border border-rose-800 text-slate-100 max-w-2xl mx-auto my-8 shadow-2xl">
          <div className="flex items-center gap-3 text-rose-400 mb-3">
            <AlertTriangle className="w-8 h-8 flex-shrink-0" />
            <div>
              <h3 className="text-base font-bold">Ocurrió un error al cargar {this.props.viewName || "la vista"}</h3>
              <p className="text-xs text-slate-400">Los datos de la vista fueron restablecidos para evitar bloquear la interfaz.</p>
            </div>
          </div>
          {this.state.error && (
            <div className="bg-slate-950 p-3 rounded-lg font-mono text-xs text-rose-300 mb-4 overflow-x-auto border border-rose-950">
              {this.state.error.message}
            </div>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Reintentar Carga
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
