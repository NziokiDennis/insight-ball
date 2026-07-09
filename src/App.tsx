import { Component, lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Header } from "@/components/layout/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { CircleDot, BarChart2, Layers, Clock } from "lucide-react";
import Home from "./pages/Home";

// Secondary pages are lazy — Home loads eagerly since it's the entry point
const AboutPage = lazy(() => import("./pages/About"));
const BacktestPage = lazy(() => import("./pages/Backtest"));
const ParlayPage = lazy(() => import("./pages/Parlay"));
const HistoryPage = lazy(() => import("./pages/History"));
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

class ErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { crashed: false };
  }

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  render() {
    if (this.state.crashed) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="font-display text-xl font-semibold text-foreground">Something went wrong</p>
          <p className="text-sm text-muted-foreground">Please reload the page.</p>
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

const NAV_ITEMS = [
  { to: "/", label: "Predict", icon: CircleDot, end: true },
  { to: "/backtest", label: "Backtest", icon: BarChart2, end: false },
  { to: "/parlay", label: "Parlay", icon: Layers, end: false },
  { to: "/history", label: "History", icon: Clock, end: false },
];

function MobileNav() {
  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white/95 backdrop-blur-sm">
      <div className="flex items-stretch">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                <span>{label}</span>
                {isActive && <span className="absolute bottom-0 h-0.5 w-10 rounded-full bg-primary" />}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-background pb-[60px] sm:pb-0">
          <Header />
          <main className="flex-1">
            <ErrorBoundary>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/backtest" element={<BacktestPage />} />
                  <Route path="/parlay" element={<ParlayPage />} />
                  <Route path="/history" element={<HistoryPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </main>
          <MobileNav />
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
