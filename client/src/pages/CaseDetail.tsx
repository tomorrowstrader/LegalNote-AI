import { ArrowLeft, Calendar, User, Shield, Loader2, RefreshCw, Sparkles, FileText, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DocumentViewer from "@/components/DocumentViewer";
import { AudioPlayer } from "@/components/AudioPlayer";
import { AuditTrail } from "@/components/AuditTrail";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useEffect } from "react";

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

interface ConsentLog {
  id: string;
  caseId: string;
  consentGiven: boolean;
  consentTimestamp: string;
  consentModality: string;
}

interface ProcessingStatus {
  status: string;
  processingMetadata: {
    status: string;
    progress: number;
    currentStep: string;
    totalCost: number;
    totalTokens: number;
    error?: string;
    completedAt?: string;
  };
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

  const { data: consentLogs = [], isLoading: consentLoading } = useQuery<ConsentLog[]>({
    queryKey: [`/api/consent/by-case/${caseId}`],
    enabled: !!caseId && caseData?.sourceType === 'audio',
  });

  // Poll processing status when case is being processed
  const { data: processingStatus } = useQuery<ProcessingStatus>({
    queryKey: [`/api/cases/${caseId}/processing-status`],
    enabled: !!caseId && caseData?.status === 'processing',
    refetchInterval: 2000, // Poll every 2 seconds
  });

  // Refresh case data when processing completes (any terminal status)
  useEffect(() => {
    const terminalStatuses = ['review_required', 'completed', 'pending', 'failed'];
    if (processingStatus?.status && terminalStatuses.includes(processingStatus.status) && caseData?.status === 'processing') {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}`] });
    }
  }, [processingStatus?.status, caseData?.status, caseId]);

  // Check if there's a valid consent log (consentGiven === true)
  const hasValidConsent = consentLogs.some(log => log.consentGiven === true);
  
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
            {caseData.sourceType === 'audio' && hasValidConsent ? (
              <Badge className="bg-accent" data-testid="badge-gdpr-compliant">
                <Shield className="w-3 h-3 mr-1" />
                GDPR Compliant
              </Badge>
            ) : caseData.sourceType === 'audio' ? (
              <Badge variant="destructive" data-testid="badge-consent-missing">
                <Shield className="w-3 h-3 mr-1" />
                Consent Required
              </Badge>
            ) : null}
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

        {caseData.sourceType === 'audio' && !hasValidConsent && (
          <div className="mb-8 p-6 bg-destructive/10 border-2 border-destructive rounded-lg">
            <div className="flex items-start gap-4">
              <Shield className="w-6 h-6 text-destructive flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-2">GDPR Compliance Required</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  No valid client consent has been recorded for this case. UK solicitors must obtain and document client 
                  consent before processing audio recordings under GDPR and professional conduct rules.
                </p>
                <p className="text-sm font-medium text-foreground">
                  Please contact your client to obtain consent, or delete this case if consent cannot be obtained.
                </p>
              </div>
            </div>
          </div>
        )}

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
          <div className="mb-8 p-6 bg-card rounded-lg border-2 border-accent shadow-lg" data-testid="processing-status-card">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-2 bg-accent/20 rounded-lg">
                <Bot className="w-6 h-6 text-accent" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-foreground">AI Processing in Progress</h3>
                  {(!processingStatus || processingStatus.processingMetadata?.status === 'processing') && (
                    <Loader2 className="w-4 h-4 animate-spin text-accent" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-3" data-testid="text-current-step">
                  {processingStatus?.processingMetadata?.currentStep || 'Preparing...'}
                </p>
                
                {processingStatus?.processingMetadata && (
                  <>
                    <Progress 
                      value={processingStatus.processingMetadata.progress || 0} 
                      className="h-2 mb-3"
                      data-testid="progress-bar"
                    />
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground" data-testid="text-progress-percentage">
                        {processingStatus.processingMetadata.progress || 0}% complete
                      </span>
                      {processingStatus.processingMetadata.totalCost > 0 && (
                        <span className="text-muted-foreground" data-testid="text-processing-cost">
                          Cost: ${processingStatus.processingMetadata.totalCost.toFixed(4)}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {processingStatus?.processingMetadata?.error && (
              <Alert variant="destructive" className="mt-4" data-testid="alert-processing-error">
                <AlertDescription>
                  {processingStatus.processingMetadata.error}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {caseData.sourceType === 'audio' && caseData.status === 'pending' && !caseData.transcript && (
          <div className="mb-8 p-6 bg-card rounded-lg border border-border">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">
                  {hasValidConsent ? 'Ready for AI Processing' : 'Consent Required Before Processing'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {hasValidConsent 
                    ? 'Your audio recording is ready. Click below to transcribe and generate legal documents.'
                    : 'Valid client consent must be recorded before AI processing can begin. This is required for GDPR compliance.'}
                </p>
              </div>
              <Button
                onClick={() => processAIMutation.mutate()}
                disabled={processAIMutation.isPending || !hasValidConsent}
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
