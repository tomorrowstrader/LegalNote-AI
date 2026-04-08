import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  Clock,
  FileText,
  Users,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Timer,
  MessageSquare,
  ClipboardList,
  ChevronRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { DemoLeadMatter } from "@/data/demoData";

interface DemoCaseDetailProps {
  matter: DemoLeadMatter;
  onViewDocument: () => void;
  onViewTranscript: () => void;
  onViewAudit: () => void;
  onBack: () => void;
}

export function DemoCaseDetail({ matter, onViewDocument, onViewTranscript, onViewAudit, onBack }: DemoCaseDetailProps) {
  const [activeTab, setActiveTab] = useState("sessions");
  const { toast } = useToast();

  const showDemoToast = (label: string) => {
    toast({ title: "Demo only", description: `${label} is not functional in the demo. In your live environment, this would work as expected.`, duration: 3000 });
  };

  const undertakingStatusConfig = {
    outstanding: { label: "Outstanding", cls: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800" },
    completed: { label: "Completed", cls: "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800" },
    overdue: { label: "Overdue", cls: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800" },
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <button onClick={onBack} className="hover:text-foreground transition-colors">Dashboard</button>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground font-medium truncate">{matter.title}</span>
      </div>

      {/* Matter header */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">{matter.ref}</span>
                <Badge variant="outline" className="text-xs bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800">Overdue</Badge>
                <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700">High Risk</Badge>
              </div>
              <h2 className="text-xl font-bold">{matter.title}</h2>
              <p className="text-sm text-muted-foreground">
                Client: {matter.clientName} &middot; Solicitor: {matter.solicitor} &middot; Opened: {format(parseISO(matter.openedDate), "d MMM yyyy")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => showDemoToast("Share")} data-testid="button-share-matter">
                Share
              </Button>
              <Button size="sm" onClick={() => showDemoToast("New Session")} data-testid="button-new-session">
                New Session
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="case-detail-tabs">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="sessions" data-testid="case-sessions-tab" data-demo-target="case-sessions-tab" className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sessions</span>
            <span className="sm:hidden text-xs">Sessions</span>
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="case-documents-tab" className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Documents</span>
            <span className="sm:hidden text-xs">Docs</span>
          </TabsTrigger>
          <TabsTrigger value="transcript" data-testid="case-transcript-tab" data-demo-target="case-transcript-preview" className="flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Transcript</span>
            <span className="sm:hidden text-xs">Trans.</span>
          </TabsTrigger>
          <TabsTrigger value="compliance" data-testid="case-compliance-tab" className="flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Compliance</span>
            <span className="sm:hidden text-xs">Comp.</span>
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="case-audit-tab" className="flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Audit</span>
            <span className="sm:hidden text-xs">Audit</span>
          </TabsTrigger>
        </TabsList>

        {/* Sessions tab */}
        <TabsContent value="sessions" className="space-y-3 mt-4">
          <p className="text-xs text-muted-foreground">{matter.sessions.length} sessions recorded for this matter</p>
          {matter.sessions.map((session, idx) => (
            <Card key={session.id} data-testid={`session-card-${session.id}`} data-demo-target={idx === 0 ? "case-session-card-first" : undefined}>
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-xs">{session.type}</Badge>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {format(parseISO(session.date), "d MMM yyyy")}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {session.duration}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{session.summary}</p>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="w-3 h-3" />
                      {session.attendees.join(" · ")}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {session.transcriptProduced && (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle2 className="w-3 h-3" /> Transcript produced
                        </span>
                      )}
                      {session.noteProduced && (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle2 className="w-3 h-3" /> Attendance note generated
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 flex-shrink-0">
                    {session.transcriptProduced && (
                      <Button variant="outline" size="sm" onClick={onViewTranscript} data-testid={`button-view-transcript-${session.id}`}>
                        <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                        Transcript
                      </Button>
                    )}
                    {session.noteProduced && (
                      <Button variant="outline" size="sm" onClick={onViewDocument} data-testid={`button-view-note-${session.id}`}>
                        <FileText className="w-3.5 h-3.5 mr-1.5" />
                        View Note
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Documents tab */}
        <TabsContent value="documents" className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Documents generated for this matter</p>
            <Button size="sm" variant="outline" onClick={onViewDocument} data-testid="button-view-all-documents">
              View Attendance Note <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
          {(matter.documents ?? [
            { id: "d1", title: "Attendance Note — Initial Consultation", type: "Attendance Note", status: "approved" as const },
            { id: "d2", title: "Client Care Letter", type: "Client Care Letter", status: "approved" as const },
            { id: "d3", title: "Court Application Form", type: "Court Form", status: "approved" as const },
            { id: "d4", title: "Position Statement", type: "Court Document", status: "draft" as const },
          ]).map((doc) => {
            const sc = {
              approved: { label: "Approved", cls: "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800" },
              draft: { label: "Draft", cls: "bg-muted text-muted-foreground border-border" },
              pending_review: { label: "Pending Review", cls: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800" },
            }[doc.status] ?? { label: doc.status, cls: "bg-muted text-muted-foreground border-border" };
            return (
              <div
                key={doc.id}
                className="flex flex-wrap items-center gap-3 p-3 rounded-md border border-border hover-elevate cursor-pointer"
                data-testid={`case-doc-row-${doc.id}`}
                onClick={doc.type === "Attendance Note" ? onViewDocument : () => showDemoToast("Document viewer")}
              >
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">{doc.type}</p>
                </div>
                <Badge variant="outline" className={`text-xs flex-shrink-0 ${sc.cls}`}>{sc.label}</Badge>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">Open</Button>
              </div>
            );
          })}
        </TabsContent>

        {/* Transcript tab */}
        <TabsContent value="transcript" className="mt-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-sm font-medium">Initial Consultation Transcript</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(matter.transcriptWordCount ?? matter.transcript.reduce((n, t) => n + t.text.split(" ").length, 0)).toLocaleString()} words &middot; {matter.transcriptDuration ?? "–"} &middot; Diarized, 2 speakers
                  </p>
                </div>
                <Button onClick={onViewTranscript} data-testid="button-view-full-transcript">
                  View Full Transcript <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
              <div className="space-y-3 opacity-60 select-none pointer-events-none">
                {matter.transcript.slice(0, 3).map((turn) => (
                  <div key={turn.id} className="flex gap-3">
                    <Badge variant="outline" className="text-xs flex-shrink-0 h-5 self-start mt-0.5">
                      {turn.speaker}
                    </Badge>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{turn.text}</p>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground italic text-center pt-2">— Click "View Full Transcript" to read all {matter.transcript.length} turns —</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance tab */}
        <TabsContent value="compliance" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Undertakings */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Undertakings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {matter.undertakings.map((u) => {
                  const sc = undertakingStatusConfig[u.status as keyof typeof undertakingStatusConfig] ?? undertakingStatusConfig.outstanding;
                  return (
                    <div key={u.id} className="p-3 rounded-md border border-border space-y-1" data-testid={`undertaking-${u.id}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium leading-relaxed">{u.description}</p>
                        <Badge variant="outline" className={`text-xs flex-shrink-0 ${sc.cls}`}>{sc.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Given by: {u.givenBy} &middot; To: {u.givenTo}</p>
                      <p className="text-xs text-muted-foreground">Due: {format(parseISO(u.dueDate), "d MMM yyyy")}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Time entries */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Time Entries</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {matter.timeEntries.map((te) => (
                  <div key={te.id} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0" data-testid={`time-entry-${te.id}`}>
                    <Timer className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{te.description}</p>
                      <p className="text-xs text-muted-foreground">{format(parseISO(te.date), "d MMM yyyy")} &middot; {te.units} units</p>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground flex-shrink-0">£{te.fee.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
                  <span className="text-xs font-medium">Total billed</span>
                  <span className="text-sm font-bold">£{matter.timeEntries.reduce((sum, te) => sum + te.fee, 0).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Audit tab (summary) */}
        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-sm font-medium">Audit Trail — {matter.auditTrail.length} events</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Tamper-evident &middot; HMAC-SHA256 signed</p>
                </div>
                <Button variant="outline" size="sm" onClick={onViewAudit} data-testid="button-view-full-audit">
                  View Full Audit Trail <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </div>
              <div className="space-y-2">
                {matter.auditTrail.slice(0, 4).map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium">{entry.eventType}</span>
                        <span className="text-xs text-muted-foreground">{format(parseISO(entry.timestamp), "d MMM, HH:mm")}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
