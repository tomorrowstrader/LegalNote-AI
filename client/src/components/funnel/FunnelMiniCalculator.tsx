import { useState } from "react";
import { motion } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Clock } from "lucide-react";

const LEGALNOTE_MONTHLY = 199;
const EFFICIENCY = 0.7;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function FunnelMiniCalculator() {
  const [hourlyRate, setHourlyRate] = useState(200);
  const [docHours, setDocHours] = useState(8);

  const hoursPerYear = docHours * EFFICIENCY * 48;
  const valuePerYear = hoursPerYear * hourlyRate;
  const paybackDays = Math.max(
    1,
    Math.ceil((LEGALNOTE_MONTHLY / (valuePerYear / 12)) * 30),
  );

  return (
    <div className="funnel-glass-card w-full max-w-md mx-auto p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-6">
        <Clock className="h-4 w-4 text-[hsl(18,70%,42%)]" />
        <span className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
          Time back for growth
        </span>
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex justify-between text-sm mb-3">
            <span className="text-muted-foreground">Hourly rate</span>
            <span className="font-semibold tabular-nums">{formatCurrency(hourlyRate)}</span>
          </div>
          <Slider
            min={100}
            max={400}
            step={25}
            value={[hourlyRate]}
            onValueChange={(v) => setHourlyRate(v[0])}
            className="funnel-slider"
          />
        </div>

        <div>
          <div className="flex justify-between text-sm mb-3">
            <span className="text-muted-foreground">Weekly hours on attendance notes</span>
            <span className="font-semibold tabular-nums">{docHours}h</span>
          </div>
          <Slider
            min={3}
            max={20}
            step={1}
            value={[docHours]}
            onValueChange={(v) => setDocHours(v[0])}
            className="funnel-slider"
          />
        </div>
      </div>

      <motion.div
        layout
        className="mt-8 pt-6 border-t border-border/60 text-center"
      >
        <p className="text-sm text-muted-foreground mb-1">Hours reclaimed per year</p>
        <p className="text-5xl sm:text-6xl font-bold tracking-tight text-foreground tabular-nums">
          {Math.round(hoursPerYear)}
          <span className="text-2xl font-medium text-muted-foreground ml-1">hrs</span>
        </p>
        <p className="text-xs text-muted-foreground mt-3 max-w-xs mx-auto leading-relaxed">
          That's {formatCurrency(valuePerYear)} in capacity — for clients, new business, or training your team. Pays back in {paybackDays} days.
        </p>
      </motion.div>
    </div>
  );
}
