import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { OddsInputPanel } from "@/components/prediction/OddsInputPanel";
import { ResultsPanel } from "@/components/prediction/ResultsPanel";
import { ResultsSkeleton } from "@/components/prediction/ResultsSkeleton";
import { useSimulation } from "@/hooks/useSimulation";
import type { OddsFormData } from "@/utils/validation";
import { Zap, Eye, Target, Flame } from "lucide-react";
import ignitionLogo from "@/assets/ignition-logo.png";

export default function Home() {
  const { result, isLoading, simulate, clear } = useSimulation();
  const [lastInput, setLastInput] = useState<OddsFormData | null>(null);
  const [searchParams] = useSearchParams();

  // Load from shared URL params
  useEffect(() => {
    const h = searchParams.get("h");
    const d = searchParams.get("d");
    const a = searchParams.get("a");
    if (h && d && a) {
      const data: OddsFormData = {
        home_odds: parseFloat(h),
        draw_odds: parseFloat(d),
        away_odds: parseFloat(a),
        simulations: parseInt(searchParams.get("s") || "1000"),
        home_team: searchParams.get("ht") || "",
        away_team: searchParams.get("at") || "",
      };
      setLastInput(data);
      simulate(data.home_odds, data.draw_odds, data.away_odds, data.simulations);
    }
  }, []);

  const handleSubmit = (data: OddsFormData) => {
    setLastInput(data);
    simulate(data.home_odds, data.draw_odds, data.away_odds, data.simulations);
  };

  const handleClear = () => {
    setLastInput(null);
    clear();
  };

  return (
    <PageWrapper>
      {/* Hero */}
      <section className="text-center mb-12 animate-slide-up">
        <div className="flex items-center justify-center gap-3 mb-4">
          <img src={ignitionLogo} alt="Ignition" className="h-12 w-12 rounded-lg" />
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-foreground tracking-tight">
            Ignition
          </h1>
        </div>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
          Mathematical football match prediction engine. Convert bookmaker odds to true probabilities 
          using Monte Carlo simulation. <span className="text-primary font-medium">We simulate, not speculate.</span>
        </p>
      </section>

      {/* Calculator */}
      <div className="max-w-3xl mx-auto space-y-6">
        <OddsInputPanel onSubmit={handleSubmit} isLoading={isLoading} onClear={handleClear} />

        {isLoading && <ResultsSkeleton />}

        {result && lastInput && !isLoading && (
          <ResultsPanel
            result={result}
            homeOdds={lastInput.home_odds}
            drawOdds={lastInput.draw_odds}
            awayOdds={lastInput.away_odds}
            homeTeam={lastInput.home_team}
            awayTeam={lastInput.away_team}
            isLocal={true}
          />
        )}
      </div>

      {/* Feature cards */}
      {!result && (
        <section className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto animate-slide-up" style={{ animationDelay: "200ms" }}>
          {[
            {
              icon: Zap,
              title: "Instant Speed",
              desc: "Run up to 100,000 simulations in milliseconds. Results appear before you blink.",
            },
            {
              icon: Eye,
              title: "Full Transparency",
              desc: "See every calculation step. No black boxes, no hidden models. Verify the math yourself.",
            },
            {
              icon: Target,
              title: "Value Edge",
              desc: "Spot the gap between our probability and the bookmaker's implied odds. Find real value.",
            },
          ].map((card, idx) => (
            <div
              key={card.title}
              className="surface-panel p-6 space-y-3 hover:border-primary/30 transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <card.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-foreground">{card.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </section>
      )}
    </PageWrapper>
  );
}
