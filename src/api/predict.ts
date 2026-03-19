import { apiClient } from "./client";
import type { PredictionRequest, PredictionResponse } from "@/types";

export async function postPredict(data: PredictionRequest): Promise<PredictionResponse> {
  const res = await apiClient.post<PredictionResponse>("/api/v1/predict", data);
  return res.data;
}
