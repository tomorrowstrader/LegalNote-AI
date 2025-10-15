import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, FileType, FileSearch } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface Document {
  id: string;
  caseId: string;
  type: 'attendance_note' | 'summary' | 'legal_opinion';
  content: string;
  version: number;
  createdAt: string;
}

interface DocumentViewerProps {
  documents: Document[];
  transcript?: string;
  textNotes?: string;
  status: string;
}

export default function DocumentViewer({
  documents,
  transcript,
  textNotes,
  status,
}: DocumentViewerProps) {
  const handleExport = (format: 'word' | 'pdf') => {
    console.log(`Exporting as ${format}`);
  };

  const attendanceNote = documents.find(d => d.type === 'attendance_note');
  const summary = documents.find(d => d.type === 'summary');
  const legalOpinion = documents.find(d => d.type === 'legal_opinion');

  const hasAnyDocument = documents.length > 0 || transcript || textNotes;

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
                  onClick={() => handleExport('word')}
                  className="gap-2 flex-1 sm:flex-initial"
                  data-testid="button-export-word"
                >
                  <FileType className="w-4 h-4" />
                  Export as Word
                </Button>
                <Button
                  onClick={() => handleExport('pdf')}
                  className="gap-2 bg-accent hover:bg-accent flex-1 sm:flex-initial"
                  data-testid="button-export-pdf"
                >
                  <FileText className="w-4 h-4" />
                  Export as PDF
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue={(summary || textNotes) ? "summary" : transcript ? "transcript" : "attendance"} className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="transcript" data-testid="tab-transcript" disabled={!transcript} className="text-xs sm:text-sm px-2 py-2.5 h-auto">
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
              {transcript ? (
                <p className="text-foreground whitespace-pre-wrap">{transcript}</p>
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
    </div>
  );
}
