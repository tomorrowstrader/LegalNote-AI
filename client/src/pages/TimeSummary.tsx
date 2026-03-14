import { useState } from "react";
import { ArrowLeft, Download, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { TimeEntry } from "@shared/schema";

type TimeEntryWithMeta = TimeEntry & {
  caseTitle?: string;
  clientName?: string;
  userName?: string;
};

export default function TimeSummary() {
  const [, setLocation] = useLocation();
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0]);

  const queryParams = new URLSearchParams();
  if (startDate) queryParams.set("startDate", new Date(startDate).toISOString());
  if (endDate) queryParams.set("endDate", new Date(endDate + "T23:59:59").toISOString());

  const { data: entries = [], isLoading } = useQuery<TimeEntryWithMeta[]>({
    queryKey: ["/api/time-entries", startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/time-entries?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch time entries");
      return res.json();
    },
  });

  const totalMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0);
  const totalValue = entries.reduce((sum, e) => sum + (e.durationMinutes / 60) * (parseFloat(e.hourlyRate) || 0), 0);
  const confirmedEntries = entries.filter(e => e.status === "confirmed");
  const draftEntries = entries.filter(e => e.status === "draft");
  const totalHours = (totalMinutes / 60).toFixed(1);

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", new Date(startDate).toISOString());
    if (endDate) params.set("endDate", new Date(endDate + "T23:59:59").toISOString());
    window.open(`/api/time-entries/export-csv?${params.toString()}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-8">
        <Button
          variant="ghost"
          onClick={() => setLocation("/")}
          className="mb-6 gap-2"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>

        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold text-foreground flex items-center gap-3">
              <Clock className="w-8 h-8" />
              Time Summary
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              View and export billable time across all matters
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleExportCSV}
            className="gap-2"
            data-testid="button-export-csv"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-end gap-4 flex-wrap">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="input-end-date"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-2xl font-semibold text-foreground" data-testid="text-total-entries">{entries.length}</p>
              <p className="text-xs text-muted-foreground">Total Entries</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-2xl font-semibold text-foreground" data-testid="text-total-hours">{totalHours}h</p>
              <p className="text-xs text-muted-foreground">Total Hours</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-2xl font-semibold text-foreground" data-testid="text-total-value">£{totalValue.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Total Value</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-2xl font-semibold text-green-600 dark:text-green-400" data-testid="text-confirmed-count">{confirmedEntries.length}</p>
              <p className="text-xs text-muted-foreground">Confirmed</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Time Entries</CardTitle>
            <CardDescription>
              {draftEntries.length > 0 && `${draftEntries.length} draft entries awaiting confirmation`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : entries.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-6 text-center" data-testid="text-no-entries">
                No time entries found for the selected date range
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium text-muted-foreground">Date</th>
                      <th className="pb-2 font-medium text-muted-foreground">Fee Earner</th>
                      <th className="pb-2 font-medium text-muted-foreground">Matter</th>
                      <th className="pb-2 font-medium text-muted-foreground">Client</th>
                      <th className="pb-2 font-medium text-muted-foreground">Description</th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">Duration</th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">Rate</th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">Total</th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {entries.map((entry) => {
                      const entryTotal = ((entry.durationMinutes / 60) * parseFloat(entry.hourlyRate)).toFixed(2);
                      return (
                        <tr key={entry.id} data-testid={`row-time-entry-${entry.id}`}>
                          <td className="py-2">
                            {new Date(entry.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </td>
                          <td className="py-2">{entry.userName || "-"}</td>
                          <td className="py-2 max-w-[150px] truncate">{entry.caseTitle || "-"}</td>
                          <td className="py-2">{entry.clientName || "-"}</td>
                          <td className="py-2 max-w-[200px] truncate">{entry.description}</td>
                          <td className="py-2 text-right">{entry.durationMinutes}m</td>
                          <td className="py-2 text-right">£{entry.hourlyRate}</td>
                          <td className="py-2 text-right font-medium">£{entryTotal}</td>
                          <td className="py-2 text-right">
                            <Badge
                              variant={entry.status === "confirmed" ? "default" : "outline"}
                              className={entry.status === "confirmed" ? "bg-accent" : ""}
                            >
                              {entry.status === "confirmed" ? "Confirmed" : "Draft"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-medium">
                      <td colSpan={5} className="py-2">Totals</td>
                      <td className="py-2 text-right">{totalMinutes}m</td>
                      <td className="py-2 text-right"></td>
                      <td className="py-2 text-right">£{totalValue.toFixed(2)}</td>
                      <td className="py-2 text-right"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
