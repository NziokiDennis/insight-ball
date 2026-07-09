import { apiClient } from "./client";

export interface SavedPrediction {
  id: string;
  created_at: string;
  home_team: string;
  away_team: string;
  home_odds: number;
  draw_odds: number;
  away_odds: number;
  simulations: number;
  home_prob: number;
  draw_prob: number;
  away_prob: number;
  recommended_outcome: string | null;
  model_notes: string[];
  actual_result: string | null;
  result_fetched_at: string | null;
  league: string;
}

export async function savePrediction(data: {
  home_team: string;
  away_team: string;
  home_odds: number;
  draw_odds: number;
  away_odds: number;
  simulations: number;
  home_prob: number;
  draw_prob: number;
  away_prob: number;
  recommended_outcome: string | null;
  model_notes: string[];
  league?: string;
}): Promise<void> {
  try {
    await apiClient.post("/api/v1/predictions/save", data);
  } catch {
    // silent — DB save failure shouldn't interrupt UX
  }
}

export async function fetchPredictions(limit = 100): Promise<SavedPrediction[]> {
  try {
    const { data } = await apiClient.get<{ predictions: SavedPrediction[] }>(
      `/api/v1/predictions?limit=${limit}`
    );
    return Array.isArray(data?.predictions) ? data.predictions : [];
  } catch {
    return [];
  }
}
