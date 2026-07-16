import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  FileText, 
  Sparkles, 
  Loader2, 
  Clock, 
  RefreshCw,
  Copy,
  Check,
  Maximize2
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import type { PreMeetingBriefing as PreMeetingBriefingType } from "@shared/schema";

interface PreMeetingBriefingProps {
  caseId: string;
  hasTranscript: boolean;
  /** When true, poll until a brief appears (T-30 pre-gen may still be running). */
  expectPreparing?: boolean;
}

export default function PreMeetingBriefing({
  caseId,
  hasTranscript,
  expectPreparing = false,
}: PreMeetingBriefingProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();
  
  const { data: briefing, isLoading } = useQuery<PreMeetingBriefingType | null>({
    queryKey: [`/api/cases/${caseId}/pre-meeting-briefing`],
    refetchInterval: (query) => {
      if (!expectPreparing) return false;
      if (query.state.data) return false;
      return 2000;
    },
  });

  const isWaitingForPreGen = expectPreparing && !briefing && hasTranscript && !isGenerating;

  const generateMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      const response = await apiRequest("POST", `/api/cases/${caseId}/pre-meeting-briefing`, {});
      return response;
    },
    onSuccess: () => {
      setIsGenerating(false);
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/pre-meeting-briefing`] });
      toast({
        title: "Briefing Ready",
        description: "Your matter briefing is ready to review.",
      });
    },
    onError: (error: any) => {
      setIsGenerating(false);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate briefing",
        variant: "destructive",
      });
    },
  });

  const handleCopy = async () => {
    if (briefing?.content) {
      await navigator.clipboard.writeText(briefing.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied to clipboard",
      });
    }
  };

  if (isLoading && !isWaitingForPreGen) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Pre-Meeting Briefing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Pre-Meeting Briefing
          </CardTitle>
          <div className="flex items-center gap-2">
            {briefing && (
              <>
                <Badge variant="secondary" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  {format(new Date(briefing.generatedAt), "dd MMM HH:mm")}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setIsModalOpen(true)}
                  data-testid="button-expand-briefing"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopy}
                  data-testid="button-copy-briefing"
                >
                  {copied ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </>
            )}
            {hasTranscript && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateMutation.mutate()}
                disabled={isGenerating || isWaitingForPreGen}
                data-testid="button-generate-briefing"
              >
                {isGenerating || isWaitingForPreGen ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Preparing...
                  </>
                ) : briefing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Regenerate
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-1" />
                    Prepare Briefing
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isWaitingForPreGen ? (
          <div className="text-center py-6 text-muted-foreground" data-testid="briefing-preparing-state">
            <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin opacity-70" />
            <p className="text-sm">Preparing your briefing…</p>
            <p className="text-xs mt-1">This usually takes less than a minute.</p>
          </div>
        ) : !briefing ? (
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No briefing generated yet.</p>
            {hasTranscript && (
              <p className="text-xs mt-1">Click "Prepare Briefing" to review your matter before the meeting.</p>
            )}
            {!hasTranscript && (
              <p className="text-xs mt-1">Complete a meeting recording first to prepare a briefing.</p>
            )}
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="prose prose-sm dark:prose-invert max-w-none pr-4">
              <ReactMarkdown>{briefing.content}</ReactMarkdown>
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col" data-testid="modal-premeeting-briefing-expanded">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Pre-Meeting Briefing
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0">
            <div className="prose prose-sm dark:prose-invert max-w-none py-2 pr-4">
              <ReactMarkdown>{briefing?.content || ''}</ReactMarkdown>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
