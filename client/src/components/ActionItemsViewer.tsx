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
  CheckCircle2,
  Trash2,
  ShieldCheck,
  FileEdit,
  Plus,
  PenLine,
  X,
  Maximize2,
  Scale,
  Users,
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

type ObligationParty = "solicitor" | "client";

function isClientAssignee(assignee: string | null | undefined): boolean {
  if (!assignee) return false;
  return /\bclient\b/i.test(assignee.trim());
}

function getObligationParty(item: ActionItem): ObligationParty {
  return isClientAssignee(item.assignee) ? "client" : "solicitor";
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

function ObligationItemRow({
  item,
  idx,
  testIdPrefix,
  onToggle,
  onApprove,
  onDelete,
  togglePending,
  approvePending,
  deletePending,
  compact = false,
}: {
  item: ActionItem;
  idx: number;
  testIdPrefix: string;
  onToggle: (id: string, completed: boolean) => void;
  onApprove: (id: string) => void;
  onDelete?: (id: string) => void;
  togglePending: boolean;
  approvePending: boolean;
  deletePending?: boolean;
  compact?: boolean;
}) {
  const status = (item as any).status as string | null;
  const showSpecificAssignee =
    !!item.assignee &&
    !/^solicitor$/i.test(item.assignee.trim()) &&
    !/^client$/i.test(item.assignee.trim());

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border bg-card transition-opacity group",
        item.completed && "opacity-60",
        compact && item.completed && "bg-muted/50"
      )}
      data-testid={`${testIdPrefix}-${idx}`}
    >
      <Checkbox
        checked={item.completed}
        onCheckedChange={(checked) => onToggle(item.id, !!checked)}
        disabled={togglePending || status !== 'approved'}
        className="mt-0.5"
        title={status !== 'approved' ? "Approve this item first before marking as complete" : undefined}
        data-testid={`checkbox-${testIdPrefix}-${idx}`}
      />

      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm",
          item.completed && "line-through text-muted-foreground"
        )}>
          {item.description}
        </p>

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {getStatusBadge(status)}
          {getPriorityBadge(item.priority)}

          {(item as any).isManual && (
            <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">
              <PenLine className="w-3 h-3 mr-1" />
              Manual
            </Badge>
          )}

          {showSpecificAssignee && (
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

          {status === 'approved' && (item as any).approvedAt && (
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

      {!compact && (
        <div className="flex items-center gap-1">
          {status !== 'approved' && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => onApprove(item.id)}
              disabled={approvePending}
              title="Approve this obligation"
              data-testid={`button-approve-${testIdPrefix}-${idx}`}
            >
              <ShieldCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
            </Button>
          )}
          {onDelete && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:opacity-100"
              onClick={() => onDelete(item.id)}
              disabled={deletePending}
              data-testid={`button-delete-${testIdPrefix}-${idx}`}
            >
              <Trash2 className="w-4 h-4 text-muted-foreground" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ObligationColumn({
  title,
  subtitle,
  icon: Icon,
  items,
  emptyLabel,
  testIdPrefix,
  onToggle,
  onApprove,
  onDelete,
  togglePending,
  approvePending,
  deletePending,
}: {
  title: string;
  subtitle: string;
  icon: typeof Scale;
  items: ActionItem[];
  emptyLabel: string;
  testIdPrefix: string;
  onToggle: (id: string, completed: boolean) => void;
  onApprove: (id: string) => void;
  onDelete: (id: string) => void;
  togglePending: boolean;
  approvePending: boolean;
  deletePending: boolean;
}) {
  const completedCount = items.filter((i) => i.completed).length;

  return (
    <div
      className="flex flex-col min-w-0 rounded-lg border bg-muted/20"
      data-testid={`column-${testIdPrefix}`}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b bg-muted/40 rounded-t-lg">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
            <h3 className="text-sm font-semibold truncate">{title}</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 pl-6">{subtitle}</p>
        </div>
        <Badge variant="secondary" className="shrink-0 text-xs" data-testid={`badge-${testIdPrefix}-count`}>
          {completedCount}/{items.length}
        </Badge>
      </div>

      <ScrollArea className="h-[320px]">
        <div className="space-y-2 p-3">
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Icon className="w-7 h-7 mx-auto mb-2 opacity-40" />
              <p className="text-xs">{emptyLabel}</p>
            </div>
          ) : (
            items.map((item, idx) => (
              <ObligationItemRow
                key={item.id}
                item={item}
                idx={idx}
                testIdPrefix={testIdPrefix}
                onToggle={onToggle}
                onApprove={onApprove}
                onDelete={onDelete}
                togglePending={togglePending}
                approvePending={approvePending}
                deletePending={deletePending}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function ActionItemsViewer({ caseId, hasTranscript }: ActionItemsViewerProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [newAssignee, setNewAssignee] = useState<"Solicitor" | "Client">("Solicitor");
  const [newPriority, setNewPriority] = useState("medium");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();
  const actionItemsQueryKey = [`/api/cases/${caseId}/action-items`] as const;
  
  const { data: items, isLoading } = useQuery<ActionItem[]>({
    queryKey: actionItemsQueryKey,
  });

  const markItemsApproved = (current: ActionItem[] | undefined, ids: Set<string>) => {
    if (!current) return current;
    const approvedAt = new Date().toISOString();
    return current.map((item) =>
      ids.has(item.id)
        ? { ...item, status: 'approved', approvedAt } as ActionItem
        : item
    );
  };

  const extractMutation = useMutation({
    mutationFn: async () => {
      setIsExtracting(true);
      const response = await apiRequest('POST', `/api/cases/${caseId}/extract-action-items`);
      return response;
    },
    onSuccess: (data: any) => {
      setIsExtracting(false);
      queryClient.invalidateQueries({ queryKey: actionItemsQueryKey });
      toast({
        title: "Obligations Extracted",
        description: `Found ${data.items?.length || 0} obligations from the transcript.`,
      });
    },
    onError: (error: any) => {
      setIsExtracting(false);
      toast({
        title: "Extraction Failed",
        description: error.message || "Failed to extract obligations",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      return await apiRequest('PATCH', `/api/action-items/${id}`, { completed });
    },
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: actionItemsQueryKey });
      const previous = queryClient.getQueryData<ActionItem[]>(actionItemsQueryKey);
      queryClient.setQueryData<ActionItem[]>(actionItemsQueryKey, (current) =>
        current?.map((item) =>
          item.id === id
            ? {
                ...item,
                completed,
                completedAt: completed ? new Date().toISOString() : null,
              } as ActionItem
            : item
        )
      );
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: actionItemsQueryKey });
    },
    onError: (error: any, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(actionItemsQueryKey, context.previous);
      }
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update obligation",
        variant: "destructive",
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('PATCH', `/api/action-items/${id}`, { status: 'approved' });
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: actionItemsQueryKey });
      const previous = queryClient.getQueryData<ActionItem[]>(actionItemsQueryKey);
      queryClient.setQueryData<ActionItem[]>(actionItemsQueryKey, (current) =>
        markItemsApproved(current, new Set([id]))
      );
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: actionItemsQueryKey });
      toast({
        title: "Obligation Approved",
        description: "The obligation has been approved and is now part of the case record.",
      });
    },
    onError: (error: any, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(actionItemsQueryKey, context.previous);
      }
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve obligation",
        variant: "destructive",
      });
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest<{ success: boolean; approvedCount: number; items?: ActionItem[] }>(
        'POST',
        `/api/cases/${caseId}/action-items/approve-all`
      );
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: actionItemsQueryKey });
      const previous = queryClient.getQueryData<ActionItem[]>(actionItemsQueryKey);
      const pendingIds = new Set(
        (previous || [])
          .filter((item) => (item as any).status !== 'approved')
          .map((item) => item.id)
      );
      queryClient.setQueryData<ActionItem[]>(actionItemsQueryKey, (current) =>
        markItemsApproved(current, pendingIds)
      );
      return { previous, pendingCount: pendingIds.size };
    },
    onSuccess: (data, _vars, context) => {
      if (data.items?.length) {
        const approvedById = new Map(data.items.map((item) => [item.id, item]));
        queryClient.setQueryData<ActionItem[]>(actionItemsQueryKey, (current) =>
          current?.map((item) => approvedById.get(item.id) ?? item)
        );
      }
      queryClient.invalidateQueries({ queryKey: actionItemsQueryKey });
      toast({
        title: "Obligations Approved",
        description: `${data.approvedCount || context?.pendingCount || 0} obligations have been approved.`,
      });
    },
    onError: (error: any, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(actionItemsQueryKey, context.previous);
      }
      toast({
        title: "Bulk Approval Failed",
        description: error.message || "Failed to approve obligations",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/action-items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: actionItemsQueryKey });
      toast({
        title: "Obligation Deleted",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete obligation",
        variant: "destructive",
      });
    },
  });

  const createManualMutation = useMutation({
    mutationFn: async (data: { description: string; assignee?: string; priority?: string }) => {
      return await apiRequest('POST', `/api/cases/${caseId}/action-items/manual`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: actionItemsQueryKey });
      setShowAddForm(false);
      setNewDescription("");
      setNewAssignee("Solicitor");
      setNewPriority("medium");
      toast({
        title: "Obligation Created",
        description: "The obligation has been added as a draft.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create obligation",
        variant: "destructive",
      });
    },
  });

  const handleAddActionItem = () => {
    if (!newDescription.trim()) return;
    createManualMutation.mutate({
      description: newDescription.trim(),
      assignee: newAssignee,
      priority: newPriority,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ListTodo className="w-4 h-4" />
            Obligations
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
  const solicitorItems = (items || []).filter((item) => getObligationParty(item) === "solicitor");
  const clientItems = (items || []).filter((item) => getObligationParty(item) === "client");

  const handleToggle = (id: string, completed: boolean) => {
    toggleMutation.mutate({ id, completed });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ListTodo className="w-4 h-4" />
            Obligations
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {totalCount > 0 && (
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" data-testid="badge-action-item-count">
                  {completedCount}/{totalCount} complete
                </Badge>
                {approvedCount > 0 && (
                  <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800" data-testid="badge-approved-count">
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    {approvedCount}/{totalCount} approved
                  </Badge>
                )}
                {draftItems.length > 0 && (
                  <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800" data-testid="badge-draft-count">
                    <FileEdit className="w-3 h-3 mr-1" />
                    {draftItems.length} draft
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
            {hasTranscript && totalCount === 0 && (
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
      <CardContent className="space-y-3">
        {showAddForm && (
          <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <PenLine className="w-4 h-4" />
              Add Manual Obligation
            </div>
            <div className="space-y-2">
              <div>
                <Label htmlFor="new-description" className="text-xs text-muted-foreground">Description</Label>
                <Input
                  id="new-description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Enter obligation description..."
                  data-testid="input-new-action-description"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <div className="flex-1 min-w-[140px]">
                  <Label htmlFor="new-assignee" className="text-xs text-muted-foreground">Assigned to</Label>
                  <Select
                    value={newAssignee}
                    onValueChange={(value: "Solicitor" | "Client") => setNewAssignee(value)}
                  >
                    <SelectTrigger id="new-assignee" data-testid="select-new-action-assignee">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Solicitor">Solicitor</SelectItem>
                      <SelectItem value="Client">Client</SelectItem>
                    </SelectContent>
                  </Select>
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
            <p className="text-sm">No obligations found.</p>
            {hasTranscript && (
              <p className="text-xs mt-1">Click "Extract" to identify obligations from the transcript.</p>
            )}
            <p className="text-xs mt-1">Or click "Add" to create one manually.</p>
          </div>
        )}

        {items && items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ObligationColumn
              title="Solicitor Obligations"
              subtitle="Actions for the fee earner / firm"
              icon={Scale}
              items={solicitorItems}
              emptyLabel="No solicitor obligations"
              testIdPrefix="solicitor-obligation"
              onToggle={handleToggle}
              onApprove={(id) => approveMutation.mutate(id)}
              onDelete={(id) => deleteMutation.mutate(id)}
              togglePending={toggleMutation.isPending}
              approvePending={approveMutation.isPending}
              deletePending={deleteMutation.isPending}
            />
            <ObligationColumn
              title="Client Obligations"
              subtitle="Actions for the client"
              icon={Users}
              items={clientItems}
              emptyLabel="No client obligations"
              testIdPrefix="client-obligation"
              onToggle={handleToggle}
              onApprove={(id) => approveMutation.mutate(id)}
              onDelete={(id) => deleteMutation.mutate(id)}
              togglePending={toggleMutation.isPending}
              approvePending={approveMutation.isPending}
              deletePending={deleteMutation.isPending}
            />
          </div>
        )}
      </CardContent>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col" data-testid="modal-action-items-expanded">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListTodo className="w-4 h-4" />
              Obligations
              {items && items.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {items.filter(i => i.completed).length}/{items.length} complete
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-0 overflow-hidden">
            <ObligationColumn
              title="Solicitor Obligations"
              subtitle="Actions for the fee earner / firm"
              icon={Scale}
              items={solicitorItems}
              emptyLabel="No solicitor obligations"
              testIdPrefix="modal-solicitor-obligation"
              onToggle={handleToggle}
              onApprove={(id) => approveMutation.mutate(id)}
              onDelete={(id) => deleteMutation.mutate(id)}
              togglePending={toggleMutation.isPending}
              approvePending={approveMutation.isPending}
              deletePending={deleteMutation.isPending}
            />
            <ObligationColumn
              title="Client Obligations"
              subtitle="Actions for the client"
              icon={Users}
              items={clientItems}
              emptyLabel="No client obligations"
              testIdPrefix="modal-client-obligation"
              onToggle={handleToggle}
              onApprove={(id) => approveMutation.mutate(id)}
              onDelete={(id) => deleteMutation.mutate(id)}
              togglePending={toggleMutation.isPending}
              approvePending={approveMutation.isPending}
              deletePending={deleteMutation.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
