import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, FileText, AlertCircle, CheckCircle2, Clock, Smartphone, Loader2, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getApiErrorMessage } from "@/lib/queryClient";
import { exportToPDF, exportToWord } from "@/lib/documentExport";
import type { FirmProfile } from "@shared/schema";
import DownloadModal from "@/components/DownloadModal";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { normalizeAttendanceSectionLabels } from "@shared/attendanceNoteFormat";
import { ShareBrandBar, ShareBrandFooter } from "@/components/ShareBrandChrome";
import { ShareFlagCorrection } from "@/components/ShareFlagCorrection";

interface ShareLinkData {
  requiresSmsVerification: boolean;
  requiresPassword: boolean;
  recipientName?: string;
  hasRegisteredPhone?: boolean;
  phoneLastFour?: string;
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
    sharedDocuments: string[];
  };
  firmProfile?: FirmProfile;
}

function SharedDocumentContent({
  content,
  testId,
  transcript = false,
  attendance = false,
}: {
  content: string;
  testId: string;
  transcript?: boolean;
  attendance?: boolean;
}) {
  const displayContent = attendance
    ? normalizeAttendanceSectionLabels(content)
    : content;
  // Page-level scroll only — avoid nested ScrollArea (double scrollbar).
  return (
    <div
      className={`prose prose-sm sm:prose-base dark:prose-invert max-w-none pb-2 ${
        transcript ? "font-mono text-xs sm:text-sm" : ""
      }`}
      data-testid={testId}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
        {displayContent}
      </ReactMarkdown>
    </div>
  );
}

