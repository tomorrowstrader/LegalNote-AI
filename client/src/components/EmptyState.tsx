import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-12 md:py-16 px-4 text-center" data-testid="container-empty-state">
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-muted flex items-center justify-center mb-3 sm:mb-4">
        <Icon className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
      </div>
      <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">{title}</h3>
      <p className="text-xs sm:text-sm text-muted-foreground max-w-md mb-4 sm:mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="bg-accent hover:bg-accent" data-testid="button-empty-action">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
