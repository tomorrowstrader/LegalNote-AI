import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExpandableSectionProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  maxHeight?: string;
  className?: string;
  expandButtonTestId?: string;
}

export function ExpandableSection({ 
  title, 
  icon, 
  children, 
  maxHeight = "300px",
  className,
  expandButtonTestId = "button-expand-section"
}: ExpandableSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <div className={cn("relative", className)}>
        <ScrollArea 
          className="rounded-md" 
          style={{ maxHeight }}
        >
          {children}
        </ScrollArea>
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-0 right-0 h-7 w-7 opacity-60 hover:opacity-100"
          onClick={() => setIsExpanded(true)}
          data-testid={expandButtonTestId}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {icon}
              {title}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="py-2">
              {children}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ExpandButton({ 
  onClick, 
  testId = "button-expand" 
}: { 
  onClick: () => void; 
  testId?: string;
}) {
  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-7 w-7 opacity-60 hover:opacity-100"
      onClick={onClick}
      data-testid={testId}
    >
      <Maximize2 className="h-4 w-4" />
    </Button>
  );
}
