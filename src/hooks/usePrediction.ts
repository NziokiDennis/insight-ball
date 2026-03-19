import { useState, useCallback } from "react";
import type { PredictionRequest, PredictionResponse } from "@/types";
import { postPredict } from "@/api/predict";
import { runLocalSimulation } from "@/utils/probability";

/**
 * Tries the backend API first, falls back to local simulation.
 */
export function usePrediction() {
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocal, setIsLocal] = useState(false);

  const predict = useCallback(async (data: PredictionRequest) => {
    setIsLoading(true);
    setIsLocal(false);
    try {
      const res = await postPredict(data);
      setResult(res);
    } catch {
      // Fallback to local simulation
      const res = runLocalSimulation(data.home_odds, data.draw_odds, data.away_odds, data.simulations);
      setResult(res);
      setIsLocal(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setIsLocal(false);
  }, []);

  return { result, isLoading, isLocal, predict, clear };
}
