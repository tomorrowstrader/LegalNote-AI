import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Lock, FileText, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ShareLinkData {
  requiresSmsVerification: boolean;
  recipientName?: string;
  phoneNumber?: string;
  caseData?: {
    title: string;
    clientName: string;
    matterReference: string | null;
    createdAt: Date;
  };
  documents?: Array<{
    id: string;
    type: string;
    content: string;
    version: number;
    createdAt: Date;
  }>;
  transcript?: {
    id: string;
    content: string;
    createdAt: Date;
  } | null;
  shareLink?: {
    recipientName: string;
    expiresAt: Date;
    accessLevel: string;
  };
}

export default function ShareLinkView() {
  const [, params] = useRoute("/share/:linkId");
  const linkId = params?.linkId;

  const { data, isLoading, error } = useQuery<ShareLinkData>({
    queryKey: ['/api/share', linkId],
    enabled: !!linkId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Loading secure document access...</CardTitle>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to load documents";
    const isExpired = errorMessage.includes("expired");
    const isNotFound = errorMessage.includes("not found");

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle>
                {isExpired ? "Link Expired" : isNotFound ? "Link Not Found" : "Access Error"}
              </CardTitle>
            </div>
            <CardDescription>
              {isExpired
                ? "This secure document link has expired. Please contact your solicitor for a new link."
                : isNotFound
                ? "The document link you're trying to access could not be found."
                : errorMessage}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (data?.requiresSmsVerification) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <CardTitle>SMS Verification Required</CardTitle>
            </div>
            <CardDescription>
              For your security, this document requires SMS verification before access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                A verification code has been sent to {data.phoneNumber}
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground mt-4">
              SMS verification feature coming soon. Please contact your solicitor for alternative access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data?.caseData) {
    return null;
  }

  const { caseData, documents, transcript, shareLink } = data;

  const getDocumentTitle = (type: string) => {
    switch (type) {
      case "attendance_note":
        return "Attendance Note";
      case "legal_opinion":
        return "Legal Opinion";
      case "summary":
        return "Summary";
      default:
        return type;
    }
  };

  const attendanceNote = documents?.find(doc => doc.type === "attendance_note");
  const legalOpinion = documents?.find(doc => doc.type === "legal_opinion");

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto py-8 px-4">
        {/* Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl mb-2">{caseData.title}</CardTitle>
                <CardDescription className="text-base">
                  Client: {caseData.clientName}
                  {caseData.matterReference && (
                    <> • Matter: {caseData.matterReference}</>
                  )}
                </CardDescription>
              </div>
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Secure Access
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                <span>Shared with: {shareLink?.recipientName}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>
                  Expires: {shareLink?.expiresAt 
                    ? formatDistanceToNow(new Date(shareLink.expiresAt), { addSuffix: true })
                    : "Unknown"}
                </span>
              </div>
            </div>
            
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Confidential Legal Documents:</strong> This information is privileged and confidential. 
                Unauthorized disclosure, copying, or distribution is strictly prohibited.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Documents Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Case Documents</CardTitle>
            <CardDescription>
              Review the documents prepared for this matter
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={attendanceNote ? "attendance" : legalOpinion ? "opinion" : "transcript"}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger 
                  value="attendance" 
                  disabled={!attendanceNote}
                  data-testid="tab-attendance-note"
                >
                  Attendance Note
                </TabsTrigger>
                <TabsTrigger 
                  value="opinion" 
                  disabled={!legalOpinion}
                  data-testid="tab-legal-opinion"
                >
                  Legal Opinion
                </TabsTrigger>
                <TabsTrigger 
                  value="transcript" 
                  disabled={!transcript}
                  data-testid="tab-transcript"
                >
                  Transcript
                </TabsTrigger>
              </TabsList>

              {attendanceNote && (
                <TabsContent value="attendance" className="mt-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div className="whitespace-pre-wrap" data-testid="content-attendance-note">
                      {attendanceNote.content}
                    </div>
                  </div>
                </TabsContent>
              )}

              {legalOpinion && (
                <TabsContent value="opinion" className="mt-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div className="whitespace-pre-wrap" data-testid="content-legal-opinion">
                      {legalOpinion.content}
                    </div>
                  </div>
                </TabsContent>
              )}

              {transcript && (
                <TabsContent value="transcript" className="mt-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div className="whitespace-pre-wrap text-muted-foreground" data-testid="content-transcript">
                      {transcript.content}
                    </div>
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            If you have any questions about these documents, please contact your solicitor.
          </p>
        </div>
      </div>
    </div>
  );
}
