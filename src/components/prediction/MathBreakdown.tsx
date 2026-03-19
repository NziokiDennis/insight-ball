import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { MathStep } from "@/types";

interface MathBreakdownProps {
  steps: MathStep[];
}

export function MathBreakdown({ steps }: MathBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="surface-panel overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="font-display font-semibold text-sm text-foreground">
          Step-by-Step Math Breakdown
        </span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-border p-4 space-y-4 animate-fade-in">
          <p className="text-xs text-muted-foreground">
            We convert bookmaker odds to implied probabilities, remove the overround (margin), 
            then run a Monte Carlo simulation to produce stable probability estimates.
          </p>

          {steps.map((step, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <h4 className="text-sm font-medium text-foreground">{step.label}</h4>
              </div>
              <div className="ml-8 space-y-1">
                <code className="block text-xs font-mono text-muted-foreground bg-background rounded px-2 py-1">
                  {step.formula}
                </code>
                <p className="text-xs font-mono text-foreground/80">{step.result}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
