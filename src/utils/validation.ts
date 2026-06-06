import { z } from "zod";

export const oddsSchema = z.object({
  home_odds: z
    .number({ invalid_type_error: "Must be a number" })
    .min(1.01, "Minimum odds: 1.01")
    .max(1000, "Maximum odds: 1000"),
  draw_odds: z
    .number({ invalid_type_error: "Must be a number" })
    .min(1.01, "Minimum odds: 1.01")
    .max(1000, "Maximum odds: 1000"),
  away_odds: z
    .number({ invalid_type_error: "Must be a number" })
    .min(1.01, "Minimum odds: 1.01")
    .max(1000, "Maximum odds: 1000"),
  simulations: z
    .number()
    .int()
    .min(100, "Minimum 100 simulations")
    .max(100000, "Maximum 100,000 simulations"),
  home_team: z.string().max(100).default(""),
  away_team: z.string().max(100).default(""),
});

export type OddsFormData = z.infer<typeof oddsSchema>;
