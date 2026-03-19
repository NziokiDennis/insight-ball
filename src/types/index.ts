export interface PredictionRequest {
  home_odds: number;
  draw_odds: number;
  away_odds: number;
  simulations: number;
  home_team: string;
  away_team: string;
}

export interface PredictionResponse {
  home_probability: number;
  draw_probability: number;
  away_probability: number;
  home_count: number;
  draw_count: number;
  away_count: number;
  simulations: number;
  home_value_edge: number;
  draw_value_edge: number;
  away_value_edge: number;
  confidence_band: number;
  overround: number;
  duration_ms: number;
}

export interface MathStep {
  label: string;
  formula: string;
  result: string;
}

export interface HistoryEntry {
  id: string;
  home_team: string;
  away_team: string;
  home_odds: number;
  draw_odds: number;
  away_odds: number;
  home_probability: number;
  draw_probability: number;
  away_probability: number;
  simulations: number;
  actual_result?: "home" | "draw" | "away" | null;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  username?: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username?: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null, token: string | null) => void;
}
