import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  BadgePoundSterling,
  Clock,
  FileWarning,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

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

type SortField = "caseTitle" | "totalMinutes" | "billableValue" | "variance" | "lastTimeEntryDate" | "sessionsWithNoEntryCount";
type SortDir = "asc" | "desc";

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

function SortButton({ field, currentField, dir, onSort, label }: {
  field: SortField;
  currentField: SortField;
  dir: SortDir;
  onSort: (f: SortField) => void;
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

export default function FirmComplianceDashboard() {
  const [, setLocation] = useLocation();
  const { isCOFA, isFirmAdmin, user } = useAuth();
  const isManagingPartner = user?.primaryRole === "managing_partner";

  const [sortField, setSortField] = useState<SortField>("caseTitle");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const { data, isLoading, error } = useQuery<FinanceComplianceData>({
    queryKey: ["/api/firm/finance-compliance"],
  });

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const sortedMatters = useMemo(() => {
    if (!data?.matters) return [];
    return [...data.matters].sort((a, b) => {
      let aVal: string | number | null;
      let bVal: string | number | null;

      switch (sortField) {
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
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [data?.matters, sortField, sortDir]);

  const unbilledMatters = useMemo(() => sortedMatters.filter(m => m.hasTimeRecorded && !m.hasCostsEstimate), [sortedMatters]);
  const costsTransparencyMatters = useMemo(() => sortedMatters.filter(m => !m.hasCostsEstimate), [sortedMatters]);
  const timeGapMatters = useMemo(() => sortedMatters.filter(m => m.sessionsWithNoEntryCount > 0), [sortedMatters]);

  if (!isCOFA && !isFirmAdmin && !isManagingPartner) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-sm w-full mx-4">
          <CardContent className="p-6 text-center">
            <ShieldCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-foreground mb-1">Access restricted</p>
            <p className="text-sm text-muted-foreground">This view is available to the COFA, firm administrators, and managing partners.</p>
            <Button variant="ghost" className="mt-4" onClick={() => setLocation("/")}>Return to dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8">
          <Skeleton className="h-10 w-64 mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8">
          <Button variant="ghost" onClick={() => setLocation("/")} className="mb-6 gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Card>
            <CardContent className="p-8 text-center">
              <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-3" />
              <p className="text-foreground font-medium mb-1">Finance compliance data could not be loaded.</p>
              <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8">
        <Button
          variant="ghost"
          onClick={() => setLocation("/")}
          className="mb-6 gap-2"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-1 flex items-center gap-3">
            <BadgePoundSterling className="w-7 h-7 text-accent" />
            Finance Compliance
          </h1>
          <p className="text-muted-foreground text-sm">
            Firm-wide financial compliance overview. Covers time recording obligations, costs transparency requirements, and billable matter status.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Generated {format(new Date(data.generatedAt), "d MMMM yyyy 'at' HH:mm")}
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10" data-testid="finance-summary-cards">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-2xl font-bold leading-none" data-testid="stat-total-matters">{summary.totalActiveMatters}</p>
                <p className="text-xs text-muted-foreground mt-1">Active matters</p>
              </div>
            </CardContent>
          </Card>
          <Card className={summary.unbilledCount > 0 ? "border-amber-500/50" : ""}>
            <CardContent className="p-4 flex items-center gap-3">
              <BadgePoundSterling className={`w-5 h-5 shrink-0 ${summary.unbilledCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
              <div>
                <p className="text-2xl font-bold leading-none" data-testid="stat-unbilled">{summary.unbilledCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Unbilled matters</p>
              </div>
            </CardContent>
          </Card>
          <Card className={summary.costsTransparencyCount > 0 ? "border-amber-500/50" : ""}>
            <CardContent className="p-4 flex items-center gap-3">
              <FileWarning className={`w-5 h-5 shrink-0 ${summary.costsTransparencyCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
              <div>
                <p className="text-2xl font-bold leading-none" data-testid="stat-costs-transparency">{summary.costsTransparencyCount}</p>
                <p className="text-xs text-muted-foreground mt-1">No costs estimate</p>
              </div>
            </CardContent>
          </Card>
          <Card className={summary.timeGapCount > 0 ? "border-amber-500/50" : ""}>
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className={`w-5 h-5 shrink-0 ${summary.timeGapCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
              <div>
                <p className="text-2xl font-bold leading-none" data-testid="stat-time-gaps">{summary.timeGapCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Time recording gaps</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Full matter table */}
        <section className="mb-10">
          <h2 className="text-base font-semibold text-foreground mb-3">All active matters</h2>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm" data-testid="matter-table">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-2">
                    <SortButton field="caseTitle" currentField={sortField} dir={sortDir} onSort={handleSort} label="Matter" />
                  </th>
                  <th className="text-right px-4 py-2">
                    <SortButton field="totalMinutes" currentField={sortField} dir={sortDir} onSort={handleSort} label="Time recorded" />
                  </th>
                  <th className="text-right px-4 py-2">
                    <SortButton field="billableValue" currentField={sortField} dir={sortDir} onSort={handleSort} label="Billable value" />
                  </th>
                  <th className="text-right px-4 py-2 hidden md:table-cell">
                    Costs estimate
                  </th>
                  <th className="text-right px-4 py-2 hidden lg:table-cell">
                    <SortButton field="variance" currentField={sortField} dir={sortDir} onSort={handleSort} label="Variance" />
                  </th>
                  <th className="text-right px-4 py-2 hidden md:table-cell">
                    <SortButton field="lastTimeEntryDate" currentField={sortField} dir={sortDir} onSort={handleSort} label="Last entry" />
                  </th>
                  <th className="text-center px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedMatters.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">No active matters found.</td>
                  </tr>
                ) : (
                  sortedMatters.map((m) => (
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

        {/* Unbilled Matters */}
        <section className="mb-10" data-testid="section-unbilled">
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

        {/* Costs Transparency */}
        <section className="mb-10" data-testid="section-costs-transparency">
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

        {/* Time Recording Gaps */}
        <section className="mb-10" data-testid="section-time-gaps">
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
    </div>
  );
}
