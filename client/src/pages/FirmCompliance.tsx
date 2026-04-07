import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  FileText,
  AlertCircle,
  BadgePoundSterling,
  FileWarning,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { format, differenceInDays, formatDistanceToNow } from "date-fns";
import { PRACTICE_AREA_LABELS } from "@shared/schema";

interface MatterComplianceStatus {
  caseId: string;
  caseTitle: string;
  clientName: string;
  matterReference: string | null;
  practiceArea: string | null;
  createdAt: string;
  feeEarnerName: string;
  feeEarnerId: string;
  supervisorId: string | null;
  supervisorName: string | null;
  ragStatus: "red" | "amber" | "green";
  outstandingItems: number;
  outstandingUndertakings: number;
  lastSignoffDate: string | null;
  daysSinceSignoff: number | null;
  issues: string[];
}

interface ComplianceOverview {
  totalActiveMatters: number;
  redMatters: number;
  amberMatters: number;
  greenMatters: number;
  totalOutstandingUndertakings: number;
  matters: MatterComplianceStatus[];
  undertakings: Array<{
    id: string;
    description: string;
    caseId: string;
    caseTitle: string;
    clientName: string;
    givenTo: string | null;
    dueDate: string | null;
    status: string;
    createdAt: string;
    feeEarnerName: string;
    daysSinceCreated: number;
    isOverdue: boolean;
  }>;
  supervisionByFeeEarner: Array<{
    feeEarnerId: string;
    feeEarnerName: string;
    supervisorId: string | null;
    supervisorName: string | null;
    matters: Array<{
      caseId: string;
      caseTitle: string;
      lastSignoffDate: string | null;
      daysSinceSignoff: number | null;
      needsSignoff: boolean;
    }>;
  }>;
}

interface MatterFinanceRow {
  caseId: string;
  caseTitle: string;
  clientName: string;
  matterReference: string | null;
  practiceArea: string | null;
  createdAt: string;
  totalMinutes: number;
  billableValue: number;
  costsEstimate: string | null;
  estimatedAmount: number | null;
  variance: number | null;
  hasCostsEstimate: boolean;
  hasTimeRecorded: boolean;
  lastTimeEntryDate: string | null;
  noTimeIn30Days: boolean;
  sessionCount: number;
  sessionsWithNoEntryCount: number;
  timeEntryCount: number;
}

interface FinanceComplianceData {
  summary: {
    totalActiveMatters: number;
    unbilledCount: number;
    costsTransparencyCount: number;
    timeGapCount: number;
    inactiveCount: number;
  };
  matters: MatterFinanceRow[];
  generatedAt: string;
}

type SortField = "ragStatus" | "feeEarnerName" | "practiceArea" | "createdAt" | "outstandingItems";
type SortDir = "asc" | "desc";
type FinanceSortField = "caseTitle" | "totalMinutes" | "billableValue" | "variance" | "lastTimeEntryDate" | "sessionsWithNoEntryCount";

const RAG_SORT_ORDER: Record<string, number> = { red: 0, amber: 1, green: 2 };

function formatMinutes(minutes: number): string {
  if (minutes === 0) return "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatGBP(amount: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function RagBadge({ status }: { status: "red" | "amber" | "green" }) {
  if (status === "red") return <Badge variant="outline" className="text-red-700 dark:text-red-400 border-red-400/60">Red</Badge>;
  if (status === "amber") return <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-400/60">Amber</Badge>;
  return <Badge variant="outline" className="text-green-700 dark:text-green-400 border-green-400/60">Green</Badge>;
}

