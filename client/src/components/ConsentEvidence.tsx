import { useState } from "react";
import { Shield, Play, Pause, Download, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import type { AudioRecording, ConsentLog } from "@shared/schema";

interface ConsentEvidenceProps {
  caseId: string;
  audioRecording?: AudioRecording;
  consentLogs: ConsentLog[];
}

export function ConsentEvidence({ caseId, audioRecording, consentLogs }: ConsentEvidenceProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const hasConsentSegment = !!audioRecording?.consentSegmentPath;
  const consentLog = consentLogs.find(log => log.consentGiven === true);
  
  const { data: consentUrl, isLoading: urlLoading, error: urlError, refetch } = useQuery<{ url: string; expiresAt: string }>({
    queryKey: [`/api/audio/${audioRecording?.id}/consent-segment`],
    enabled: !!audioRecording?.id && hasConsentSegment,
  });

  const handlePlayPause = () => {
    if (!consentUrl?.url) return;
    
    if (!audioElement) {
      const audio = new Audio(consentUrl.url);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);
      setAudioElement(audio);
      audio.play();
      setIsPlaying(true);
    } else {
      if (isPlaying) {
        audioElement.pause();
        setIsPlaying(false);
      } else {
        audioElement.play();
        setIsPlaying(true);
      }
    }
  };

  const handleDownload = async () => {
    if (!consentUrl?.url) return;
    
    try {
      const response = await fetch(consentUrl.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `consent-evidence-${caseId}.webm`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download consent segment:', error);
    }
  };

  if (!hasConsentSegment && !consentLog) {
    return null;
  }

  return (
    <Card className="border-green-500/20 bg-green-500/5" data-testid="card-consent-evidence">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <CardTitle className="text-base text-foreground">Consent Evidence</CardTitle>
            <CardDescription className="text-xs">Preserved indefinitely for compliance</CardDescription>
          </div>
          <Badge 
            variant="outline" 
            className="ml-auto bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30"
            data-testid="badge-consent-verified"
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            Verified
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {consentLog && (
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Recorded:</span>
              <span className="font-medium" data-testid="text-consent-timestamp">
                {format(new Date(consentLog.consentTimestamp), "dd MMM yyyy 'at' HH:mm")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Modality:</span>
              <Badge variant="secondary" className="text-xs" data-testid="badge-consent-modality">
                {consentLog.consentModality === 'verbal_recorded' ? 'Verbal (Recorded)' : 
                 consentLog.consentModality === 'verbal_witnessed' ? 'Verbal (Witnessed)' : 
                 consentLog.consentModality === 'written' ? 'Written' : 
                 consentLog.consentModality}
              </Badge>
            </div>
          </div>
        )}

        {hasConsentSegment && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
            {urlLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : urlError ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4" />
                <span>Unable to load consent recording</span>
                <Button variant="ghost" size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePlayPause}
                  className="shrink-0"
                  data-testid="button-play-consent"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </Button>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">Consent Recording Segment</p>
                  <p className="text-xs text-muted-foreground">
                    {audioRecording?.consentDurationSeconds ? (
                      <>Duration: {Math.floor(audioRecording.consentDurationSeconds / 60)}:{(audioRecording.consentDurationSeconds % 60).toString().padStart(2, '0')} (from meeting start to consent confirmation)</>
                    ) : (
                      <>Captured from meeting start to consent confirmation</>
                    )}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDownload}
                  className="shrink-0"
                  data-testid="button-download-consent"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          This consent evidence is preserved indefinitely to document the legal basis for processing 
          client data (GDPR Article 7). It provides proof of informed consent in case of disputes or 
          professional liability claims.
        </p>
      </CardContent>
    </Card>
  );
}
