import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { postPredict } from "@/api/predict";
import { fetchFixtures, fetchWCFixtures, fetchCLFixtures, type Fixture } from "@/api/fixtures";
import { savePrediction } from "@/api/predictions";
import { CalendarDays, CircleDot, FlaskConical, Plus, X, Layers, Loader2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SlipMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeOdds: string;
  drawOdds: string;
  awayOdds: string;
}

interface AnalysedMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  homeProb: number;
  drawProb: number;
  awayProb: number;
  _raw: import("@/types").PredictionResponse | null;
}

interface Combination {
  outcomes: { label: string; result: "home" | "draw" | "away" }[];
  probability: number;
  combinedOdds: number;
  ev: number;
}

type SortKey = "probability" | "odds" | "ev";

const MAX_MATCHES = 10;
const PAGE_SIZE = 50;

const RESULT_COLORS: Record<string, string> = {
  home: "bg-primary/15 text-primary",
  draw: "bg-yellow-100 text-yellow-700",
  away: "bg-emerald-100 text-emerald-700",
};

const RESULT_TEXT_COLORS: Record<string, string> = {
  home: "text-primary font-semibold",
  draw: "text-yellow-600 font-semibold",
  away: "text-emerald-600 font-semibold",
};

function newMatch(): SlipMatch {
  return {
    id: Math.random().toString(36).slice(2),
    homeTeam: "",
    awayTeam: "",
    homeOdds: "",
    drawOdds: "",
    awayOdds: "",
  };
}

function devig(h: number, d: number, a: number) {
  const s = 1 / h + 1 / d + 1 / a;
  return { home: (1 / h / s) * 100, draw: (1 / d / s) * 100, away: (1 / a / s) * 100 };
}

function buildCombinations(matches: AnalysedMatch[]): Combination[] {
  if (!matches.length) return [];
  const total = Math.pow(3, matches.length);
  const out: Combination[] = [];

  for (let i = 0; i < total; i++) {
    let prob = 1;
    let odds = 1;
    const outcomes: Combination["outcomes"] = [];
    let tmp = i;

    for (let j = 0; j < matches.length; j++) {
      const idx = tmp % 3;
      tmp = Math.floor(tmp / 3);
      const m = matches[j];
      const slot = [
        { label: m.homeTeam || "Home", result: "home" as const, p: m.homeProb / 100, o: m.homeOdds },
        { label: "Draw", result: "draw" as const, p: m.drawProb / 100, o: m.drawOdds },
        { label: m.awayTeam || "Away", result: "away" as const, p: m.awayProb / 100, o: m.awayOdds },
      ][idx];
      prob *= slot.p;
      odds *= slot.o;
      outcomes.push({ label: slot.label, result: slot.result });
    }

    out.push({ outcomes, probability: prob * 100, combinedOdds: odds, ev: (prob * odds - 1) * 100 });
  }

  return out.sort((a, b) => b.probability - a.probability);
}

