import { apiClient } from "./client";

export interface Fixture {
  id: string;
  date: string;
  home_team: string;
  away_team: string;
}

export async function fetchFixtures(): Promise<Fixture[]> {
  try {
    const { data } = await apiClient.get<{ fixtures: Fixture[] }>("/api/v1/fixtures");
    return Array.isArray(data?.fixtures) ? data.fixtures : [];
  } catch {
    return [];
  }
}
