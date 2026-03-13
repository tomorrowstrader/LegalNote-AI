import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, Building2, Bell, Activity, Download, Loader2, Calendar, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronUp, Copy, Check, Mail, Briefcase, Cloud, HardDrive, FlaskConical, Trash2, RefreshCw, Database } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFirmProfileSchema } from "@shared/schema";
import type { FirmProfile, InsertFirmProfile, UserPreferences } from "@shared/schema";
import { SafeguardsStatus } from "@/components/SafeguardsStatus";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface UserStatistics {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  totalCases: number;
  successfulCases: number;
  failedCases: number;
  totalCosts: number;
  lastActivity: string | null;
  joinedDate: string;
}

function FirmProfileForm() {
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: firmProfile, isLoading } = useQuery<FirmProfile>({
    queryKey: ['/api/firm-profile'],
  });

  const form = useForm<InsertFirmProfile>({
    resolver: zodResolver(insertFirmProfileSchema),
    defaultValues: {
      firmName: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      postcode: "",
      country: "United Kingdom",
      phone: "",
      email: "",
      sraNumber: "",
      logoUrl: "",
      includeLocation: true,
      showFullSolicitorName: true,
      includeClientConfirmation: false,
    },
  });

  // Update form when data loads
  useEffect(() => {
    if (firmProfile) {
      form.reset({
        firmName: firmProfile.firmName || "",
        addressLine1: firmProfile.addressLine1 || "",
        addressLine2: firmProfile.addressLine2 || "",
        city: firmProfile.city || "",
        postcode: firmProfile.postcode || "",
        country: firmProfile.country || "United Kingdom",
        phone: firmProfile.phone || "",
        email: firmProfile.email || "",
        sraNumber: firmProfile.sraNumber || "",
        logoUrl: firmProfile.logoUrl || "",
        includeLocation: firmProfile.includeLocation ?? true,
        showFullSolicitorName: firmProfile.showFullSolicitorName ?? true,
        includeClientConfirmation: firmProfile.includeClientConfirmation ?? false,
      });
    }
  }, [firmProfile, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: InsertFirmProfile) => {
      const response = await fetch('/api/firm-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          updatedBy: user?.id,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update firm profile');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/firm-profile'] });
      toast({
        title: "Firm Profile Updated",
        description: "Your firm details have been saved successfully.",
        duration: 3000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update firm profile. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  const onSubmit = (data: InsertFirmProfile) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading firm profile...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          <CardTitle>Firm Details</CardTitle>
        </div>
        <CardDescription>
          Manage your law firm information. These details will appear on all exported documents.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="firmName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Firm Name *</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-firm-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="addressLine1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 1</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-address-line1" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="addressLine2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 2</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-address-line2" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-city" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="postcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postcode</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-postcode" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-phone" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Firm Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" data-testid="input-email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sraNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SRA Number</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-sra-number" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator className="my-6" />

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Document Preferences</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure which fields appear in generated attendance notes and legal documents
                </p>
              </div>

              <FormField
                control={form.control}
                name="includeLocation"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Include Meeting Location</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Show whether meeting was in office, by phone, or video conference
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-include-location"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="showFullSolicitorName"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Show Full Solicitor Name</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Display full name and title, or initials only for privacy
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-show-full-name"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="includeClientConfirmation"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Include Client Confirmation Section</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Add signature box for client to confirm accuracy of notes
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-client-confirmation"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <Button 
              type="submit" 
              className="bg-accent hover:bg-accent" 
              disabled={updateMutation.isPending}
              data-testid="button-save-firm"
            >
              {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function UsageMetrics() {
  const { toast } = useToast();
  const { data: teamMembers, isLoading: loadingTeam } = useQuery<UserStatistics[]>({
    queryKey: ["/api/admin/users"],
  });

  const totalCases = teamMembers?.reduce((sum, m) => sum + m.totalCases, 0) || 0;
  const successfulCases = teamMembers?.reduce((sum, m) => sum + m.successfulCases, 0) || 0;
  const failedCases = teamMembers?.reduce((sum, m) => sum + m.failedCases, 0) || 0;

  const handleExportReport = () => {
    if (totalCases === 0) {
      toast({
        title: "No Data to Export",
        description: "There is no usage data available to export",
        variant: "destructive",
      });
      return;
    }

    const headers = ['Metric', 'Count'];
    const csvData = [
      ['Total Cases', totalCases],
      ['Successful Cases', successfulCases],
      ['Failed Cases', failedCases],
      ['Success Rate %', totalCases > 0 ? Math.round((successfulCases / totalCases) * 100) : 0],
      ['Export Date', new Date().toLocaleDateString('en-GB')]
    ];

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `LegalNote_Usage_Report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Report Exported",
      description: "Usage report has been downloaded successfully",
      duration: 3000,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            <CardTitle>Usage Metrics</CardTitle>
          </div>
          <Button variant="outline" className="gap-2" onClick={handleExportReport} data-testid="button-export-usage">
            <Download className="w-4 h-4" />
            Export Report
          </Button>
        </div>
        <CardDescription>Track your platform usage and case activity</CardDescription>
      </CardHeader>
      <CardContent>
        {loadingTeam ? (
          <div className="text-center py-4 text-muted-foreground">Loading usage data...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Cases</p>
              <p className="text-3xl font-semibold">{totalCases}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Successful</p>
              <p className="text-3xl font-semibold text-green-600">{successfulCases}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Failed</p>
              <p className="text-3xl font-semibold text-destructive">{failedCases}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Success Rate</p>
              <p className="text-3xl font-semibold">
                {totalCases > 0 ? Math.round((successfulCases / totalCases) * 100) : 0}%
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CalendarConnections() {
  const { toast } = useToast();
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [copiedUri, setCopiedUri] = useState<string | null>(null);
  
  const { data: connections, isLoading } = useQuery<{
    google: { connected: boolean; email?: string; connectedAt?: string };
  }>({
    queryKey: ['/api/oauth/connections'],
  });

  const { data: oauthConfig } = useQuery<{
    baseUrl: string;
    redirectUris: { google: string };
    instructions: {
      google: { step1: string; step2: string; step3: string; step4: string };
    };
    status: { googleConfigured: boolean };
  }>({
    queryKey: ['/api/calendar/oauth-config'],
  });

  const disconnectMutation = useMutation({
    mutationFn: async (provider: 'google') => {
      const res = await fetch(`/api/calendar/disconnect/${provider}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to disconnect calendar');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/oauth/connections'] });
      toast({
        title: "Calendar Disconnected",
        description: "Google Calendar has been disconnected",
        duration: 4000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Disconnect Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleConnect = () => {
    window.location.href = `/api/oauth/connect/google`;
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate('google');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUri(label);
    setTimeout(() => setCopiedUri(null), 2000);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
      duration: 2000,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading calendar connections...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          <CardTitle>Calendar Integrations</CardTitle>
        </div>
        <CardDescription>
          Connect your calendar to automatically sync case deadlines
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Calendar className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Google Calendar</p>
                {connections?.google.connected && connections.google.email ? (
                  <p className="text-sm text-muted-foreground">{connections.google.email}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Not connected</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connections?.google.connected ? (
                <>
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Connected
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={disconnectMutation.isPending}
                    data-testid="button-disconnect-google"
                  >
                    {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
                  </Button>
                </>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleConnect}
                  data-testid="button-connect-google"
                >
                  Connect
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 border rounded-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Calendar className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Outlook Calendar</p>
                {connections?.outlook?.connected && connections.outlook.email ? (
                  <p className="text-sm text-muted-foreground">{connections.outlook.email}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Not connected</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connections?.outlook?.connected ? (
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  Connect via Replit Tools
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Separator />

        <Collapsible open={showTroubleshooting} onOpenChange={setShowTroubleshooting}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between" size="sm">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>Troubleshooting OAuth Configuration</span>
              </div>
              {showTroubleshooting ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4 space-y-4">
            {oauthConfig && (
              <>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    If you see "redirect_uri_mismatch" or "invalid_request" errors, make sure these exact redirect URIs are configured in your OAuth provider settings.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Google Calendar Redirect URI</Label>
                      <Badge variant={oauthConfig.status.googleConfigured ? "outline" : "destructive"}>
                        {oauthConfig.status.googleConfigured ? "Configured" : "Not Configured"}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Input 
                        value={oauthConfig.redirectUris.google} 
                        readOnly 
                        className="font-mono text-xs"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(oauthConfig.redirectUris.google, "Google redirect URI")}
                      >
                        {copiedUri === "Google redirect URI" ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1 pl-3">
                      <p className="font-medium">Configuration steps:</p>
                      <ol className="list-decimal list-inside space-y-0.5">
                        <li>{oauthConfig.instructions.google.step1}</li>
                        <li>{oauthConfig.instructions.google.step2}</li>
                        <li>{oauthConfig.instructions.google.step3}</li>
                        <li>{oauthConfig.instructions.google.step4}</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        <div className="space-y-2">
          <p className="text-sm font-medium">How it works</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Connect your Google Calendar account</li>
            <li>Set deadlines on cases using "Set Priority & Deadline"</li>
            <li>Sync deadlines to your calendar using "Sync to Calendar"</li>
            <li>Calendar events update automatically when you change case deadlines</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function VideoConferencing() {
  const { toast } = useToast();
  
  interface RecallStatus {
    configured: boolean;
    connected: boolean;
    connection: {
      status: string;
      connectedAt: string;
      lastSyncAt: string;
    } | null;
  }
  
  const { data: recallStatus, isLoading } = useQuery<RecallStatus>({
    queryKey: ['/api/recall/status'],
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/recall/connect');
      return res;
    },
    onSuccess: (data: { valid: boolean; message: string }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/recall/status'] });
      if (data.valid) {
        toast({
          title: "Video Integration Connected",
          description: "You can now import meeting recordings from Zoom, Teams, and Meet",
          duration: 4000,
        });
      } else {
        toast({
          title: "Connection Issue",
          description: data.message || "Unable to connect video integration",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect video integration",
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', '/api/recall/disconnect');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recall/status'] });
      toast({
        title: "Video Integration Disconnected",
        description: "Meeting import feature has been disabled",
        duration: 4000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Disconnect Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading video integration status...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          <CardTitle>Video Conferencing</CardTitle>
        </div>
        <CardDescription>
          Import recordings from Zoom, Microsoft Teams, and Google Meet to automatically generate attendance notes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!recallStatus?.configured ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Video conferencing integration is not configured. Contact your administrator to set up the RECALL_API_KEY.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Activity className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Meeting Recording Import</p>
                  <p className="text-sm text-muted-foreground">
                    Import from Zoom, Teams, and Meet
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {recallStatus.connected ? (
                  <>
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Connected
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnectMutation.mutate()}
                      disabled={disconnectMutation.isPending}
                      data-testid="button-disconnect-recall"
                    >
                      {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => connectMutation.mutate()}
                    disabled={connectMutation.isPending}
                    data-testid="button-connect-recall"
                  >
                    {connectMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      "Connect"
                    )}
                  </Button>
                )}
              </div>
            </div>

            {recallStatus.connected && recallStatus.connection && (
              <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
                <p>Connected since: {new Date(recallStatus.connection.connectedAt).toLocaleDateString('en-GB', { 
                  day: 'numeric', 
                  month: 'short', 
                  year: 'numeric' 
                })}</p>
                {recallStatus.connection.lastSyncAt && (
                  <p>Last sync: {new Date(recallStatus.connection.lastSyncAt).toLocaleString('en-GB')}</p>
                )}
              </div>
            )}
          </div>
        )}

        <Separator />

        <div className="space-y-2">
          <p className="text-sm font-medium">How it works</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Record your video meetings using Zoom, Teams, or Google Meet</li>
            <li>After the call ends, open the case in LegalNote AI</li>
            <li>Click "Import Recording" to select from your recent meetings</li>
            <li>Confirm client consent was obtained before or during the call</li>
            <li>LegalNote AI downloads the recording and generates your attendance note automatically</li>
          </ul>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Supported platforms</p>
          <div className="flex gap-2">
            <Badge variant="secondary">Zoom</Badge>
            <Badge variant="secondary">Microsoft Teams</Badge>
            <Badge variant="secondary">Google Meet</Badge>
          </div>
        </div>

        <div className="p-3 bg-muted rounded-md">
          <p className="text-xs text-muted-foreground">
            <strong>GDPR Notice:</strong> Meeting recordings are processed securely and deleted within 7 days. 
            Client consent must be confirmed before importing any recording.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ClioIntegration() {
  const { toast } = useToast();
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  
  interface ClioStatus {
    configured: boolean;
    connected: boolean;
    status?: string;
    firmName?: string;
    email?: string;
    lastSyncAt?: string;
    syncEnabled?: boolean;
    message?: string;
  }
  
  const { data: clioStatus, isLoading, refetch } = useQuery<ClioStatus>({
    queryKey: ['/api/clio/status'],
  });

  useEffect(() => {
    if (searchParams.get('clio_connected') === 'true') {
      refetch();
      toast({
        title: "Clio Connected",
        description: "Your Clio account has been successfully connected.",
        duration: 4000,
      });
      window.history.replaceState({}, '', '/settings');
    } else if (searchParams.get('clio_error')) {
      const error = searchParams.get('clio_error');
      toast({
        title: "Clio Connection Failed",
        description: error || "Failed to connect to Clio",
        variant: "destructive",
        duration: 6000,
      });
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/clio/disconnect');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clio/status'] });
      toast({
        title: "Clio Disconnected",
        description: "Your Clio account has been disconnected.",
        duration: 4000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Disconnect Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleConnect = () => {
    window.location.href = '/api/clio/auth';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading Clio integration status...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Briefcase className="w-5 h-5" />
          <CardTitle>Clio Practice Management</CardTitle>
        </div>
        <CardDescription>
          Connect to Clio to import matters and sync case information with your practice management system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!clioStatus?.configured ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {clioStatus?.message || "Clio integration is not configured. Contact your administrator to set up CLIO_CLIENT_ID and CLIO_CLIENT_SECRET."}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Clio Manage</p>
                  {clioStatus.connected && clioStatus.firmName ? (
                    <p className="text-sm text-muted-foreground">{clioStatus.firmName}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not connected</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {clioStatus.connected ? (
                  <>
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Connected
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnectMutation.mutate()}
                      disabled={disconnectMutation.isPending}
                      data-testid="button-disconnect-clio"
                    >
                      {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleConnect}
                    data-testid="button-connect-clio"
                  >
                    Connect
                  </Button>
                )}
              </div>
            </div>

            {clioStatus.connected && clioStatus.email && (
              <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
                <p>Connected as: {clioStatus.email}</p>
                {clioStatus.lastSyncAt && (
                  <p>Last sync: {new Date(clioStatus.lastSyncAt).toLocaleString('en-GB')}</p>
                )}
              </div>
            )}
          </div>
        )}

        <Separator />

        <div className="space-y-2">
          <p className="text-sm font-medium">How it works</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Connect your Clio account using OAuth</li>
            <li>Import matters from Clio to create new cases in LegalNote AI</li>
            <li>Link existing cases to Clio matters for easy reference</li>
            <li>Matter reference numbers and client names are automatically synced</li>
          </ul>
        </div>

        <div className="p-3 bg-muted rounded-md">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> LegalNote AI uses Clio's EU endpoint for GDPR compliance. 
            Only matter metadata is synced - no document content is transferred to Clio.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function StorageIntegrations() {
  const { toast } = useToast();
  
  interface StorageStatus {
    sharepoint: {
      available: boolean;
      connected: boolean;
      autoSyncEnabled: boolean;
      email: string | null;
      driveName: string | null;
      availableInfo?: {
        email: string | null;
        drive: { id: string; name: string } | null;
        sites?: Array<{ id: string; name: string; displayName: string }>;
      };
    };
    onedrive: {
      available: boolean;
      connected: boolean;
      autoSyncEnabled: boolean;
      email: string | null;
      driveName: string | null;
      availableInfo?: {
        email: string | null;
        drive: { id: string; name: string } | null;
      };
    };
  }
  
  const { data: storageStatus, isLoading } = useQuery<StorageStatus>({
    queryKey: ['/api/storage/status'],
  });

  const connectMutation = useMutation({
    mutationFn: async (provider: 'sharepoint' | 'onedrive') => {
      const res = await apiRequest('POST', '/api/storage/connect', { provider });
      return res;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/storage/status'] });
      toast({
        title: "Connected",
        description: `Successfully connected to ${data.connection?.driveName || 'cloud storage'}.`,
        duration: 4000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (provider: 'sharepoint' | 'onedrive') => {
      const res = await fetch(`/api/storage/disconnect/${provider}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to disconnect');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/storage/status'] });
      toast({
        title: "Disconnected",
        description: "Cloud storage has been disconnected.",
        duration: 4000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Disconnect Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleAutoSyncMutation = useMutation({
    mutationFn: async ({ provider, enabled }: { provider: 'sharepoint' | 'onedrive'; enabled: boolean }) => {
      const res = await apiRequest('PATCH', `/api/storage/${provider}/settings`, { autoSyncEnabled: enabled });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/storage/status'] });
      toast({
        title: "Settings Updated",
        description: "Auto-sync setting has been updated.",
        duration: 3000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading cloud storage status...</p>
        </CardContent>
      </Card>
    );
  }

  const renderStorageProvider = (
    provider: 'sharepoint' | 'onedrive',
    label: string,
    icon: 'cloud' | 'drive',
    status: StorageStatus['sharepoint'] | StorageStatus['onedrive'] | undefined
  ) => {
    const IconComponent = icon === 'cloud' ? Cloud : HardDrive;
    
    return (
      <div className="flex items-center justify-between p-4 border rounded-md" key={provider}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <IconComponent className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">{label}</p>
            {status?.connected ? (
              <p className="text-sm text-muted-foreground">
                {status.driveName || status.email || 'Connected'}
              </p>
            ) : status?.available ? (
              <p className="text-sm text-muted-foreground">Available - Click to connect</p>
            ) : (
              <p className="text-sm text-muted-foreground">Connect via Replit Tools</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status?.connected ? (
            <>
              <div className="flex items-center gap-2 mr-2">
                <span className="text-xs text-muted-foreground">Auto-sync</span>
                <Switch
                  checked={status.autoSyncEnabled}
                  onCheckedChange={(checked) => toggleAutoSyncMutation.mutate({ provider, enabled: checked })}
                  disabled={toggleAutoSyncMutation.isPending}
                  data-testid={`switch-autosync-${provider}`}
                />
              </div>
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Connected
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnectMutation.mutate(provider)}
                disabled={disconnectMutation.isPending}
                data-testid={`button-disconnect-${provider}`}
              >
                {disconnectMutation.isPending ? "..." : "Disconnect"}
              </Button>
            </>
          ) : status?.available ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => connectMutation.mutate(provider)}
              disabled={connectMutation.isPending}
              data-testid={`button-connect-${provider}`}
            >
              {connectMutation.isPending ? "Connecting..." : "Connect"}
            </Button>
          ) : (
            <Badge variant="secondary" className="gap-1">
              Setup in Replit Tools
            </Badge>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Cloud className="w-5 h-5" />
          <CardTitle>Firm Cloud Storage</CardTitle>
        </div>
        <CardDescription>
          Centralized document backup for your firm
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Cloud className="h-4 w-4" />
          <AlertDescription>
            This is a firm-wide integration. All solicitors' documents will sync to the same connected storage account, 
            creating a centralized document repository for your practice.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          {renderStorageProvider('onedrive', 'OneDrive', 'drive', storageStatus?.onedrive)}
          {renderStorageProvider('sharepoint', 'SharePoint', 'cloud', storageStatus?.sharepoint)}
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-sm font-medium">How it works</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Admin connects the firm's OneDrive or SharePoint account via Replit Tools</li>
            <li>Documents from all solicitors sync to: LegalNote AI / Cases / [Client - Case Title]</li>
            <li>Each case gets organized folders for attendance notes, summaries, and transcripts</li>
            <li>Perfect for boutique firms wanting a shared document library</li>
          </ul>
        </div>

        <div className="p-3 bg-muted rounded-md">
          <p className="text-xs text-muted-foreground">
            <strong>Setup:</strong> Connect your firm's Microsoft account in Replit Tools first, then click "Connect" above. 
            For solo practitioners, this provides automatic backup of all your generated documents.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationSettings() {
  const { toast } = useToast();
  
  const { data: preferences, isLoading } = useQuery<UserPreferences>({
    queryKey: ['/api/user-preferences'],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<UserPreferences>) => {
      const response = await fetch('/api/user-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update preferences');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-preferences'] });
      toast({
        title: "Preferences Updated",
        description: "Your notification preferences have been saved.",
        duration: 3000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update preferences. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  const handleEmailToggle = (checked: boolean) => {
    updateMutation.mutate({ sendRecordingConfirmationEmails: checked });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading notification preferences...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          <CardTitle>Notification Preferences</CardTitle>
        </div>
        <CardDescription>
          Control which notifications you receive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-md">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mt-0.5">
              <Mail className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Recording Confirmation Emails</p>
              <p className="text-sm text-muted-foreground">
                Receive an email each time a recording is successfully saved and processed
              </p>
            </div>
          </div>
          <Switch
            checked={preferences?.sendRecordingConfirmationEmails ?? false}
            onCheckedChange={handleEmailToggle}
            disabled={updateMutation.isPending}
            data-testid="switch-recording-confirmation-emails"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Recording confirmation emails are disabled by default to prevent inbox overload. Enable if you prefer email confirmations for each meeting recording.
        </p>
      </CardContent>
    </Card>
  );
}

function DemoDataControls() {
  const { toast } = useToast();
  const [demoDataLoaded, setDemoDataLoaded] = useState(false);

  const seedMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/demo/seed');
      return response;
    },
    onSuccess: (data: any) => {
      setDemoDataLoaded(true);
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      toast({
        title: "Demo Data Loaded",
        description: `Created ${data.casesCreated || 4} sample cases with transcripts, documents, and action items.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Load Demo Data",
        description: error.message || "Could not seed demo data. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/demo/reset');
      return response;
    },
    onSuccess: (data: any) => {
      setDemoDataLoaded(true);
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      toast({
        title: "Demo Data Reset",
        description: `Cleared old data and created ${data.casesCreated || 4} fresh sample cases.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Reset Demo Data",
        description: error.message || "Could not reset demo data. Please try again.",
        variant: "destructive",
      });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', '/api/demo/clear');
      return response;
    },
    onSuccess: () => {
      setDemoDataLoaded(false);
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      toast({
        title: "Demo Data Cleared",
        description: "All sample cases have been removed from your account.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Clear Demo Data",
        description: error.message || "Could not clear demo data. Please try again.",
        variant: "destructive",
      });
    },
  });

  const isLoading = seedMutation.isPending || resetMutation.isPending || clearMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5" />
          <CardTitle>Demo Data</CardTitle>
        </div>
        <CardDescription>
          Load sample UK legal cases for product demonstrations and sales presentations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Database className="h-4 w-4" />
          <AlertDescription>
            Demo data creates 5 realistic UK legal case scenarios: Property Purchase, Employment Dispute, Commercial Contract, and Family Law. Each includes full transcripts, attendance notes, summaries, action items, and audit trail entries.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              <span className="font-medium">Load Demo Data</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Create sample cases in your account for demonstrations
            </p>
            <Button
              onClick={() => seedMutation.mutate()}
              disabled={isLoading}
              className="w-full"
              data-testid="button-load-demo-data"
            >
              {seedMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  Load Demo Data
                </>
              )}
            </Button>
          </div>

          <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="font-medium">Reset Demo Data</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Clear existing demo data and load fresh samples
            </p>
            <Button
              variant="outline"
              onClick={() => resetMutation.mutate()}
              disabled={isLoading}
              className="w-full"
              data-testid="button-reset-demo-data"
            >
              {resetMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reset Demo Data
                </>
              )}
            </Button>
          </div>

          <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-destructive" />
              <span className="font-medium">Clear Demo Data</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Remove all sample cases from your account
            </p>
            <Button
              variant="outline"
              onClick={() => clearMutation.mutate()}
              disabled={isLoading}
              className="w-full border-destructive text-destructive hover:bg-destructive/10"
              data-testid="button-clear-demo-data"
            >
              {clearMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear Demo Data
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">Sample Cases Include:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>Sarah Thompson - Property Purchase (Conveyancing)</li>
            <li>Marcus Webb - Unfair Dismissal Claim (Employment)</li>
            <li>Eleanor Chen - LLP Partnership Agreement (Commercial)</li>
            <li>David Patterson - Divorce Settlement (Family Law)</li>
            <li>James Smith - Financial Settlement (Family Law with cost warnings)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = (user as any)?.isAdmin === true;
  
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const validTabs = ['firm', 'notifications', 'usage', 'integrations', 'security', 'demo'];
    return validTabs.includes(tab || '') ? tab! : 'firm';
  });
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const validTabs = ['firm', 'notifications', 'usage', 'integrations', 'security', 'demo'];
    if (tab && validTabs.includes(tab)) {
      setActiveTab(tab);
    }
  }, []);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 py-8 text-center">
          <h1 className="text-2xl font-semibold mb-4">Access Restricted</h1>
          <p className="text-muted-foreground mb-6">
            You need administrator privileges to access firm settings.
          </p>
          <p className="text-sm text-muted-foreground">
            Looking for your personal settings? Visit <a href="/profile" className="text-accent underline">My Profile</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-foreground">Firm Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage firm, team, and security settings (Admin only)
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="firm" data-testid="tab-firm">Firm</TabsTrigger>
            <TabsTrigger value="notifications" data-testid="tab-notifications">Notifications</TabsTrigger>
            <TabsTrigger value="usage" data-testid="tab-usage">Usage</TabsTrigger>
            <TabsTrigger value="integrations" data-testid="tab-integrations">Integrations</TabsTrigger>
            <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
            <TabsTrigger value="demo" data-testid="tab-demo">Demo</TabsTrigger>
          </TabsList>

          <TabsContent value="firm" className="space-y-6">
            <FirmProfileForm />
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <NotificationSettings />
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            <UsageMetrics />
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <CalendarConnections />
            <VideoConferencing />
            <StorageIntegrations />
            <ClioIntegration />
          </TabsContent>

          <TabsContent value="demo" className="space-y-6">
            <DemoDataControls />
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <SafeguardsStatus />
            
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  <CardTitle>Security & Compliance</CardTitle>
                </div>
                <CardDescription>Platform security and GDPR compliance information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <Shield className="w-5 h-5 text-accent mt-0.5" />
                        <div>
                          <p className="font-medium">Compliance Thread (AML/KYC)</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {user?.complianceThread
                              ? "Per-matter AML monitoring, risk assessments, and MLRO decision records are active."
                              : "Contact your account administrator to enable AML compliance features."}
                          </p>
                        </div>
                      </div>
                      {isAdmin ? (
                        <Switch
                          checked={user?.complianceThread ?? false}
                          onCheckedChange={async (checked) => {
                            try {
                              await apiRequest("PATCH", "/api/user/compliance-thread", { enabled: checked });
                              queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
                            } catch (e) {
                              console.error("Failed to toggle compliance thread:", e);
                            }
                          }}
                          data-testid="switch-compliance-thread"
                        />
                      ) : (
                        <Badge
                          variant={user?.complianceThread ? "default" : "outline"}
                          className="no-default-hover-elevate no-default-active-elevate text-xs"
                          data-testid="badge-compliance-status"
                        >
                          {user?.complianceThread ? "Active" : "Inactive"}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-muted rounded-md">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-accent mt-0.5" />
                      <div>
                        <p className="font-medium">GDPR Compliance Active</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          All audio files are automatically deleted after 7 days. Consent segment audio preserved indefinitely for legal compliance proof.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-muted rounded-md">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-accent mt-0.5" />
                      <div>
                        <p className="font-medium">OAuth Authentication</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Your account is secured via Replit authentication. Password management is handled by your identity provider.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-muted rounded-md">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-accent mt-0.5" />
                      <div>
                        <p className="font-medium">Data Encryption</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          All data is encrypted in transit (TLS) and at rest. Secure share links support SMS two-factor authentication for enhanced client document security.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
