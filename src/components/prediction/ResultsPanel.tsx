import type { PredictionResponse } from "@/types";
import { OutcomeCard } from "./OutcomeCard";
import { SimulationMeta } from "./SimulationMeta";
import { MathBreakdown } from "./MathBreakdown";
import { generateMathSteps } from "@/utils/probability";
import { Share2, FileDown } from "lucide-react";
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
  const steps = generateMathSteps(homeOdds, drawOdds, awayOdds, result);

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

  const handleExportPDF = () => {
    toast.info("PDF export will be available when the backend is connected");
  };

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Match header */}
      {(homeTeam || awayTeam) && (
        <div className="text-center">
          <h2 className="font-display font-bold text-xl text-foreground">
            {homeTeam || "Home"} <span className="text-muted-foreground">vs</span> {awayTeam || "Away"}
          </h2>
        </div>
      )}

      {/* Outcome cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={handleShare} className="flex items-center gap-2">
          <Share2 className="h-4 w-4" />
          Share Result
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPDF} className="flex items-center gap-2">
          <FileDown className="h-4 w-4" />
          Export PDF
        </Button>
      </div>

      {/* Math breakdown */}
      <MathBreakdown steps={steps} />
    </div>
  );
}
