import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { fetchDatasets, runBacktest, type BacktestParams } from "@/api/backtest";
import type { BacktestResult, BacktestBet, DatasetInfo } from "@/types";
import { CalendarDays, CircleDot, FlaskConical, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const DATASET_LABELS: Record<string, string> = {
  "E0-2223": "PL 2022/23",
  "E0-2324": "PL 2023/24",
  "E0-2425": "PL 2024/25",
  E0: "PL 2025/26",
  E1: "Championship",
  D1: "Bundesliga",
  I1: "Serie A",
  SP1: "La Liga",
  F1: "Ligue 1",
};

// Chronological sort order for dataset keys
function datasetSortKey(key: string): string {
  // E0-2223 → 2223, E0-2324 → 2324, E0 → 9999 (current season last)
  const m = key.match(/(\d{4})$/);
  return m ? m[1] : "9999";
}

const PICK_COLORS: Record<string, string> = {
  home: "bg-primary/15 text-primary",
  draw: "bg-yellow-100 text-yellow-700",
  away: "bg-emerald-100 text-emerald-700",
};

function StatTile({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: "positive" | "negative" | "neutral" }) {
  const valueColor =
    highlight === "positive" ? "text-emerald-600" :
    highlight === "negative" ? "text-red-500" :
    "text-foreground";
  return (
    <div className="dashboard-tile p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono-data text-2xl font-semibold tabular-nums ${valueColor}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function BetRow({ bet, stake }: { bet: BacktestBet; stake: number }) {
  const rowBg = bet.won ? "bg-emerald-50/60" : "bg-red-50/40";
  const pnlColor = bet.pnl >= 0 ? "text-emerald-600 font-semibold" : "text-red-500 font-semibold";
  return (
    <tr className={`border-b border-border/40 text-xs ${rowBg} hover:brightness-[0.97] transition-all`}>
      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{bet.date}</td>
      <td className="px-3 py-2 font-medium whitespace-nowrap">{bet.home_team} <span className="text-muted-foreground font-normal">vs</span> {bet.away_team}</td>
      <td className="px-3 py-2 font-mono tabular-nums text-muted-foreground">{bet.xg_home.toFixed(2)}–{bet.xg_away.toFixed(2)}</td>
      <td className="px-3 py-2">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${PICK_COLORS[bet.pick] ?? ""}`}>{bet.pick}</span>
      </td>
      <td className="px-3 py-2 font-mono tabular-nums">{bet.odds.toFixed(2)}</td>
      <td className="px-3 py-2 font-mono tabular-nums">{bet.ev.toFixed(1)}%</td>
      <td className="px-3 py-2">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${PICK_COLORS[bet.actual] ?? ""}`}>{bet.actual}</span>
      </td>
      <td className={`px-3 py-2 font-mono tabular-nums ${pnlColor}`}>
        {bet.pnl >= 0 ? "+" : ""}{bet.pnl.toFixed(2)}
      </td>
    </tr>
  );
}

export default function BacktestPage() {
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [params, setParams] = useState<BacktestParams>({
    datasets: ["E0"],
    min_edge: 0.05,
    stake: 1.0,
    min_home_matches: 4,
    min_away_matches: 4,
    max_odds: 4.0,
  });
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetchDatasets()
      .then((ds) => {
        const sorted = [...ds].sort((a, b) => datasetSortKey(a.key).localeCompare(datasetSortKey(b.key)));
        setDatasets(sorted);
        // Default: select all available seasons
        setParams((p) => ({ ...p, datasets: sorted.map((d) => d.key) }));
      })
      .catch(() => {});
  }, []);

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await runBacktest(params);
      setResult(res);
      if (res.bets === 0) {
        toast.info("No bets found — try lowering the minimum edge.");
      } else {
        toast.success(`Backtest complete · ${res.bets} bets evaluated`);
      }
    } catch {
      toast.error("Backtest failed — is the backend running?");
    } finally {
      setRunning(false);
    }
  };

  const roiHighlight = result
    ? result.roi >= 0
      ? "positive"
      : "negative"
    : "neutral";

  const profitHighlight = result
    ? result.profit >= 0
      ? "positive"
      : "negative"
    : "neutral";

  return (
    <PageWrapper className="min-h-[calc(100vh-4rem)]">
      <div className="dashboard-shell min-h-[calc(100vh-6rem)] overflow-hidden animate-slide-up">
        {/* Mac chrome bar */}
        <div className="mac-chrome">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="hidden items-end gap-1 sm:flex">
              <Link
                to="/"
                className="rounded-t-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <CircleDot className="h-3.5 w-3.5" />
                  Prediction
                </span>
              </Link>
              <div className="mac-tab">
                <FlaskConical className="mr-2 h-3.5 w-3.5 text-primary" />
                Backtest
              </div>
              <div className="rounded-t-lg px-4 py-2 text-sm font-medium text-muted-foreground">
                Markets
              </div>
            </div>
          </div>
          <div className="hidden rounded-md bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm md:block">
            Rolling-window Poisson
          </div>
        </div>

        {/* Blue header banner */}
        <section className="bg-primary px-4 py-5 text-white sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-white/75">
                <CalendarDays className="h-4 w-4" />
                <span>Historical simulation</span>
              </div>
              <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Backtest Engine
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/78">
                Rolling-window Poisson model against historical odds. No data leakage — each match uses only prior results to build ratings.
              </p>
            </div>
            <div className="rounded-md bg-white/14 px-4 py-3 text-sm ring-1 ring-white/20">
              <span className="text-white/70">Model</span>
              <span className="ml-2 font-semibold text-white">Dixon-Coles Poisson</span>
            </div>
          </div>
        </section>

        <section className="bg-[#f6f7f9] p-3 sm:p-5 lg:p-6 space-y-5">
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <StatTile label="Matches evaluated" value={result ? result.evaluated_matches.toString() : "—"} />
            <StatTile label="Bets placed" value={result ? result.bets.toString() : "—"} />
            <StatTile label="Wins" value={result ? result.wins.toString() : "—"} />
            <StatTile
              label="Hit rate"
              value={result ? `${(result.hit_rate * 100).toFixed(1)}%` : "—"}
              sub={result ? `${result.wins}/${result.bets}` : undefined}
            />
            <StatTile
              label="Profit (units)"
              value={result ? `${result.profit >= 0 ? "+" : ""}${result.profit.toFixed(2)}` : "—"}
              highlight={profitHighlight}
            />
            <StatTile
              label="ROI"
              value={result ? `${(result.roi * 100).toFixed(2)}%` : "—"}
              highlight={roiHighlight}
            />
          </div>

          {/* Config + results */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_1fr]">
            {/* Config panel */}
            <div className="space-y-4">
              <div className="dashboard-tile p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-semibold">Configuration</h2>
                  <FlaskConical className="h-4 w-4 text-primary" />
                </div>

                {/* Seasons */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Seasons</label>
                  {(datasets.length > 0 ? datasets : [{ key: "E0", rows: 339 }]).map((d) => {
                    const checked = params.datasets.includes(d.key);
                    const toggle = () =>
                      setParams((p) => ({
                        ...p,
                        datasets: checked
                          ? p.datasets.filter((k) => k !== d.key)
                          : [...p.datasets, d.key].sort((a, b) =>
                              datasetSortKey(a).localeCompare(datasetSortKey(b))
                            ),
                      }));
                    return (
                      <label key={d.key} className="flex items-center gap-2.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={toggle}
                          className="accent-primary h-3.5 w-3.5 rounded"
                        />
                        <span className="text-sm font-medium group-hover:text-primary transition-colors">
                          {DATASET_LABELS[d.key] ?? d.key}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">{d.rows} matches</span>
                      </label>
                    );
                  })}
                  <p className="text-[10px] text-muted-foreground pt-1">
                    {params.datasets.length} season{params.datasets.length !== 1 ? "s" : ""} selected
                  </p>
                </div>

                {/* Min edge */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Minimum edge</label>
                    <span className="font-mono text-sm font-semibold text-primary">{(params.min_edge * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={20}
                    step={1}
                    value={Math.round(params.min_edge * 100)}
                    onChange={(e) => setParams((p) => ({ ...p, min_edge: parseInt(e.target.value) / 100 }))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0% (all)</span>
                    <span>20% (strict)</span>
                  </div>
                </div>

                {/* Max odds */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Max odds cap</label>
                    <span className="font-mono text-sm font-semibold text-primary">{params.max_odds.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min={1.5}
                    max={10}
                    step={0.5}
                    value={params.max_odds}
                    onChange={(e) => setParams((p) => ({ ...p, max_odds: parseFloat(e.target.value) }))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>1.5 (favorites only)</span>
                    <span>10 (no cap)</span>
                  </div>
                </div>

                {/* Stake */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Stake per bet (units)</label>
                  <input
                    type="number"
                    min={0.1}
                    max={100}
                    step={0.5}
                    value={params.stake}
                    onChange={(e) => setParams((p) => ({ ...p, stake: parseFloat(e.target.value) || 1 }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Min matches */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Min home games</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={params.min_home_matches}
                      onChange={(e) => setParams((p) => ({ ...p, min_home_matches: parseInt(e.target.value) || 4 }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Min away games</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={params.min_away_matches}
                      onChange={(e) => setParams((p) => ({ ...p, min_away_matches: parseInt(e.target.value) || 4 }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={handleRun}
                  disabled={running || params.datasets.length === 0}
                >
                  {running ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running…
                    </>
                  ) : (
                    "Run Backtest"
                  )}
                </Button>
              </div>

              {/* Methodology note */}
              <div className="dashboard-tile p-5 space-y-3">
                <h3 className="font-display text-sm font-semibold">Methodology</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  For each match, ratings are computed from all previously completed matches only — no lookahead. Teams need at least the configured minimum games before ratings are trusted.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  EV = <span className="font-mono">model_prob × odds − 1</span>. A bet is placed on the highest-EV outcome when it clears the minimum edge threshold.
                </p>
              </div>
            </div>

            {/* Results panel */}
            <div className="min-w-0">
              {!result && !running && (
                <div className="dashboard-tile min-h-[420px] p-5 sm:p-6 flex flex-col items-center justify-center gap-4 text-center">
                  <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                    <FlaskConical className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-display text-lg font-semibold text-foreground">No results yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">Configure parameters and press Run Backtest.</p>
                  </div>
                </div>
              )}

              {running && (
                <div className="dashboard-tile min-h-[420px] p-5 sm:p-6 flex flex-col items-center justify-center gap-4 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Processing all matches…</p>
                </div>
              )}

              {result && !running && (
                <div className="space-y-4">
                  {/* ROI summary card */}
                  <div className="dashboard-tile p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-display text-lg font-semibold">Results Summary</h2>
                      {result.roi >= 0 ? (
                        <TrendingUp className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-red-400" />
                      )}
                    </div>
                    <div className="rounded-lg bg-[#111827] p-4 text-white">
                      <div className="flex items-baseline gap-2">
                        <span className={`font-mono text-3xl font-bold ${result.roi >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {result.roi >= 0 ? "+" : ""}{(result.roi * 100).toFixed(2)}%
                        </span>
                        <span className="text-white/50 text-sm">ROI</span>
                      </div>
                      <p className="mt-1 text-sm text-white/60">
                        {result.bets} bets · {result.wins} wins · {(result.hit_rate * 100).toFixed(1)}% strike rate · {result.profit >= 0 ? "+" : ""}{result.profit.toFixed(2)} units profit
                      </p>
                    </div>
                  </div>

                  {/* Bet detail table */}
                  {result.bets_detail.length > 0 && (
                    <div className="dashboard-tile overflow-hidden">
                      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                        <h3 className="font-display text-base font-semibold">Bet Log</h3>
                        <span className="text-xs text-muted-foreground">{result.bets_detail.length} entries</span>
                      </div>
                      <div className="overflow-x-auto">
                        <div className="max-h-[520px] overflow-y-auto">
                          <table className="w-full text-left">
                            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                              <tr className="border-b border-border text-xs text-muted-foreground">
                                <th className="px-3 py-2.5 font-medium">Date</th>
                                <th className="px-3 py-2.5 font-medium">Fixture</th>
                                <th className="px-3 py-2.5 font-medium">xG</th>
                                <th className="px-3 py-2.5 font-medium">Pick</th>
                                <th className="px-3 py-2.5 font-medium">Odds</th>
                                <th className="px-3 py-2.5 font-medium">EV%</th>
                                <th className="px-3 py-2.5 font-medium">Result</th>
                                <th className="px-3 py-2.5 font-medium">P&amp;L</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.bets_detail.map((bet, i) => (
                                <BetRow key={i} bet={bet} stake={params.stake} />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </PageWrapper>
  );
}
