import { FileText, Calendar, User, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CaseCardProps {
  id: string;
  title: string;
  clientName: string;
  meetingDate: string;
  status: "completed" | "processing" | "pending";
  createdBy: string;
}

export default function CaseCard({ id, title, clientName, meetingDate, status, createdBy }: CaseCardProps) {
  const statusConfig = {
    completed: { icon: CheckCircle2, label: "Completed", variant: "default" as const },
    processing: { icon: Clock, label: "Processing", variant: "secondary" as const },
    pending: { icon: Clock, label: "Pending", variant: "outline" as const },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <Card className="hover-elevate active-elevate-2 cursor-pointer" data-testid={`card-case-${id}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
            <p className="text-sm text-muted-foreground">{clientName}</p>
          </div>
          <Badge variant={config.variant} className="gap-1">
            <StatusIcon className="w-3 h-3" />
            {config.label}
          </Badge>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{meetingDate}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="w-4 h-4" />
            <span>{createdBy}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
