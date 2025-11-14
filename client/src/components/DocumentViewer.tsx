import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, FileSearch } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { exportToPDF, exportToWord } from "@/lib/documentExport";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { FirmProfile } from "@shared/schema";
import DownloadModal from "@/components/DownloadModal";

interface Document {
  id: string;
  caseId: string;
  type: 'attendance_note' | 'summary' | 'legal_opinion' | 'transcript';
  content: string;
  version: number;
  createdAt: string;
}

interface DocumentViewerProps {
  documents: Document[];
  transcript?: string;
  textNotes?: string;
  status: string;
  caseTitle: string;
  clientName: string;
  matterReference?: string;
  createdAt: string;
}

export default function DocumentViewer({
  documents,
  transcript,
  textNotes,
  status,
  caseTitle,
  clientName,
  matterReference,
  createdAt,
}: DocumentViewerProps) {
  const { toast } = useToast();
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // Fetch firm profile for exports
  const { data: firmProfile } = useQuery<FirmProfile>({
    queryKey: ['/api/firm-profile'],
  });

  const handleExport = () => {
    setShowDownloadModal(true);
  };

  const handleDownload = async (selectedDocs: string[], format: 'pdf' | 'word') => {
    if (selectedDocs.length === 0) {
      toast({
        title: "No Documents Selected",
        description: "Please select at least one document to export",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    try {
      const attendanceNote = documents.find(d => d.type === 'attendance_note');
      const summary = documents.find(d => d.type === 'summary');
      const legalOpinion = documents.find(d => d.type === 'legal_opinion');

      const content: any = {
        caseTitle,
        clientName,
        matterReference,
        createdAt,
        documentType: selectedDocs.length === 1 ? selectedDocs[0] as any : 'full_case',
        firmProfile: firmProfile || undefined,
      };

      if (selectedDocs.includes('attendance_note')) {
        if (attendanceNote?.content) {
          content.attendanceNote = attendanceNote.content;
        }
      }

      if (selectedDocs.includes('legal_opinion')) {
        if (legalOpinion?.content) {
          content.legalOpinion = legalOpinion.content;
        }
      }

      if (selectedDocs.includes('summary')) {
        const summaryContent = summary?.content || textNotes;
        if (summaryContent) {
          content.summary = summaryContent;
        }
      }

      if (selectedDocs.includes('transcript')) {
        if (transcriptContent) {
          content.transcript = transcriptContent;
        }
      }

      const hasAnyContent = content.attendanceNote || content.legalOpinion || content.summary || content.transcript;
      if (!hasAnyContent) {
        toast({
          title: "No Content Available",
          description: "The selected documents don't have any content to export",
          variant: "destructive",
          duration: 5000,
        });
        setShowDownloadModal(false);
        return;
      }

      if (format === 'pdf') {
        await exportToPDF(content);
        toast({
          title: "Download Ready",
          description: "Your PDF is ready. Choose where to save it in the dialog.",
          duration: 3000,
        });
      } else {
        await exportToWord(content);
        toast({
          title: "Download Ready",
          description: "Your Word document is ready. Choose where to save it in the dialog.",
          duration: 3000,
        });
      }

      setShowDownloadModal(false);
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export documents. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const attendanceNote = documents.find(d => d.type === 'attendance_note');
  const summary = documents.find(d => d.type === 'summary');
  const legalOpinion = documents.find(d => d.type === 'legal_opinion');
  const transcriptDoc = documents.find(d => d.type === 'transcript');
  
  const transcriptContent = transcriptDoc?.content ?? transcript;

  const hasAnyDocument = documents.length > 0 || transcriptContent || textNotes;

  // If case is still pending and no documents, show placeholder
  if (status === 'pending' && !hasAnyDocument) {
    return (
      <div className="space-y-6" data-testid="container-document-viewer">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileSearch className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Documents Yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              {textNotes 
                ? 'AI processing will generate documents from your meeting notes.' 
                : 'Record audio and process with AI to generate legal documents automatically.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="container-document-viewer">
      <div className="sticky top-16 z-40 bg-background py-4 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold">Generated Documentation</h2>
            <p className="text-xs text-muted-foreground mt-1 sm:hidden">Export documents below</p>
          </div>
          {hasAnyDocument && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground hidden sm:block">Export documents:</p>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  onClick={handleExport}
                  className="gap-2 flex-1 sm:flex-initial"
                  data-testid="button-export"
                >
                  <FileDown className="w-4 h-4" />
                  Export Documents
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue={(summary || textNotes) ? "summary" : transcriptContent ? "transcript" : "attendance"} className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="transcript" data-testid="tab-transcript" disabled={!transcriptContent} className="text-xs sm:text-sm px-2 py-2.5 h-auto">
            <span className="hidden sm:inline">Transcript</span>
            <span className="sm:hidden">Script</span>
          </TabsTrigger>
          <TabsTrigger value="summary" data-testid="tab-summary" disabled={!summary && !textNotes} className="text-xs sm:text-sm px-2 py-2.5 h-auto">
            Summary
          </TabsTrigger>
          <TabsTrigger value="attendance" data-testid="tab-attendance" disabled={!attendanceNote} className="text-xs sm:text-sm px-2 py-2.5 h-auto">
            <span className="hidden sm:inline">Attendance Note</span>
            <span className="sm:hidden">Att. Note</span>
          </TabsTrigger>
          <TabsTrigger value="opinion" data-testid="tab-opinion" disabled={!legalOpinion} className="text-xs sm:text-sm px-2 py-2.5 h-auto">
            <span className="hidden sm:inline">Legal Opinion</span>
            <span className="sm:hidden">Opinion</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transcript" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Full Transcript</CardTitle>
                <Badge variant="outline" data-testid="badge-ai-generated">AI Generated</Badge>
              </div>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              {transcriptContent ? (
                <p className="text-foreground whitespace-pre-wrap">{transcriptContent}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Transcript not yet available. Process this case with AI to generate a transcript.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Case Summary</CardTitle>
                {summary && (
                  <Badge variant="outline" data-testid="badge-version">
                    Version {summary.version}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              {summary ? (
                <p className="text-foreground whitespace-pre-wrap">{summary.content}</p>
              ) : textNotes ? (
                <div>
                  <p className="text-sm text-muted-foreground mb-4 italic">
                    Meeting notes (AI-generated summary will appear here once processed)
                  </p>
                  <p className="text-foreground whitespace-pre-wrap">{textNotes}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No summary available yet. Documents will be generated automatically.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Attendance Note</CardTitle>
                {attendanceNote && (
                  <Badge variant="outline" data-testid="badge-version">
                    Version {attendanceNote.version}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              {attendanceNote ? (
                <p className="text-foreground whitespace-pre-wrap">{attendanceNote.content}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No attendance note available yet. Documents will be generated automatically.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="opinion" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Legal Opinion</CardTitle>
                {legalOpinion && (
                  <Badge variant="outline" data-testid="badge-version">
                    Version {legalOpinion.version}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              {legalOpinion ? (
                <p className="text-foreground whitespace-pre-wrap">{legalOpinion.content}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No legal opinion available yet. Documents will be generated automatically.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DownloadModal
        open={showDownloadModal}
        onOpenChange={setShowDownloadModal}
        availableDocuments={{
          hasAttendanceNote: !!attendanceNote,
          hasLegalOpinion: !!legalOpinion,
          hasSummary: !!summary || !!textNotes,
          hasTranscript: !!transcriptContent,
        }}
        sharedDocuments={['attendance_note', 'legal_opinion', 'summary', 'transcript']}
        onDownload={handleDownload}
      />
    </div>
  );
}
