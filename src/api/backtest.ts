import { apiClient } from "./client";
import type { BacktestResult, DatasetInfo } from "@/types";

export async function fetchDatasets(): Promise<DatasetInfo[]> {
  const { data } = await apiClient.get<{ datasets: DatasetInfo[] }>("/api/v1/datasets");
  return data.datasets;
}

export interface BacktestParams {
  dataset: string;
  min_edge: number;
  stake: number;
  min_home_matches: number;
  min_away_matches: number;
}

export async function runBacktest(params: BacktestParams): Promise<BacktestResult> {
  const { data } = await apiClient.post<BacktestResult>("/api/v1/backtest", params);
  return data;
}
