import { Component, lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Header } from "@/components/layout/Header";
import { Skeleton } from "@/components/ui/skeleton";
import Home from "./pages/Home";

// Secondary pages are lazy — Home loads eagerly since it's the entry point
const AboutPage = lazy(() => import("./pages/About"));
const BacktestPage = lazy(() => import("./pages/Backtest"));
const ParlayPage = lazy(() => import("./pages/Parlay"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function PageFallback() {
  return (
    <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  { crashed: boolean; message: string; stack: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { crashed: false, message: "", stack: "" };
  }

  static getDerivedStateFromError(error: unknown) {
    return { crashed: true, message: String(error) };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    this.setState({ stack: info.componentStack ?? "" });
  }

  render() {
    if (this.state.crashed) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="font-display text-xl font-semibold text-foreground">Something went wrong</p>
          <pre className="max-w-2xl w-full overflow-auto rounded bg-muted px-3 py-2 font-mono text-xs text-left text-destructive whitespace-pre-wrap break-all">
            {this.state.message}{"\n\n"}{this.state.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-background">
          <Header />
          <main className="flex-1">
            <ErrorBoundary>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/backtest" element={<BacktestPage />} />
                  <Route path="/parlay" element={<ParlayPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
