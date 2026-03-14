import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, FileText, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface ExternalDocumentRefsProps {
  caseId: string;
}

interface ExternalDocRef {
  id: string;
  caseId: string;
  description: string;
  documentType: string;
  documentDate: string | null;
  providedBy: string | null;
  createdAt: string;
  createdBy: string;
}

const DOCUMENT_TYPES = [
  { value: "contract", label: "Contract" },
  { value: "letter", label: "Letter" },
  { value: "court_order", label: "Court Order" },
  { value: "witness_statement", label: "Witness Statement" },
  { value: "expert_report", label: "Expert Report" },
  { value: "legislation", label: "Legislation" },
  { value: "regulation", label: "Regulation" },
  { value: "email_correspondence", label: "Email Correspondence" },
  { value: "invoice", label: "Invoice" },
  { value: "deed", label: "Deed" },
  { value: "statutory_form", label: "Statutory Form" },
  { value: "other", label: "Other" },
];

export default function ExternalDocumentRefs({ caseId }: ExternalDocumentRefsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [documentType, setDocumentType] = useState("other");
  const [documentDate, setDocumentDate] = useState("");
  const [providedBy, setProvidedBy] = useState("");
  
  const { toast } = useToast();

  const { data: refs = [], isLoading } = useQuery<ExternalDocRef[]>({
    queryKey: ["/api/cases", caseId, "external-documents"],
    queryFn: async () => {
      const res = await fetch(`/api/cases/${caseId}/external-documents`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/cases/${caseId}/external-documents`, {
        description: description.trim(),
        documentType,
        documentDate: documentDate || null,
        providedBy: providedBy.trim(),
      });
    },
    onSuccess: () => {
      toast({
        title: "Reference logged",
        description: "External document reference has been recorded.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "external-documents"] });
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/audit`] });
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to log reference",
        description: error.message || "Could not create external document reference.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setDescription("");
    setDocumentType("other");
    setDocumentDate("");
    setProvidedBy("");
  };

  const getTypeLabel = (type: string) => {
    return DOCUMENT_TYPES.find(t => t.value === type)?.label || type.replace(/_/g, " ");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <ExternalLink className="w-4 h-4" />
          External Document References
        </h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1" data-testid="button-add-external-doc">
              <Plus className="w-3.5 h-3.5" />
              Log Reference
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Log External Document Reference
              </DialogTitle>
              <DialogDescription>
                Record a reference to an external document discussed in a meeting. No files are stored.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Description</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Tenancy agreement dated 15 Jan 2024"
                  data-testid="input-ext-doc-description"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Document Type</label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger data-testid="select-ext-doc-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Document Date</label>
                <Input
                  type="date"
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                  data-testid="input-ext-doc-date"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Provided By</label>
                <Input
                  value={providedBy}
                  onChange={(e) => setProvidedBy(e.target.value)}
                  placeholder="e.g. Client, Opposing Counsel"
                  data-testid="input-ext-doc-provided-by"
                />
              </div>

              <Button
                onClick={() => createMutation.mutate()}
                disabled={!description.trim() || !providedBy.trim() || createMutation.isPending}
                className="w-full gap-2"
                data-testid="button-save-ext-doc"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Log Reference
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : refs.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2" data-testid="text-no-external-docs">
          No external document references logged for this case.
        </p>
      ) : (
        <div className="space-y-2">
          {refs.map((ref) => (
            <Card key={ref.id} className="p-3" data-testid={`card-ext-doc-${ref.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate" data-testid={`text-ext-doc-desc-${ref.id}`}>
                    {ref.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {getTypeLabel(ref.documentType)}
                    </Badge>
                    {ref.documentDate && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(ref.documentDate), "dd MMM yyyy")}
                      </span>
                    )}
                    {ref.providedBy && (
                      <span className="text-xs text-muted-foreground">
                        From: {ref.providedBy}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(ref.createdAt), "dd MMM")}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
