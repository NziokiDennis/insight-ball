import type { PredictionResponse, TeamFormData } from "@/types";
import { OutcomeCard } from "./OutcomeCard";
import { SimulationMeta } from "./SimulationMeta";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ResultsPanelProps {
  result: PredictionResponse;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  homeTeam: string;
  awayTeam: string;
  isLocal: boolean;
}

const FORM_COLORS: Record<string, string> = {
  W: "bg-green-500",
  D: "bg-yellow-400",
  L: "bg-red-500",
};

function FormRow({ label, form }: { label: string; form: TeamFormData }) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className="w-24 truncate font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-1">
        {form.form_string.split("").map((r, i) => (
          <span
            key={i}
            title={r === "W" ? "Win" : r === "D" ? "Draw" : "Loss"}
            className={`h-4 w-4 rounded-sm flex items-center justify-center text-[9px] font-bold text-white ${FORM_COLORS[r] ?? "bg-muted"}`}
          >
            {r}
          </span>
        ))}
      </div>
      <span className="font-mono text-muted-foreground tabular-nums">
        {(form.goals_scored / form.matches).toFixed(1)} gf · {(form.goals_conceded / form.matches).toFixed(1)} ga
      </span>
    </div>
  );
}

export function ResultsPanel({
  result,
  homeOdds,
  drawOdds,
  awayOdds,
  homeTeam,
  awayTeam,
  isLocal,
}: ResultsPanelProps) {
  const homeLabel = homeTeam || "Home Win";
  const awayLabel = awayTeam || "Away Win";

  const handleShare = () => {
    const params = new URLSearchParams({
      h: homeOdds.toString(),
      d: drawOdds.toString(),
      a: awayOdds.toString(),
      s: result.simulations.toString(),
      ht: homeTeam,
      at: awayTeam,
    });
    navigator.clipboard.writeText(`${window.location.origin}/?${params}`).then(() =>
      toast.success("Result URL copied to clipboard")
    );
  };

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Match header */}
      {(homeTeam || awayTeam) && (
        <div className="dashboard-tile px-5 py-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Fixture</p>
          <h2 className="mt-1 break-words font-display text-2xl font-bold text-foreground">
            {homeTeam || "Home"} <span className="text-muted-foreground">vs</span> {awayTeam || "Away"}
          </h2>
        </div>
      )}

      {/* Outcome cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <OutcomeCard label={homeLabel} probability={result.home_probability} count={result.home_count} simulations={result.simulations} valueEdge={result.home_value_edge} color="primary" delay={0} />
        <OutcomeCard label="Draw" probability={result.draw_probability} count={result.draw_count} simulations={result.simulations} valueEdge={result.draw_value_edge} color="secondary" delay={100} />
        <OutcomeCard label={awayLabel} probability={result.away_probability} count={result.away_count} simulations={result.simulations} valueEdge={result.away_value_edge} color="success" delay={200} />
      </div>

      {/* Poisson goal model */}
      {result.poisson_active && result.lambda_home != null && result.lambda_away != null && (
        <div className="surface-panel px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Goal model</p>
            <span className="font-mono text-xs text-foreground">
              xG: <span className="text-primary font-semibold">{result.lambda_home.toFixed(2)}</span>
              <span className="text-muted-foreground"> – </span>
              <span className="font-semibold">{result.lambda_away.toFixed(2)}</span>
            </span>
          </div>

          {result.scoreline_probabilities && result.scoreline_probabilities.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {result.scoreline_probabilities.map((s, i) => (
                <div
                  key={s.scoreline}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-mono ${
                    i === 0
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <span>{s.scoreline}</span>
                  <span className={i === 0 ? "text-primary-foreground/70" : "text-muted-foreground"}>
                    {s.probability}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Form summary */}
      {result.form_active && result.home_form && result.away_form && (
        <div className="surface-panel px-4 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Last {result.home_form.matches} matches
          </p>
          <FormRow label={homeTeam || "Home"} form={result.home_form} />
          <FormRow label={awayTeam || "Away"} form={result.away_form} />
        </div>
      )}

      {/* Simulation meta */}
      <div className="surface-panel p-4">
        <SimulationMeta
          simulations={result.simulations}
          durationMs={result.duration_ms}
          confidenceBand={result.confidence_band}
          overround={result.overround}
          isLocal={isLocal}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          homeElo={result.home_elo}
          awayElo={result.away_elo}
          eloActive={result.elo_active}
          poissonActive={result.poisson_active}
        />
      </div>

      {/* Value flag + Kelly stake */}
      {result.recommended_outcome && (() => {
        const rec = result.recommended_outcome!;
        const prob = rec === "home" ? result.home_probability / 100
          : rec === "draw" ? result.draw_probability / 100
          : result.away_probability / 100;
        const odds = rec === "home" ? homeOdds : rec === "draw" ? drawOdds : awayOdds;
        const kelly = odds > 1 ? Math.max(0, (prob * odds - 1) / (odds - 1)) : 0;
        const quarterKelly = kelly * 0.25;
        return (
          <div className="surface-panel p-4 space-y-2">
            <p className="text-sm text-success font-medium">
              Value flag: <span className="uppercase">{rec}</span> has the strongest positive expected value.
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border pt-2">
              <div>
                <span className="font-medium text-foreground">Full Kelly</span>
                <span className="ml-1.5 font-mono text-primary">{(kelly * 100).toFixed(1)}%</span>
                <span className="ml-1 text-muted-foreground">of bankroll</span>
              </div>
              <div className="h-3 w-px bg-border" />
              <div>
                <span className="font-medium text-foreground">¼ Kelly</span>
                <span className="ml-1.5 font-mono text-primary">{(quarterKelly * 100).toFixed(1)}%</span>
                <span className="ml-1 text-muted-foreground">(recommended)</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Model notes */}
      {result.model_notes && result.model_notes.length > 0 && (
        <div className="surface-panel px-4 py-3 space-y-1">
          {result.model_notes.map((note, i) => (
            <p key={i} className="text-xs text-muted-foreground">{note}</p>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={handleShare} className="flex items-center gap-2">
          <Share2 className="h-4 w-4" />
          Share Result
        </Button>
      </div>
    </div>
  );
}
