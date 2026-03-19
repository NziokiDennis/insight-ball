import { useState, useCallback } from "react";
import type { PredictionResponse } from "@/types";
import { runLocalSimulation } from "@/utils/probability";

export function useSimulation() {
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const simulate = useCallback(
    (homeOdds: number, drawOdds: number, awayOdds: number, simulations: number) => {
      setIsLoading(true);
      // Use requestAnimationFrame to let skeleton render first
      requestAnimationFrame(() => {
        const res = runLocalSimulation(homeOdds, drawOdds, awayOdds, simulations);
        setResult(res);
        setIsLoading(false);
      });
    },
    []
  );

  const clear = useCallback(() => setResult(null), []);

  return { result, isLoading, simulate, clear };
}
