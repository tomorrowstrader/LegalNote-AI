import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileText } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ClientCareLetterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  clientName: string;
  costsEstimate?: string | null;
}

export default function ClientCareLetterModal({
  open, onOpenChange, caseId, clientName, costsEstimate,
}: ClientCareLetterModalProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [firmName, setFirmName] = useState("");
  const [firmAddress, setFirmAddress] = useState("");
  const [firmPhone, setFirmPhone] = useState("");
  const [firmEmail, setFirmEmail] = useState("");
  const [sraNumber, setSraNumber] = useState("");
  const [feeEarnerName, setFeeEarnerName] = useState("");
  const [costs, setCosts] = useState(costsEstimate || "");

  const handleGenerate = async () => {
    if (!firmName.trim() || !feeEarnerName.trim()) {
      toast({
        title: "Missing information",
        description: "Firm name and fee earner name are required.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      await apiRequest("POST", `/api/cases/${caseId}/client-care-letter`, {
        firmName: firmName.trim(),
        firmAddress: firmAddress.trim() || undefined,
        firmPhone: firmPhone.trim() || undefined,
        firmEmail: firmEmail.trim() || undefined,
        sraNumber: sraNumber.trim() || undefined,
        feeEarnerName: feeEarnerName.trim(),
        costsEstimate: costs.trim() || undefined,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId] });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith(`/api/cases/${caseId}/documents`);
        },
      });

      toast({
        title: "Client care letter generated",
        description: `Letter for ${clientName} has been created and saved to the case documents.`,
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate client care letter.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Prepare Client Care Letter
          </DialogTitle>
          <DialogDescription>
            Enter your firm details to generate an SRA-compliant client care letter for {clientName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="ccl-firm-name">
              Firm Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ccl-firm-name"
              placeholder="e.g., Smith & Partners Solicitors"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              disabled={isGenerating}
              data-testid="input-ccl-firm-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ccl-fee-earner">
              Fee Earner Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ccl-fee-earner"
              placeholder="e.g., John Smith, Senior Solicitor"
              value={feeEarnerName}
              onChange={(e) => setFeeEarnerName(e.target.value)}
              disabled={isGenerating}
              data-testid="input-ccl-fee-earner"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ccl-firm-address">Firm Address</Label>
            <Input
              id="ccl-firm-address"
              placeholder="e.g., 1 High Street, London, EC1A 1AA"
              value={firmAddress}
              onChange={(e) => setFirmAddress(e.target.value)}
              disabled={isGenerating}
              data-testid="input-ccl-firm-address"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ccl-firm-phone">Firm Phone</Label>
              <Input
                id="ccl-firm-phone"
                placeholder="020 1234 5678"
                value={firmPhone}
                onChange={(e) => setFirmPhone(e.target.value)}
                disabled={isGenerating}
                data-testid="input-ccl-firm-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ccl-firm-email">Firm Email</Label>
              <Input
                id="ccl-firm-email"
                placeholder="info@smithpartners.co.uk"
                value={firmEmail}
                onChange={(e) => setFirmEmail(e.target.value)}
                disabled={isGenerating}
                data-testid="input-ccl-firm-email"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ccl-sra-number">SRA Number</Label>
            <Input
              id="ccl-sra-number"
              placeholder="e.g., 123456"
              value={sraNumber}
              onChange={(e) => setSraNumber(e.target.value)}
              disabled={isGenerating}
              data-testid="input-ccl-sra-number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ccl-costs">Costs Estimate</Label>
            <Input
              id="ccl-costs"
              placeholder="e.g., £1,500 – £3,000 plus VAT and disbursements"
              value={costs}
              onChange={(e) => setCosts(e.target.value)}
              disabled={isGenerating}
              data-testid="input-ccl-costs"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating} data-testid="button-generate-ccl">
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Preparing...
              </>
            ) : (
              "Prepare Letter"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
