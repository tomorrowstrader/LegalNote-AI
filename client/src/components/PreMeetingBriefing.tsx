import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Sparkles, 
  Loader2, 
  Clock, 
  RefreshCw,
  Download,
  Copy,
  Check
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import type { PreMeetingBriefing as PreMeetingBriefingType } from "@shared/schema";

interface PreMeetingBriefingProps {
  caseId: string;
  hasTranscript: boolean;
}

export default function PreMeetingBriefing({ caseId, hasTranscript }: PreMeetingBriefingProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  
  const { data: briefing, isLoading } = useQuery<PreMeetingBriefingType | null>({
    queryKey: [`/api/cases/${caseId}/pre-meeting-briefing`],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      const response = await apiRequest(`/api/cases/${caseId}/pre-meeting-briefing`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: () => {
      setIsGenerating(false);
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/pre-meeting-briefing`] });
      toast({
        title: "Briefing Generated",
        description: "Your pre-meeting briefing is ready.",
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

  if (isLoading) {
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
                disabled={isGenerating}
                data-testid="button-generate-briefing"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Generating...
                  </>
                ) : briefing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Regenerate
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-1" />
                    Generate
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!briefing ? (
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No briefing generated yet.</p>
            {hasTranscript && (
              <p className="text-xs mt-1">Click "Generate" to create a pre-meeting summary.</p>
            )}
            {!hasTranscript && (
              <p className="text-xs mt-1">Complete a meeting recording first to generate a briefing.</p>
            )}
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{briefing.content}</ReactMarkdown>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
