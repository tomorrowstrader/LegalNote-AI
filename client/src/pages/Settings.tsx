import { useEffect, useState, useRef } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, Building2, Bell, Activity, Download, Loader2, Calendar, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronUp, Copy, Check, Mail, Briefcase, Cloud, HardDrive, FlaskConical, Trash2, RefreshCw, Database, TrendingUp, Award, BarChart3, Link2, Send, Upload, ImageIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { isFeatureVisible } from "@/lib/features";
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

function FirmCompletenessChecklist({ firmProfile }: { firmProfile?: FirmProfile | null }) {
  if (!firmProfile) {
    return (
      <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md space-y-2" data-testid="panel-profile-missing">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 flex-shrink-0" />
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Firm profile not yet set up</p>
        </div>
        <p className="text-xs text-amber-800 dark:text-amber-200">Complete all fields below to enable firm letterhead on client-facing documents (attendance notes, matter records, client care letters) and SRA compliance on audit exports.</p>
      </div>
    );
  }

  const fields = [
    { key: 'firmName', label: 'Firm Name', reason: 'Required for all document letterheads', value: firmProfile.firmName },
    { key: 'addressLine1', label: 'Address', reason: 'Required for full letterhead on client-facing documents', value: firmProfile.addressLine1 },
    { key: 'phone', label: 'Phone Number', reason: 'Appears in document contact line', value: firmProfile.phone },
    { key: 'email', label: 'Firm Email', reason: 'Appears in document contact line', value: firmProfile.email },
    { key: 'sraNumber', label: 'SRA Number', reason: 'Required for compliant document footers and audit exports', value: firmProfile.sraNumber },
    { key: 'logoUrl', label: 'Firm Logo', reason: 'Displayed at the top of all client-facing document letterheads', value: firmProfile.logoUrl },
  ];

  const missing = fields.filter(f => !f.value);
  const complete = fields.filter(f => !!f.value);

  if (missing.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md text-sm text-green-800 dark:text-green-200" data-testid="panel-profile-complete">
        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
        <span>Firm profile is complete. All document exports will include full letterhead branding.</span>
      </div>
    );
  }

  return (
    <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md space-y-3" data-testid="panel-profile-incomplete">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 flex-shrink-0" />
        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
          {missing.length} field{missing.length !== 1 ? 's' : ''} incomplete — documents will still export but missing fields will be omitted from letterheads
        </p>
      </div>
      <ul className="space-y-1.5">
        {missing.map(f => (
          <li key={f.key} className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200" data-testid={`item-missing-${f.key}`}>
            <XCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
            <span><span className="font-medium">{f.label}</span> — {f.reason}</span>
          </li>
        ))}
        {complete.map(f => (
          <li key={f.key} className="flex items-start gap-2 text-xs text-green-700 dark:text-green-400" data-testid={`item-complete-${f.key}`}>
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="font-medium">{f.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FirmProfileForm() {
  const { toast } = useToast();
  const { user } = useAuth();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

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
      if (firmProfile.logoUrl) {
        setLogoPreview(firmProfile.logoUrl);
      }
    }
  }, [firmProfile, form]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!allowed.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Only PNG, JPG, and SVG files are allowed", variant: "destructive", duration: 5000 });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be 2MB or smaller", variant: "destructive", duration: 5000 });
      return;
    }

    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const response = await fetch('/api/firm-profile/logo', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Upload failed');
      }
      const { logoUrl } = await response.json();
      form.setValue('logoUrl', logoUrl);
      setLogoPreview(logoUrl);
      // Immediately persist logoUrl using the dedicated logo-url endpoint.
      // This works even when other firm profile fields are not yet filled in.
      const persistResponse = await fetch('/api/firm-profile/logo-url', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ logoUrl }),
      });
      if (!persistResponse.ok) {
        const persistErr = await persistResponse.json().catch(() => ({}));
        throw new Error(persistErr.message || 'Logo uploaded but could not be saved to firm profile');
      }
      queryClient.invalidateQueries({ queryKey: ['/api/firm-profile'] });
      toast({ title: "Logo uploaded", description: "Your firm logo has been saved and will appear on all client-facing documents.", duration: 4000 });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message || "Failed to upload logo. Please try again.", variant: "destructive", duration: 5000 });
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

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
          Manage your law firm information and logo. Firm name and logo appear on attendance notes and client care letters after processing (preview and PDF/Word export).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <FirmCompletenessChecklist firmProfile={firmProfile} />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Firm Logo</Label>
              <div className="flex items-start gap-4">
                <div className="w-24 h-24 rounded-md border border-border flex items-center justify-center bg-muted/30 flex-shrink-0 overflow-hidden" data-testid="container-logo-preview">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Firm logo" className="w-full h-full object-contain p-1" data-testid="img-logo-preview" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-2 flex-1">
                  <p className="text-sm text-muted-foreground">
                    Upload your firm logo. It will appear on all client-facing document letterheads. PNG, JPG, or SVG, max 2MB.
                  </p>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                    data-testid="input-logo-file"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                    data-testid="button-upload-logo"
                  >
                    {logoUploading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>
                    ) : (
                      <><Upload className="w-4 h-4 mr-2" />{logoPreview ? 'Change Logo' : 'Upload Logo'}</>
                    )}
                  </Button>
                  {logoPreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        setLogoPreview(null);
                        form.setValue('logoUrl', '');
                        try {
                          await fetch('/api/firm-profile/logo-url', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ logoUrl: '' }),
                          });
                          queryClient.invalidateQueries({ queryKey: ['/api/firm-profile'] });
                        } catch {
                          // Non-blocking — logo removal will apply on next profile save
                        }
                      }}
                      data-testid="button-remove-logo"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />Remove Logo
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <Separator />

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
  const [isConnectingOutlook, setIsConnectingOutlook] = useState(false);
  
  const { data: connections, isLoading } = useQuery<{
    google: { connected: boolean; email?: string; connectedAt?: string };
    outlook?: { connected: boolean; email?: string; connectedAt?: string };
  }>({
    queryKey: ['/api/oauth/connections'],
  });

  const { data: oauthConfig } = useQuery<{
    baseUrl: string;
    redirectUris: { google: string };
    instructions: {
      google: { step1: string; step2: string; step3: string; step4: string; step5?: string };
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

  const handleConnectOutlook = async () => {
    setIsConnectingOutlook(true);
    try {
      const response = await fetch('/api/calendar/auth/outlook', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error('Failed to get authorization URL');
      }
      const { authUrl } = await response.json();
      window.location.href = authUrl;
    } catch (error) {
      setIsConnectingOutlook(false);
      toast({
        title: "Connection Error",
        description: error instanceof Error ? error.message : "Failed to initiate calendar connection",
        variant: "destructive",
      });
    }
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
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleConnectOutlook}
                  disabled={isConnectingOutlook}
                  data-testid="button-connect-outlook"
                >
                  {isConnectingOutlook ? "Connecting..." : "Connect"}
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
                        {oauthConfig.instructions.google.step5 && (
                          <li>{oauthConfig.instructions.google.step5}</li>
                        )}
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
            <li>After the call ends, open the case in LegalNote</li>
            <li>Click "Import Recording" to select from your recent meetings</li>
            <li>Confirm client consent was obtained before or during the call</li>
            <li>LegalNote downloads the recording and generates your attendance note automatically</li>
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
            <li>Import matters from Clio to create new cases in LegalNote</li>
            <li>Link existing cases to Clio matters for easy reference</li>
            <li>Matter reference numbers and client names are automatically synced</li>
          </ul>
        </div>

        <div className="p-3 bg-muted rounded-md">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> LegalNote uses Clio's EU endpoint for GDPR compliance. 
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
              <p className="text-sm text-muted-foreground">Coming soon</p>
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
            <Button variant="default" size="sm" disabled>
              Coming soon
            </Button>
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
            <li>Coming soon — OneDrive and SharePoint integration will be available in a future update</li>
            <li>Documents from all solicitors sync to: LegalNote / Cases / [Client - Case Title]</li>
            <li>Each case gets organized folders for attendance notes, summaries, and transcripts</li>
            <li>Perfect for boutique firms wanting a shared document library</li>
          </ul>
        </div>

        <div className="p-3 bg-muted rounded-md">
          <p className="text-xs text-muted-foreground">
            <strong>Setup:</strong> Coming soon — OneDrive and SharePoint integration will be available in a future update.
            For solo practitioners, this will provide automatic backup of all your generated documents.
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

interface ComplianceScore {
  overall: number;
  grade: string;
  breakdown: Record<string, { score: number; max: number; label: string; detail: string }>;
  lastUpdated: string;
}

interface RiskDigest {
  generatedAt: string;
  totalIssues: number;
  overdueUndertakings: Array<{ id: string; wording: string; caseTitle: string; deadline: string; daysOverdue: number }>;
  upcomingUndertakings: Array<{ id: string; wording: string; caseTitle: string; deadline: string; daysUntil: number }>;
  highAmlCases: Array<{ id: string; title: string; riskLevel: string; clientName: string | null }>;
  unacknowledgedLetters: Array<{ caseId: string; caseTitle: string; clientName: string | null; sentAt: string }>;
  missingSessions: Array<{ caseId: string; caseTitle: string; completedSessions: number; documentedSessions: number }>;
}

function GrowthSettings() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const complianceScoreVisible = isFeatureVisible("complianceScore");
  const publicComplianceBadgeVisible = isFeatureVisible("publicComplianceBadge");

  const { data: firmProfile } = useQuery<FirmProfile>({ queryKey: ['/api/firm-profile'] });
  const { data: score, isLoading: scoreLoading } = useQuery<ComplianceScore>({
    queryKey: ['/api/firm/compliance-score'],
    enabled: complianceScoreVisible,
  });
  const { data: digest, isLoading: digestLoading, refetch: refetchDigest } = useQuery<RiskDigest>({ queryKey: ['/api/firm/risk-digest'] });

  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestEmail, setDigestEmail] = useState('');
  const [digestFrequency, setDigestFrequency] = useState('weekly');
  const [badgeEnabled, setBadgeEnabled] = useState(false);
  const [badgeSlug, setBadgeSlug] = useState('');

  useEffect(() => {
    if (firmProfile) {
      setDigestEnabled(firmProfile.digestEnabled ?? false);
      setDigestEmail(firmProfile.digestEmail ?? '');
      setDigestFrequency(firmProfile.digestFrequency ?? 'weekly');
      setBadgeEnabled(firmProfile.complianceBadgeEnabled ?? false);
      setBadgeSlug(firmProfile.complianceBadgeSlug ?? '');
    }
  }, [firmProfile]);

  const saveMutation = useMutation({
    mutationFn: async (updates: Partial<FirmProfile>) => {
      return apiRequest('PUT', '/api/firm-profile', { ...firmProfile, ...updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/firm-profile'] });
      toast({ title: 'Settings saved' });
    },
    onError: () => toast({ title: 'Failed to save settings', variant: 'destructive' }),
  });

  const gradeColor = (g: string) => g === 'A' ? 'text-green-600' : g === 'B' ? 'text-blue-600' : g === 'C' ? 'text-amber-600' : g === 'D' ? 'text-orange-600' : 'text-red-600';

  const badgeEmbedCode = badgeSlug ? `<a href="https://legalnote.app/badge/${badgeSlug}" target="_blank" rel="noopener">
  <img src="https://legalnote.app/api/public/badge/${badgeSlug}/image" alt="LegalNote Compliance Badge" />
</a>` : '';

  const copyEmbed = () => {
    navigator.clipboard.writeText(badgeEmbedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveDigest = () => {
    saveMutation.mutate({ digestEnabled, digestEmail: digestEmail || undefined, digestFrequency } as any);
  };

  const handleSaveBadge = () => {
    saveMutation.mutate({ complianceBadgeEnabled: badgeEnabled, complianceBadgeSlug: badgeSlug || undefined } as any);
  };

  return (
    <div className="space-y-6">
      {complianceScoreVisible && (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            <CardTitle>Compliance Score</CardTitle>
          </div>
          <CardDescription>
            A composite score across consent, AML, undertakings, client care, and documentation completeness.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scoreLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Calculating score...</div>
          ) : score ? (
            <div className="space-y-5">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className={`text-5xl font-bold ${gradeColor(score.grade)}`}>{score.grade}</div>
                  <div className="text-sm text-muted-foreground mt-1">Grade</div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{score.overall} / 100</span>
                    <span className="text-xs text-muted-foreground">Updated {new Date(score.lastUpdated).toLocaleDateString('en-GB')}</span>
                  </div>
                  <Progress value={score.overall} className="h-3" />
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                {Object.values(score.breakdown).map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{item.label}</span>
                      <span className="font-medium">{item.score}/{item.max}</span>
                    </div>
                    <Progress value={(item.score / item.max) * 100} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Score unavailable.</p>
          )}
        </CardContent>
      </Card>
      )}

      {/* Risk Digest */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            <CardTitle>Managing Partner Risk Digest</CardTitle>
          </div>
          <CardDescription>
            Weekly email summary of compliance issues for senior review. Sent every Monday at 7:00 AM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Enable weekly digest</Label>
              <p className="text-sm text-muted-foreground">Receive a Monday morning risk summary by email.</p>
            </div>
            <Switch
              checked={digestEnabled}
              onCheckedChange={setDigestEnabled}
              data-testid="switch-digest-enabled"
            />
          </div>

          {digestEnabled && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="digest-email">Recipient email</Label>
                <Input
                  id="digest-email"
                  type="email"
                  placeholder="managing.partner@yourfirm.co.uk"
                  value={digestEmail}
                  onChange={(e) => setDigestEmail(e.target.value)}
                  data-testid="input-digest-email"
                />
                <p className="text-xs text-muted-foreground">Leave blank to use the firm's registered email address.</p>
              </div>
            </>
          )}

          <Button onClick={handleSaveDigest} disabled={saveMutation.isPending} data-testid="button-save-digest">
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save
          </Button>

          {digest && !digestLoading && (
            <>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium">Current digest preview</p>
                  <Button variant="ghost" size="sm" onClick={() => refetchDigest()} data-testid="button-refresh-digest">
                    <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: 'Overdue undertakings', count: digest.overdueUndertakings.length, color: 'text-red-600' },
                    { label: 'Due this week', count: digest.upcomingUndertakings.length, color: 'text-amber-600' },
                    { label: 'AML reviews needed', count: digest.highAmlCases.length, color: 'text-purple-600' },
                    { label: 'Unacknowledged letters', count: digest.unacknowledgedLetters.length, color: 'text-blue-600' },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="p-3 bg-muted rounded-md text-center">
                      <div className={`text-2xl font-bold ${color}`}>{count}</div>
                      <div className="text-xs text-muted-foreground mt-1">{label}</div>
                    </div>
                  ))}
                </div>
                {digest.totalIssues === 0 && (
                  <p className="text-sm text-green-600 font-medium mt-3">No outstanding issues — all clear this week.</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {publicComplianceBadgeVisible && (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            <CardTitle>Public Compliance Badge</CardTitle>
          </div>
          <CardDescription>
            Display a compliance badge on your firm's website to demonstrate your commitment to regulatory standards.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Enable public badge</Label>
              <p className="text-sm text-muted-foreground">Make your compliance score publicly accessible via a unique URL.</p>
            </div>
            <Switch
              checked={badgeEnabled}
              onCheckedChange={setBadgeEnabled}
              data-testid="switch-badge-enabled"
            />
          </div>

          {badgeEnabled && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="badge-slug">Badge URL slug</Label>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 bg-muted rounded-md text-sm text-muted-foreground border border-input whitespace-nowrap">
                    /badge/
                  </div>
                  <Input
                    id="badge-slug"
                    placeholder="smiths-solicitors"
                    value={badgeSlug}
                    onChange={(e) => setBadgeSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    data-testid="input-badge-slug"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Use lowercase letters, numbers, and hyphens only.</p>
              </div>

              {badgeSlug && (
                <div className="space-y-2">
                  <Label>Public badge URL</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={`${window.location.origin}/badge/${badgeSlug}`} className="font-mono text-sm" data-testid="input-badge-url" />
                    <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/badge/${badgeSlug}`); toast({ title: 'URL copied' }); }} data-testid="button-copy-badge-url">
                      <Link2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {badgeSlug && badgeEmbedCode && (
                <div className="space-y-2">
                  <Label>Embed code for your website</Label>
                  <div className="relative">
                    <Textarea readOnly value={badgeEmbedCode} className="font-mono text-xs min-h-[80px]" data-testid="textarea-embed-code" />
                    <Button variant="outline" size="sm" className="absolute top-2 right-2" onClick={copyEmbed} data-testid="button-copy-embed">
                      {copied ? <><Check className="w-3 h-3 mr-1" /> Copied</> : <><Copy className="w-3 h-3 mr-1" /> Copy</>}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          <Button onClick={handleSaveBadge} disabled={saveMutation.isPending} data-testid="button-save-badge">
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save
          </Button>
        </CardContent>
      </Card>
      )}
    </div>
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
        description: `Created ${data.casesCreated || 4} sample cases with transcripts, documents, and obligations.`,
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
            Demo data creates 5 realistic UK legal case scenarios: Property Purchase, Employment Dispute, Commercial Contract, and Family Law. Each includes full transcripts, attendance notes, matter records, obligations, and audit trail entries.
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
  const { user, isAdmin } = useAuth();
  
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
      // All users can access Firm + Integrations; other tabs remain platform-admin only
      const allowedForAll = tab === 'firm' || tab === 'integrations';
      if (!isAdmin && !allowedForAll) {
        setActiveTab('firm');
      } else {
        setActiveTab(tab);
      }
    }
  }, [isAdmin]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-foreground">Firm Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin
              ? "Manage firm letterhead, logo, team, integrations, and security settings"
              : "Manage firm letterhead, logo, and calendar integrations"}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="firm" data-testid="tab-firm">Firm</TabsTrigger>
            <TabsTrigger value="integrations" data-testid="tab-integrations">Integrations</TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="notifications" data-testid="tab-notifications">Notifications</TabsTrigger>
                <TabsTrigger value="usage" data-testid="tab-usage">Usage</TabsTrigger>
                <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
                <TabsTrigger value="growth" data-testid="tab-growth">Growth</TabsTrigger>
                <TabsTrigger value="demo" data-testid="tab-demo">Demo</TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="firm" className="space-y-6">
            <FirmProfileForm />
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <CalendarConnections />
            <VideoConferencing />
            <StorageIntegrations />
            <ClioIntegration />
          </TabsContent>

          {isAdmin && (
            <>
          <TabsContent value="notifications" className="space-y-6">
            <NotificationSettings />
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            <UsageMetrics />
          </TabsContent>

          <TabsContent value="growth" className="space-y-6">
            <GrowthSettings />
          </TabsContent>

          <TabsContent value="demo" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Link2 className="w-5 h-5" />
                  <CardTitle>Demo Link Generator</CardTitle>
                </div>
                <CardDescription>
                  Create personalised demo links to send to prospects — each link shows a live dashboard tailored to their practice area and firm name.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/demo-generator">
                  <Button data-testid="button-open-demo-generator">
                    <Link2 className="w-4 h-4 mr-2" />
                    Open Demo Link Generator
                  </Button>
                </Link>
              </CardContent>
            </Card>
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
                  {isFeatureVisible("amlCompliance") && (
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
                  )}

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
                          Your account is secured via OAuth authentication. Sign in with your identity provider; password management is handled there.
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
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}
