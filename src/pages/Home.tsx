import { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { OddsInputPanel } from "@/components/prediction/OddsInputPanel";
import { ResultsPanel } from "@/components/prediction/ResultsPanel";
import { ResultsSkeleton } from "@/components/prediction/ResultsSkeleton";
import { usePrediction } from "@/hooks/usePrediction";
import { useIsMobile } from "@/hooks/use-mobile";
import { oddsSchema, type OddsFormData } from "@/utils/validation";
import { pushPrediction, getHistory, clearHistory, type HistoryEntry } from "@/utils/predictionHistory";
import { fetchFixtures, fetchWCFixtures, type Fixture } from "@/api/fixtures";
import {
  Activity,
  CalendarDays,
  CircleDot,
  TrendingUp,
  Clock,
  Trash2,
} from "lucide-react";

const OUTCOME_COLORS: Record<string, string> = {
  home: "bg-primary/15 text-primary",
  draw: "bg-yellow-100 text-yellow-700",
  away: "bg-emerald-100 text-emerald-700",
};

function formatRelativeDate(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatFixtureDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

export default function Home() {
  const { result, isLoading, isLocal, predict, clear } = usePrediction();
  const [lastInput, setLastInput] = useState<OddsFormData | null>(null);
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const resultsRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => getHistory());
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [wcFixtures, setWcFixtures] = useState<Fixture[]>([]);
  const [fixtureTab, setFixtureTab] = useState<"epl" | "wc">("epl");
  const [prefill, setPrefill] = useState<{ homeTeam: string; awayTeam: string } | null>(null);

  // Load from shared URL params
  useEffect(() => {
    const h = searchParams.get("h");
    const d = searchParams.get("d");
    const a = searchParams.get("a");
    if (h && d && a) {
      const parsed = oddsSchema.safeParse({
        home_odds: parseFloat(h),
        draw_odds: parseFloat(d),
        away_odds: parseFloat(a),
        simulations: parseInt(searchParams.get("s") || "1000"),
        home_team: searchParams.get("ht") || "",
        away_team: searchParams.get("at") || "",
      });
      if (!parsed.success) return;
      const data = parsed.data;
      setLastInput(data);
      predict(data);
    }
  }, []);

  useEffect(() => {
    if (result && isMobile && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result, isMobile]);

  // Auto-save completed predictions
  useEffect(() => {
    if (!result || !lastInput) return;
    pushPrediction({
      homeTeam: lastInput.home_team,
      awayTeam: lastInput.away_team,
      homeOdds: lastInput.home_odds,
      drawOdds: lastInput.draw_odds,
      awayOdds: lastInput.away_odds,
      simulations: lastInput.simulations,
      recommendation: result.recommended_outcome ?? null,
      homeProb: result.home_probability,
      drawProb: result.draw_probability,
      awayProb: result.away_probability,
    });
    setHistory(getHistory());
  }, [result]);

  // Fetch upcoming fixtures on mount
  useEffect(() => {
    fetchFixtures().then(setFixtures);
    fetchWCFixtures().then(setWcFixtures);
  }, []);

  const handleSubmit = (data: OddsFormData) => {
    setLastInput(data);
    predict(data);
  };

  const handleClear = () => {
    setLastInput(null);
    clear();
  };

  const handleClearHistory = () => {
    clearHistory();
    setHistory([]);
  };

  const handleFixtureSelect = (fixture: Fixture) => {
    setPrefill({ homeTeam: fixture.home_team, awayTeam: fixture.away_team });
  };

  const stats = result
    ? [
        { label: "Home", value: `${result.home_probability}%`, dot: "bg-primary" },
        { label: "Draw", value: `${result.draw_probability}%`, dot: "bg-warning" },
        { label: "Away", value: `${result.away_probability}%`, dot: "bg-secondary" },
        { label: "Market margin", value: `${result.overround.toFixed(2)}%`, dot: "bg-muted-foreground" },
      ]
    : [
        { label: "Home", value: "--", dot: "bg-primary" },
        { label: "Draw", value: "--", dot: "bg-warning" },
        { label: "Away", value: "--", dot: "bg-secondary" },
        { label: "Market margin", value: "--", dot: "bg-muted-foreground" },
      ];

  return (
    <PageWrapper className="min-h-[calc(100vh-4rem)]">
      <div className="dashboard-shell min-h-[calc(100vh-6rem)] overflow-hidden animate-slide-up">
        <div className="mac-chrome">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="hidden items-end gap-1 sm:flex">
              <div className="mac-tab">
                <CircleDot className="mr-2 h-3.5 w-3.5 text-primary" />
                Prediction
              </div>
              <Link
                to="/backtest"
                className="rounded-t-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Backtest
              </Link>
              <Link to="/parlay" className="rounded-t-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Parlay
              </Link>
            </div>
          </div>
          <div className="hidden rounded-md bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm md:block">
            Backend model online
          </div>
        </div>

        <section className="bg-primary px-4 py-5 text-white sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-white/75">
                <CalendarDays className="h-4 w-4" />
                <span>Prediction desk</span>
              </div>
              <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Match Intelligence
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/78">
                Enter the fixture odds, compare outcome probability, and only treat positive expected value as a signal.
              </p>
            </div>
            <div className="rounded-md bg-white/14 px-4 py-3 text-sm ring-1 ring-white/20">
              <span className="text-white/70">Mode</span>
              <span className="ml-2 font-semibold text-white">{isLocal ? "Local fallback" : "Backend model"}</span>
            </div>
          </div>
        </section>

        <section className="bg-[#f6f7f9] p-3 sm:p-5 lg:p-6">
          <div className="min-w-0">
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="dashboard-tile min-w-0 p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={`h-2 w-2 rounded-full ${stat.dot}`} />
                    <span>{stat.label}</span>
                  </div>
                  <p className="mt-2 truncate font-mono-data text-[clamp(1.55rem,3vw,2.25rem)] font-semibold text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(340px,440px)_1fr]">
              <div className="space-y-5 min-w-0">
                <OddsInputPanel onSubmit={handleSubmit} isLoading={isLoading} onClear={handleClear} prefill={prefill} />

                <div className="dashboard-tile p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-lg font-semibold">Betting Rule</h2>
                    <Activity className="h-4 w-4 text-primary" />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    A likely winner is not automatically a bet. The signal matters only when model probability beats the market price by enough to create positive expected value.
                  </p>
                </div>

                {/* Prediction history */}
                {history.length > 0 && (
                  <div className="dashboard-tile p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="text-sm font-semibold">Recent</h3>
                      </div>
                      <button
                        onClick={handleClearHistory}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Clear history"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {history.slice(0, 5).map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs">
                          <span className="font-medium truncate min-w-0">
                            {entry.homeTeam || "Home"} <span className="text-muted-foreground font-normal">vs</span> {entry.awayTeam || "Away"}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            {entry.recommendation && (
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${OUTCOME_COLORS[entry.recommendation] ?? ""}`}>
                                {entry.recommendation}
                              </span>
                            )}
                            <span className="text-muted-foreground">{formatRelativeDate(entry.timestamp)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="min-w-0" ref={resultsRef}>
                {isLoading && <ResultsSkeleton />}

                {result && lastInput && !isLoading ? (
                  <ResultsPanel
                    result={result}
                    homeOdds={lastInput.home_odds}
                    drawOdds={lastInput.draw_odds}
                    awayOdds={lastInput.away_odds}
                    homeTeam={lastInput.home_team}
                    awayTeam={lastInput.away_team}
                    isLocal={isLocal}
                  />
                ) : (
                  <div className="space-y-4">
                    {(fixtures.length > 0 || wcFixtures.length > 0) && (
                      <div className="dashboard-tile p-5">
                        <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setFixtureTab("epl")}
                              className={`text-sm font-semibold px-2 py-0.5 rounded transition-colors ${fixtureTab === "epl" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}
                            >
                              Premier League
                            </button>
                            {wcFixtures.length > 0 && (
                              <button
                                onClick={() => setFixtureTab("wc")}
                                className={`text-sm font-semibold px-2 py-0.5 rounded transition-colors ${fixtureTab === "wc" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}
                              >
                                🌍 World Cup 2026
                              </button>
                            )}
                          </div>
                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">Click a fixture to fill team names</p>
                        <div className="space-y-2">
                          {(fixtureTab === "wc" ? wcFixtures : fixtures).map((f) => (
                            <button
                              key={f.id}
                              onClick={() => handleFixtureSelect(f)}
                              className="w-full flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2.5 text-sm hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{formatFixtureDate(f.date)}</span>
                                <span className="font-medium truncate">{f.home_team}</span>
                                <span className="text-muted-foreground shrink-0">vs</span>
                                <span className="font-medium truncate">{f.away_team}</span>
                              </div>
                              <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">Predict →</span>
                            </button>
                          ))}
                          {(fixtureTab === "wc" ? wcFixtures : fixtures).length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-4">No upcoming fixtures</p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="dashboard-tile min-h-[300px] p-5 sm:p-6">
                      <div className="flex items-center justify-between border-b border-border pb-4">
                        <div>
                          <h2 className="font-display text-xl font-semibold">Prediction Output</h2>
                          <p className="mt-1 text-sm text-muted-foreground">Awaiting fixture analysis.</p>
                        </div>
                        <TrendingUp className="h-5 w-5 text-primary" />
                      </div>
                      <div className="mt-6 grid gap-4 md:grid-cols-3">
                        {["Home win", "Draw", "Away win"].map((label) => (
                          <div key={label} className="rounded-lg border border-dashed border-border bg-muted/40 p-5">
                            <p className="text-sm text-muted-foreground">{label}</p>
                            <div className="mt-4 h-3 rounded-full bg-white" />
                            <div className="mt-3 h-8 w-24 rounded-md bg-white" />
                          </div>
                        ))}
                      </div>
                      <div className="mt-6 rounded-lg bg-[#111827] p-5 text-white">
                        <p className="text-sm font-medium">Risk discipline</p>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
                          The strongest prediction is not automatically a bet. We only care when model probability creates positive expected value against the offered odds.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageWrapper>
  );
}
