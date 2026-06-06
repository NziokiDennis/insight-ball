import { apiClient } from "./client";

export interface Fixture {
  id: string;
  date: string;
  home_team: string;
  away_team: string;
}

export async function fetchFixtures(): Promise<Fixture[]> {
  const { data } = await apiClient.get<{ fixtures: Fixture[] }>("/api/v1/fixtures");
  return data.fixtures;
}
