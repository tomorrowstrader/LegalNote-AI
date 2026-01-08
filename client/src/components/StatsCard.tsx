import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState, useRef } from "react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  suffix?: string;
  animate?: boolean;
  variant?: "default" | "ring";
  ringColor?: "emerald" | "blue" | "amber" | "primary";
}

function useCountUp(end: number, duration: number = 1000, enabled: boolean = true, decimals: number = 0) {
  const [count, setCount] = useState(0);
  const startTime = useRef<number | null>(null);
  const frameRef = useRef<number>();

  useEffect(() => {
    if (!enabled || typeof end !== 'number' || isNaN(end)) {
      setCount(end);
      return;
    }

    setCount(0);
    startTime.current = null;

    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const progress = Math.min((timestamp - startTime.current) / duration, 1);
      
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const multiplier = Math.pow(10, decimals);
      setCount(Math.round(eased * end * multiplier) / multiplier);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [end, duration, enabled, decimals]);

  return count;
}

function ProgressRing({ 
  value, 
  size = 48, 
  strokeWidth = 4,
  color = "emerald"
}: { 
  value: number; 
  size?: number; 
  strokeWidth?: number;
  color?: "emerald" | "blue" | "amber" | "primary";
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;
  
  const colorClasses = {
    emerald: "stroke-emerald-500",
    blue: "stroke-blue-500",
    amber: "stroke-amber-500",
    primary: "stroke-primary",
  };

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        fill="none"
        className="stroke-muted/30"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        className={`${colorClasses[color]} transition-all duration-1000 ease-out`}
        style={{
          strokeDasharray: circumference,
          strokeDashoffset: offset,
        }}
      />
    </svg>
  );
}

export default function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  trend,
  trendValue,
  suffix,
  animate = true,
  variant = "default",
  ringColor = "emerald"
}: StatsCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const numericValue = typeof value === 'number' ? value : parseFloat(value as string);
  const isNumeric = typeof value === 'number' || !isNaN(numericValue);
  const hasDecimals = isNumeric && numericValue !== Math.floor(numericValue);
  const animatedValue = useCountUp(isNumeric ? numericValue : 0, 800, animate && isVisible && isNumeric, hasDecimals ? 1 : 0);

  const displayValue = isNumeric ? (hasDecimals ? animatedValue.toFixed(1) : animatedValue) : value;

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground';

  if (variant === "ring") {
    return (
      <Card 
        ref={cardRef}
        className={`group relative overflow-visible transition-all duration-500 hover:-translate-y-0.5 hover:shadow-lg dark:border-[hsl(45,85%,55%,0.15)] dark:shadow-[0_4px_20px_rgba(0,0,20,0.4),inset_0_1px_0_rgba(216,172,74,0.08)] ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
        data-testid={`card-stat-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <ProgressRing value={isNumeric ? animatedValue : 0} size={56} strokeWidth={5} color={ringColor} />
              <div className="absolute inset-0 flex items-center justify-center">
                <Icon className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
              <div className="flex items-baseline gap-1">
                <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {displayValue}
                </p>
                {suffix && (
                  <span className="text-base font-medium text-muted-foreground">{suffix}</span>
                )}
              </div>
              {description && (
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      ref={cardRef}
      className={`group relative overflow-visible transition-all duration-500 hover:-translate-y-0.5 hover:shadow-lg dark:border-[hsl(45,85%,55%,0.15)] dark:shadow-[0_4px_20px_rgba(0,0,20,0.4),inset_0_1px_0_rgba(216,172,74,0.08)] ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      data-testid={`card-stat-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted dark:bg-[hsl(220,60%,15%)] border border-border/50 dark:border-[hsl(45,85%,55%,0.1)]">
              <Icon className="w-4 h-4 text-muted-foreground dark:text-[hsl(45,85%,65%)]" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
          </div>
          {trend && (
            <div className={`flex items-center gap-1 ${trendColor}`}>
              <TrendIcon className="w-3.5 h-3.5" />
              {trendValue && <span className="text-xs font-medium">{trendValue}</span>}
            </div>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <p className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            {displayValue}
          </p>
          {suffix && (
            <span className="text-lg font-medium text-muted-foreground">{suffix}</span>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-2">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
