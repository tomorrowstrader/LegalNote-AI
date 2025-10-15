import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DollarSign, TrendingUp, Users, FileText, Calendar, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

interface UsageStats {
  totalCostToday: number;
  totalCostWeek: number;
  totalCostMonth: number;
  totalCostAllTime: number;
  topUsers: Array<{ userId: string; cost: number }>;
  topExpensiveCases: Array<{ id: string; title: string; cost: number; createdAt: string; userId: string }>;
  dailyCosts: Array<{ date: string; cost: number }>;
  totalCasesProcessed: number;
}

export default function AdminUsage() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  
  // Admin check via isAdmin flag from backend (configurable via ADMIN_USER_ID env var)
  const isAdmin = (user as any)?.isAdmin === true;

  // Redirect non-admin users to dashboard
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      setLocation('/');
    }
  }, [authLoading, isAdmin, setLocation]);
  
  const { data: stats, isLoading, error } = useQuery<UsageStats>({
    queryKey: ['/api/admin/usage-stats'],
    enabled: isAdmin, // Only fetch if user is admin
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <Skeleton className="h-10 w-64 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
          <Skeleton className="h-96 mb-8" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <Button
            variant="ghost"
            onClick={() => setLocation('/')}
            className="mb-6 gap-2"
            data-testid="button-back-to-dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
          <Alert variant="destructive">
            <AlertDescription>
              {error ? "Failed to load usage statistics. Admin access required." : "No data available."}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Low balance warning threshold (less than $1 remaining)
  const BUDGET_LIMIT = 5.00; // Your $5 budget
  const remainingBudget = BUDGET_LIMIT - stats.totalCostAllTime;
  const isLowBalance = remainingBudget < 1.00;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-foreground mb-2">API Usage Dashboard</h1>
            <p className="text-muted-foreground">Monitor OpenAI API costs and usage</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setLocation('/')}
            className="gap-2"
            data-testid="button-back-to-dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>

        {isLowBalance && (
          <Alert variant="destructive" className="mb-8" data-testid="alert-low-balance">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              <strong>Low Balance Warning:</strong> You have ${remainingBudget.toFixed(2)} remaining of your ${BUDGET_LIMIT.toFixed(2)} budget. 
              Please add more credits to your OpenAI account to continue processing.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card data-testid="card-cost-today">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Costs</CardTitle>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalCostToday.toFixed(4)}</div>
              <p className="text-xs text-muted-foreground mt-1">API usage costs</p>
            </CardContent>
          </Card>

          <Card data-testid="card-cost-week">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalCostWeek.toFixed(4)}</div>
              <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
            </CardContent>
          </Card>

          <Card data-testid="card-cost-month">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalCostMonth.toFixed(4)}</div>
              <p className="text-xs text-muted-foreground mt-1">Monthly total</p>
            </CardContent>
          </Card>

          <Card data-testid="card-cases-processed">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cases Processed</CardTitle>
              <FileText className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCasesProcessed}</div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Budget Overview</CardTitle>
              <CardDescription>Track your OpenAI API spending</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Total Spent</span>
                    <span className="text-sm text-muted-foreground">${stats.totalCostAllTime.toFixed(4)}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-accent h-2 rounded-full" 
                      style={{ width: `${Math.min((stats.totalCostAllTime / BUDGET_LIMIT) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t">
                  <span className="font-medium">Remaining Budget</span>
                  <span className={`font-bold ${isLowBalance ? 'text-destructive' : 'text-accent'}`}>
                    ${remainingBudget.toFixed(2)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Budget limit: ${BUDGET_LIMIT.toFixed(2)} (configurable in code)
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily Cost Trend</CardTitle>
              <CardDescription>Last 7 days of API usage</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.dailyCosts.map((day, index) => (
                  <div key={day.date} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(day.date), "MMM dd")}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-secondary rounded-full h-2">
                        <div 
                          className="bg-accent h-2 rounded-full" 
                          style={{ 
                            width: `${Math.min((day.cost / Math.max(...stats.dailyCosts.map(d => d.cost))) * 100, 100)}%` 
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium w-16 text-right">
                        ${day.cost.toFixed(4)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Most Expensive Cases</CardTitle>
            <CardDescription>Top 10 cases by AI processing cost</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.topExpensiveCases.length > 0 ? (
              <div className="space-y-3">
                {stats.topExpensiveCases.map((caseData, index) => (
                  <div 
                    key={caseData.id} 
                    className="flex items-center justify-between p-3 bg-card rounded-lg border hover-elevate cursor-pointer"
                    onClick={() => setLocation(`/case/${caseData.id}`)}
                    data-testid={`case-item-${index}`}
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{caseData.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(caseData.createdAt), "MMM dd, yyyy 'at' HH:mm")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-accent">${caseData.cost.toFixed(4)}</p>
                      <p className="text-xs text-muted-foreground">Cost</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No cases processed yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
