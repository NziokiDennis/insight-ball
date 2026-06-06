const STORAGE_KEY = "ignition_predictions_v1";
const MAX_ENTRIES = 15;

export interface HistoryEntry {
  id: string;
  timestamp: number;
  homeTeam: string;
  awayTeam: string;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  simulations: number;
  recommendation: string | null;
  homeProb: number;
  drawProb: number;
  awayProb: number;
}

function load(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function getHistory(): HistoryEntry[] {
  return load();
}

export function pushPrediction(entry: Omit<HistoryEntry, "id" | "timestamp">): void {
  const entries = load();
  const newEntry: HistoryEntry = {
    ...entry,
    id: Math.random().toString(36).slice(2),
    timestamp: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([newEntry, ...entries].slice(0, MAX_ENTRIES)));
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}
