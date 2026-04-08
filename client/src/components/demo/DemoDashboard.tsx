import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  ShieldAlert,
  TrendingUp,
  AlertCircle,
  Folders,
  ArrowRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import type { DemoMatter, DemoObligation, DemoVariant } from "@/data/demoData";

interface DemoDashboardProps {
  variant: DemoVariant;
  matters: DemoMatter[];
  obligations: DemoObligation[];
  displayName: string;
  displayFirm: string;
  practiceAreaLabel: string;
  onViewCaseDetail: () => void;
}

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function ScoreGauge({ score }: { score: number }) {
  const color =
    score >= 85
      ? "text-green-600 dark:text-green-400"
      : score >= 70
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";

  const barColor =
    score >= 85
      ? "bg-green-500"
      : score >= 70
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className="space-y-2" data-testid="compliance-score-gauge">
      <div className="flex items-end gap-2">
        <span className={`text-5xl font-bold tabular-nums ${color}`}>{score}</span>
        <span className={`text-2xl font-semibold mb-1 ${color}`}>%</span>
      </div>
      <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">Compliance Readiness Score</p>
    </div>
  );
}

function ObligationCard({ obligation }: { obligation: DemoObligation }) {
  const isOverdue = obligation.status === "overdue";
  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-md border ${
        isOverdue
          ? "border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/30"
          : "border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30"
      }`}
      data-testid={`obligation-card-${obligation.id}`}
    >
      <div className="mt-0.5 flex-shrink-0">
        {isOverdue ? (
          <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <Badge
            variant="outline"
            className={`text-xs ${
              isOverdue
                ? "border-red-300 dark:border-red-700 text-red-700 dark:text-red-300"
                : "border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
            }`}
          >
            {isOverdue
              ? `Overdue ${obligation.daysOverdue === 1 ? "1 day" : `${obligation.daysOverdue} days`}`
              : `Due in ${obligation.daysDue} day${obligation.daysDue === 1 ? "" : "s"}`}
          </Badge>
          <span className="text-xs text-muted-foreground truncate">{obligation.matterTitle}</span>
        </div>
        <p className="text-sm font-medium">{obligation.type}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{obligation.description}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Due: {format(parseISO(obligation.dueDate), "d MMM yyyy")}
        </p>
      </div>
    </div>
  );
}

function MatterRow({ matter, onViewDetail }: { matter: DemoMatter; onViewDetail?: () => void }) {
  const statusConfig = {
    active: { label: "Active", cls: "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800" },
    review_required: { label: "Review Required", cls: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800" },
    overdue: { label: "Overdue", cls: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800" },
  };
  const riskConfig = {
    low: { label: "Low Risk", cls: "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800" },
    medium: { label: "Medium Risk", cls: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
    high: { label: "High Risk", cls: "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800" },
  };
  const sc = statusConfig[matter.status];
  const rc = riskConfig[matter.riskLevel];
  const isLead = matter.id.endsWith("1");

  return (
    <div
      className="flex flex-wrap items-center gap-3 p-3 rounded-md border border-border hover-elevate cursor-pointer"
      data-testid={`matter-row-${matter.id}`}
      onClick={isLead ? onViewDetail : undefined}
    >
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <span className="text-xs text-muted-foreground font-mono">{matter.ref}</span>
        </div>
        <p className="text-sm font-medium truncate">{matter.title}</p>
        <p className="text-xs text-muted-foreground">
          Last activity: {format(parseISO(matter.lastActivity), "d MMM yyyy")}
          {matter.nextDeadline && (
            <> &middot; Next deadline: {format(parseISO(matter.nextDeadline), "d MMM yyyy")}</>
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 flex-shrink-0">
        <Badge variant="outline" className={`text-xs ${sc.cls}`}>{sc.label}</Badge>
        <Badge variant="outline" className={`text-xs ${rc.cls}`}>{rc.label}</Badge>
        {matter.obligationsDue > 0 && (
          <Badge variant="outline" className="text-xs border-red-300 dark:border-red-700 text-red-700 dark:text-red-300">
            {matter.obligationsDue} obligation{matter.obligationsDue !== 1 ? "s" : ""} overdue
          </Badge>
        )}
        {isLead && onViewDetail && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={(e) => { e.stopPropagation(); onViewDetail(); }}>
            View <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function DemoDashboard({ variant, matters, obligations, displayName, displayFirm, practiceAreaLabel, onViewCaseDetail }: DemoDashboardProps) {
  const greeting = getTimeBasedGreeting();
  const overdue = obligations.filter((o) => o.status === "overdue");
  const dueSoon = obligations.filter((o) => o.status === "due_soon");

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Greeting */}
      <div data-testid="demo-greeting">
        <h1 className="text-2xl font-bold">
          {greeting}, {displayName} — welcome to your {displayFirm} dashboard
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your real-time compliance view across all active {practiceAreaLabel} matters.
          {overdue.length > 0 && (
            <span className="text-red-600 dark:text-red-400 font-medium">
              {" "}You have {overdue.length} overdue obligation{overdue.length !== 1 ? "s" : ""} requiring immediate attention.
            </span>
          )}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="stats-row" data-demo-target="stats-row">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Folders className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Active Matters</span>
            </div>
            <p className="text-2xl font-bold" data-testid="stat-active-matters">{variant.stats.activeMatters}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Overdue Items</span>
            </div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="stat-overdue-items">{variant.stats.overdueItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Pending Review</span>
            </div>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="stat-pending-review">{variant.stats.pendingReview}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Docs Generated</span>
            </div>
            <p className="text-2xl font-bold" data-testid="stat-docs-generated">{variant.stats.documentsGenerated}</p>
          </CardContent>
        </Card>
      </div>

      {/* Compliance score + obligations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1" data-testid="card-compliance-score" data-demo-target="card-compliance-score">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <CardTitle className="text-base">Compliance Score</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ScoreGauge score={variant.complianceScore} />
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{overdue.length} overdue obligation{overdue.length !== 1 ? "s" : ""}</span>
              </div>
              {dueSoon.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{dueSoon.length} obligation{dueSoon.length !== 1 ? "s" : ""} due soon</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{variant.stats.activeMatters} active matter{variant.stats.activeMatters !== 1 ? "s" : ""} tracked</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2" data-testid="card-obligations" data-demo-target="card-obligations">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <CardTitle className="text-base">Compliance Obligations</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">
              Overdue and near-due obligations across your active matters
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {obligations.map((o) => (
              <ObligationCard key={o.id} obligation={o} />
            ))}
            {obligations.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                No overdue or near-due obligations
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Matter list */}
      <Card data-testid="card-matter-list" data-demo-target="card-matter-list">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Folders className="w-4 h-4" />
              <CardTitle className="text-base">Active Matters — {practiceAreaLabel}</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">{matters.length} matters</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {matters.map((m) => (
            <MatterRow key={m.id} matter={m} onViewDetail={onViewCaseDetail} />
          ))}
        </CardContent>
      </Card>

      {/* Generated documents */}
      <Card data-testid="card-documents">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <CardTitle className="text-base">Generated Documents</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">{variant.documents.length} documents</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Attendance notes, client care letters, and more — auto-generated from your recordings
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {variant.documents.map((d) => {
            const sc = {
              approved: { label: "Approved", cls: "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800" },
              draft: { label: "Draft", cls: "bg-muted text-muted-foreground border-border" },
              pending_review: { label: "Pending Review", cls: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800" },
            }[d.status];
            return (
              <div key={d.id} className="flex flex-wrap items-center gap-3 p-3 rounded-md border border-border" data-testid={`document-row-${d.id}`}>
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.title}</p>
                  <p className="text-xs text-muted-foreground">{d.type} &middot; Generated {format(parseISO(d.generatedAt), "d MMM yyyy")}</p>
                </div>
                <Badge variant="outline" className={`text-xs flex-shrink-0 ${sc.cls}`}>{sc.label}</Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
