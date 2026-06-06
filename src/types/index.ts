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
  market_probabilities?: {
    home: number;
    draw: number;
    away: number;
  };
  expected_value?: {
    home: number;
    draw: number;
    away: number;
  };
  recommended_outcome?: "home" | "draw" | "away" | null;
  most_likely_outcome?: "home" | "draw" | "away";
  model_notes?: string[];
  home_elo?: number | null;
  away_elo?: number | null;
  elo_active?: boolean;
  home_form?: TeamFormData | null;
  away_form?: TeamFormData | null;
  form_active?: boolean;
  lambda_home?: number | null;
  lambda_away?: number | null;
  poisson_active?: boolean;
  most_likely_scoreline?: string | null;
  scoreline_probabilities?: { scoreline: string; probability: number }[];
}

export interface MathStep {
  label: string;
  formula: string;
  result: string;
}

export interface BacktestBet {
  date: string;
  home_team: string;
  away_team: string;
  pick: "home" | "draw" | "away";
  odds: number;
  ev: number;
  actual: "home" | "draw" | "away";
  won: boolean;
  pnl: number;
  xg_home: number;
  xg_away: number;
}

export interface BacktestResult {
  evaluated_matches: number;
  bets: number;
  wins: number;
  hit_rate: number;
  profit: number;
  roi: number;
  bets_detail: BacktestBet[];
}

export interface DatasetInfo {
  key: string;
  rows: number;
}

export interface TeamFormData {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goals_scored: number;
  goals_conceded: number;
  form_string: string;
}
