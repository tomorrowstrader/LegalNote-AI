import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Mic,
  MicOff,
  FileText,
  CheckCircle2,
  Share2,
  AlertTriangle,
  Link,
  Clock,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import type { DemoLeadMatter } from "@/data/demoData";

interface DemoAuditTrailProps {
  matter: DemoLeadMatter;
  onBack: () => void;
}

const EVENT_ICONS: Record<string, React.ElementType> = {
  "Consent Obtained": CheckCircle2,
  "Recording Started": Mic,
  "Recording Completed": MicOff,
  "Transcript Produced": FileText,
  "Attendance Note Generated": FileText,
  "Document Generated": FileText,
  "Document Approved": CheckCircle2,
  "Document Created": FileText,
  "Client Care Letter Issued": Share2,
  "Secure Link Shared": Link,
  "AML Check Initiated": Shield,
  "Compliance Alert": AlertTriangle,
  "Default": Clock,
};

const EVENT_COLORS: Record<string, string> = {
  "Consent Obtained": "text-green-600 dark:text-green-400",
  "Recording Started": "text-blue-600 dark:text-blue-400",
  "Recording Completed": "text-blue-600 dark:text-blue-400",
  "Transcript Produced": "text-purple-600 dark:text-purple-400",
  "Attendance Note Generated": "text-purple-600 dark:text-purple-400",
  "Document Generated": "text-purple-600 dark:text-purple-400",
  "Document Approved": "text-green-600 dark:text-green-400",
  "Document Created": "text-muted-foreground",
  "Client Care Letter Issued": "text-blue-600 dark:text-blue-400",
  "Secure Link Shared": "text-amber-600 dark:text-amber-400",
  "AML Check Initiated": "text-orange-600 dark:text-orange-400",
  "Compliance Alert": "text-red-600 dark:text-red-400",
  "Default": "text-muted-foreground",
};

export function DemoAuditTrail({ matter, onBack }: DemoAuditTrailProps) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <button onClick={onBack} className="hover:text-foreground transition-colors">
          Case Detail
        </button>
        <span>/</span>
        <span className="text-foreground font-medium">Audit Trail</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Audit Trail</h2>
          </div>
          <p className="text-sm text-muted-foreground">{matter.title}</p>
          <p className="text-xs text-muted-foreground">{matter.auditTrail.length} events recorded</p>
        </div>
      </div>

      {/* Tamper-evident notice */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground" data-testid="audit-tamper-notice">
        <Shield className="w-4 h-4 flex-shrink-0 text-primary mt-0.5" />
        <div>
          <p className="font-medium text-foreground mb-0.5">Tamper-evident &mdash; HMAC-SHA256 signed</p>
          <p>Every event in this audit trail is cryptographically signed with an HMAC-SHA256 fingerprint. If any record is altered after creation, the fingerprint will not match. This log is immutable and admissible as evidence.</p>
        </div>
      </div>

      {/* Audit log */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Event Log</CardTitle>
          <p className="text-xs text-muted-foreground">Chronological — oldest first</p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-0" data-testid="audit-trail-list" data-demo-target="audit-trail-list">
            {matter.auditTrail.map((entry, idx) => {
              const Icon = EVENT_ICONS[entry.eventType] || EVENT_ICONS["Default"];
              const color = EVENT_COLORS[entry.eventType] || EVENT_COLORS["Default"];
              const isLast = idx === matter.auditTrail.length - 1;
              return (
                <div
                  key={entry.id}
                  className="flex gap-4 py-3 border-b border-border last:border-0"
                  data-testid={`audit-entry-${entry.id}`}
                >
                  {/* Timeline */}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full border border-border bg-background flex items-center justify-center ${color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    {!isLast && <div className="w-px bg-border flex-1 my-1" style={{ minHeight: "16px" }} />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium">{entry.eventType}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(entry.timestamp), "d MMM yyyy, HH:mm")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-1.5">{entry.description}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">Actor: <span className="text-foreground">{entry.actor}</span></span>
                      <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground" data-testid={`fingerprint-${entry.id}`}>
                        {entry.hmacFingerprint}…
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
        {[
          { label: "Consent / Approval", color: "text-green-600 dark:text-green-400" },
          { label: "Recording", color: "text-blue-600 dark:text-blue-400" },
          { label: "AI Processing", color: "text-purple-600 dark:text-purple-400" },
          { label: "Sharing / Links", color: "text-amber-600 dark:text-amber-400" },
          { label: "Compliance Alert", color: "text-red-600 dark:text-red-400" },
          { label: "AML / Risk", color: "text-orange-600 dark:text-orange-400" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full bg-current flex-shrink-0 ${item.color}`} />
            <span className="text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
