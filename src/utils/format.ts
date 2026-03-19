export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString();
}

export function formatDuration(ms: number): string {
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatEdge(edge: number): string {
  const sign = edge > 0 ? "+" : "";
  return `${sign}${edge.toFixed(2)}%`;
}

/** Convert logarithmic slider position (0-1) to simulation count (100-100000) */
export function sliderToSimulations(value: number): number {
  const min = Math.log10(100);
  const max = Math.log10(100000);
  const result = Math.pow(10, min + value * (max - min));
  return Math.round(result);
}

/** Convert simulation count to logarithmic slider position (0-1) */
export function simulationsToSlider(sims: number): number {
  const min = Math.log10(100);
  const max = Math.log10(100000);
  return (Math.log10(sims) - min) / (max - min);
}
