import type { PredictionResponse, MathStep } from "@/types";

export function runLocalSimulation(
  homeOdds: number,
  drawOdds: number,
  awayOdds: number,
  simulations: number
): PredictionResponse {
  const start = performance.now();

  // Step 1: Raw implied probabilities
  const rawHome = 1 / homeOdds;
  const rawDraw = 1 / drawOdds;
  const rawAway = 1 / awayOdds;
  const rawTotal = rawHome + rawDraw + rawAway;

  // Step 2: Overround
  const overround = (rawTotal - 1.0) * 100;

  // Step 3: Normalise
  const pHome = rawHome / rawTotal;
  const pDraw = rawDraw / rawTotal;
  const pAway = rawAway / rawTotal;

  // Step 4: Monte Carlo
  let homeCount = 0;
  let drawCount = 0;
  let awayCount = 0;

  for (let i = 0; i < simulations; i++) {
    const rand = Math.random();
    if (rand < pHome) {
      homeCount++;
    } else if (rand < pHome + pDraw) {
      drawCount++;
    } else {
      awayCount++;
    }
  }

  // Step 5: Simulated probabilities
  const simHome = homeCount / simulations;
  const simDraw = drawCount / simulations;
  const simAway = awayCount / simulations;

  // Step 6: Expected value against the offered decimal odds
  const homeEdge = parseFloat(((simHome * homeOdds - 1) * 100).toFixed(2));
  const drawEdge = parseFloat(((simDraw * drawOdds - 1) * 100).toFixed(2));
  const awayEdge = parseFloat(((simAway * awayOdds - 1) * 100).toFixed(2));

  // Step 7: Confidence band (Wilson 95%)
  const z = 1.96;
  const p = simHome;
  const band = z * Math.sqrt((p * (1 - p)) / simulations);

  const duration = performance.now() - start;

  return {
    home_probability: parseFloat((simHome * 100).toFixed(2)),
    draw_probability: parseFloat((simDraw * 100).toFixed(2)),
    away_probability: parseFloat((simAway * 100).toFixed(2)),
    home_count: homeCount,
    draw_count: drawCount,
    away_count: awayCount,
    simulations,
    home_value_edge: homeEdge,
    draw_value_edge: drawEdge,
    away_value_edge: awayEdge,
    confidence_band: parseFloat((band * 100).toFixed(2)),
    overround: parseFloat(overround.toFixed(2)),
    duration_ms: parseFloat(duration.toFixed(1)),
    market_probabilities: {
      home: parseFloat((pHome * 100).toFixed(2)),
      draw: parseFloat((pDraw * 100).toFixed(2)),
      away: parseFloat((pAway * 100).toFixed(2)),
    },
    expected_value: {
      home: homeEdge,
      draw: drawEdge,
      away: awayEdge,
    },
    recommended_outcome: homeEdge > 3 || drawEdge > 3 || awayEdge > 3
      ? ([
          ["home", homeEdge],
          ["draw", drawEdge],
          ["away", awayEdge],
        ].sort((a, b) => Number(b[1]) - Number(a[1]))[0][0] as "home" | "draw" | "away")
      : null,
    most_likely_outcome: ([
      ["home", simHome],
      ["draw", simDraw],
      ["away", simAway],
    ].sort((a, b) => Number(b[1]) - Number(a[1]))[0][0] as "home" | "draw" | "away"),
    model_notes: ["Client fallback uses devigged market probabilities only."],
  };
}

export function generateMathSteps(
  homeOdds: number,
  drawOdds: number,
  awayOdds: number,
  result: PredictionResponse
): MathStep[] {
  const rawHome = 1 / homeOdds;
  const rawDraw = 1 / drawOdds;
  const rawAway = 1 / awayOdds;
  const rawTotal = rawHome + rawDraw + rawAway;

  return [
    {
      label: "Raw Implied Probabilities",
      formula: "P = 1 / Odds",
      result: `Home: 1/${homeOdds} = ${(rawHome * 100).toFixed(2)}% | Draw: 1/${drawOdds} = ${(rawDraw * 100).toFixed(2)}% | Away: 1/${awayOdds} = ${(rawAway * 100).toFixed(2)}%`,
    },
    {
      label: "Total Implied Probability (Overround)",
      formula: "Total = P_home + P_draw + P_away",
      result: `${(rawTotal * 100).toFixed(2)}% — Bookmaker margin: ${result.overround.toFixed(2)}%`,
    },
    {
      label: "Normalised Probabilities",
      formula: "P_norm = P_raw / Total",
      result: `Home: ${((rawHome / rawTotal) * 100).toFixed(2)}% | Draw: ${((rawDraw / rawTotal) * 100).toFixed(2)}% | Away: ${((rawAway / rawTotal) * 100).toFixed(2)}%`,
    },
    {
      label: "Monte Carlo Simulation",
      formula: `${result.simulations.toLocaleString()} random iterations weighted by normalised probabilities`,
      result: `Home: ${result.home_count.toLocaleString()} wins | Draw: ${result.draw_count.toLocaleString()} | Away: ${result.away_count.toLocaleString()} wins`,
    },
    {
      label: "Final Outcome Probabilities",
      formula: "P_sim = count / total_simulations × 100",
      result: `Home: ${result.home_probability}% | Draw: ${result.draw_probability}% | Away: ${result.away_probability}%`,
    },
    {
      label: "Expected Value",
      formula: "EV = model_probability × decimal_odds - 1",
      result: `Home: ${result.home_value_edge}% | Draw: ${result.draw_value_edge}% | Away: ${result.away_value_edge}%`,
    },
    {
      label: "95% Confidence Band",
      formula: "±z × √(p(1-p)/n) where z=1.96",
      result: `±${result.confidence_band}%`,
    },
  ];
}
