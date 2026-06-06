import { apiClient } from "./client";
import type { PredictionRequest, PredictionResponse } from "@/types";

export async function postPredict(data: PredictionRequest): Promise<PredictionResponse> {
  const res = await apiClient.post<PredictionResponse>("/api/v1/predict", data);
  return res.data;
}

export async function fetchElo(teamName: string): Promise<number | null> {
  try {
    const res = await apiClient.get<{ team: string; elo: number }>(
      `/api/v1/elo/${encodeURIComponent(teamName)}`
    );
    return res.data.elo;
  } catch {
    return null;
  }
}
