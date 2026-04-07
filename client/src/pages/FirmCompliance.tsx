import { useState } from "react";
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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { format, differenceInDays } from "date-fns";
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
    caseId: string;
    caseTitle: string;
    matterReference: string | null;
    wording: string;
    feeEarnerName: string;
    dateGiven: string;
    daysOutstanding: number;
  }>;
  supervisionByFeeEarner: Array<{
    feeEarnerId: string;
    feeEarnerName: string;
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

type SortField = "ragStatus" | "feeEarnerName" | "practiceArea" | "createdAt" | "outstandingItems";
type SortDir = "asc" | "desc";

const RAG_SORT_ORDER = { red: 0, amber: 1, green: 2 };

function RagBadge({ status }: { status: "red" | "amber" | "green" }) {
  const config = {
    red: { label: "Red", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800" },
    amber: { label: "Amber", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
    green: { label: "Green", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800" },
  };
  const { label, className } = config[status];
  return <Badge variant="outline" className={className}>{label}</Badge>;
}

function SortButton({ field, currentField, dir, onSort }: {
  field: SortField; currentField: SortField; dir: SortDir; onSort: (f: SortField) => void;
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

export default function FirmCompliance() {
  const [, setLocation] = useLocation();
  const { canAccessFirmCompliance, isLoading: authLoading } = useAuth();
  const [sortField, setSortField] = useState<SortField>("ragStatus");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const { data: overview, isLoading } = useQuery<ComplianceOverview>({
    queryKey: ["/api/firm/compliance-overview"],
    enabled: canAccessFirmCompliance,
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
                                <p className="text-sm">
                                  {matter.practiceArea
                                    ? (PRACTICE_AREA_LABELS as any)[matter.practiceArea] || matter.practiceArea
                                    : <span className="text-muted-foreground">Not set</span>}
                                </p>
                              </TableCell>
                              <TableCell>
                                <p className="text-sm">{format(new Date(matter.createdAt), "d MMM yyyy")}</p>
                              </TableCell>
                              <TableCell>
                                {matter.outstandingItems > 0 ? (
                                  <div className="space-y-0.5">
                                    <span className="text-sm font-medium text-amber-600 dark:text-amber-400">{matter.outstandingItems}</span>
                                    {matter.issues.slice(0, 2).map((issue, i) => (
                                      <p key={i} className="text-xs text-muted-foreground">{issue}</p>
                                    ))}
                                  </div>
                                ) : (
                                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
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
              <Card data-testid="card-undertakings-register">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    <AlertTriangle className="w-4 h-4" />
                    Undertakings Register
                    <Badge variant="outline">{overview?.undertakings.length ?? 0} outstanding</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {!overview?.undertakings.length ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                      <CheckCircle2 className="w-8 h-8 text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground">No outstanding undertakings across the firm.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Matter</TableHead>
                            <TableHead>Wording</TableHead>
                            <TableHead>Fee Earner</TableHead>
                            <TableHead>Date Given</TableHead>
                            <TableHead>Days Outstanding</TableHead>
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
                                <p className="font-medium text-sm">{u.caseTitle}</p>
                                {u.matterReference && (
                                  <p className="text-xs text-muted-foreground">{u.matterReference}</p>
                                )}
                              </TableCell>
                              <TableCell>
                                <p className="text-sm max-w-xs truncate" title={u.wording} data-testid={`text-undertaking-wording-${u.id}`}>{u.wording}</p>
                              </TableCell>
                              <TableCell>
                                <p className="text-sm">{u.feeEarnerName}</p>
                              </TableCell>
                              <TableCell>
                                <p className="text-sm">{format(new Date(u.dateGiven), "d MMM yyyy")}</p>
                              </TableCell>
                              <TableCell>
                                <span className={`text-sm font-medium ${u.daysOutstanding > 30 ? "text-red-600 dark:text-red-400" : u.daysOutstanding > 14 ? "text-amber-600 dark:text-amber-400" : ""}`}
                                  data-testid={`text-days-outstanding-${u.id}`}>
                                  {u.daysOutstanding} day{u.daysOutstanding !== 1 ? "s" : ""}
                                </span>
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
          </Tabs>
        </>
      )}
    </div>
  );
}
