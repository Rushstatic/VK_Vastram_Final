import React from 'react';

interface AppErrorBoundaryState {
  hasError: boolean;
}

/** Prevents a render-time React exception from leaving the storefront as a blank page. */
export class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Keep diagnostic details in the browser console; never display them to customers.
    console.error('[VK VASTRAM] UI rendering error', error, info.componentStack);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-[#FAF8F5] text-[#1C1917] flex items-center justify-center p-6">
          <section className="max-w-md text-center space-y-4">
            <h1 className="font-serif text-2xl">This page encountered a problem</h1>
            <p className="text-sm text-[#57534E]">Your cart and account have not been intentionally changed. Reload the page to try again.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center px-5 py-3 bg-[#1C1917] text-[#FAF8F5] text-sm"
            >
              Reload page
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
