import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckCircle2, Circle, AlertCircle, Clock, ArrowUpDown,
  User, Users, ExternalLink, Filter, ChevronDown, ChevronUp
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, isToday, isTomorrow } from "date-fns";

interface ActionItem {
  id: string;
  caseId: string;
  caseTitle?: string;
  clientName?: string;
  description: string;
  assignee?: string;
  dueDate?: string;
  priority: string;
  status: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}

export default function MyActions() {
  const { toast } = useToast();
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [filterCase, setFilterCase] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("dueDate");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: actionItems = [], isLoading } = useQuery<ActionItem[]>({
    queryKey: ['/api/action-items/all'],
  });

  const completeMutation = useMutation({
    mutationFn: async ({ itemId, completed }: { itemId: string; completed: boolean }) => {
      return await apiRequest('PATCH', `/api/action-items/${itemId}`, { completed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/action-items/all'] });
      toast({ title: "Obligation updated", duration: 2000 });
    },
    onError: () => {
      toast({ title: "Failed to update obligation", variant: "destructive", duration: 3000 });
    }
  });

  const filtered = actionItems
    .filter(item => {
      if (filterAssignee !== "all" && item.assignee?.toLowerCase() !== filterAssignee) return false;
      if (filterPriority !== "all" && item.priority.toLowerCase() !== filterPriority.toLowerCase()) return false;
      if (filterStatus === "pending" && item.completed) return false;
      if (filterStatus === "completed" && !item.completed) return false;
      if (filterCase !== "all" && item.caseId !== filterCase) return false;
      if (searchTerm && !item.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "dueDate") {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (sortBy === "priority") {
        const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return (order[a.priority.toLowerCase()] ?? 1) - (order[b.priority.toLowerCase()] ?? 1);
      }
      return 0;
    });

  const uniqueCases = Array.from(
    new Map(actionItems.map(i => [i.caseId, { id: i.caseId, title: i.caseTitle || 'Unknown case' }])).values()
  );

  const priorityConfig: Record<string, { label: string; className: string }> = {
    high: { label: "High", className: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" },
    medium: { label: "Medium", className: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" },
    low: { label: "Low", className: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" },
  };

  const getDueDateLabel = (dueDate?: string, completed?: boolean) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    if (isPast(date) && !isToday(date) && !completed) {
      return { label: `Overdue · ${format(date, "d MMM")}`, className: "text-red-600 dark:text-red-400 font-medium" };
    }
    if (isToday(date)) return { label: "Due today", className: "text-amber-600 dark:text-amber-400" };
    if (isTomorrow(date)) return { label: "Due tomorrow", className: "text-amber-500 dark:text-amber-500" };
    return { label: format(date, "d MMM yyyy"), className: "text-muted-foreground" };
  };

  const stats = {
    total: actionItems.filter(i => !i.completed).length,
    overdue: actionItems.filter(i => !i.completed && i.dueDate && isPast(new Date(i.dueDate)) && !isToday(new Date(i.dueDate))).length,
    dueToday: actionItems.filter(i => !i.completed && i.dueDate && isToday(new Date(i.dueDate))).length,
    high: actionItems.filter(i => !i.completed && i.priority.toLowerCase() === 'high').length,
  };

  const handleStatClick = (statType: string) => {
    setFilterStatus("pending");
    setFilterAssignee("all");
    setFilterCase("all");
    setSearchTerm("");

    if (statType === "total") {
      setFilterPriority("all");
      setSortBy("dueDate");
    } else if (statType === "overdue") {
      setFilterPriority("all");
      setSortBy("dueDate");
    } else if (statType === "dueToday") {
      setFilterPriority("all");
      setSortBy("dueDate");
    } else if (statType === "high") {
      setFilterPriority("high");
      setSortBy("priority");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">My Obligations</h1>
        <p className="text-sm text-muted-foreground mt-1">All outstanding obligations across your matters</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card
          className="cursor-pointer transition-all hover-elevate"
          onClick={() => handleStatClick("total")}
          data-testid="stat-card-total"
        >
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground mt-1">Pending</div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer transition-all hover-elevate"
          onClick={() => handleStatClick("overdue")}
          data-testid="stat-card-overdue"
        >
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.overdue}</div>
            <div className="text-xs text-muted-foreground mt-1">Overdue</div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer transition-all hover-elevate"
          onClick={() => handleStatClick("dueToday")}
          data-testid="stat-card-due-today"
        >
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.dueToday}</div>
            <div className="text-xs text-muted-foreground mt-1">Due today</div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer transition-all hover-elevate"
          onClick={() => handleStatClick("high")}
          data-testid="stat-card-high-priority"
        >
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">{stats.high}</div>
            <div className="text-xs text-muted-foreground mt-1">High priority</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filter:</span>
            </div>
            <Input
              placeholder="Search obligations..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-48 h-8 text-sm"
              data-testid="input-search-obligations"
            />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32 h-8 text-sm" data-testid="select-filter-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All items</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="w-36 h-8 text-sm" data-testid="select-filter-assignee">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All assignees</SelectItem>
                <SelectItem value="solicitor">Solicitor</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-32 h-8 text-sm" data-testid="select-filter-priority">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            {uniqueCases.length > 1 && (
              <Select value={filterCase} onValueChange={setFilterCase}>
                <SelectTrigger className="w-44 h-8 text-sm" data-testid="select-filter-case">
                  <SelectValue placeholder="Case" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cases</SelectItem>
                  {uniqueCases.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-1.5 ml-auto">
              <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32 h-8 text-sm" data-testid="select-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dueDate">By due date</SelectItem>
                  <SelectItem value="priority">By priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                <div className="h-3 bg-muted rounded animate-pulse w-1/2 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <CheckCircle2 className="w-10 h-10 text-muted-foreground mb-3" />
            <h3 className="text-base font-medium">No obligations found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {filterStatus === 'pending' ? "You're all caught up." : "No items match your filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const dueDateInfo = getDueDateLabel(item.dueDate, item.completed);
            const priorityCfg = priorityConfig[item.priority.toLowerCase()] ?? priorityConfig.medium;
            const isOverdue = item.dueDate && isPast(new Date(item.dueDate)) && !isToday(new Date(item.dueDate)) && !item.completed;
            const isExpanded = expandedId === item.id;

            return (
              <Card 
                key={item.id} 
                className={`transition-all ${item.completed ? 'opacity-60' : ''} ${isOverdue ? 'border-red-300 dark:border-red-800' : ''}`}
                data-testid={`card-action-item-${item.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={checked => completeMutation.mutate({ itemId: item.id, completed: !!checked })}
                      className="mt-0.5 shrink-0"
                      data-testid={`checkbox-action-${item.id}`}
                    />
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      data-testid={`toggle-expand-${item.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-relaxed ${item.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {item.description}
                        </p>
                        <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 mt-0.5">
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${priorityCfg.className}`}>
                          {priorityCfg.label}
                        </span>

                        {item.assignee && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            {item.assignee.toLowerCase() === 'client' ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
                            {item.assignee}
                          </div>
                        )}

                        {dueDateInfo && (
                          <div className={`flex items-center gap-1 text-xs ${dueDateInfo.className}`}>
                            {isOverdue ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {dueDateInfo.label}
                          </div>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pt-3 border-t border-border space-y-3">
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-muted-foreground">Matter:</span>
                              <span className="ml-1 text-foreground font-medium">{item.caseTitle || 'Unknown'}</span>
                            </div>
                            {item.clientName && (
                              <div>
                                <span className="text-muted-foreground">Client:</span>
                                <span className="ml-1 text-foreground">{item.clientName}</span>
                              </div>
                            )}
                            <div>
                              <span className="text-muted-foreground">Created:</span>
                              <span className="ml-1 text-foreground">{format(new Date(item.createdAt), "d MMM yyyy")}</span>
                            </div>
                            {item.dueDate && (
                              <div>
                                <span className="text-muted-foreground">Due:</span>
                                <span className="ml-1 text-foreground">{format(new Date(item.dueDate), "d MMM yyyy")}</span>
                              </div>
                            )}
                          </div>
                          {item.caseId && (
                            <Link href={`/case/${item.caseId}`}>
                              <Button size="sm" variant="outline" className="gap-1.5 text-xs" data-testid={`button-go-to-matter-${item.id}`}>
                                <ExternalLink className="w-3 h-3" />
                                Go to Matter
                              </Button>
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
