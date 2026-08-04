import { apiClient } from "./client";

export interface Fixture {
  id: string;
  date: string;
  home_team: string;
  away_team: string;
}

async function fetchFromEndpoint(endpoint: string): Promise<Fixture[]> {
  try {
    const { data } = await apiClient.get<{ fixtures: Fixture[] }>(endpoint);
    return Array.isArray(data?.fixtures) ? data.fixtures : [];
  } catch {
    return [];
  }
}

export const fetchFixtures = () => fetchFromEndpoint("/api/v1/fixtures");
export const fetchWCFixtures = () => fetchFromEndpoint("/api/v1/fixtures/wc");
export const fetchCLFixtures = () => fetchFromEndpoint("/api/v1/fixtures/cl");
export const fetchLaLigaFixtures = () => fetchFromEndpoint("/api/v1/fixtures/laliga");
export const fetchBundesligaFixtures = () => fetchFromEndpoint("/api/v1/fixtures/bundesliga");
export const fetchSerieAFixtures = () => fetchFromEndpoint("/api/v1/fixtures/seriea");
export const fetchLigue1Fixtures = () => fetchFromEndpoint("/api/v1/fixtures/ligue1");
