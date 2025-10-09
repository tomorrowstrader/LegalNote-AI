import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, FileType } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DocumentViewerProps {
  attendanceNote: string;
  keyIssues: string[];
  nextSteps: string[];
  legalOpinion: string;
  transcript?: string;
  textNotes?: string;
}

export default function DocumentViewer({
  attendanceNote,
  keyIssues,
  nextSteps,
  legalOpinion,
  transcript,
  textNotes,
}: DocumentViewerProps) {
  const handleExport = (format: 'word' | 'pdf') => {
    console.log(`Exporting as ${format}`);
  };

  return (
    <div className="space-y-6" data-testid="container-document-viewer">
      <div className="sticky top-16 z-40 bg-background py-4 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-xl sm:text-2xl font-semibold">Generated Documentation</h2>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => handleExport('word')}
              className="gap-2 flex-1 sm:flex-initial"
              data-testid="button-export-word"
            >
              <FileType className="w-4 h-4" />
              <span className="hidden xs:inline">Export </span>Word
            </Button>
            <Button
              onClick={() => handleExport('pdf')}
              className="gap-2 bg-accent hover:bg-accent flex-1 sm:flex-initial"
              data-testid="button-export-pdf"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden xs:inline">Export </span>PDF
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="summary" data-testid="tab-summary">Summary</TabsTrigger>
          <TabsTrigger value="opinion" data-testid="tab-opinion">Legal Opinion</TabsTrigger>
          <TabsTrigger value="transcript" data-testid="tab-transcript">Transcript</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Note</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              {attendanceNote ? (
                <p className="text-foreground whitespace-pre-wrap">{attendanceNote}</p>
              ) : textNotes ? (
                <div>
                  <p className="text-sm text-muted-foreground mb-4 italic">
                    Meeting notes (AI-generated documents will appear here once processed)
                  </p>
                  <p className="text-foreground whitespace-pre-wrap">{textNotes}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No attendance note available yet. Documents will be generated automatically.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Key Issues</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {keyIssues.map((issue, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="text-primary font-medium">{index + 1}.</span>
                    <span className="text-foreground">{issue}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next Steps / Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {nextSteps.map((step, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="text-accent font-medium">•</span>
                    <span className="text-foreground">{step}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="opinion" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Draft Legal Opinion</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p className="text-foreground whitespace-pre-wrap">{legalOpinion}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transcript" className="mt-6">
          {transcript ? (
            <Card>
              <CardHeader>
                <CardTitle>Full Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                  {transcript}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No transcript available for this case
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
