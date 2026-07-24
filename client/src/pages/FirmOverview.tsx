import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Clock, FileCheck, Loader2, Users, Video } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import type { Firm } from "@shared/schema";

type StatsRange = "today" | "48h" | "week" | "all";

type FirmEvaluationStats = {
  range: StatsRange;
  meetingsConducted: number;
  meetingHoursRecorded: number;
  notesProduced: number;
  lettersProduced: number;
  notesAdopted: number;
  lettersAdopted: number;
  documentsSent: number;
  hoursProtected: number;
  seats: { used: number; limit: number | null; members: number; pendingInvites: number };
  byMember: Array<{
    userId: string;
    name: string;
    meetings: number;
    notesAdopted: number;
  }>;
};

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function rangeLabel(range: StatsRange): string {
  switch (range) {
    case "today":
      return "today";
    case "48h":
      return "in the last 48 hours";
    case "week":
      return "this week";
    case "all":
      return "all time";
  }
}

function formatHours(n: number): string {
  if (n === 0) return "0";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

const RANGE_OPTIONS: { value: StatsRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "48h", label: "Last 48 hours" },
  { value: "week", label: "This week" },
  { value: "all", label: "All time" },
];

export default function FirmOverview() {
  const { user, isFirmAdmin } = useAuth();
  const [range, setRange] = useState<StatsRange>("today");

  const firstName =
    user?.firstName?.trim().split(/\s+/)[0] ||
    user?.email?.split("@")[0] ||
    "there";

  const { data: firm, isLoading: firmLoading } = useQuery<Firm>({
    queryKey: ["/api/firm"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<FirmEvaluationStats>({
    queryKey: ["/api/firm/evaluation-stats", range],
    queryFn: async () => {
      const res = await fetch(`/api/firm/evaluation-stats?range=${range}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load firm stats");
      return res.json();
    },
    enabled: isFirmAdmin,
  });

  const narrative = useMemo(() => {
    if (!stats) return null;
    const meetings = stats.meetingsConducted;
    const notes = stats.notesAdopted;
    const hours = formatHours(stats.hoursProtected);
    const period = rangeLabel(range);
    return `${firstName}, your team ran ${meetings} meeting${meetings === 1 ? "" : "s"}, produced ${notes} adopted note${notes === 1 ? "" : "s"}, and protected ${hours} hour${hours === "1" ? "" : "s"} ${period}.`;
  }, [stats, firstName, range]);

  if (!isFirmAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Firm overview</CardTitle>
            <CardDescription>Only firm leads can view team evaluation stats.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const loading = firmLoading || statsLoading;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0" data-testid="firm-overview-welcome">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {getTimeBasedGreeting()}, {firstName}
            </h1>
            {firm?.name && (
              <p className="text-sm text-muted-foreground mt-1">{firm.name}</p>
            )}
            {narrative && (
              <p className="text-base text-foreground/90 mt-3 max-w-2xl leading-relaxed">
                {narrative}
              </p>
            )}
            {loading && !stats && (
              <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading team activity…
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {RANGE_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={range === opt.value ? "default" : "outline"}
                onClick={() => setRange(opt.value)}
                data-testid={`firm-stats-range-${opt.value}`}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {firm?.isEvaluation && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">Evaluation</Badge>
            {stats?.seats && (
              <span className="text-muted-foreground">
                Seats {stats.seats.used}
                {stats.seats.limit != null ? ` / ${stats.seats.limit}` : ""}
                {stats.seats.pendingInvites > 0
                  ? ` (${stats.seats.pendingInvites} pending invite${stats.seats.pendingInvites === 1 ? "" : "s"})`
                  : ""}
              </span>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href="/team">Manage team</Link>
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Hours protected
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums" data-testid="stat-hours-protected">
                {stats ? formatHours(stats.hoursProtected) : "—"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Vs manual note-up (~45 mins/hour recorded, capped at 90 mins, minus ~12 mins review)
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5" />
                Meetings
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {stats?.meetingsConducted ?? "—"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {stats ? `${formatHours(stats.meetingHoursRecorded)} hours recorded` : "—"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5" />
                Notes adopted
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {stats?.notesAdopted ?? "—"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {stats
                ? `${stats.notesProduced} produced · ${stats.lettersAdopted} letters adopted`
                : "—"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Team seats
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {stats
                  ? `${stats.seats.used}${stats.seats.limit != null ? `/${stats.seats.limit}` : ""}`
                  : "—"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {stats
                ? `${stats.seats.members} member${stats.seats.members === 1 ? "" : "s"}`
                : "—"}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Team breakdown</CardTitle>
            <CardDescription>Activity by fee earner for the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
            {!stats || stats.byMember.length === 0 ? (
              <p className="text-sm text-muted-foreground">No team members yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Meetings</TableHead>
                    <TableHead className="text-right">Notes adopted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.byMember.map((m) => (
                    <TableRow key={m.userId}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.meetings}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.notesAdopted}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
