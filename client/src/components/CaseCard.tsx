import { FileText, Calendar, User, CheckCircle2, Clock, MoreVertical, Mail, Download, UserPlus, Eye, Headphones } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CaseCardProps {
  id: string;
  title: string;
  clientName: string;
  meetingDate: string;
  status: "completed" | "processing" | "pending";
  createdBy: string;
  priority?: "urgent" | "deadline-soon" | "normal";
  audioExpiresIn?: number;
}

export default function CaseCard({ 
  id, 
  title, 
  clientName, 
  meetingDate, 
  status, 
  createdBy,
  priority = "normal",
  audioExpiresIn
}: CaseCardProps) {
  const statusConfig = {
    completed: { icon: CheckCircle2, label: "Completed", variant: "default" as const },
    processing: { icon: Clock, label: "Processing", variant: "secondary" as const },
    pending: { icon: Clock, label: "Pending", variant: "outline" as const },
  };

  const priorityConfig = {
    urgent: { color: "bg-destructive", label: "Action Required" },
    "deadline-soon": { color: "bg-amber-500", label: "Deadline Approaching" },
    normal: { color: "bg-green-500", label: "Completed" },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const getAudioBadgeColor = () => {
    if (!audioExpiresIn) return "";
    if (audioExpiresIn <= 2) return "bg-destructive";
    if (audioExpiresIn <= 6) return "bg-amber-500";
    return "bg-primary";
  };

  const handleAction = (action: string, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log(`${action} action for case ${id}`);
  };

  return (
    <Card className="hover-elevate active-elevate-2 cursor-pointer relative" data-testid={`card-case-${id}`}>
      {priority !== "normal" && (
        <div className={`absolute -top-2 -right-2 w-3 h-3 rounded-full ${priorityConfig[priority].color} ring-2 ring-background`} 
             data-testid={`badge-priority-${priority}`} />
      )}
      
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-start gap-2 mb-1">
              <h3 className="text-lg font-semibold text-foreground">{title}</h3>
              {priority !== "normal" && (
                <Badge className={`${priorityConfig[priority].color} text-xs`}>
                  {priorityConfig[priority].label}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{clientName}</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={config.variant} className="gap-1">
              <StatusIcon className="w-3 h-3" />
              {config.label}
            </Badge>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-actions-${id}`}>
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => handleAction('email', e)} data-testid={`action-email-${id}`}>
                  <Mail className="w-4 h-4 mr-2" />
                  Email to Client
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => handleAction('review', e)} data-testid={`action-review-${id}`}>
                  <Eye className="w-4 h-4 mr-2" />
                  Mark as Reviewed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => handleAction('download', e)} data-testid={`action-download-${id}`}>
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => handleAction('assign', e)} data-testid={`action-assign-${id}`}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Assign to Team Member
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
          {audioExpiresIn !== undefined && (
            <div className="flex items-center gap-2">
              <Badge className={`${getAudioBadgeColor()} gap-1 text-xs`} data-testid={`badge-audio-${id}`}>
                <Headphones className="w-3 h-3" />
                Audio expires in {audioExpiresIn}h
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