export default function ParlayPage() {
  const [matches, setMatches] = useState<SlipMatch[]>([newMatch(), newMatch()]);
  const [analysed, setAnalysed] = useState<AnalysedMatch[]>([]);
  const [combinations, setCombinations] = useState<Combination[]>([]);
  const [analysing, setAnalysing] = useState(false);
  const [showValueOnly, setShowValueOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("probability");
  const [showAll, setShowAll] = useState(false);
  const [eplFixtures, setEplFixtures] = useState<Fixture[]>([]);
  const [wcFixtures, setWcFixtures] = useState<Fixture[]>([]);
  const [clFixtures, setClFixtures] = useState<Fixture[]>([]);
  const [fixtureTab, setFixtureTab] = useState<"epl" | "wc" | "cl">("epl");

  useEffect(() => {
    fetchFixtures().then(setEplFixtures);
    fetchWCFixtures().then(f => { setWcFixtures(f); if (f.length > 0) setFixtureTab("wc"); });
    fetchCLFixtures().then(f => { setClFixtures(f); if (f.length > 0) setFixtureTab("cl"); });
  }, []);

  const addFromFixture = (f: Fixture) => {
    if (matches.length >= MAX_MATCHES) { toast.error(`Maximum ${MAX_MATCHES} matches`); return; }
    setMatches(m => [...m, { ...newMatch(), homeTeam: f.home_team, awayTeam: f.away_team }]);
    toast.success(`${f.home_team} vs ${f.away_team} added`);
  };

  const addMatch = () => {
    if (matches.length < MAX_MATCHES) setMatches((m) => [...m, newMatch()]);
  };

  const removeMatch = (id: string) => {
    if (matches.length > 1) setMatches((m) => m.filter((x) => x.id !== id));
  };

  const update = (id: string, field: keyof SlipMatch, value: string) =>
    setMatches((m) => m.map((x) => (x.id === id ? { ...x, [field]: value } : x)));

  const handleAnalyse = async () => {
    const valid = matches.filter((m) => {
      const h = parseFloat(m.homeOdds), d = parseFloat(m.drawOdds), a = parseFloat(m.awayOdds);
      return h > 1 && d > 1 && a > 1;
    });
    if (!valid.length) { toast.error("Enter odds for at least one match"); return; }

    setAnalysing(true);
    setAnalysed([]);
    setCombinations([]);
    setShowAll(false);

    try {
      const results = await Promise.all(
        valid.map(async (m): Promise<AnalysedMatch> => {
          const h = parseFloat(m.homeOdds);
          const d = parseFloat(m.drawOdds);
          const a = parseFloat(m.awayOdds);
          try {
            const r = await postPredict({
              home_odds: h, draw_odds: d, away_odds: a,
              home_team: m.homeTeam.trim(), away_team: m.awayTeam.trim(),
              simulations: 500,
            });
            return { id: m.id, homeTeam: m.homeTeam.trim(), awayTeam: m.awayTeam.trim(), homeOdds: h, drawOdds: d, awayOdds: a, homeProb: r.home_probability, drawProb: r.draw_probability, awayProb: r.away_probability, _raw: r };
          } catch {
            const dv = devig(h, d, a);
            return { id: m.id, homeTeam: m.homeTeam.trim(), awayTeam: m.awayTeam.trim(), homeOdds: h, drawOdds: d, awayOdds: a, homeProb: dv.home, drawProb: dv.draw, awayProb: dv.away, _raw: null };
          }
        })
      );
      setAnalysed(results);
      const combos = buildCombinations(results);
      setCombinations(combos);
      const valueCount = combos.filter((c) => c.ev > 0).length;
      toast.success(`${combos.length} combinations · ${valueCount} with positive EV`);

      // Save to History — only matches where the real model responded (_raw present)
      const toSave = results.filter(r => r._raw !== null);
      if (toSave.length > 0) {
        Promise.all(
          toSave.map(r =>
            savePrediction({
              home_team: r.homeTeam, away_team: r.awayTeam,
              home_odds: r.homeOdds, draw_odds: r.drawOdds, away_odds: r.awayOdds,
              simulations: 500,
              home_prob: r.homeProb, draw_prob: r.drawProb, away_prob: r.awayProb,
              recommended_outcome: r._raw?.recommended_outcome ?? null,
              model_notes: r._raw?.model_notes ?? [],
              league: "parlay",
            })
          )
        ).then(outcomes => {
          const saved = outcomes.filter(Boolean).length;
          if (saved > 0) toast.info(`${saved} prediction${saved > 1 ? "s" : ""} saved to History`);
          else toast.error("Could not save to History — check connection");
        });
      }
    } finally {
      setAnalysing(false);
    }
  };

  const sorted = [...combinations].sort((a, b) => {
    if (sortBy === "odds") return b.combinedOdds - a.combinedOdds;
    if (sortBy === "ev") return b.ev - a.ev;
    return b.probability - a.probability;
  });
  const filtered = showValueOnly ? sorted.filter((c) => c.ev > 0) : sorted;
  const displayed = showAll ? filtered : filtered.slice(0, PAGE_SIZE);
  const valueCount = combinations.filter((c) => c.ev > 0).length;

  return (
    <PageWrapper className="min-h-[calc(100vh-4rem)]">
      <div className="dashboard-shell min-h-[calc(100vh-6rem)] overflow-hidden animate-slide-up">
        {/* Mac chrome */}
        <div className="mac-chrome">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="hidden items-end gap-1 sm:flex">
              <Link to="/" className="rounded-t-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
                <CircleDot className="h-3.5 w-3.5" />Prediction
              </Link>
              <Link to="/backtest" className="rounded-t-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
                <FlaskConical className="h-3.5 w-3.5" />Backtest
              </Link>
              <div className="mac-tab">
                <Layers className="mr-2 h-3.5 w-3.5 text-primary" />Parlay
              </div>
              <Link to="/history" className="rounded-t-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                History
              </Link>
            </div>
          </div>
          <div className="hidden rounded-md bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm md:block">
            {combinations.length > 0 ? `${combinations.length} combinations` : "Accumulator builder"}
          </div>
        </div>

        {/* Banner */}
        <section className="bg-primary px-4 py-5 text-white sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-white/75">
                <CalendarDays className="h-4 w-4" /><span>Accumulator analysis</span>
              </div>
              <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Parlay Builder</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/78">
                Add matches, enter odds, and see every possible outcome combination — probability, combined odds, and expected value.
              </p>
            </div>
            {combinations.length > 0 && (
              <div className="rounded-md bg-white/14 px-4 py-3 text-sm ring-1 ring-white/20">
                <span className="text-white/70">Value combos</span>
                <span className="ml-2 font-semibold text-white">{valueCount} / {combinations.length}</span>
              </div>
            )}
          </div>
        </section>

        <section className="bg-[#f6f7f9] p-3 sm:p-5 lg:p-6">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_1fr]">

            {/* LEFT — Slip builder */}
            <div className="space-y-4">
              <div className="dashboard-tile p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-semibold">Slip Builder</h2>
                  <span className="text-xs text-muted-foreground">{matches.length} / {MAX_MATCHES}</span>
                </div>

                <div className="space-y-3">
                  {matches.map((m, idx) => (
                    <div key={m.id} className="rounded-lg border border-border bg-background p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Match {idx + 1}</span>
                        {matches.length > 1 && (
                          <button onClick={() => removeMatch(m.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input placeholder="Home team" value={m.homeTeam} onChange={(e) => update(m.id, "homeTeam", e.target.value)}
                          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50" />
                        <input placeholder="Away team" value={m.awayTeam} onChange={(e) => update(m.id, "awayTeam", e.target.value)}
                          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50" />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {(["homeOdds", "drawOdds", "awayOdds"] as const).map((field, fi) => (
                          <div key={field} className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">
                              {["H", "D", "A"][fi]}
                            </span>
                            <input type="text" inputMode="decimal" placeholder="1.50" value={m[field]}
                              onChange={(e) => { const v = e.target.value; if (!v || /^[0-9]*\.?[0-9]*$/.test(v)) update(m.id, field, v); }}
                              className="w-full rounded-md border border-input bg-[#fbfbfc] pl-5 pr-1.5 py-1.5 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-ring" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {matches.length < MAX_MATCHES && (
                  <button onClick={addMatch}
                    className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-2.5 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-all">
                    <Plus className="h-4 w-4" />Add Match
                  </button>
                )}

                <Button className="w-full h-11" onClick={handleAnalyse} disabled={analysing}>
                  {analysing
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analysing…</>
                    : <><Layers className="mr-2 h-4 w-4" />Analyse Outcomes</>}
                </Button>
              </div>
            </div>

            {/* RIGHT — Results */}
            <div className="min-w-0 space-y-4">
              {!analysed.length && !analysing && (
                <div className="dashboard-tile min-h-[420px] flex flex-col items-center justify-center gap-4 text-center p-8">
                  <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                    <Layers className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-display text-lg font-semibold">No combinations yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">Add your matches and press Analyse Outcomes.</p>
                  </div>
                  <div className="mt-2 rounded-lg bg-[#111827] p-5 text-left text-white max-w-sm w-full">
                    <p className="text-sm font-medium">Example: 3 matches</p>
                    <p className="mt-2 text-xs leading-6 text-white/60">
                      Arsenal vs Chelsea · Liverpool vs City · Spurs vs United<br />
                      → 27 combinations, sorted by probability
                    </p>
                  </div>
                </div>
              )}

              {analysing && (
                <div className="dashboard-tile min-h-[420px] flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Fetching model probabilities for {matches.filter(m => parseFloat(m.homeOdds) > 1).length} matches…</p>
                </div>
              )}

              {analysed.length > 0 && !analysing && (
                <>
                  {/* Per-match summary */}
                  <div className="dashboard-tile p-5 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Match Probabilities</p>
                    {analysed.map((m) => {
                      const best = Math.max(m.homeProb, m.drawProb, m.awayProb);
                      return (
                        <div key={m.id} className="flex items-center gap-3 flex-wrap text-sm">
                          <span className="w-44 shrink-0 truncate font-medium">
                            {m.homeTeam || "Home"} <span className="text-muted-foreground font-normal">vs</span> {m.awayTeam || "Away"}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {[
                              { label: m.homeTeam || "H", prob: m.homeProb, result: "home" },
                              { label: "Draw", prob: m.drawProb, result: "draw" },
                              { label: m.awayTeam || "A", prob: m.awayProb, result: "away" },
                            ].map(({ label, prob, result }) => (
                              <span key={result}
                                className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${RESULT_COLORS[result]} ${prob === best ? "font-bold ring-1 ring-current/30" : "opacity-60"}`}>
                                <span className="truncate max-w-[56px]">{label}</span>
                                <span className="font-mono">{prob.toFixed(1)}%</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Combinations table */}
                  <div className="dashboard-tile overflow-hidden">
                    <div className="px-5 py-4 border-b border-border flex flex-wrap items-center gap-3 justify-between">
                      <div>
                        <h3 className="font-display text-base font-semibold">All Combinations</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {combinations.length} total · {valueCount} positive EV
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}
                          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring">
                          <option value="probability">Sort: Probability</option>
                          <option value="odds">Sort: Odds</option>
                          <option value="ev">Sort: EV</option>
                        </select>
                        <button onClick={() => setShowValueOnly((v) => !v)}
                          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${showValueOnly ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}>
                          <Filter className="h-3 w-3" />Value only
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <div className="max-h-[560px] overflow-y-auto">
                        <table className="w-full text-left">
                          <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
                            <tr className="border-b border-border text-xs text-muted-foreground">
                              {analysed.map((m, i) => (
                                <th key={m.id} className="px-3 py-2.5 font-medium whitespace-nowrap">
                                  {m.homeTeam && m.awayTeam
                                    ? `${m.homeTeam} vs ${m.awayTeam}`
                                    : `Match ${i + 1}`}
                                </th>
                              ))}
                              <th className="px-3 py-2.5 font-medium">Prob</th>
                              <th className="px-3 py-2.5 font-medium">Odds</th>
                              <th className="px-3 py-2.5 font-medium">EV</th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayed.map((combo, i) => (
                              <tr key={i} className={`border-b border-border/40 text-xs transition-all hover:brightness-[0.97] ${combo.ev > 0 ? "bg-emerald-50/60" : ""}`}>
                                {combo.outcomes.map((o, j) => (
                                  <td key={j} className="px-3 py-2 whitespace-nowrap">
                                    <span className={`text-xs ${RESULT_TEXT_COLORS[o.result]}`}>
                                      {o.result === "draw" ? "Draw" : `${o.label} WIN`}
                                    </span>
                                  </td>
                                ))}
                                <td className="px-3 py-2 font-mono tabular-nums">{combo.probability.toFixed(2)}%</td>
                                <td className="px-3 py-2 font-mono tabular-nums font-semibold">@{combo.combinedOdds.toFixed(2)}</td>
                                <td className={`px-3 py-2 font-mono tabular-nums font-semibold ${combo.ev > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                                  {combo.ev > 0 ? "+" : ""}{combo.ev.toFixed(1)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {filtered.length > PAGE_SIZE && !showAll && (
                      <div className="px-5 py-3 border-t border-border text-center">
                        <button onClick={() => setShowAll(true)} className="text-xs text-primary hover:underline">
                          Show all {filtered.length} combinations
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Fixtures quick-fill */}
            {(eplFixtures.length > 0 || wcFixtures.length > 0 || clFixtures.length > 0) && (
              <div className="dashboard-tile p-4 space-y-3 xl:col-start-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setFixtureTab("epl")}
                      className={`text-xs font-semibold px-2 py-0.5 rounded transition-colors ${fixtureTab === "epl" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}>
                      Premier League
                    </button>
                    {wcFixtures.length > 0 && (
                      <button onClick={() => setFixtureTab("wc")}
                        className={`text-xs font-semibold px-2 py-0.5 rounded transition-colors ${fixtureTab === "wc" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}>
                        🌍 World Cup
                      </button>
                    )}
                    {clFixtures.length > 0 && (
                      <button onClick={() => setFixtureTab("cl")}
                        className={`text-xs font-semibold px-2 py-0.5 rounded transition-colors ${fixtureTab === "cl" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}>
                        ⭐ Champions League
                      </button>
                    )}
                  </div>
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">Click to add a match to your slip</p>
                <div className="space-y-1.5">
                  {(fixtureTab === "wc" ? wcFixtures : fixtureTab === "cl" ? clFixtures : eplFixtures).map(f => (
                    <button key={f.id} onClick={() => addFromFixture(f)}
                      className="w-full flex items-center justify-between rounded-md border border-border/60 bg-background px-2.5 py-2 text-xs hover:border-primary/40 hover:bg-primary/5 transition-all text-left group">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-muted-foreground whitespace-nowrap shrink-0">
                          {new Date(f.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                        <span className="font-medium truncate">{f.home_team}</span>
                        <span className="text-muted-foreground shrink-0">vs</span>
                        <span className="font-medium truncate">{f.away_team}</span>
                      </div>
                      <Plus className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
                    </button>
                  ))}
                  {(fixtureTab === "wc" ? wcFixtures : fixtureTab === "cl" ? clFixtures : eplFixtures).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">No upcoming fixtures</p>
                  )}
                </div>
              </div>
            )}

            {/* HOW IT WORKS — last on mobile, bottom of left col on desktop */}
            <div className="dashboard-tile p-4 space-y-2 xl:col-start-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">How it works</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Each match uses the full Poisson + Elo + form model. All 3<sup>N</sup> outcome combinations are generated with joint probability and combined odds.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-emerald-600 font-medium">Green rows</span> have positive EV — model probability beats the combined market price.
              </p>
            </div>
          </div>
        </section>
      </div>
    </PageWrapper>
  );
}
