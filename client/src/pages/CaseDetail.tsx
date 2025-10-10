import { ArrowLeft, Calendar, User, Shield, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import DocumentViewer from "@/components/DocumentViewer";
import { AudioPlayer } from "@/components/AudioPlayer";
import { AuditTrail } from "@/components/AuditTrail";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

interface AudioRecording {
  id: string;
  caseId: string;
  filePath: string | null;
  duration: number | null;
  expiresAt: string;
  deletedAt: string | null;
}

export default function CaseDetail() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const caseId = params.id;
  const { toast } = useToast();

  const { data: caseData, isLoading, error } = useQuery<CaseWithDocuments>({
    queryKey: [`/api/cases/${caseId}`],
    enabled: !!caseId,
  });
  
  const { data: audioData, isLoading: audioLoading } = useQuery<AudioRecording>({
    queryKey: [`/api/audio/by-case/${caseId}`],
    enabled: !!caseId && caseData?.sourceType === 'audio',
  });
  
  const processAIMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/cases/${caseId}/process`, {});
    },
    onSuccess: () => {
      toast({
        title: "Processing complete",
        description: "Documents have been generated successfully",
        duration: 5000,
      });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/cases/${caseId}`] 
      });
    },
    onError: (error: any) => {
      toast({
        title: "Processing failed",
        description: error.message || "Failed to process case. Please try again.",
        variant: "destructive",
        duration: 8000,
      });
    },
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

        {caseData.sourceType === 'audio' && audioData && audioData.filePath && (
          <div className="mb-8">
            <AudioPlayer
              audioUrl={audioData.filePath}
              expiresAt={new Date(audioData.expiresAt)}
              caseId={caseData.id}
              audioRecordingId={audioData.id}
            />
          </div>
        )}

        {caseData.status === 'processing' && (
          <div className="mb-8 p-6 bg-card rounded-lg border border-border flex items-center gap-4">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-1">AI Processing in Progress</h3>
              <p className="text-sm text-muted-foreground">
                Transcribing audio and generating legal documents. This may take a few minutes...
              </p>
            </div>
          </div>
        )}

        {caseData.sourceType === 'audio' && caseData.status === 'pending' && !caseData.transcript && (
          <div className="mb-8 p-6 bg-card rounded-lg border border-border">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">Ready for AI Processing</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Your audio recording is ready. Click below to transcribe and generate legal documents.
                </p>
              </div>
              <Button
                onClick={() => processAIMutation.mutate()}
                disabled={processAIMutation.isPending}
                className="gap-2 bg-accent hover:bg-accent"
                data-testid="button-process-ai"
              >
                {processAIMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Process with AI
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        <DocumentViewer
          attendanceNote={caseData.attendanceNote || ""}
          keyIssues={caseData.keyIssues || []}
          nextSteps={caseData.nextSteps || []}
          legalOpinion={caseData.legalOpinion || ""}
          transcript={caseData.transcript}
          textNotes={caseData.textNotes}
        />

        <div className="mt-8">
          <AuditTrail caseId={caseId!} limit={50} />
        </div>
      </div>
    </div>
  );
}
