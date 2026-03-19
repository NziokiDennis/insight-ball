import { apiClient } from "./client";
import type { HistoryEntry } from "@/types";

export async function getHistory(): Promise<HistoryEntry[]> {
  const res = await apiClient.get<HistoryEntry[]>("/api/v1/history");
  return res.data;
}
