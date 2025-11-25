import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
}

export default function StatsCard({ title, value, icon: Icon, description }: StatsCardProps) {
  return (
    <Card 
      className="group relative overflow-visible transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:border-[hsl(45,85%,55%,0.15)] dark:shadow-[0_4px_20px_rgba(0,0,20,0.4),inset_0_1px_0_rgba(216,172,74,0.08)]"
      data-testid={`card-stat-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted dark:bg-[hsl(220,60%,15%)] border border-border/50 dark:border-[hsl(45,85%,55%,0.1)]">
            <Icon className="w-4 h-4 text-muted-foreground dark:text-[hsl(45,85%,65%)]" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
        </div>
        <p className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">{value}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-2">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
