import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, FileText, AlertCircle, CheckCircle2, Clock, Smartphone, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [smsStep, setSmsStep] = useState<"phone" | "code">("phone");
  const { toast } = useToast();

  const { data, isLoading, error, refetch } = useQuery<ShareLinkData>({
    queryKey: ['/api/share', linkId],
    enabled: !!linkId,
  });

  const sendSmsMutation = useMutation({
    mutationFn: async (phone: string) => {
      const response = await apiRequest(`/api/share/${linkId}/send-sms`, {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: phone }),
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Code Sent",
        description: "Please check your phone for the verification code",
        duration: 5000,
      });
      setSmsStep("code");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Code",
        description: error.message || "Please try again",
        variant: "destructive",
        duration: 8000,
      });
    },
  });

  const verifySmsMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest(`/api/share/${linkId}/verify-sms`, {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Verified Successfully",
        description: "Loading your documents...",
        duration: 3000,
      });
      // Refetch to get documents after verification
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid code. Please try again",
        variant: "destructive",
        duration: 8000,
      });
    },
  });

  const handleSendSms = () => {
    if (!phoneNumber.trim()) {
      toast({
        title: "Phone Number Required",
        description: "Please enter your mobile number",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }
    sendSmsMutation.mutate(phoneNumber);
  };

  const handleVerifyCode = () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter the 6-digit code",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }
    verifySmsMutation.mutate(verificationCode);
  };

  const handleResendCode = () => {
    setVerificationCode("");
    sendSmsMutation.mutate(phoneNumber);
  };

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
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              <CardTitle>SMS Verification Required</CardTitle>
            </div>
            <CardDescription>
              For your security, please verify your mobile number to access these documents.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {smsStep === "phone" ? (
              <>
                <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
                  <Lock className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                    Shared with: <strong>{data.recipientName}</strong>
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="phone-number">Your Mobile Number</Label>
                  <Input
                    id="phone-number"
                    type="tel"
                    placeholder="+447xxx... or 07xxx..."
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendSms()}
                    data-testid="input-phone-number"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter your UK mobile number to receive a verification code
                  </p>
                </div>

                <Button 
                  onClick={handleSendSms}
                  className="w-full"
                  disabled={sendSmsMutation.isPending}
                  data-testid="button-send-code"
                >
                  {sendSmsMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending Code...
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-4 h-4 mr-2" />
                      Send Verification Code
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-sm text-green-800 dark:text-green-200">
                    Code sent to {phoneNumber.replace(/\d(?=\d{4})/g, '*')}
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="verification-code">Verification Code</Label>
                  <Input
                    id="verification-code"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
                    maxLength={6}
                    className="text-center text-2xl tracking-widest"
                    data-testid="input-verification-code"
                  />
                  <p className="text-xs text-muted-foreground">
                    Code expires in 15 minutes
                  </p>
                </div>

                <div className="space-y-2">
                  <Button 
                    onClick={handleVerifyCode}
                    className="w-full"
                    disabled={verifySmsMutation.isPending || verificationCode.length !== 6}
                    data-testid="button-verify-code"
                  >
                    {verifySmsMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Verify Code
                      </>
                    )}
                  </Button>

                  <Button 
                    onClick={handleResendCode}
                    variant="outline"
                    className="w-full"
                    disabled={sendSmsMutation.isPending}
                    data-testid="button-resend-code"
                  >
                    {sendSmsMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Resend Code"
                    )}
                  </Button>
                </div>

                <Button 
                  onClick={() => {
                    setSmsStep("phone");
                    setVerificationCode("");
                  }}
                  variant="ghost"
                  className="w-full text-xs"
                  data-testid="button-change-number"
                >
                  Use a different number
                </Button>
              </>
            )}

            <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                <strong>Confidential Legal Documents:</strong> These documents contain privileged attorney-client communications. Unauthorized access or disclosure is prohibited.
              </AlertDescription>
            </Alert>
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
