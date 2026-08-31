import { useState } from "react";
import { toTitleCase } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, FileText, DollarSign, CheckCircle2, TrendingUp, Clock, FileDown, Loader2, UserPlus, Mail, Building2, Calendar, Check, X, Sparkles, LifeBuoy } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { exportMarkdownToPDF } from "@/lib/documentExport";
import { apiRequest, getApiErrorMessage, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

interface StrategyDoc {
  filename: string;
  title: string;
  size: number;
  modifiedAt: string;
}

interface WaitlistEntry {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  firmName: string | null;
  firmSize: string | null;
  role: string | null;
  source: string | null;
  referralCode: string | null;
  status: string;
  gdprConsent: boolean;
  marketingConsent: boolean;
  /** DB column is signup_at — keep createdAt as optional alias for older payloads */
  signupAt: string;
  createdAt?: string;
}

function waitlistDisplayName(entry: WaitlistEntry): string | null {
  const parts = [entry.firstName, entry.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

function waitlistRequestedAt(entry: WaitlistEntry): Date | null {
  const raw = entry.signupAt || entry.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

type SeedReeveResult = {
  success: boolean;
  message: string;
  caseId?: string;
  userId?: string;
  userEmail?: string;
};

export default function AdminDashboard() {
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);
  const [sampleEmail, setSampleEmail] = useState("");
  const [sampleUserId, setSampleUserId] = useState("");
  const [seedingUserId, setSeedingUserId] = useState<string | null>(null);
  const { toast } = useToast();
  
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<AdminStatistics>({
    queryKey: ["/api/admin/statistics"],
  });

  const { data: userStats, isLoading: usersLoading, error: usersError } = useQuery<UserStatistics[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: docs } = useQuery<StrategyDoc[]>({
    queryKey: ["/api/admin/docs"],
  });

  const { data: waitlist, isLoading: waitlistLoading } = useQuery<WaitlistEntry[]>({
    queryKey: ["/api/admin/waitlist"],
  });

  const seedReeveMutation = useMutation({
    mutationFn: async (payload: { email?: string; userId?: string }) => {
      return apiRequest<SeedReeveResult>("POST", "/api/admin/sample-matters/reeve", payload);
    },
    onSuccess: (result) => {
      setSeedingUserId(null);
      toast({
        title: "Sample matter sent",
        description: result.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/statistics"] });
    },
    onError: (error) => {
      setSeedingUserId(null);
      toast({
        title: "Could not send sample matter",
        description: getApiErrorMessage(error, "The target user must already have an account."),
        variant: "destructive",
      });
    },
  });

  const sendReeveSample = (payload: { email?: string; userId?: string }) => {
    if (payload.userId) setSeedingUserId(payload.userId);
    seedReeveMutation.mutate(payload);
  };

  const updateWaitlistStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/admin/waitlist/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/waitlist"] });
      toast({
        title: "Status updated",
        description: "Waitlist entry status has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update waitlist status.",
        variant: "destructive",
      });
    },
  });

  const handleDownloadPDF = async (filename: string, title: string) => {
    setDownloadingDoc(filename);
    try {
      const { content } = await apiRequest<{ content: string }>("GET", `/api/admin/docs/${filename}`);
      await exportMarkdownToPDF(content, title);
    } catch (error) {
      console.error("Failed to download PDF:", error);
    } finally {
      setDownloadingDoc(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string | Date | null | undefined) => {
    if (!dateStr) return "Never";
    const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "—";
    return format(d, "dd MMM yyyy HH:mm");
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

  if (statsError || usersError) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Admin access required to view this page</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {statsError || usersError ? "Failed to load admin statistics. Please ensure you have admin privileges." : "You do not have permission to access the admin dashboard."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="admin-dashboard">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-admin-title">Admin Dashboard</h1>
          <p className="text-muted-foreground">System overview and cost monitoring</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" data-testid="button-admin-support-tickets">
            <Link href="/admin/support-tickets">
              <LifeBuoy className="w-4 h-4 mr-2" />
              Support queue
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" data-testid="button-admin-provision-firm">
            <Link href="/admin/provision-firm">
              <Building2 className="w-4 h-4 mr-2" />
              Evaluation firms &amp; invites
            </Link>
          </Button>
        </div>
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
              {typeof stats?.successRate === 'number' && Number.isFinite(stats.successRate) ? stats.successRate.toFixed(1) : "0.0"}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.successfulProcessing || 0} successful / {stats?.failedProcessing || 0} failed
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
              {stats?.casesLast7Days || 0} this week / {stats?.casesLast30Days || 0} this month
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
              Meeting-to-Matter™ Engine Performance
            </CardTitle>
            <CardDescription>Average processing times and document generation via Meeting-to-Matter™</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Average Processing Time</span>
              <span className="font-semibold" data-testid="text-avg-processing-time">
                {typeof stats?.averageProcessingTimeMinutes === 'number' && Number.isFinite(stats.averageProcessingTimeMinutes) ? stats.averageProcessingTimeMinutes.toFixed(1) : "0.0"} min
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Transcriptions</span>
              <span className="font-semibold">{stats?.totalTranscriptions || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Documents Generated</span>
              <span className="font-semibold">{stats?.totalDocumentsGenerated || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Avg. Docs per Case</span>
              <span className="font-semibold">
                {stats?.totalCases && stats.totalCases > 0 ? (stats.totalDocumentsGenerated / stats.totalCases).toFixed(1) : "0.0"}
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
              <Badge variant="secondary">{stats?.casesLast7Days || 0} cases</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Last 30 Days</span>
              <Badge variant="secondary">{stats?.casesLast30Days || 0} cases</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Daily Average (7d)</span>
              <Badge variant="secondary">
                {stats?.casesLast7Days ? (stats.casesLast7Days / 7).toFixed(1) : "0.0"} cases/day
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Weekly Average (30d)</span>
              <Badge variant="secondary">
                {stats?.casesLast30Days ? ((stats.casesLast30Days / 30) * 7).toFixed(1) : "0.0"} cases/week
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sample matter provisioning */}
      <Card data-testid="card-sample-matters">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Sample matters
          </CardTitle>
          <CardDescription>
            Push a ready-made family law sample (Reeve financial remedy conference) into a user account.
            Includes diarized transcript, attendance note with open reasoning gaps, and action items.
            The user must already have signed up.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sample-user">Select user</Label>
              <Select
                value={sampleUserId || undefined}
                onValueChange={(value) => {
                  setSampleUserId(value);
                  const match = userStats?.find((u) => u.userId === value);
                  if (match?.email) setSampleEmail(match.email);
                }}
              >
                <SelectTrigger id="sample-user" data-testid="select-sample-user">
                  <SelectValue placeholder="Choose an account…" />
                </SelectTrigger>
                <SelectContent>
                  {userStats?.filter((u) => u.email).map((user) => (
                    <SelectItem key={user.userId} value={user.userId}>
                      {(user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName} — `
                        : "") + (user.email || user.userId)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sample-email">Or enter email</Label>
              <Input
                id="sample-email"
                type="email"
                value={sampleEmail}
                onChange={(e) => {
                  setSampleEmail(e.target.value);
                  setSampleUserId("");
                }}
                placeholder="solicitor@firm.co.uk"
                data-testid="input-sample-email"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => {
                if (sampleUserId) {
                  sendReeveSample({ userId: sampleUserId });
                } else if (sampleEmail.trim()) {
                  sendReeveSample({ email: sampleEmail.trim() });
                }
              }}
              disabled={
                seedReeveMutation.isPending ||
                (!sampleUserId && !sampleEmail.trim())
              }
              data-testid="button-send-reeve-sample"
            >
              {seedReeveMutation.isPending && !seedingUserId ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending…
                </>
              ) : (
                "Send Reeve sample matter"
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Re-sending archives any prior Reeve sample for that user and creates a fresh one.
            </p>
          </div>
        </CardContent>
      </Card>

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
                  <th className="text-right py-2 px-2">Sample</th>
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
                    <td className="py-3 px-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={seedReeveMutation.isPending}
                        onClick={() => sendReeveSample({ userId: user.userId })}
                        data-testid={`button-send-reeve-${user.userId}`}
                      >
                        {seedingUserId === user.userId && seedReeveMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          "Send Reeve"
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
                {(!userStats || userStats.length === 0) && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Waitlist Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Early Access Waitlist
          </CardTitle>
          <CardDescription>
            Manage early access requests
            {waitlist && waitlist.length > 0 && (
              <span className="ml-2">
                ({waitlist.filter(w => w.status === "pending").length} pending)
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {waitlistLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : waitlist && waitlist.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Contact</th>
                    <th className="text-left py-2 px-2">Firm</th>
                    <th className="text-left py-2 px-2">Source</th>
                    <th className="text-left py-2 px-2">Referral</th>
                    <th className="text-center py-2 px-2">Consent</th>
                    <th className="text-left py-2 px-2">Status</th>
                    <th className="text-left py-2 px-2">Requested</th>
                    <th className="text-right py-2 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {waitlist.map((entry) => {
                    const displayName = waitlistDisplayName(entry);
                    const requestedAt = waitlistRequestedAt(entry);
                    const statusLabel = entry.status ? toTitleCase(entry.status) : "Unknown";
                    return (
                    <tr key={entry.id} className="border-b hover-elevate" data-testid={`row-waitlist-${entry.id}`}>
                      <td className="py-3 px-2">
                        <div className="font-medium flex items-center gap-2">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {entry.email}
                        </div>
                        {displayName && (
                          <div className="text-xs text-muted-foreground mt-1">{displayName}</div>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {entry.firmName ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <div>
                              <div>{entry.firmName}</div>
                              {entry.firmSize && (
                                <div className="text-xs text-muted-foreground">{entry.firmSize}</div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className="text-xs">
                          {entry.source || "direct"}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        {entry.referralCode ? (
                          <Badge variant="secondary" className="text-xs">
                            {entry.referralCode}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {entry.gdprConsent && (
                            <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-700">
                              GDPR
                            </Badge>
                          )}
                          {entry.marketingConsent && (
                            <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-700">
                              MKT
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge 
                          variant={entry.status === "approved" || entry.status === "active" || entry.status === "invited" ? "default" : entry.status === "rejected" || entry.status === "declined" ? "destructive" : "secondary"}
                          className={entry.status === "pending" ? "bg-yellow-500/10 text-yellow-700" : ""}
                        >
                          {statusLabel}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-muted-foreground text-xs">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {requestedAt ? format(requestedAt, "dd MMM yyyy") : "—"}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center justify-end gap-1">
                          {entry.status === "pending" && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => updateWaitlistStatus.mutate({ id: entry.id, status: "invited" })}
                                disabled={updateWaitlistStatus.isPending}
                                data-testid={`button-approve-${entry.id}`}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => updateWaitlistStatus.mutate({ id: entry.id, status: "declined" })}
                                disabled={updateWaitlistStatus.isPending}
                                data-testid={`button-reject-${entry.id}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8" data-testid="text-no-waitlist">
              No waitlist entries yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Strategy Documents Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Strategy Documents
          </CardTitle>
          <CardDescription>Export business strategy and planning documents as PDF</CardDescription>
        </CardHeader>
        <CardContent>
          {docs && docs.length > 0 ? (
            <div className="space-y-2">
              {docs.map((doc) => (
                <div 
                  key={doc.filename} 
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover-elevate"
                  data-testid={`row-doc-${doc.filename}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate" data-testid={`text-doc-title-${doc.filename}`}>{doc.title}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
                      <span data-testid={`text-doc-size-${doc.filename}`}>{formatFileSize(doc.size)}</span>
                      <span data-testid={`text-doc-updated-${doc.filename}`}>
                        Updated {(() => {
                          const d = new Date(doc.modifiedAt);
                          return Number.isNaN(d.getTime()) ? "—" : format(d, "dd MMM yyyy");
                        })()}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleDownloadPDF(doc.filename, doc.title)}
                    disabled={downloadingDoc === doc.filename}
                    data-testid={`button-download-${doc.filename}`}
                  >
                    {downloadingDoc === doc.filename ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <FileDown className="h-4 w-4 mr-2" />
                    )}
                    PDF
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8" data-testid="text-no-docs">No documents found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
