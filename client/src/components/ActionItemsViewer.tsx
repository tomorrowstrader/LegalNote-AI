import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  ListTodo, 
  Sparkles, 
  User, 
  Calendar, 
  Loader2, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  Trash2,
  ShieldCheck,
  FileEdit,
  Plus,
  PenLine,
  X,
  Maximize2
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

function getStatusBadge(status: string | null) {
  if (status === 'approved') {
    return (
      <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
        <ShieldCheck className="w-3 h-3 mr-1" />
        Approved
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">
      <FileEdit className="w-3 h-3 mr-1" />
      Draft
    </Badge>
  );
}

export default function ActionItemsViewer({ caseId, hasTranscript }: ActionItemsViewerProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [newAssignee, setNewAssignee] = useState("Solicitor");
  const [newPriority, setNewPriority] = useState("medium");
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('PATCH', `/api/action-items/${id}`, { status: 'approved' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/action-items`] });
      toast({
        title: "Action Item Approved",
        description: "The action item has been approved and is now part of the case record.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve action item",
        variant: "destructive",
      });
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/cases/${caseId}/action-items/approve-all`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/action-items`] });
      toast({
        title: "Action Items Approved",
        description: `${data.approvedCount || 0} action items have been approved.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Bulk Approval Failed",
        description: error.message || "Failed to approve action items",
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

  const createManualMutation = useMutation({
    mutationFn: async (data: { description: string; assignee?: string; priority?: string }) => {
      return await apiRequest('POST', `/api/cases/${caseId}/action-items/manual`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/action-items`] });
      setShowAddForm(false);
      setNewDescription("");
      setNewAssignee("Solicitor");
      setNewPriority("medium");
      toast({
        title: "Action Item Created",
        description: "The action item has been added as a draft.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create action item",
        variant: "destructive",
      });
    },
  });

  const handleAddActionItem = () => {
    if (!newDescription.trim()) return;
    createManualMutation.mutate({
      description: newDescription.trim(),
      assignee: newAssignee || undefined,
      priority: newPriority,
    });
  };

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
  const draftItems = items?.filter(i => (i as any).status !== 'approved') || [];
  const approvedCount = items?.filter(i => (i as any).status === 'approved').length || 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ListTodo className="w-4 h-4" />
            Action Items
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {totalCount > 0 && (
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" data-testid="badge-action-item-count">
                  {completedCount}/{totalCount}
                </Badge>
                {approvedCount > 0 && (
                  <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800" data-testid="badge-approved-count">
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    {approvedCount} approved
                  </Badge>
                )}
              </div>
            )}
            {draftItems.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkApproveMutation.mutate()}
                disabled={bulkApproveMutation.isPending}
                data-testid="button-approve-all"
              >
                {bulkApproveMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 mr-1" />
                    Approve All ({draftItems.length})
                  </>
                )}
              </Button>
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddForm(!showAddForm)}
              data-testid="button-add-action-item"
            >
              {showAddForm ? (
                <>
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </>
              )}
            </Button>
            {items && items.length > 0 && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setIsModalOpen(true)}
                data-testid="button-expand-action-items"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {showAddForm && (
          <div className="p-3 rounded-lg border bg-muted/30 space-y-3 mb-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <PenLine className="w-4 h-4" />
              Add Manual Action Item
            </div>
            <div className="space-y-2">
              <div>
                <Label htmlFor="new-description" className="text-xs text-muted-foreground">Description</Label>
                <Input
                  id="new-description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Enter action item description..."
                  data-testid="input-new-action-description"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <div className="flex-1 min-w-[120px]">
                  <Label htmlFor="new-assignee" className="text-xs text-muted-foreground">Assignee</Label>
                  <Input
                    id="new-assignee"
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value)}
                    placeholder="Assignee name"
                    data-testid="input-new-action-assignee"
                  />
                </div>
                <div className="w-[120px]">
                  <Label htmlFor="new-priority" className="text-xs text-muted-foreground">Priority</Label>
                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger id="new-priority" data-testid="select-new-action-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewDescription("");
                  }}
                  data-testid="button-cancel-add-action"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddActionItem}
                  disabled={!newDescription.trim() || createManualMutation.isPending}
                  data-testid="button-save-action-item"
                >
                  {createManualMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-1" />
                      Add Item
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
        {(!items || items.length === 0) && !showAddForm && (
          <div className="text-center py-6 text-muted-foreground">
            <ListTodo className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No action items found.</p>
            {hasTranscript && (
              <p className="text-xs mt-1">Click "Extract" to find action items from the transcript.</p>
            )}
            <p className="text-xs mt-1">Or click "Add" to create one manually.</p>
          </div>
        )}
        {items && items.length > 0 && (
          <ScrollArea className="h-[350px]">
            <div className="space-y-2 pr-4 pb-2">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border bg-card transition-opacity group",
                  item.completed && "opacity-60"
                )}
                data-testid={`action-item-${idx}`}
              >
                <Checkbox
                  checked={item.completed}
                  onCheckedChange={(checked) => {
                    toggleMutation.mutate({ id: item.id, completed: !!checked });
                  }}
                  disabled={toggleMutation.isPending || (item as any).status !== 'approved'}
                  className="mt-0.5"
                  title={(item as any).status !== 'approved' ? "Approve this item first before marking as complete" : undefined}
                  data-testid={`checkbox-action-item-${idx}`}
                />
                
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm",
                    item.completed && "line-through text-muted-foreground"
                  )}>
                    {item.description}
                  </p>
                  
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {getStatusBadge((item as any).status)}
                    {getPriorityBadge(item.priority)}
                    
                    {(item as any).isManual && (
                      <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                        <PenLine className="w-3 h-3 mr-1" />
                        Manual
                      </Badge>
                    )}
                    
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
                    
                    {(item as any).status === 'approved' && (item as any).approvedAt && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ShieldCheck className="w-3 h-3 text-green-600 dark:text-green-400" />
                        Approved {format(new Date((item as any).approvedAt), "dd MMM")}
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
                
                <div className="flex items-center gap-1">
                  {(item as any).status !== 'approved' && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => approveMutation.mutate(item.id)}
                      disabled={approveMutation.isPending}
                      title="Approve this action item"
                      data-testid={`button-approve-action-item-${idx}`}
                    >
                      <ShieldCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </Button>
                  )}
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
              </div>
            ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col" data-testid="modal-action-items-expanded">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListTodo className="w-4 h-4" />
              Action Items
              {items && items.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {items.filter(i => i.completed).length}/{items.length}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-2 py-2">
              {items?.map((item, idx) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border",
                    item.completed && "bg-muted/50"
                  )}
                >
                  <Checkbox
                    checked={item.completed}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: item.id, completed: !!checked })}
                    disabled={toggleMutation.isPending || (item as any).status !== 'approved'}
                    title={(item as any).status !== 'approved' ? "Approve this item first before marking as complete" : undefined}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm",
                      item.completed && "line-through text-muted-foreground"
                    )}>
                      {item.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {getPriorityBadge(item.priority)}
                      {getStatusBadge((item as any).status)}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="w-3 h-3" />
                        {item.assignee}
                      </div>
                      {item.dueDate && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(item.dueDate), "dd MMM yyyy")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