export default function ShareLinkView() {
  const [, params] = useRoute("/share/:linkId");
  const linkId = params?.linkId;
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [smsStep, setSmsStep] = useState<"phone" | "code">("phone");
  const [sentToLastFour, setSentToLastFour] = useState<string | undefined>();
  const [deliveryChannel, setDeliveryChannel] = useState<"sms" | "email" | "sms_and_email" | undefined>();
  const [password, setPassword] = useState("");
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [activeDocTab, setActiveDocTab] = useState<string>("attendance");
  const { toast } = useToast();

  const { data, isLoading, error, refetch } = useQuery<ShareLinkData>({
    queryKey: ['/api/share', linkId],
    enabled: !!linkId,
    staleTime: 0,
    gcTime: 0,
  });

  const sendSmsMutation = useMutation({
    mutationFn: async (phone?: string) => {
      const response = await apiRequest<{
        success: boolean;
        phoneLastFour?: string;
        emailBackupSent?: boolean;
        deliveryChannel?: "sms" | "email" | "sms_and_email";
        message?: string;
      }>('POST', `/api/share/${linkId}/send-sms`, phone ? { phoneNumber: phone } : {});
      return response;
    },
    onSuccess: (result) => {
      setSentToLastFour(result.phoneLastFour || data?.phoneLastFour);
      setDeliveryChannel(result.deliveryChannel);
      const description =
        result.deliveryChannel === "sms_and_email"
          ? "Check your mobile and your email for the verification code."
          : result.deliveryChannel === "email"
            ? "We sent the verification code to your email."
            : result.message || "Please check your phone for the verification code";
      toast({
        title: "Code Sent",
        description,
        duration: 8000,
      });
      setSmsStep("code");
    },
    onError: (error: unknown) => {
      const errorMsg = getApiErrorMessage(error, "");
      
      const isPhoneMismatch = errorMsg.includes("does not match") || errorMsg.includes("expected recipient");
      const isRateLimit = errorMsg.includes("Maximum SMS send attempts");
      
      let title = "Failed to Send Code";
      let description = errorMsg || "We could not send a verification code. Please check your number and try again, or contact the sender directly.";
      let duration = 8000;
      
      if (isPhoneMismatch) {
        title = "Incorrect Phone Number";
        description = `Please use the mobile number that ${data?.recipientName || "the solicitor"} specified when sharing these documents with you. If you're unsure, please contact them directly.`;
        duration = 10000;
      } else if (isRateLimit) {
        title = "Too Many Attempts";
        description = "Maximum verification attempts exceeded. Please contact the sender directly.";
        duration = 10000;
      }
      
      toast({
        title,
        description,
        variant: "destructive",
        duration,
      });
    },
  });

  const verifySmsMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest('POST', `/api/share/${linkId}/verify-sms`, { code });
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
    onError: (error: unknown) => {
      toast({
        title: "Verification Failed",
        description: getApiErrorMessage(error, "Invalid code. Please try again"),
        variant: "destructive",
        duration: 8000,
      });
    },
  });

  const handleSendSms = () => {
    // Registered number on file: send without requiring re-entry (avoids format mismatches)
    if (data?.hasRegisteredPhone) {
      sendSmsMutation.mutate(undefined);
      return;
    }
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
    if (data?.hasRegisteredPhone) {
      sendSmsMutation.mutate(undefined);
    } else {
      sendSmsMutation.mutate(phoneNumber);
    }
  };

  const verifyPasswordMutation = useMutation({
    mutationFn: async (pwd: string) => {
      const response = await apiRequest('POST', `/api/share/${linkId}/verify-password`, {
        password: pwd.trim(),
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Password Verified",
        description: "Loading your documents...",
        duration: 3000,
      });
      // Refetch to get documents after password verification
      refetch();
    },
    onError: (error: unknown) => {
      toast({
        title: "Incorrect Password",
        description: getApiErrorMessage(error, "Please try again"),
        variant: "destructive",
        duration: 8000,
      });
    },
  });

  const handleVerifyPassword = () => {
    if (!password.trim()) {
      toast({
        title: "Password Required",
        description: "Please enter the password",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }
    verifyPasswordMutation.mutate(password.trim());
  };

  const handleDownload = async (selectedDocs: string[], format: 'pdf' | 'word') => {
    if (!data?.caseData || !data?.documents || !data?.shareLink) return;

    const sharedDocs = data.shareLink.sharedDocuments || [];
    const isSharedDocType = (docType: string) =>
      sharedDocs.includes(docType) ||
      ((docType === "summary" || docType === "client_letter") &&
        (sharedDocs.includes("summary") || sharedDocs.includes("client_letter"))) ||
      ((docType === "attendance_note" || docType === "meeting_notes") &&
        (sharedDocs.includes("attendance_note") || sharedDocs.includes("meeting_notes")));
    
    const invalidDocs = selectedDocs.filter(doc => !isSharedDocType(doc));
    if (invalidDocs.length > 0) {
      toast({
        title: "Invalid Selection",
        description: "Some selected documents are not available for download",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    try {
      const documentContent: any = {
        caseTitle: data.caseData.title,
        clientName: data.caseData.clientName,
        matterReference: data.caseData.matterReference || undefined,
        createdAt: data.documents[0]?.createdAt.toString() || new Date().toISOString(),
        documentType: selectedDocs.length === 1 ? selectedDocs[0] as any : 'full_case',
        firmProfile: data.firmProfile,
      };

      if (selectedDocs.includes('attendance_note') && (sharedDocs.includes('attendance_note') || sharedDocs.includes('meeting_notes'))) {
        const doc = data.documents.find(d => d.type === 'attendance_note' || d.type === 'meeting_notes');
        if (doc) documentContent.attendanceNote = doc.content;
      }

      if (selectedDocs.includes('summary') && (sharedDocs.includes('summary') || sharedDocs.includes('client_letter'))) {
        const doc = data.documents.find(d => d.type === 'summary' || d.type === 'client_letter');
        if (doc) documentContent.summary = doc.content;
      }

      if (selectedDocs.includes('client_care_letter') && sharedDocs.includes('client_care_letter')) {
        const doc = data.documents.find(d => d.type === 'client_care_letter');
        if (doc) documentContent.clientCareLetter = doc.content;
      }

      if (selectedDocs.includes('transcript') && sharedDocs.includes('transcript') && data.transcript) {
        documentContent.transcript = data.transcript.content;
      }

      if (format === 'pdf') {
        await exportToPDF(documentContent);
      } else {
        await exportToWord(documentContent);
      }

      toast({
        title: `${format.toUpperCase()} Downloaded`,
        description: "Your documents have been downloaded successfully",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: `Failed to download ${format.toUpperCase()}. Please try again.`,
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <ShareBrandBar />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Loading secure document access...</CardTitle>
              </div>
            </CardHeader>
          </Card>
        </div>
        <ShareBrandFooter />
      </div>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to load documents";
    const isExpired = errorMessage.includes("expired");
    const isNotFound = errorMessage.includes("not found");

    return (
      <div className="min-h-screen bg-background flex flex-col">
        <ShareBrandBar />
        <div className="flex-1 flex items-center justify-center p-4">
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
        <ShareBrandFooter />
      </div>
    );
  }

  if (data?.requiresPassword) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <ShareBrandBar />
        <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <CardTitle>Password Required</CardTitle>
            </div>
            <CardDescription>
              This link is password protected. Please enter the password to access the documents.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
              <Lock className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                Shared with: <strong>{data.recipientName}</strong>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                data-testid="input-password"
              />
              <p className="text-xs text-muted-foreground">
                Enter the password provided by your solicitor
              </p>
            </div>

            <Button 
              onClick={handleVerifyPassword}
              className="w-full"
              disabled={verifyPasswordMutation.isPending}
              data-testid="button-verify-password"
            >
              {verifyPasswordMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Verify Password
                </>
              )}
            </Button>
          </CardContent>
        </Card>
        </div>
        <ShareBrandFooter />
      </div>
    );
  }

  if (data?.requiresSmsVerification) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <ShareBrandBar />
        <div className="flex-1 flex items-center justify-center p-4">
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

                {data.hasRegisteredPhone ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      We will send a verification code to the mobile number on file
                      {data.phoneLastFour ? (
                        <> ending in <strong>····{data.phoneLastFour}</strong></>
                      ) : null}
                      , and a backup copy to your email.
                    </p>
                  </div>
                ) : (
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
                )}

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
                    {deliveryChannel === "email"
                      ? "Code sent to your email on file."
                      : deliveryChannel === "sms_and_email"
                        ? `Code sent to ····${sentToLastFour || data.phoneLastFour || "****"} and your email.`
                        : `Code sent to number ending in ····${sentToLastFour || data.phoneLastFour || "****"}`}
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="verification-code">Verification Code</Label>
                  <Input
                    id="verification-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
                    maxLength={6}
                    className="text-center text-2xl tracking-widest font-sans"
                    data-testid="input-verification-code"
                  />
                  <p className="text-xs text-muted-foreground">
                    Code expires in 15 minutes
                    {deliveryChannel === "sms_and_email" || deliveryChannel === "email"
                      ? " · check your email if SMS does not arrive"
                      : null}
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

                {!data.hasRegisteredPhone && (
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
                )}
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
        <ShareBrandFooter />
      </div>
    );
  }

  if (!data?.caseData) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <ShareBrandBar />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle>Unable to load documents</CardTitle>
              </div>
              <CardDescription>
                Verification succeeded, but the shared documents could not be loaded. Please try the link again or contact your solicitor.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
        <ShareBrandFooter />
      </div>
    );
  }

  const { caseData, documents, transcript, shareLink } = data;

  const getDocumentTitle = (type: string) => {
    switch (type) {
      case "attendance_note":
        return "Attendance Note";
      case "summary":
      case "client_letter":
        return "Client Letter";
      default:
        return type;
    }
  };

  const attendanceNote = documents?.find(doc => doc.type === "attendance_note" || doc.type === "meeting_notes");
  const summary = documents?.find(doc => doc.type === "summary" || doc.type === "client_letter");

  const sharedDocs = shareLink?.sharedDocuments || [];
  const careLetter = documents?.find(doc => doc.type === "client_care_letter");
  const showCareLetter = !!careLetter && sharedDocs.includes("client_care_letter");
  const summaryShared = sharedDocs.includes("summary") || sharedDocs.includes("client_letter");
  const availableDocuments = {
    hasAttendanceNote: !!attendanceNote && (sharedDocs.includes("attendance_note") || sharedDocs.includes("meeting_notes")),
    hasSummary: !!summary && summaryShared,
    hasTranscript: !!transcript && sharedDocs.includes("transcript"),
    hasCareLetter: showCareLetter,
  };

  const canDownload = shareLink?.accessLevel === "download";

  const activeDocument =
    activeDocTab === "attendance"
      ? attendanceNote
      : activeDocTab === "summary"
        ? summary
        : activeDocTab === "care-letter"
          ? careLetter
          : null;
  const activeDocumentType =
    activeDocTab === "transcript"
      ? "transcript"
      : activeDocument?.type || null;

  const defaultTab =
    showCareLetter && !attendanceNote && !summary
      ? "care-letter"
      : attendanceNote
        ? "attendance"
        : summary
          ? "summary"
          : showCareLetter
            ? "care-letter"
            : "transcript";

  // Do not put hooks here — early returns above would change hook order after SMS unlock
  // and white-screen the page. Tabs already fall back via value={... ? activeDocTab : defaultTab}.

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ShareBrandBar />
      <div className="container max-w-5xl mx-auto py-8 px-4 flex-1">
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

        {/* Documents — natural page scroll (single scrollbar) */}
        <Card className="overflow-hidden">
          <CardHeader className="relative z-20 shrink-0 border-b bg-card">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle>Case Documents</CardTitle>
                <CardDescription>
                  Documents prepared for this matter
                </CardDescription>
              </div>
              {canDownload && (
                <Button
                  onClick={() => setShowDownloadModal(true)}
                  variant="default"
                  size="sm"
                  data-testid="button-open-download-modal"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Documents
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <ShareFlagCorrection
              linkId={linkId!}
              activeDocumentId={activeDocument?.id}
              activeDocumentType={activeDocumentType}
            />
            <Tabs
              value={["attendance", "summary", "care-letter", "transcript"].includes(activeDocTab) ? activeDocTab : defaultTab}
              onValueChange={setActiveDocTab}
              className="w-full"
            >
              <TabsList className="grid w-full shrink-0 grid-flow-col auto-cols-fr gap-1">
                {attendanceNote && (
                  <TabsTrigger 
                    value="attendance" 
                    data-testid="tab-attendance-note"
                  >
                    Attendance Note
                  </TabsTrigger>
                )}
                {summary && (
                  <TabsTrigger 
                    value="summary" 
                    data-testid="tab-summary"
                  >
                    Client Letter
                  </TabsTrigger>
                )}
                {showCareLetter && (
                  <TabsTrigger
                    value="care-letter"
                    data-testid="tab-care-letter"
                  >
                    Client Care Letter
                  </TabsTrigger>
                )}
                {transcript && (
                  <TabsTrigger 
                    value="transcript" 
                    data-testid="tab-transcript"
                  >
                    Transcript
                  </TabsTrigger>
                )}
              </TabsList>

              {attendanceNote && (
                <TabsContent value="attendance" className="mt-4">
                  <SharedDocumentContent
                    content={attendanceNote.content}
                    testId="content-attendance-note"
                    attendance
                  />
                </TabsContent>
              )}

              {summary && (
                <TabsContent value="summary" className="mt-4">
                  <SharedDocumentContent
                    content={summary.content}
                    testId="content-summary"
                  />
                </TabsContent>
              )}

              {showCareLetter && careLetter && (
                <TabsContent value="care-letter" className="mt-4">
                  <SharedDocumentContent
                    content={careLetter.content}
                    testId="content-care-letter"
                  />
                </TabsContent>
              )}

              {transcript && (
                <TabsContent value="transcript" className="mt-4">
                  <SharedDocumentContent
                    content={transcript.content}
                    testId="content-transcript"
                    transcript
                  />
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <ShareBrandFooter />

      {/* Download Modal */}
      <DownloadModal
        open={showDownloadModal}
        onOpenChange={setShowDownloadModal}
        availableDocuments={availableDocuments}
        sharedDocuments={sharedDocs}
        onDownload={handleDownload}
      />
    </div>
  );
}
