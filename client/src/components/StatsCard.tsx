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
    <Card data-testid={`card-stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-1 sm:mb-2">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">{title}</p>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary dark:text-primary-foreground" />
        </div>
        <p className="text-2xl sm:text-3xl font-semibold text-foreground">{value}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-1 sm:mt-2">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
