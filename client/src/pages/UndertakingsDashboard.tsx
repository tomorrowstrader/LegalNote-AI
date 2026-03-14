import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { format, isPast } from "date-fns";
import { useLocation } from "wouter";
import type { Undertaking } from "@shared/schema";

type UndertakingWithCase = Undertaking & { caseTitle?: string; clientName?: string };

export default function UndertakingsDashboard() {
  const [, setLocation] = useLocation();

  const { data: undertakings = [], isLoading } = useQuery<UndertakingWithCase[]>({
    queryKey: ['/api/undertakings/outstanding'],
  });

  const overdue = undertakings.filter(u => u.deadline && isPast(new Date(u.deadline)));
  const upcoming = undertakings.filter(u => u.deadline && !isPast(new Date(u.deadline)));
  const noDeadline = undertakings.filter(u => !u.deadline);

  const sorted = [...overdue, ...upcoming, ...noDeadline];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
          <Skeleton className="h-10 w-64 mb-6" />
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
        <Button
          variant="ghost"
          onClick={() => setLocation('/')}
          className="mb-6 gap-2"
          data-testid="button-back-dashboard"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-foreground mb-2 flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-accent" />
            Undertakings Register
          </h1>
          <p className="text-muted-foreground">
            All outstanding undertakings across all matters. Overdue items are shown first.
          </p>
        </div>

        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <Card className="flex-1 min-w-[140px]">
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold" data-testid="stat-total-outstanding">{undertakings.length}</p>
                <p className="text-xs text-muted-foreground">Outstanding</p>
              </div>
            </CardContent>
          </Card>
          <Card className={`flex-1 min-w-[140px] ${overdue.length > 0 ? 'border-destructive' : ''}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className={`w-5 h-5 ${overdue.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              <div>
                <p className={`text-2xl font-bold ${overdue.length > 0 ? 'text-destructive' : ''}`} data-testid="stat-overdue">{overdue.length}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </CardContent>
          </Card>
          <Card className="flex-1 min-w-[140px]">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold" data-testid="stat-upcoming">{upcoming.length}</p>
                <p className="text-xs text-muted-foreground">With Deadline</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="w-12 h-12 mx-auto text-muted-foreground opacity-40 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No outstanding undertakings</p>
            <p className="text-sm text-muted-foreground mt-1">
              All undertakings have been discharged or none have been recorded.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map(u => {
              const isOverdue = u.deadline && isPast(new Date(u.deadline));
              return (
                <Card
                  key={u.id}
                  className={`hover-elevate cursor-pointer ${isOverdue ? 'border-destructive' : ''}`}
                  onClick={() => setLocation(`/case/${u.caseId}`)}
                  data-testid={`undertaking-row-${u.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-sm font-medium">{u.wording}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {u.caseTitle && <span>Matter: {u.caseTitle}</span>}
                          {u.clientName && <span>Client: {u.clientName}</span>}
                          {u.dateGiven && (
                            <span>Given: {format(new Date(u.dateGiven), "dd MMM yyyy")}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isOverdue ? (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Overdue
                          </Badge>
                        ) : u.deadline ? (
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            {format(new Date(u.deadline), "dd MMM yyyy")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">No deadline</Badge>
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
    </div>
  );
}
