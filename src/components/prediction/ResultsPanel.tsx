import type { PredictionResponse } from "@/types";
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

export function ResultsPanel({ result, homeOdds, drawOdds, awayOdds, homeTeam, awayTeam, isLocal }: ResultsPanelProps) {
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
    const url = `${window.location.origin}/?${params.toString()}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Result URL copied to clipboard");
    });
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
        <OutcomeCard
          label={homeLabel}
          probability={result.home_probability}
          count={result.home_count}
          simulations={result.simulations}
          valueEdge={result.home_value_edge}
          color="primary"
          delay={0}
        />
        <OutcomeCard
          label="Draw"
          probability={result.draw_probability}
          count={result.draw_count}
          simulations={result.simulations}
          valueEdge={result.draw_value_edge}
          color="secondary"
          delay={100}
        />
        <OutcomeCard
          label={awayLabel}
          probability={result.away_probability}
          count={result.away_count}
          simulations={result.simulations}
          valueEdge={result.away_value_edge}
          color="success"
          delay={200}
        />
      </div>

      {/* Simulation metadata */}
      <div className="surface-panel p-4">
        <SimulationMeta
          simulations={result.simulations}
          durationMs={result.duration_ms}
          confidenceBand={result.confidence_band}
          overround={result.overround}
          isLocal={isLocal}
        />
      </div>

      {result.recommended_outcome && (
        <div className="surface-panel p-4 text-sm">
          <p className="text-success font-medium">
            Value flag: {result.recommended_outcome.toUpperCase()} has the strongest positive expected value.
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={handleShare} className="flex items-center gap-2">
          <Share2 className="h-4 w-4" />
          Share Result
        </Button>
      </div>
    </div>
  );
}
