import { formatEdge } from "@/utils/format";

interface ValueEdgeBadgeProps {
  edge: number;
}

export function ValueEdgeBadge({ edge }: ValueEdgeBadgeProps) {
  let bgClass = "bg-muted text-muted-foreground";
  if (edge > 0.5) bgClass = "bg-success/15 text-success";
  else if (edge < -0.5) bgClass = "bg-warning/15 text-warning";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${bgClass}`}>
      {formatEdge(edge)}
    </span>
  );
}
