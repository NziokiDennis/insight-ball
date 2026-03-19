import { useEffect, useState } from "react";

interface ProbabilityBarProps {
  value: number;
  color: "primary" | "secondary" | "success";
  delay?: number;
}

const colorMap = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  success: "bg-success",
};

export function ProbabilityBar({ value, color, delay = 0 }: ProbabilityBarProps) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return (
    <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-600 ease-out ${colorMap[color]}`}
        style={{
          width: `${width}%`,
          transitionDuration: "600ms",
          transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      />
    </div>
  );
}
