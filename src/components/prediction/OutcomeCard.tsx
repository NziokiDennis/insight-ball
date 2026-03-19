import { useEffect, useState, useRef } from "react";
import { ProbabilityBar } from "./ProbabilityBar";
import { ValueEdgeBadge } from "./ValueEdgeBadge";
import { formatNumber } from "@/utils/format";

interface OutcomeCardProps {
  label: string;
  probability: number;
  count: number;
  simulations: number;
  valueEdge: number;
  color: "primary" | "secondary" | "success";
  delay?: number;
}

function AnimatedNumber({ target, duration = 400, delay = 0 }: { target: number; duration?: number; delay?: number }) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = performance.now();
      const animate = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(parseFloat((eased * target).toFixed(1)));
        if (progress < 1) {
          frameRef.current = requestAnimationFrame(animate);
        }
      };
      frameRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration, delay]);

  return <>{display.toFixed(1)}%</>;
}

export function OutcomeCard({ label, probability, count, simulations, valueEdge, color, delay = 0 }: OutcomeCardProps) {
  return (
    <div className="surface-panel p-5 space-y-4 animate-slide-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{label}</h3>
        <ValueEdgeBadge edge={valueEdge} />
      </div>

      <div className="font-mono-data text-5xl font-bold text-foreground leading-none">
        <AnimatedNumber target={probability} delay={delay} />
      </div>

      <ProbabilityBar value={probability} color={color} delay={delay + 100} />

      <p className="text-xs text-muted-foreground font-mono">
        {formatNumber(count)} / {formatNumber(simulations)} simulations
      </p>
    </div>
  );
}
