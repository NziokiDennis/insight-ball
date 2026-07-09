import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { fetchPredictions, type SavedPrediction } from "@/api/predictions";
import { apiClient } from "@/api/client";
import { CalendarDays, RefreshCw, CheckCircle2, XCircle, Clock, CircleDot, FlaskConical, Layers } from "lucide-react";

const OUTCOME_LABEL: Record<string, string> = {
  home: "Home",
  draw: "Draw",
  away: "Away",
};

const OUTCOME_COLOR: Record<string, string> = {
  home: "bg-primary/15 text-primary",
  draw: "bg-yellow-100 text-yellow-700",
  away: "bg-emerald-100 text-emerald-700",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function expectedResultLabel(createdAt: string): string {
  const matchDate = new Date(createdAt);
  const today = new Date();
  const matchDay = matchDate.toDateString();
  const todayDay = today.toDateString();

  const deadline = new Date(matchDate);
  deadline.setHours(23, 59, 0, 0);

  if (matchDay === todayDay) {
    return "By tonight 23:59";
  }
  if (deadline < today) {
    return "Updating soon";
  }
  return `By ${matchDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} 23:59`;
}

async function markResult(id: string, result: string, onDone: () => void) {
  try {
    await apiClient.patch(`/api/v1/predictions/${id}/result`, { result });
    onDone();
  } catch {
    // silent
  }
}

function ManualResultPicker({ id, onDone }: { id: string; onDone: () => void }) {
  const [saving, setSaving] = useState(false);
  const handle = async (result: string) => {
    setSaving(true);
    await markResult(id, result, onDone);
    setSaving(false);
  };
  return (
    <div className="flex items-center gap-1">
      {(["home", "draw", "away"] as const).map((r) => (
        <button
          key={r}
          disabled={saving}
          onClick={() => handle(r)}
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase transition-colors hover:opacity-80 disabled:opacity-40 ${OUTCOME_COLOR[r]}`}
        >
          {OUTCOME_LABEL[r]}
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ prediction, actual, createdAt }: { prediction: string | null; actual: string | null; createdAt: string }) {
  if (!actual) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
        <Clock className="h-3 w-3 shrink-0" />
        {expectedResultLabel(createdAt)}
      </span>
    );
  }
  const correct = prediction === actual;
  return correct ? (
    <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Correct
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
      <XCircle className="h-3.5 w-3.5" />
      Wrong
    </span>
  );
}

export default function History() {
  const [predictions, setPredictions] = useState<SavedPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    const rows = await fetchPredictions(200);
    setPredictions(rows);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  const resolved = predictions.filter((p) => p.actual_result !== null);
  const correct = resolved.filter((p) => p.recommended_outcome === p.actual_result);
  const accuracy = resolved.length > 0 ? Math.round((correct.length / resolved.length) * 100) : null;

  const stats = [
    { label: "Total predictions", value: predictions.length || "--", dot: "bg-primary" },
    { label: "Resolved", value: resolved.length || "--", dot: "bg-warning" },
    { label: "Correct calls", value: correct.length || "--", dot: "bg-secondary" },
    { label: "Accuracy", value: accuracy !== null ? `${accuracy}%` : "--", dot: "bg-muted-foreground" },
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
              <Link to="/" className="rounded-t-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
                <CircleDot className="h-3.5 w-3.5" />Prediction
              </Link>
              <Link to="/backtest" className="rounded-t-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
                <FlaskConical className="h-3.5 w-3.5" />Backtest
              </Link>
              <Link to="/parlay" className="rounded-t-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />Parlay
              </Link>
              <div className="mac-tab">
                <Clock className="mr-2 h-3.5 w-3.5 text-primary" />History
              </div>
            </div>
          </div>
          <div className="hidden rounded-md bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm md:block">
            Prediction log
          </div>
        </div>

        <section className="bg-primary px-4 py-5 text-white sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-white/75">
                <CalendarDays className="h-4 w-4" />
                <span>Prediction log</span>
              </div>
              <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                History
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/78">
                All predictions saved to the database. Actual results are filled automatically after matches complete.
              </p>
            </div>
            <button
              onClick={load}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-md bg-white/14 px-4 py-2.5 text-sm font-medium text-white ring-1 ring-white/20 hover:bg-white/20 transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </section>

        <section className="bg-[#f6f7f9] p-3 sm:p-5 lg:p-6">
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="dashboard-tile min-w-0 p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                  <span>{s.label}</span>
                </div>
                <p className="mt-2 truncate font-mono-data text-[clamp(1.55rem,3vw,2.25rem)] font-semibold text-foreground">
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          <div className="dashboard-tile overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                Loading predictions…
              </div>
            ) : predictions.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <Clock className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">No predictions saved yet</p>
                <p className="text-xs text-muted-foreground/70">Run a prediction on the home page and it will appear here.</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                        <th className="px-4 py-3 text-left font-medium">Date</th>
                        <th className="px-4 py-3 text-left font-medium">Match</th>
                        <th className="px-4 py-3 text-center font-medium">H%</th>
                        <th className="px-4 py-3 text-center font-medium">D%</th>
                        <th className="px-4 py-3 text-center font-medium">A%</th>
                        <th className="px-4 py-3 text-center font-medium">Recommended</th>
                        <th className="px-4 py-3 text-center font-medium">Actual</th>
                        <th className="px-4 py-3 text-center font-medium">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {predictions.map((p) => (
                        <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(p.created_at)}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {p.home_team || "Home"}{" "}
                            <span className="text-muted-foreground font-normal text-xs">vs</span>{" "}
                            {p.away_team || "Away"}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-xs">{p.home_prob}%</td>
                          <td className="px-4 py-3 text-center font-mono text-xs">{p.draw_prob}%</td>
                          <td className="px-4 py-3 text-center font-mono text-xs">{p.away_prob}%</td>
                          <td className="px-4 py-3 text-center">
                            {p.recommended_outcome ? (
                              <span className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase ${OUTCOME_COLOR[p.recommended_outcome] ?? ""}`}>
                                {OUTCOME_LABEL[p.recommended_outcome] ?? p.recommended_outcome}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">No edge</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {p.actual_result ? (
                              <span className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase ${OUTCOME_COLOR[p.actual_result] ?? ""}`}>
                                {OUTCOME_LABEL[p.actual_result] ?? p.actual_result}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {p.actual_result ? (
                              <StatusBadge prediction={p.recommended_outcome} actual={p.actual_result} createdAt={p.created_at} />
                            ) : (
                              <ManualResultPicker id={p.id} onDone={load} />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-border">
                  {predictions.map((p) => (
                    <div key={p.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-sm">
                          {p.home_team || "Home"} <span className="text-muted-foreground font-normal text-xs">vs</span> {p.away_team || "Away"}
                        </span>
                        <StatusBadge prediction={p.recommended_outcome} actual={p.actual_result} createdAt={p.created_at} />
                      </div>
                      {p.actual_result === null && (
                        <ManualResultPicker id={p.id} onDone={load} />
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>H {p.home_prob}%</span>
                        <span>D {p.draw_prob}%</span>
                        <span>A {p.away_prob}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {p.recommended_outcome && (
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${OUTCOME_COLOR[p.recommended_outcome] ?? ""}`}>
                              {OUTCOME_LABEL[p.recommended_outcome]}
                            </span>
                          )}
                          {p.actual_result && (
                            <>
                              <span className="text-muted-foreground text-xs">→</span>
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${OUTCOME_COLOR[p.actual_result] ?? ""}`}>
                                {OUTCOME_LABEL[p.actual_result]}
                              </span>
                            </>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">{formatDate(p.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </PageWrapper>
  );
}
