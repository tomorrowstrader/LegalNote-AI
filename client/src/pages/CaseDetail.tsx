import { ArrowLeft, Calendar, User, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import DocumentViewer from "@/components/DocumentViewer";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

interface CaseWithDocuments {
  id: string;
  title: string;
  clientName: string;
  matterReference?: string;
  createdBy: string;
  createdAt: string;
  status: string;
  priority: string;
  sourceType: string;
  textNotes?: string;
  consentGiven?: boolean;
  attendanceNote?: string;
  keyIssues?: string[];
  nextSteps?: string[];
  legalOpinion?: string;
  transcript?: string;
}

export default function CaseDetail() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const caseId = params.id;

  const { data: caseData, isLoading, error } = useQuery<CaseWithDocuments>({
    queryKey: [`/api/cases/${caseId}`],
    enabled: !!caseId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
          <Skeleton className="h-10 w-48 mb-6" />
          <div className="mb-8">
            <Skeleton className="h-10 w-96 mb-4" />
            <Skeleton className="h-6 w-64 mb-4" />
            <div className="flex gap-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-40" />
            </div>
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
          <Button
            variant="ghost"
            onClick={() => setLocation('/')}
            className="mb-6 gap-2"
            data-testid="button-back-to-dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">Case not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
        <Button
          variant="ghost"
          onClick={() => setLocation('/')}
          className="mb-6 gap-2"
          data-testid="button-back-to-dashboard"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-semibold text-foreground mb-2">
                {caseData.title}
              </h1>
              <p className="text-lg text-muted-foreground">{caseData.clientName}</p>
            </div>
            <Badge className="bg-accent" data-testid="badge-gdpr-compliant">
              <Shield className="w-3 h-3 mr-1" />
              GDPR Compliant
            </Badge>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{format(new Date(caseData.createdAt), "dd MMMM yyyy")}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="w-4 h-4" />
              <span>Created by {caseData.createdBy}</span>
            </div>
            {caseData.consentGiven && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="w-4 h-4" />
                <span>Consent recorded</span>
              </div>
            )}
          </div>
        </div>

        <DocumentViewer
          attendanceNote={caseData.attendanceNote || ""}
          keyIssues={caseData.keyIssues || []}
          nextSteps={caseData.nextSteps || []}
          legalOpinion={caseData.legalOpinion || ""}
          transcript={caseData.transcript}
        />
      </div>
    </div>
  );
}
