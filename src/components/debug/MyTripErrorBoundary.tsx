"use client";

import { Component, type ReactNode } from "react";

import { tripDebug } from "@/lib/debug/trip-debug";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class MyTripErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    tripDebug("my-trip.error", {
      message: error.message,
      stack: info.componentStack?.slice(0, 400),
    });
  }

  render() {
    if (this.state.error) {
      return (
        <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-2">
          <header className="shrink-0">
            <h2 className="text-lg font-semibold tracking-tight text-red-900">
              My Trip crashed
            </h2>
          </header>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-medium text-red-900">{this.state.error.message}</p>
            <p className="mt-2 text-xs text-red-800">
              Add <span className="font-mono">?debug=1</span> to the URL and check the
              console for [TripConnect] logs.
            </p>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm"
            >
              Try again
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
