import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CheckCircle2, Circle, AlertCircle, Clock, ArrowUpDown,
  User, Users, ExternalLink, Filter
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

  // Filter and sort
  const filtered = actionItems
    .filter(item => {
      if (filterAssignee !== "all" && item.assignee?.toLowerCase() !== filterAssignee) return false;
      if (filterPriority !== "all" && item.priority !== filterPriority) return false;
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
        const order = { high: 0, medium: 1, low: 2 };
        return (order[a.priority as keyof typeof order] ?? 1) - (order[b.priority as keyof typeof order] ?? 1);
      }
      return 0;
    });

  // Unique cases for filter
  const uniqueCases = Array.from(
    new Map(actionItems.map(i => [i.caseId, { id: i.caseId, title: i.caseTitle || 'Unknown case' }])).values()
  );

  const priorityConfig = {
    high: { label: "High", className: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" },
    medium: { label: "Medium", className: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" },
    low: { label: "Low", className: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" },
  };

  const getDueDateLabel = (dueDate?: string) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    if (isPast(date) && !isToday(date)) return { label: "Overdue", className: "text-red-600 dark:text-red-400" };
    if (isToday(date)) return { label: "Due today", className: "text-amber-600 dark:text-amber-400" };
    if (isTomorrow(date)) return { label: "Due tomorrow", className: "text-amber-500 dark:text-amber-500" };
    return { label: format(date, "d MMM yyyy"), className: "text-muted-foreground" };
  };

  const stats = {
    total: actionItems.filter(i => !i.completed).length,
    overdue: actionItems.filter(i => !i.completed && i.dueDate && isPast(new Date(i.dueDate)) && !isToday(new Date(i.dueDate))).length,
    dueToday: actionItems.filter(i => !i.completed && i.dueDate && isToday(new Date(i.dueDate))).length,
    high: actionItems.filter(i => !i.completed && i.priority === 'high').length,
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">My Actions</h1>
        <p className="text-sm text-muted-foreground mt-1">All outstanding obligations across your matters</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground mt-1">Pending actions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.overdue}</div>
            <div className="text-xs text-muted-foreground mt-1">Overdue</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.dueToday}</div>
            <div className="text-xs text-muted-foreground mt-1">Due today</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">{stats.high}</div>
            <div className="text-xs text-muted-foreground mt-1">High priority</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filter:</span>
            </div>
            <Input
              placeholder="Search actions..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-48 h-8 text-sm"
            />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All items</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All assignees</SelectItem>
                <SelectItem value="solicitor">Solicitor</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-32 h-8 text-sm">
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
                <SelectTrigger className="w-44 h-8 text-sm">
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
                <SelectTrigger className="w-32 h-8 text-sm">
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

      {/* Action items list */}
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
            const dueDateInfo = getDueDateLabel(item.dueDate);
            const priorityCfg = priorityConfig[item.priority as keyof typeof priorityConfig] ?? priorityConfig.medium;
            const isOverdue = item.dueDate && isPast(new Date(item.dueDate)) && !isToday(new Date(item.dueDate)) && !item.completed;

            return (
              <Card 
                key={item.id} 
                className={`transition-opacity ${item.completed ? 'opacity-60' : ''} ${isOverdue ? 'border-red-300 dark:border-red-800' : ''}`}
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
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-relaxed ${item.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {item.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {/* Case link */}
                        {item.caseTitle && (
                          <Link href={`/case/${item.caseId}`}>
                            <a className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                              <ExternalLink className="w-3 h-3" />
                              {item.caseTitle}
                              {item.clientName && <span className="text-muted-foreground/60">· {item.clientName}</span>}
                            </a>
                          </Link>
                        )}

                        {/* Priority badge */}
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${priorityCfg.className}`}>
                          {priorityCfg.label}
                        </span>

                        {/* Assignee */}
                        {item.assignee && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            {item.assignee.toLowerCase() === 'client' ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
                            {item.assignee}
                          </div>
                        )}

                        {/* Due date */}
                        {dueDateInfo && (
                          <div className={`flex items-center gap-1 text-xs ${dueDateInfo.className}`}>
                            <Clock className="w-3 h-3" />
                            {dueDateInfo.label}
                          </div>
                        )}

                        {isOverdue && (
                          <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
                            <AlertCircle className="w-3 h-3" />
                            Overdue
                          </div>
                        )}
                      </div>
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
