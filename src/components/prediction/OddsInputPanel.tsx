import { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { oddsSchema, type OddsFormData } from "@/utils/validation";
import { sliderToSimulations, simulationsToSlider, formatNumber } from "@/utils/format";
import { Flame, RotateCcw } from "lucide-react";

interface OddsInputPanelProps {
  onSubmit: (data: OddsFormData) => void;
  isLoading: boolean;
  onClear: () => void;
}

export function OddsInputPanel({ onSubmit, isLoading, onClear }: OddsInputPanelProps) {
  const [homeOdds, setHomeOdds] = useState("");
  const [drawOdds, setDrawOdds] = useState("");
  const [awayOdds, setAwayOdds] = useState("");
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [sliderValue, setSliderValue] = useState([simulationsToSlider(1000)]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const simulations = sliderToSimulations(sliderValue[0]);

  const validateField = useCallback((field: string, value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!value) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
        return;
      }
      const num = parseFloat(value);
      if (isNaN(num) || num < 1.01 || num > 1000) {
        setErrors((prev) => ({ ...prev, [field]: "Odds must be between 1.01 and 1000" }));
      } else {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    }, 300);
  }, []);

  const handleOddsInput = (setter: (v: string) => void, field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow only numbers and dots
    if (val && !/^[0-9]*\.?[0-9]*$/.test(val)) return;
    setter(val);
    validateField(field, val);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Block non-numeric keys except navigation
    if (["e", "E", "+", "-"].includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      home_odds: parseFloat(homeOdds),
      draw_odds: parseFloat(drawOdds),
      away_odds: parseFloat(awayOdds),
      simulations,
      home_team: homeTeam.trim(),
      away_team: awayTeam.trim(),
    };

    const result = oddsSchema.safeParse(data);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    onSubmit(result.data);
  };

  const handleReset = () => {
    setHomeOdds("");
    setDrawOdds("");
    setAwayOdds("");
    setHomeTeam("");
    setAwayTeam("");
    setSliderValue([simulationsToSlider(1000)]);
    setErrors({});
    onClear();
  };

  return (
    <form onSubmit={handleSubmit} className="dashboard-tile p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-lg text-foreground">Fixture Input</h2>
          <p className="text-xs text-muted-foreground">Teams, market odds, and simulation depth</p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          aria-label="Reset form"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* Team names (optional) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="home-team" className="text-muted-foreground text-xs uppercase tracking-wider">
            Home Team
          </Label>
          <Input
            id="home-team"
            placeholder="e.g. Arsenal"
            value={homeTeam}
            onChange={(e) => setHomeTeam(e.target.value)}
            maxLength={100}
            className="bg-background border-border focus:border-primary"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="away-team" className="text-muted-foreground text-xs uppercase tracking-wider">
            Away Team
          </Label>
          <Input
            id="away-team"
            placeholder="e.g. Chelsea"
            value={awayTeam}
            onChange={(e) => setAwayTeam(e.target.value)}
            maxLength={100}
            className="bg-background border-border focus:border-primary"
          />
        </div>
      </div>

      {/* Odds inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Home Win", value: homeOdds, setter: setHomeOdds, field: "home_odds" },
          { label: "Draw", value: drawOdds, setter: setDrawOdds, field: "draw_odds" },
          { label: "Away Win", value: awayOdds, setter: setAwayOdds, field: "away_odds" },
        ].map(({ label, value, setter, field }) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={field} className="text-muted-foreground text-xs uppercase tracking-wider">
              {label}
            </Label>
            <Input
              id={field}
              type="text"
              inputMode="decimal"
              placeholder="1.50"
              value={value}
              onChange={handleOddsInput(setter, field)}
              onKeyDown={handleKeyDown}
              className={`bg-[#fbfbfc] font-mono text-center text-lg h-12 ${
                errors[field] ? "border-destructive focus:border-destructive" : "border-border focus:border-primary"
              }`}
              aria-invalid={!!errors[field]}
              aria-describedby={errors[field] ? `${field}-error` : undefined}
            />
            {errors[field] && (
              <p id={`${field}-error`} className="text-destructive text-xs mt-1">
                {errors[field]}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Simulation slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">Simulations</Label>
          <span className="font-mono text-sm text-foreground">{formatNumber(simulations)}</span>
        </div>
        <Slider
          value={sliderValue}
          onValueChange={setSliderValue}
          min={0}
          max={1}
          step={0.01}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>100</span>
          <span>1K</span>
          <span>10K</span>
          <span>100K</span>
        </div>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        disabled={isLoading || !homeOdds || !drawOdds || !awayOdds}
        className="w-full h-12 bg-[#111827] text-white hover:bg-[#1f2937] font-display font-semibold text-base transition-all active:scale-[0.98]"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            Simulating...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Flame className="h-5 w-5" />
            Run Prediction
          </span>
        )}
      </Button>
    </form>
  );
}
