import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, Building2, Bell, Activity, Download, Loader2, Calendar, CheckCircle2, XCircle } from "lucide-react";
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

function CalendarConnections() {
  const { toast } = useToast();
  
  const { data: connections, isLoading } = useQuery<{
    google: { connected: boolean; email?: string; connectedAt?: string };
    outlook: { connected: boolean; email?: string; connectedAt?: string };
  }>({
    queryKey: ['/api/oauth/connections'],
  });

  const disconnectMutation = useMutation({
    mutationFn: async (provider: 'google' | 'outlook') => {
      const res = await fetch(`/api/oauth/disconnect/${provider}`, {
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
  
  const { data: teamMembers, isLoading: loadingTeam } = useQuery<UserStatistics[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAdmin,
  });

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
            <TabsTrigger value="team" data-testid="tab-team">Team</TabsTrigger>
            <TabsTrigger value="usage" data-testid="tab-usage">Team Usage</TabsTrigger>
            <TabsTrigger value="integrations" data-testid="tab-integrations">Integrations</TabsTrigger>
            <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="firm" className="space-y-6">
            <FirmProfileForm />
          </TabsContent>

          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    <CardTitle>Team Members</CardTitle>
                  </div>
                  <Button className="bg-accent hover:bg-accent" data-testid="button-invite-member">Invite Member</Button>
                </div>
                <CardDescription>Manage your firm's team members and permissions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {loadingTeam ? (
                    <div className="text-center py-4 text-muted-foreground">Loading team members...</div>
                  ) : teamMembers && teamMembers.length > 0 ? (
                    teamMembers.map((member, index) => {
                      const displayName = member.firstName && member.lastName 
                        ? `${member.firstName} ${member.lastName}` 
                        : member.email?.split('@')[0] || 'User';
                      const isCurrentAdmin = member.id === user?.id;
                      
                      return (
                        <div key={member.id} className="flex items-center justify-between p-4 border rounded-md" data-testid={`team-member-${index}`}>
                          <div>
                            <p className="font-medium">{displayName}</p>
                            <p className="text-sm text-muted-foreground">{member.email || 'No email'}</p>
                          </div>
                          <Badge variant={isCurrentAdmin ? "default" : "secondary"}>
                            {isCurrentAdmin ? "Admin" : "Solicitor"}
                          </Badge>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">No team members found</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    <CardTitle>Team Usage Report</CardTitle>
                  </div>
                  <Button variant="outline" className="gap-2" data-testid="button-export-usage">
                    <Download className="w-4 h-4" />
                    Export Report
                  </Button>
                </div>
                <CardDescription>Monitor API usage and costs across your team</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {loadingTeam ? (
                    <div className="text-center py-4 text-muted-foreground">Loading usage data...</div>
                  ) : teamMembers && teamMembers.length > 0 ? (
                    teamMembers.map((member) => {
                      const displayName = member.firstName && member.lastName 
                        ? `${member.firstName} ${member.lastName}` 
                        : member.email?.split('@')[0] || 'User';
                      const successRate = member.totalCases > 0 
                        ? Math.round((member.successfulCases / member.totalCases) * 100) 
                        : 0;
                      const totalCosts = member.totalCosts || 0;
                      
                      return (
                        <div key={member.id} className="space-y-3 p-4 border rounded-md" data-testid={`usage-member-${member.id}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{displayName}</p>
                              <p className="text-sm text-muted-foreground">{member.email}</p>
                            </div>
                            {totalCosts > 1.0 && (
                              <Badge className="bg-amber-500">High Usage</Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Total Cases</p>
                              <p className="font-medium">{member.totalCases}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Success Rate</p>
                              <p className="font-medium">{successRate}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">API Costs</p>
                              <p className="font-medium">£{totalCosts.toFixed(2)}</p>
                            </div>
                          </div>
                          <Progress 
                            value={successRate} 
                            className="h-2"
                          />
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">No usage data available</div>
                  )}
                </div>

                <div className="mt-6 p-4 border-t">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Cases</p>
                      <p className="text-2xl font-semibold">
                        {teamMembers?.reduce((sum, m) => sum + m.totalCases, 0) || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Costs</p>
                      <p className="text-2xl font-semibold">
                        £{(teamMembers?.reduce((sum, m) => sum + m.totalCosts, 0) || 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Active Users</p>
                      <p className="text-2xl font-semibold">{teamMembers?.length || 0}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
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
                <CardDescription>Manage security settings and GDPR compliance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-md">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-accent mt-0.5" />
                      <div>
                        <p className="font-medium">GDPR Compliance Active</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          All audio files are automatically deleted after 24 hours. Consent logs are maintained for all recordings.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label>Change Password</Label>
                  <div className="space-y-2">
                    <Input type="password" placeholder="Current password" data-testid="input-current-password" />
                    <Input type="password" placeholder="New password" data-testid="input-new-password" />
                    <Input type="password" placeholder="Confirm new password" data-testid="input-confirm-password" />
                  </div>
                  <Button className="bg-accent hover:bg-accent" data-testid="button-update-password">Update Password</Button>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                  </div>
                  <Switch data-testid="switch-2fa" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
