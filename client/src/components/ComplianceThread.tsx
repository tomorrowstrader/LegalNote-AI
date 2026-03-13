import { useState, useEffect } from "react";
import { Shield, Plus, AlertTriangle, ChevronDown, ChevronUp, Clock, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { AmlMonitoringNote, AmlDecisionRecord } from "@shared/schema";
import MLRODecisionModal from "./MLRODecisionModal";

interface ComplianceThreadProps {
  caseId: string;
  riskLevel?: string | null;
  clientName?: string;
  autoOpenNoteForm?: boolean;
}

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const RECORD_TYPE_LABELS: Record<string, string> = {
  inception: "Matter Inception",
  monitoring: "Ongoing Monitoring",
  completion: "Matter Completion",
};

export default function ComplianceThread({ caseId, riskLevel, clientName, autoOpenNoteForm }: ComplianceThreadProps) {
  const { toast } = useToast();
  const [showAddNote, setShowAddNote] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const [noteForm, setNoteForm] = useState({
    recordType: "monitoring" as "inception" | "monitoring" | "completion",
    riskLevel: riskLevel || "",
    sourceOfFundsStatus: "",
    eddDecision: "",
    eddReasoning: "",
    notes: "",
  });

  useEffect(() => {
    if (autoOpenNoteForm) {
      setShowAddNote(true);
    }
  }, [autoOpenNoteForm]);

  const { data: monitoringNotes = [], isLoading: notesLoading } = useQuery<AmlMonitoringNote[]>({
    queryKey: ["/api/cases", caseId, "aml-monitoring-notes"],
    queryFn: async () => {
      const res = await fetch(`/api/cases/${caseId}/aml-monitoring-notes`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch monitoring notes");
      return res.json();
    },
    enabled: !!caseId,
  });

  const { data: decisionRecords = [], isLoading: decisionsLoading } = useQuery<AmlDecisionRecord[]>({
    queryKey: ["/api/cases", caseId, "aml-decision-records"],
    queryFn: async () => {
      const res = await fetch(`/api/cases/${caseId}/aml-decision-records`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch decision records");
      return res.json();
    },
    enabled: !!caseId,
  });

  const createNoteMutation = useMutation({
    mutationFn: (data: typeof noteForm) =>
      apiRequest("POST", `/api/cases/${caseId}/aml-monitoring-notes`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "aml-monitoring-notes"] });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });
      setShowAddNote(false);
      setNoteForm({
        recordType: "monitoring",
        riskLevel: riskLevel || "",
        sourceOfFundsStatus: "",
        eddDecision: "",
        eddReasoning: "",
        notes: "",
      });
      toast({ title: "AML note recorded", description: "Compliance monitoring note has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save monitoring note.", variant: "destructive" });
    },
  });

  const hasInception = monitoringNotes.some(n => n.recordType === "inception");
  const hasCompletion = monitoringNotes.some(n => n.recordType === "completion");
  const totalRecords = monitoringNotes.length + decisionRecords.length;

  const completenessItems = [
    { label: "Risk assessment", done: !!riskLevel },
    { label: "Matter inception note", done: hasInception },
    { label: "Source of funds", done: monitoringNotes.some(n => !!n.sourceOfFundsStatus) },
  ];
  const completenessScore = completenessItems.filter(i => i.done).length;

  return (
    <div className="space-y-4" data-testid="compliance-thread">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-left"
          data-testid="button-toggle-compliance"
        >
          <Shield className="w-5 h-5 text-accent" />
          <span className="font-semibold text-base">Compliance Thread</span>
          {riskLevel && (
            <Badge className={`no-default-hover-elevate no-default-active-elevate ${RISK_COLORS[riskLevel] || ""}`} data-testid="badge-risk-level">
              {riskLevel.toUpperCase()} RISK
            </Badge>
          )}
          <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate" data-testid="badge-record-count">
            {totalRecords} record{totalRecords !== 1 ? "s" : ""}
          </Badge>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDecisionModal(true)}
            data-testid="button-mlro-decision"
          >
            <FileCheck className="w-4 h-4 mr-1" />
            MLRO Decision
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddNote(true)}
            data-testid="button-add-aml-note"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Note
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-3">
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            {completenessItems.map((item, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className={item.done ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
                  {item.done ? "●" : "○"}
                </span>
                {item.label}
              </span>
            ))}
            <span className="ml-auto text-xs">{completenessScore}/{completenessItems.length} complete</span>
          </div>

          {(notesLoading || decisionsLoading) && (
            <div className="text-sm text-muted-foreground py-2">Loading compliance records...</div>
          )}

          {decisionRecords.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                MLRO Decisions
              </h4>
              {decisionRecords.map((record) => (
                <Card key={record.id} className="border-amber-200 dark:border-amber-800">
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-xs" data-testid={`badge-decision-${record.id}`}>
                        {record.decision === "proceed" ? "Proceed" : record.decision === "decline_to_act" ? "Decline to Act" : "SAR Considered"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {format(new Date(record.createdAt), "dd MMM yyyy HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm"><span className="font-medium">Concern:</span> {record.concernDescription}</p>
                    <p className="text-sm text-muted-foreground">{record.decisionReasoning}</p>
                    {record.signatureHash && (
                      <p className="text-xs text-muted-foreground/60 font-mono truncate" data-testid={`signature-${record.id}`}>
                        <FileCheck className="w-3 h-3 inline mr-1" />
                        HMAC-SHA256: {record.signatureHash.slice(0, 16)}...
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {monitoringNotes.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Monitoring Notes</h4>
              {monitoringNotes.map((note) => (
                <Card key={note.id}>
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-xs" data-testid={`badge-record-type-${note.id}`}>
                          {RECORD_TYPE_LABELS[note.recordType] || note.recordType}
                        </Badge>
                        {note.riskLevel && (
                          <Badge className={`no-default-hover-elevate no-default-active-elevate text-xs ${RISK_COLORS[note.riskLevel] || ""}`}>
                            {note.riskLevel.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {format(new Date(note.createdAt), "dd MMM yyyy HH:mm")}
                      </span>
                    </div>
                    {note.sourceOfFundsStatus && (
                      <p className="text-sm"><span className="font-medium">Source of Funds:</span> {note.sourceOfFundsStatus}</p>
                    )}
                    {note.eddDecision && (
                      <p className="text-sm"><span className="font-medium">EDD:</span> {note.eddDecision}</p>
                    )}
                    <p className="text-sm text-muted-foreground">{note.notes}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {totalRecords === 0 && !notesLoading && !decisionsLoading && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No compliance records yet.</p>
              <p className="text-xs mt-1">Add an inception note to start the compliance thread for this matter.</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add AML Monitoring Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Record Type</Label>
              <Select
                value={noteForm.recordType}
                onValueChange={(v: string) => setNoteForm(f => ({ ...f, recordType: v as "inception" | "monitoring" | "completion" }))}
              >
                <SelectTrigger data-testid="select-record-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inception">Matter Inception</SelectItem>
                  <SelectItem value="monitoring">Ongoing Monitoring</SelectItem>
                  <SelectItem value="completion">Matter Completion</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Risk Level</Label>
              <Select
                value={noteForm.riskLevel}
                onValueChange={(v) => setNoteForm(f => ({ ...f, riskLevel: v }))}
              >
                <SelectTrigger data-testid="select-risk-level">
                  <SelectValue placeholder="Select risk level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Source of Funds Status</Label>
              <Textarea
                placeholder="Verified / Pending / N/A..."
                value={noteForm.sourceOfFundsStatus}
                onChange={(e) => setNoteForm(f => ({ ...f, sourceOfFundsStatus: e.target.value }))}
                className="resize-none"
                data-testid="input-source-of-funds"
              />
            </div>
            {(noteForm.riskLevel === "medium" || noteForm.riskLevel === "high") && (
              <>
                <div>
                  <Label>EDD Decision</Label>
                  <Textarea
                    placeholder="Enhanced due diligence decision..."
                    value={noteForm.eddDecision}
                    onChange={(e) => setNoteForm(f => ({ ...f, eddDecision: e.target.value }))}
                    className="resize-none"
                    data-testid="input-edd-decision"
                  />
                </div>
                <div>
                  <Label>EDD Reasoning</Label>
                  <Textarea
                    placeholder="Reasoning for EDD decision..."
                    value={noteForm.eddReasoning}
                    onChange={(e) => setNoteForm(f => ({ ...f, eddReasoning: e.target.value }))}
                    className="resize-none"
                    data-testid="input-edd-reasoning"
                  />
                </div>
              </>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Record your compliance observations..."
                value={noteForm.notes}
                onChange={(e) => setNoteForm(f => ({ ...f, notes: e.target.value }))}
                rows={4}
                className="resize-none"
                data-testid="input-aml-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddNote(false)} data-testid="button-cancel-note">
              Cancel
            </Button>
            <Button
              onClick={() => createNoteMutation.mutate(noteForm)}
              disabled={!noteForm.notes.trim() || createNoteMutation.isPending}
              data-testid="button-save-note"
            >
              {createNoteMutation.isPending ? "Saving..." : "Save Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MLRODecisionModal
        open={showDecisionModal}
        onOpenChange={setShowDecisionModal}
        caseId={caseId}
        clientName={clientName}
      />
    </div>
  );
}
