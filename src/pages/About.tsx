import { PageWrapper } from "@/components/layout/PageWrapper";
import { Shield, Code, Cpu, Globe } from "lucide-react";
import ignitionLogo from "@/assets/ignition-logo.png";

export default function AboutPage() {
  return (
    <PageWrapper>
      <div className="max-w-3xl mx-auto space-y-12 animate-slide-up">
        {/* Header */}
        <div className="text-center space-y-4">
          <img src={ignitionLogo} alt="Ignition" className="h-16 w-16 rounded-xl mx-auto" />
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-foreground">
            About Ignition
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-xl mx-auto">
            A mathematical football match prediction engine built by Prometheus Corporation. 
            No opinions. No hunches. Just probability theory and simulation.
          </p>
        </div>

        {/* How it works */}
        <section className="space-y-4">
          <h2 className="font-display font-bold text-xl text-foreground">How It Works</h2>
          <div className="surface-panel p-6 space-y-4 text-sm text-foreground/80 leading-relaxed">
            <p>
              Ignition converts bookmaker decimal odds into implied probabilities using the formula 
              <code className="font-mono bg-background rounded px-1.5 py-0.5 mx-1 text-primary">P = 1/O</code>. 
              It then removes the bookmaker's built-in margin (overround) by normalising these probabilities to sum to 100%.
            </p>
            <p>
              With the true probability weights established, the engine runs a configurable Monte Carlo simulation — 
              generating thousands of random match outcomes weighted by these probabilities. The result is a 
              statistically stable prediction with a measurable confidence interval.
            </p>
            <p>
              The <strong>Value Edge</strong> metric shows the difference between our calculated probability and the 
              bookmaker's implied probability. A positive edge suggests the bookmaker may be undervaluing that outcome.
            </p>
          </div>
        </section>

        {/* Principles */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              icon: Code,
              title: "Open Calculation",
              desc: "Every step of the math is shown. No black boxes. Verify the probability conversion, normalisation, and simulation yourself.",
            },
            {
              icon: Shield,
              title: "Security First",
              desc: "Built with JWT RS256 auth, input validation, rate limiting, and zero client-side secrets. Security is architecture, not afterthought.",
            },
            {
              icon: Cpu,
              title: "Client-Side Fallback",
              desc: "Core simulation runs locally in your browser. No backend dependency for the calculator. Works offline-capable.",
            },
            {
              icon: Globe,
              title: "Global Coverage",
              desc: "Works with any football match from any league. Enter the odds, get the probabilities. From KPL to Champions League.",
            },
          ].map((item) => (
            <div key={item.title} className="surface-panel p-5 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <item.icon className="h-4.5 w-4.5 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-foreground">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </section>

        {/* Footer note */}
        <div className="text-center text-sm text-muted-foreground border-t border-border pt-8">
          <p>Prometheus Corporation · Built by Nzioki Dennis · March 2026</p>
        </div>
      </div>
    </PageWrapper>
  );
}
