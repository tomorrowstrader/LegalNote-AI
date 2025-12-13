import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ListTodo, 
  Sparkles, 
  User, 
  Calendar, 
  Loader2, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ActionItem } from "@shared/schema";

interface ActionItemsViewerProps {
  caseId: string;
  hasTranscript: boolean;
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case 'high':
      return <Badge variant="destructive" className="text-xs">High</Badge>;
    case 'medium':
      return <Badge variant="secondary" className="text-xs">Medium</Badge>;
    case 'low':
      return <Badge variant="outline" className="text-xs">Low</Badge>;
    default:
      return <Badge variant="secondary" className="text-xs">{priority}</Badge>;
  }
}

export default function ActionItemsViewer({ caseId, hasTranscript }: ActionItemsViewerProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const { toast } = useToast();
  
  const { data: items, isLoading } = useQuery<ActionItem[]>({
    queryKey: [`/api/cases/${caseId}/action-items`],
  });

  const extractMutation = useMutation({
    mutationFn: async () => {
      setIsExtracting(true);
      const response = await apiRequest('POST', `/api/cases/${caseId}/extract-action-items`);
      return response;
    },
    onSuccess: (data: any) => {
      setIsExtracting(false);
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/action-items`] });
      toast({
        title: "Action Items Extracted",
        description: `Found ${data.items?.length || 0} action items from the transcript.`,
      });
    },
    onError: (error: any) => {
      setIsExtracting(false);
      toast({
        title: "Extraction Failed",
        description: error.message || "Failed to extract action items",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      return await apiRequest('PATCH', `/api/action-items/${id}`, { completed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/action-items`] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update action item",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/action-items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/action-items`] });
      toast({
        title: "Action Item Deleted",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete action item",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ListTodo className="w-4 h-4" />
            Action Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const completedCount = items?.filter(i => i.completed).length || 0;
  const totalCount = items?.length || 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ListTodo className="w-4 h-4" />
            Action Items
          </CardTitle>
          <div className="flex items-center gap-2">
            {totalCount > 0 && (
              <Badge variant="secondary" data-testid="badge-action-item-count">
                {completedCount}/{totalCount}
              </Badge>
            )}
            {hasTranscript && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => extractMutation.mutate()}
                disabled={isExtracting}
                data-testid="button-extract-action-items"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-1" />
                    Extract
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {(!items || items.length === 0) ? (
          <div className="text-center py-6 text-muted-foreground">
            <ListTodo className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No action items found.</p>
            {hasTranscript && (
              <p className="text-xs mt-1">Click "Extract" to find action items from the transcript.</p>
            )}
          </div>
        ) : (
          <>
            {items.map((item, idx) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border bg-card transition-opacity",
                  item.completed && "opacity-60"
                )}
                data-testid={`action-item-${idx}`}
              >
                <Checkbox
                  checked={item.completed}
                  onCheckedChange={(checked) => {
                    toggleMutation.mutate({ id: item.id, completed: !!checked });
                  }}
                  disabled={toggleMutation.isPending}
                  className="mt-0.5"
                  data-testid={`checkbox-action-item-${idx}`}
                />
                
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm",
                    item.completed && "line-through text-muted-foreground"
                  )}>
                    {item.description}
                  </p>
                  
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {getPriorityBadge(item.priority)}
                    
                    {item.assignee && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="w-3 h-3" />
                        {item.assignee}
                      </div>
                    )}
                    
                    {item.dueDate && (
                      <div className={cn(
                        "flex items-center gap-1 text-xs",
                        new Date(item.dueDate) < new Date() && !item.completed
                          ? "text-destructive"
                          : "text-muted-foreground"
                      )}>
                        <Calendar className="w-3 h-3" />
                        {format(new Date(item.dueDate), "dd MMM yyyy")}
                      </div>
                    )}
                    
                    {item.completed && item.completedAt && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400" />
                        Completed {format(new Date(item.completedAt), "dd MMM")}
                      </div>
                    )}
                  </div>
                </div>
                
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:opacity-100"
                  onClick={() => deleteMutation.mutate(item.id)}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-action-item-${idx}`}
                >
                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
