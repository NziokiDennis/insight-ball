import { apiClient } from "./client";
import type { BacktestResult, DatasetInfo } from "@/types";

export async function fetchDatasets(): Promise<DatasetInfo[]> {
  const { data } = await apiClient.get<{ datasets: DatasetInfo[] }>("/api/v1/datasets");
  return data.datasets;
}

export interface BacktestParams {
  datasets: string[];
  min_edge: number;
  stake: number;
  min_home_matches: number;
  min_away_matches: number;
  max_odds: number;
}

export async function runBacktest(params: BacktestParams): Promise<BacktestResult> {
  const { data } = await apiClient.post<BacktestResult>("/api/v1/backtest", params);
  return data;
}

export async function uploadDataset(name: string, file: File): Promise<DatasetInfo> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<DatasetInfo>(
    `/api/v1/datasets/upload?name=${encodeURIComponent(name)}`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}

export async function deleteDataset(key: string): Promise<void> {
  await apiClient.delete(`/api/v1/datasets/${key}`);
}
