import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, Building2, Bell, Activity, Download, Loader2, Calendar, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFirmProfileSchema } from "@shared/schema";
import type { FirmProfile, InsertFirmProfile } from "@shared/schema";
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
    outlook: { connected: boolean; email?: string; connectedAt?: string };
  }>({
    queryKey: ['/api/oauth/connections'],
  });

  const { data: oauthConfig } = useQuery<{
    baseUrl: string;
    redirectUris: { google: string; outlook: string };
    instructions: {
      google: { step1: string; step2: string; step3: string; step4: string };
      outlook: { step1: string; step2: string; step3: string; step4: string; step5: string };
    };
    status: { googleConfigured: boolean; outlookConfigured: boolean };
  }>({
    queryKey: ['/api/calendar/oauth-config'],
  });

  const disconnectMutation = useMutation({
    mutationFn: async (provider: 'google' | 'outlook') => {
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
    onSuccess: (_, provider) => {
      queryClient.invalidateQueries({ queryKey: ['/api/oauth/connections'] });
      toast({
        title: "Calendar Disconnected",
        description: `${provider === 'google' ? 'Google Calendar' : 'Outlook'} has been disconnected`,
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

  const handleConnect = (provider: 'google' | 'outlook') => {
    window.location.href = `/api/oauth/connect/${provider}`;
  };

  const handleDisconnect = (provider: 'google' | 'outlook') => {
    disconnectMutation.mutate(provider);
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
                    onClick={() => handleDisconnect('google')}
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
                  onClick={() => handleConnect('google')}
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
                <p className="font-medium">Microsoft Outlook</p>
                {connections?.outlook.connected && connections.outlook.email ? (
                  <p className="text-sm text-muted-foreground">{connections.outlook.email}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Not connected</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connections?.outlook.connected ? (
                <>
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Connected
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDisconnect('outlook')}
                    disabled={disconnectMutation.isPending}
                    data-testid="button-disconnect-outlook"
                  >
                    {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
                  </Button>
                </>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleConnect('outlook')}
                  data-testid="button-connect-outlook"
                >
                  Connect
                </Button>
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

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Outlook Redirect URI</Label>
                      <Badge variant={oauthConfig.status.outlookConfigured ? "outline" : "destructive"}>
                        {oauthConfig.status.outlookConfigured ? "Configured" : "Not Configured"}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Input 
                        value={oauthConfig.redirectUris.outlook} 
                        readOnly 
                        className="font-mono text-xs"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(oauthConfig.redirectUris.outlook, "Outlook redirect URI")}
                      >
                        {copiedUri === "Outlook redirect URI" ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1 pl-3">
                      <p className="font-medium">Configuration steps:</p>
                      <ol className="list-decimal list-inside space-y-0.5">
                        <li>{oauthConfig.instructions.outlook.step1}</li>
                        <li>{oauthConfig.instructions.outlook.step2}</li>
                        <li>{oauthConfig.instructions.outlook.step3}</li>
                        <li>{oauthConfig.instructions.outlook.step4}</li>
                        <li>{oauthConfig.instructions.outlook.step5}</li>
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
            <li>Connect your personal calendar account (Google or Outlook)</li>
            <li>Set deadlines on cases using "Set Priority & Deadline"</li>
            <li>Sync deadlines to your calendar using "Sync to Calendar"</li>
            <li>Calendar events update automatically when you change case deadlines</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = (user as any)?.isAdmin === true;

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

        <Tabs defaultValue="firm" className="space-y-6">
          <TabsList>
            <TabsTrigger value="firm" data-testid="tab-firm">Firm</TabsTrigger>
            <TabsTrigger value="usage" data-testid="tab-usage">Usage Metrics</TabsTrigger>
            <TabsTrigger value="integrations" data-testid="tab-integrations">Integrations</TabsTrigger>
            <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="firm" className="space-y-6">
            <FirmProfileForm />
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            <UsageMetrics />
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <CalendarConnections />
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
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
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-accent mt-0.5" />
                      <div>
                        <p className="font-medium">GDPR Compliance Active</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          All audio files are automatically deleted after 7 days. Consent logs are maintained for all recordings and accessible via audit trail.
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
                          Your account is secured via Google, Outlook, or email authentication. Password management is handled by your chosen identity provider.
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