function SortButton({ field, currentField, dir, onSort }: {
  field: SortField;
  currentField: SortField;
  dir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const isActive = currentField === field;
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      data-testid={`button-sort-${field}`}
    >
      {isActive ? (dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-50" />}
    </button>
  );
}

function FinanceSortButton({ field, currentField, dir, onSort, label }: {
  field: FinanceSortField;
  currentField: FinanceSortField;
  dir: SortDir;
  onSort: (f: FinanceSortField) => void;
  label: string;
}) {
  const active = field === currentField;
  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center gap-1 text-xs font-medium whitespace-nowrap ${active ? "text-foreground" : "text-muted-foreground"}`}
      data-testid={`sort-${field}`}
    >
      {label}
      <ArrowUpDown className={`w-3 h-3 ${active ? "opacity-100" : "opacity-40"}`} />
    </button>
  );
}

export default function FirmCompliance() {
  const [, setLocation] = useLocation();
  const { canAccessFirmCompliance, isCOFA, isFirmAdmin, user, isLoading: authLoading } = useAuth();
  const isManagingPartner = user?.primaryRole === "managing_partner";
  const canAccessFinance = isCOFA || isFirmAdmin || isManagingPartner;

  const [sortField, setSortField] = useState<SortField>("ragStatus");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [financeSortField, setFinanceSortField] = useState<FinanceSortField>("caseTitle");
  const [financeSortDir, setFinanceSortDir] = useState<SortDir>("asc");

  const { data: overview, isLoading } = useQuery<ComplianceOverview>({
    queryKey: ["/api/firm/compliance-overview"],
    enabled: canAccessFirmCompliance,
  });

  const { data: financeData, isLoading: financeLoading } = useQuery<FinanceComplianceData>({
    queryKey: ["/api/firm/finance-compliance"],
    enabled: canAccessFinance,
  });

  if (authLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Skeleton className="h-9 w-56 mb-2" />
        <Skeleton className="h-5 w-80 mb-8" />
      </div>
    );
  }

  if (!canAccessFirmCompliance) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Shield className="w-10 h-10 text-muted-foreground/40 mb-4" />
          <p className="text-sm font-medium mb-1">Access restricted</p>
          <p className="text-sm text-muted-foreground">This section is available to COLP, partner, and admin users only.</p>
        </div>
      </div>
    );
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const handleFinanceSort = (field: FinanceSortField) => {
    if (financeSortField === field) {
      setFinanceSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setFinanceSortField(field);
      setFinanceSortDir("asc");
    }
  };

  const sortedMatters = [...(overview?.matters ?? [])].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "ragStatus":
        cmp = RAG_SORT_ORDER[a.ragStatus] - RAG_SORT_ORDER[b.ragStatus];
        break;
      case "feeEarnerName":
        cmp = a.feeEarnerName.localeCompare(b.feeEarnerName);
        break;
      case "practiceArea":
        cmp = (a.practiceArea ?? "").localeCompare(b.practiceArea ?? "");
        break;
      case "createdAt":
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case "outstandingItems":
        cmp = a.outstandingItems - b.outstandingItems;
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const financeMatters = financeData?.matters ?? [];

  const sortedFinanceMatters = useMemo(() => {
    return [...financeMatters].sort((a, b) => {
      let aVal: string | number | null;
      let bVal: string | number | null;
      switch (financeSortField) {
        case "caseTitle": aVal = a.caseTitle; bVal = b.caseTitle; break;
        case "totalMinutes": aVal = a.totalMinutes; bVal = b.totalMinutes; break;
        case "billableValue": aVal = a.billableValue; bVal = b.billableValue; break;
        case "variance": aVal = a.variance ?? -Infinity; bVal = b.variance ?? -Infinity; break;
        case "lastTimeEntryDate":
          aVal = a.lastTimeEntryDate ? new Date(a.lastTimeEntryDate).getTime() : -1;
          bVal = b.lastTimeEntryDate ? new Date(b.lastTimeEntryDate).getTime() : -1;
          break;
        case "sessionsWithNoEntryCount": aVal = a.sessionsWithNoEntryCount; bVal = b.sessionsWithNoEntryCount; break;
        default: aVal = ""; bVal = "";
      }
      if (aVal === null || aVal === undefined) aVal = typeof bVal === "number" ? -Infinity : "";
      if (bVal === null || bVal === undefined) bVal = typeof aVal === "number" ? -Infinity : "";
      if (typeof aVal === "number" && typeof bVal === "number") {
        return financeSortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return financeSortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [financeMatters, financeSortField, financeSortDir]);

  const unbilledMatters = useMemo(() => sortedFinanceMatters.filter(m => m.hasTimeRecorded && !m.hasCostsEstimate), [sortedFinanceMatters]);
  const costsTransparencyMatters = useMemo(() => sortedFinanceMatters.filter(m => !m.hasCostsEstimate), [sortedFinanceMatters]);
  const timeGapMatters = useMemo(() => sortedFinanceMatters.filter(m => m.sessionsWithNoEntryCount > 0), [sortedFinanceMatters]);

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="page-firm-compliance">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1 flex items-center gap-2" data-testid="heading-firm-compliance">
          <Shield className="w-6 h-6 text-muted-foreground" />
          Firm Compliance
        </h1>
        <p className="text-sm text-muted-foreground">Firm-wide compliance oversight across all active matters</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
            <Card data-testid="card-total-matters">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground mb-1">Active Matters</p>
                <p className="text-2xl font-bold" data-testid="text-total-matters">{overview?.totalActiveMatters ?? 0}</p>
              </CardContent>
            </Card>
            <Card data-testid="card-red-matters">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground mb-1">Red</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-red-matters">{overview?.redMatters ?? 0}</p>
              </CardContent>
            </Card>
            <Card data-testid="card-amber-matters">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground mb-1">Amber</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-amber-matters">{overview?.amberMatters ?? 0}</p>
              </CardContent>
            </Card>
            <Card data-testid="card-undertakings">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground mb-1">Outstanding Undertakings</p>
                <p className="text-2xl font-bold" data-testid="text-outstanding-undertakings">{overview?.totalOutstandingUndertakings ?? 0}</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="overview" data-testid="tabs-compliance">
            <TabsList className="mb-4">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="undertakings" data-testid="tab-undertakings">Undertakings Register</TabsTrigger>
              <TabsTrigger value="supervision" data-testid="tab-supervision">Supervision</TabsTrigger>
              {canAccessFinance && (
                <TabsTrigger value="finance" data-testid="tab-finance">Finance Compliance</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="overview">
              <Card data-testid="card-matters-table">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    <FileText className="w-4 h-4" />
                    Active Matters
                    <Badge variant="outline">{sortedMatters.length} matters</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {sortedMatters.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                      <CheckCircle2 className="w-8 h-8 text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground">No active matters found.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[140px]">
                              <div className="flex items-center gap-1">
                                Status
                                <SortButton field="ragStatus" currentField={sortField} dir={sortDir} onSort={handleSort} />
                              </div>
                            </TableHead>
                            <TableHead>Matter</TableHead>
                            <TableHead>
                              <div className="flex items-center gap-1">
                                Fee Earner
                                <SortButton field="feeEarnerName" currentField={sortField} dir={sortDir} onSort={handleSort} />
                              </div>
                            </TableHead>
                            <TableHead>
                              <div className="flex items-center gap-1">
                                Type
                                <SortButton field="practiceArea" currentField={sortField} dir={sortDir} onSort={handleSort} />
                              </div>
                            </TableHead>
                            <TableHead>
                              <div className="flex items-center gap-1">
                                Opened
                                <SortButton field="createdAt" currentField={sortField} dir={sortDir} onSort={handleSort} />
                              </div>
                            </TableHead>
                            <TableHead>
                              <div className="flex items-center gap-1">
                                Issues
                                <SortButton field="outstandingItems" currentField={sortField} dir={sortDir} onSort={handleSort} />
                              </div>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedMatters.map(matter => (
                            <TableRow
                              key={matter.caseId}
                              className="cursor-pointer hover-elevate"
                              onClick={() => setLocation(`/case/${matter.caseId}`)}
                              data-testid={`row-matter-${matter.caseId}`}
                            >
                              <TableCell>
                                <RagBadge status={matter.ragStatus} />
                              </TableCell>
                              <TableCell>
                                <p className="font-medium text-sm" data-testid={`text-matter-title-${matter.caseId}`}>{matter.caseTitle}</p>
                                <p className="text-xs text-muted-foreground">{matter.clientName}{matter.matterReference ? ` · ${matter.matterReference}` : ""}</p>
                              </TableCell>
                              <TableCell>
                                <p className="text-sm" data-testid={`text-matter-fee-earner-${matter.caseId}`}>{matter.feeEarnerName}</p>
                              </TableCell>
                              <TableCell>
                                <p className="text-sm text-muted-foreground">
                                  {matter.practiceArea ? (PRACTICE_AREA_LABELS[matter.practiceArea as keyof typeof PRACTICE_AREA_LABELS] ?? matter.practiceArea) : "-"}
                                </p>
                              </TableCell>
                              <TableCell>
                                <p className="text-sm text-muted-foreground">{format(new Date(matter.createdAt), "d MMM yyyy")}</p>
                              </TableCell>
                              <TableCell>
                                {matter.outstandingItems > 0 ? (
                                  <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span className="text-xs font-medium">{matter.outstandingItems}</span>
                                  </div>
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="undertakings">
              <Card data-testid="card-undertakings-tab">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    <AlertCircle className="w-4 h-4" />
                    Outstanding Undertakings
                    <Badge variant="outline">{overview?.undertakings?.length ?? 0} undertakings</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {!overview?.undertakings?.length ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                      <CheckCircle2 className="w-8 h-8 text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground">No outstanding undertakings at this time.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Undertaking</TableHead>
                            <TableHead>Matter</TableHead>
                            <TableHead>Fee Earner</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {overview.undertakings.map(u => (
                            <TableRow
                              key={u.id}
                              className="cursor-pointer hover-elevate"
                              onClick={() => setLocation(`/case/${u.caseId}`)}
                              data-testid={`row-undertaking-${u.id}`}
                            >
                              <TableCell>
                                <p className="text-sm font-medium line-clamp-2">{u.description}</p>
                                {u.givenTo && <p className="text-xs text-muted-foreground">To: {u.givenTo}</p>}
                              </TableCell>
                              <TableCell>
                                <p className="text-sm">{u.caseTitle}</p>
                                <p className="text-xs text-muted-foreground">{u.clientName}</p>
                              </TableCell>
                              <TableCell>
                                <p className="text-sm">{u.feeEarnerName}</p>
                              </TableCell>
                              <TableCell>
                                {u.dueDate ? (
                                  <p className={`text-sm ${u.isOverdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}`}>
                                    {format(new Date(u.dueDate), "d MMM yyyy")}
                                    {u.isOverdue && <span className="ml-1 text-xs">(overdue)</span>}
                                  </p>
                                ) : (
                                  <p className="text-sm text-muted-foreground">No due date</p>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs capitalize">{u.status.replace(/_/g, " ")}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="supervision">
              <Card data-testid="card-supervision-tab">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    <Users className="w-4 h-4" />
                    Supervision by Fee Earner
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!overview?.supervisionByFeeEarner.length ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Users className="w-8 h-8 text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground">No active matters to display.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {overview.supervisionByFeeEarner.map(fe => {
                        const overdue = fe.matters.filter(m => m.needsSignoff);
                        return (
                          <div key={fe.feeEarnerId} data-testid={`section-fee-earner-${fe.feeEarnerId}`}>
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <p className="text-sm font-semibold">{fe.feeEarnerName}</p>
                              {fe.supervisorName && (
                                <span className="text-xs text-muted-foreground">Supervised by {fe.supervisorName}</span>
                              )}
                              {overdue.length > 0 && (
                                <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:text-amber-400">
                                  {overdue.length} matter{overdue.length !== 1 ? "s" : ""} overdue sign-off
                                </Badge>
                              )}
                            </div>
                            <div className="rounded-md border overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Matter</TableHead>
                                    <TableHead>Last Sign-off</TableHead>
                                    <TableHead>Days Since</TableHead>
                                    <TableHead>Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {fe.matters.map(m => (
                                    <TableRow
                                      key={m.caseId}
                                      className="cursor-pointer hover-elevate"
                                      onClick={() => setLocation(`/case/${m.caseId}`)}
                                      data-testid={`row-supervision-${m.caseId}`}
                                    >
                                      <TableCell>
                                        <p className="text-sm font-medium">{m.caseTitle}</p>
                                      </TableCell>
                                      <TableCell>
                                        <p className="text-sm">
                                          {m.lastSignoffDate
                                            ? format(new Date(m.lastSignoffDate), "d MMM yyyy")
                                            : <span className="text-muted-foreground">None recorded</span>}
                                        </p>
                                      </TableCell>
                                      <TableCell>
                                        <p className="text-sm">
                                          {m.daysSinceSignoff !== null
                                            ? `${m.daysSinceSignoff} day${m.daysSinceSignoff !== 1 ? "s" : ""}`
                                            : <span className="text-muted-foreground">N/A</span>}
                                        </p>
                                      </TableCell>
                                      <TableCell>
                                        {m.needsSignoff ? (
                                          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            <span className="text-xs font-medium">Sign-off required</span>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span className="text-xs font-medium">Current</span>
                                          </div>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {canAccessFinance && (
              <TabsContent value="finance" data-testid="tab-content-finance">
                {financeLoading ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
                    </div>
                    <Skeleton className="h-64" />
                  </div>
                ) : !financeData ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-3" />
                      <p className="text-foreground font-medium mb-1">Finance compliance data could not be loaded.</p>
                      <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-8">
                    <div className="mb-2">
                      <p className="text-sm text-muted-foreground">
                        Firm-wide financial compliance. Covers time recording obligations, costs transparency requirements, and billable matter status.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Generated {format(new Date(financeData.generatedAt), "d MMMM yyyy 'at' HH:mm")}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="finance-summary-cards">
                      <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                          <TrendingUp className="w-5 h-5 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-2xl font-bold leading-none" data-testid="stat-total-matters">{financeData.summary.totalActiveMatters}</p>
                            <p className="text-xs text-muted-foreground mt-1">Active matters</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className={financeData.summary.unbilledCount > 0 ? "border-amber-500/50" : ""}>
                        <CardContent className="p-4 flex items-center gap-3">
                          <BadgePoundSterling className={`w-5 h-5 shrink-0 ${financeData.summary.unbilledCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
                          <div>
                            <p className="text-2xl font-bold leading-none" data-testid="stat-unbilled">{financeData.summary.unbilledCount}</p>
                            <p className="text-xs text-muted-foreground mt-1">Unbilled matters</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className={financeData.summary.costsTransparencyCount > 0 ? "border-amber-500/50" : ""}>
                        <CardContent className="p-4 flex items-center gap-3">
                          <FileWarning className={`w-5 h-5 shrink-0 ${financeData.summary.costsTransparencyCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
                          <div>
                            <p className="text-2xl font-bold leading-none" data-testid="stat-costs-transparency">{financeData.summary.costsTransparencyCount}</p>
                            <p className="text-xs text-muted-foreground mt-1">No costs estimate</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className={financeData.summary.timeGapCount > 0 ? "border-amber-500/50" : ""}>
                        <CardContent className="p-4 flex items-center gap-3">
                          <Clock className={`w-5 h-5 shrink-0 ${financeData.summary.timeGapCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
                          <div>
                            <p className="text-2xl font-bold leading-none" data-testid="stat-time-gaps">{financeData.summary.timeGapCount}</p>
                            <p className="text-xs text-muted-foreground mt-1">Time recording gaps</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <section>
                      <h2 className="text-base font-semibold text-foreground mb-3">All active matters</h2>
                      <div className="overflow-x-auto rounded-md border border-border">
                        <table className="w-full text-sm" data-testid="matter-table">
                          <thead>
                            <tr className="border-b border-border bg-muted/40">
                              <th className="text-left px-4 py-2">
                                <FinanceSortButton field="caseTitle" currentField={financeSortField} dir={financeSortDir} onSort={handleFinanceSort} label="Matter" />
                              </th>
                              <th className="text-right px-4 py-2">
                                <FinanceSortButton field="totalMinutes" currentField={financeSortField} dir={financeSortDir} onSort={handleFinanceSort} label="Time recorded" />
                              </th>
                              <th className="text-right px-4 py-2">
                                <FinanceSortButton field="billableValue" currentField={financeSortField} dir={financeSortDir} onSort={handleFinanceSort} label="Billable value" />
                              </th>
                              <th className="text-right px-4 py-2 hidden md:table-cell">
                                Costs estimate
                              </th>
                              <th className="text-right px-4 py-2 hidden lg:table-cell">
                                <FinanceSortButton field="variance" currentField={financeSortField} dir={financeSortDir} onSort={handleFinanceSort} label="Variance" />
                              </th>
                              <th className="text-right px-4 py-2 hidden md:table-cell">
                                <FinanceSortButton field="lastTimeEntryDate" currentField={financeSortField} dir={financeSortDir} onSort={handleFinanceSort} label="Last entry" />
                              </th>
                              <th className="text-center px-4 py-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedFinanceMatters.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">No active matters found.</td>
                              </tr>
                            ) : (
                              sortedFinanceMatters.map((m) => (
                                <tr
                                  key={m.caseId}
                                  className="border-b border-border last:border-0 hover-elevate cursor-pointer"
                                  onClick={() => setLocation(`/case/${m.caseId}`)}
                                  data-testid={`matter-row-${m.caseId}`}
                                >
                                  <td className="px-4 py-3">
                                    <p className="font-medium text-foreground leading-snug">{m.caseTitle}</p>
                                    <p className="text-xs text-muted-foreground">{m.clientName}{m.matterReference ? ` · ${m.matterReference}` : ""}</p>
                                  </td>
                                  <td className="px-4 py-3 text-right tabular-nums">
                                    {m.totalMinutes > 0 ? (
                                      <span>{formatMinutes(m.totalMinutes)}</span>
                                    ) : (
                                      <span className="text-muted-foreground">None</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right tabular-nums">
                                    {m.billableValue > 0 ? formatGBP(m.billableValue) : <span className="text-muted-foreground">-</span>}
                                  </td>
                                  <td className="px-4 py-3 text-right hidden md:table-cell">
                                    {m.costsEstimate ? (
                                      <span className="text-foreground">{m.costsEstimate}</span>
                                    ) : (
                                      <span className="text-muted-foreground">Not recorded</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right hidden lg:table-cell tabular-nums">
                                    {m.variance !== null ? (
                                      <span className={m.variance > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}>
                                        {m.variance > 0 ? "+" : ""}{formatGBP(m.variance)}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right text-xs hidden md:table-cell">
                                    {m.lastTimeEntryDate ? (
                                      <span className={m.noTimeIn30Days ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                                        {formatDistanceToNow(new Date(m.lastTimeEntryDate), { addSuffix: true })}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">Never</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <div className="flex flex-wrap gap-1 justify-center">
                                      {m.noTimeIn30Days && m.hasTimeRecorded && (
                                        <Badge variant="outline" className="text-xs border-amber-500/60 text-amber-700 dark:text-amber-400" data-testid={`badge-inactive-${m.caseId}`}>
                                          Inactive 30d
                                        </Badge>
                                      )}
                                      {!m.hasCostsEstimate && (
                                        <Badge variant="outline" className="text-xs border-amber-500/60 text-amber-700 dark:text-amber-400" data-testid={`badge-no-estimate-${m.caseId}`}>
                                          No estimate
                                        </Badge>
                                      )}
                                      {m.sessionsWithNoEntryCount > 0 && (
                                        <Badge variant="outline" className="text-xs border-amber-500/60 text-amber-700 dark:text-amber-400" data-testid={`badge-time-gap-${m.caseId}`}>
                                          {m.sessionsWithNoEntryCount} session{m.sessionsWithNoEntryCount !== 1 ? "s" : ""} unrecorded
                                        </Badge>
                                      )}
                                      {m.hasCostsEstimate && !m.noTimeIn30Days && m.sessionsWithNoEntryCount === 0 && (
                                        <Badge variant="outline" className="text-xs border-green-500/60 text-green-700 dark:text-green-400">
                                          No issues
                                        </Badge>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <section data-testid="section-unbilled">
                      <h2 className="text-base font-semibold text-foreground mb-1">Unbilled matters</h2>
                      <p className="text-sm text-muted-foreground mb-3">
                        Matters where time has been recorded but no costs communication is on file. The SRA Accounts Rules require that clients receive costs information on an ongoing basis.
                      </p>
                      {unbilledMatters.length === 0 ? (
                        <Card>
                          <CardContent className="p-5 flex items-center gap-3">
                            <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                            <p className="text-sm text-muted-foreground">No matters with unrecorded costs estimates and recorded time.</p>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="space-y-2">
                          {unbilledMatters.map((m) => (
                            <Card
                              key={m.caseId}
                              className="cursor-pointer hover-elevate"
                              onClick={() => setLocation(`/case/${m.caseId}`)}
                              data-testid={`unbilled-row-${m.caseId}`}
                            >
                              <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                                <div>
                                  <p className="font-medium text-foreground text-sm">{m.caseTitle}</p>
                                  <p className="text-xs text-muted-foreground">{m.clientName}{m.matterReference ? ` · ${m.matterReference}` : ""}</p>
                                </div>
                                <div className="flex items-center gap-6 text-sm">
                                  <div className="text-right">
                                    <p className="font-medium tabular-nums">{formatMinutes(m.totalMinutes)}</p>
                                    <p className="text-xs text-muted-foreground">Recorded</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-medium tabular-nums">{formatGBP(m.billableValue)}</p>
                                    <p className="text-xs text-muted-foreground">Billable</p>
                                  </div>
                                  <Badge variant="outline" className="text-xs border-amber-500/60 text-amber-700 dark:text-amber-400 shrink-0">
                                    No costs estimate
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </section>

                    <section data-testid="section-costs-transparency">
                      <h2 className="text-base font-semibold text-foreground mb-1">Costs transparency</h2>
                      <p className="text-sm text-muted-foreground mb-3">
                        Matters where no costs estimate has been recorded at the point of engagement. Under the SRA Transparency Rules, clients must receive costs information at the outset.
                      </p>
                      {costsTransparencyMatters.length === 0 ? (
                        <Card>
                          <CardContent className="p-5 flex items-center gap-3">
                            <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                            <p className="text-sm text-muted-foreground">All active matters have a costs estimate recorded.</p>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="space-y-2">
                          {costsTransparencyMatters.map((m) => (
                            <Card
                              key={m.caseId}
                              className="cursor-pointer hover-elevate"
                              onClick={() => setLocation(`/case/${m.caseId}`)}
                              data-testid={`costs-row-${m.caseId}`}
                            >
                              <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                                <div>
                                  <p className="font-medium text-foreground text-sm">{m.caseTitle}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {m.clientName}{m.matterReference ? ` · ${m.matterReference}` : ""}
                                    {m.practiceArea ? ` · ${m.practiceArea.replace(/_/g, " ")}` : ""}
                                  </p>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  <p className="text-xs text-muted-foreground">
                                    Opened {format(new Date(m.createdAt), "d MMM yyyy")}
                                  </p>
                                  <Badge variant="outline" className="text-xs border-amber-500/60 text-amber-700 dark:text-amber-400 shrink-0">
                                    No costs estimate on file
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </section>

                    <section data-testid="section-time-gaps">
                      <h2 className="text-base font-semibold text-foreground mb-1">Time recording gaps</h2>
                      <p className="text-sm text-muted-foreground mb-3">
                        Sessions where no time entry has been recorded. Accurate time recording is required under the SRA Accounts Rules and supports costs transparency obligations.
                      </p>
                      {timeGapMatters.length === 0 ? (
                        <Card>
                          <CardContent className="p-5 flex items-center gap-3">
                            <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                            <p className="text-sm text-muted-foreground">All sessions have time entries recorded.</p>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="space-y-2">
                          {timeGapMatters.map((m) => (
                            <Card
                              key={m.caseId}
                              className="cursor-pointer hover-elevate"
                              onClick={() => setLocation(`/case/${m.caseId}`)}
                              data-testid={`time-gap-row-${m.caseId}`}
                            >
                              <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                                <div>
                                  <p className="font-medium text-foreground text-sm">{m.caseTitle}</p>
                                  <p className="text-xs text-muted-foreground">{m.clientName}{m.matterReference ? ` · ${m.matterReference}` : ""}</p>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  <div className="text-right">
                                    <p className="font-medium">{m.sessionsWithNoEntryCount} of {m.sessionCount}</p>
                                    <p className="text-xs text-muted-foreground">Sessions unrecorded</p>
                                  </div>
                                  <Badge variant="outline" className="text-xs border-amber-500/60 text-amber-700 dark:text-amber-400 shrink-0">
                                    Time gap
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
        </>
      )}
    </div>
  );
}
