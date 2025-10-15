import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, FileText, DollarSign, CheckCircle2, AlertCircle, TrendingUp, Clock } from "lucide-react";
import { format } from "date-fns";

interface AdminStatistics {
  totalCases: number;
  totalUsers: number;
  totalTranscriptions: number;
  totalDocumentsGenerated: number;
  totalCostsUSD: number;
  transcriptionCostsUSD: number;
  documentGenerationCostsUSD: number;
  successfulProcessing: number;
  failedProcessing: number;
  successRate: number;
  averageProcessingTimeMinutes: number;
  casesLast30Days: number;
  casesLast7Days: number;
}

interface UserStatistics {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  totalCases: number;
  successfulCases: number;
  failedCases: number;
  totalCostsUSD: number;
  lastActivity: string | null;
  joinedDate: string;
}

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<AdminStatistics>({
    queryKey: ["/api/admin/statistics"],
  });

  const { data: userStats, isLoading: usersLoading } = useQuery<UserStatistics[]>({
    queryKey: ["/api/admin/users"],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return format(new Date(dateStr), "dd MMM yyyy HH:mm");
  };

  if (statsLoading || usersLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="admin-dashboard">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-admin-title">Admin Dashboard</h1>
        <p className="text-muted-foreground">System overview and cost monitoring</p>
      </div>

      {/* Overview Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total API Costs</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-cost">
              {formatCurrency(stats?.totalCostsUSD || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Transcription: {formatCurrency(stats?.transcriptionCostsUSD || 0)} | 
              Documents: {formatCurrency(stats?.documentGenerationCostsUSD || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-success-rate">
              {stats?.successRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.successfulProcessing} successful / {stats?.failedProcessing} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-users">
              {stats?.totalUsers || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Registered solicitors
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cases Processed</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-cases">
              {stats?.totalCases || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.casesLast7Days} this week / {stats?.casesLast30Days} this month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Processing Performance
            </CardTitle>
            <CardDescription>Average processing times and document generation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Average Processing Time</span>
              <span className="font-semibold" data-testid="text-avg-processing-time">
                {stats?.averageProcessingTimeMinutes.toFixed(1)} min
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Transcriptions</span>
              <span className="font-semibold">{stats?.totalTranscriptions}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Documents Generated</span>
              <span className="font-semibold">{stats?.totalDocumentsGenerated}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Avg. Docs per Case</span>
              <span className="font-semibold">
                {stats?.totalCases ? (stats.totalDocumentsGenerated / stats.totalCases).toFixed(1) : 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Case creation trends</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Last 7 Days</span>
              <Badge variant="secondary">{stats?.casesLast7Days} cases</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Last 30 Days</span>
              <Badge variant="secondary">{stats?.casesLast30Days} cases</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Daily Average (7d)</span>
              <Badge variant="secondary">
                {stats?.casesLast7Days ? (stats.casesLast7Days / 7).toFixed(1) : 0} cases/day
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Weekly Average (30d)</span>
              <Badge variant="secondary">
                {stats?.casesLast30Days ? ((stats.casesLast30Days / 30) * 7).toFixed(1) : 0} cases/week
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Statistics Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Statistics</CardTitle>
          <CardDescription>Per-user case processing and costs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Solicitor</th>
                  <th className="text-left py-2 px-2">Email</th>
                  <th className="text-right py-2 px-2">Cases</th>
                  <th className="text-right py-2 px-2">Success</th>
                  <th className="text-right py-2 px-2">Failed</th>
                  <th className="text-right py-2 px-2">Total Costs</th>
                  <th className="text-left py-2 px-2">Last Activity</th>
                  <th className="text-left py-2 px-2">Joined</th>
                </tr>
              </thead>
              <tbody>
                {userStats?.map((user) => (
                  <tr key={user.userId} className="border-b hover-elevate" data-testid={`row-user-${user.userId}`}>
                    <td className="py-3 px-2">
                      <div className="font-medium">
                        {user.firstName && user.lastName 
                          ? `${user.firstName} ${user.lastName}`
                          : user.email || "Unknown User"}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-muted-foreground">{user.email || "—"}</td>
                    <td className="py-3 px-2 text-right font-semibold">{user.totalCases}</td>
                    <td className="py-3 px-2 text-right">
                      <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">
                        {user.successfulCases}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-right">
                      {user.failedCases > 0 ? (
                        <Badge variant="secondary" className="bg-red-500/10 text-red-700 dark:text-red-400">
                          {user.failedCases}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right font-semibold">
                      {formatCurrency(user.totalCostsUSD)}
                    </td>
                    <td className="py-3 px-2 text-muted-foreground text-xs">
                      {formatDate(user.lastActivity)}
                    </td>
                    <td className="py-3 px-2 text-muted-foreground text-xs">
                      {formatDate(user.joinedDate)}
                    </td>
                  </tr>
                ))}
                {(!userStats || userStats.length === 0) && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
