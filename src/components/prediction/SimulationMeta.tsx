import { formatNumber, formatDuration } from "@/utils/format";
import { Activity, Clock, Target, Zap } from "lucide-react";

interface SimulationMetaProps {
  simulations: number;
  durationMs: number;
  confidenceBand: number;
  overround: number;
  isLocal: boolean;
  homeTeam?: string;
  awayTeam?: string;
  homeElo?: number | null;
  awayElo?: number | null;
  eloActive?: boolean;
  poissonActive?: boolean;
}

export function SimulationMeta({
  simulations,
  durationMs,
  confidenceBand,
  overround,
  isLocal,
  homeTeam,
  awayTeam,
  homeElo,
  awayElo,
  eloActive,
  poissonActive,
}: SimulationMetaProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-mono">
      <span className="flex items-center gap-1.5">
        <Activity className="h-3.5 w-3.5" />
        {formatNumber(simulations)} {poissonActive ? "Poisson matches" : "iterations"}
      </span>
      <span className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" />
        {formatDuration(durationMs)}
      </span>
      <span className="flex items-center gap-1.5">
        <Target className="h-3.5 w-3.5" />
        ±{confidenceBand}% confidence
      </span>
      <span>Margin: {overround.toFixed(2)}%</span>

      {eloActive && homeElo != null && awayElo != null && (
        <span className="flex items-center gap-1.5 text-primary">
          <Zap className="h-3.5 w-3.5" />
          Elo: {homeTeam || "Home"} {Math.round(homeElo)} · {awayTeam || "Away"} {Math.round(awayElo)}
        </span>
      )}

      {isLocal && (
        <span className="text-warning">⚡ Client-side simulation</span>
      )}
    </div>
  );
}
