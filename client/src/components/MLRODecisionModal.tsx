import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface MLRODecisionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  clientName?: string;
}

export default function MLRODecisionModal({ open, onOpenChange, caseId, clientName }: MLRODecisionModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    concernDescription: "",
    decision: "" as "proceed" | "decline_to_act" | "sar_considered" | "",
    decisionReasoning: "",
  });

  const createDecisionMutation = useMutation({
    mutationFn: (data: { concernDescription: string; decision: string; decisionReasoning: string }) =>
      apiRequest("POST", `/api/cases/${caseId}/aml-decision-records`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "aml-decision-records"] });
      onOpenChange(false);
      setForm({ concernDescription: "", decision: "", decisionReasoning: "" });
      toast({ title: "MLRO decision recorded", description: "The decision has been logged in the compliance thread." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to record decision.", variant: "destructive" });
    },
  });

  const canSubmit = form.concernDescription.trim() && form.decision && form.decisionReasoning.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            MLRO Decision Record
          </DialogTitle>
          <DialogDescription>
            Record a formal MLRO decision for {clientName || "this matter"}. This creates an auditable record.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <AlertDescription className="text-xs">
            This record is permanent and cannot be edited once saved. It forms part of the firm's AML compliance audit trail.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <Label>Concern Description</Label>
            <Textarea
              placeholder="Describe the AML concern or trigger that prompted this decision..."
              value={form.concernDescription}
              onChange={(e) => setForm(f => ({ ...f, concernDescription: e.target.value }))}
              rows={3}
              className="resize-none"
              data-testid="input-concern-description"
            />
          </div>

          <div>
            <Label>Decision</Label>
            <Select
              value={form.decision}
              onValueChange={(v) => setForm(f => ({ ...f, decision: v as any }))}
            >
              <SelectTrigger data-testid="select-mlro-decision">
                <SelectValue placeholder="Select decision" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="proceed">Proceed — risk accepted with controls</SelectItem>
                <SelectItem value="decline_to_act">Decline to Act — disengage from matter</SelectItem>
                <SelectItem value="sar_considered">SAR Considered — reporting decision documented</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Decision Reasoning</Label>
            <Textarea
              placeholder="Set out your reasoning for this decision, including any mitigating factors or controls in place..."
              value={form.decisionReasoning}
              onChange={(e) => setForm(f => ({ ...f, decisionReasoning: e.target.value }))}
              rows={5}
              className="resize-none"
              data-testid="input-decision-reasoning"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-decision">
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (canSubmit) createDecisionMutation.mutate(form as any);
            }}
            disabled={!canSubmit || createDecisionMutation.isPending}
            data-testid="button-save-decision"
          >
            {createDecisionMutation.isPending ? "Recording..." : "Record Decision"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
