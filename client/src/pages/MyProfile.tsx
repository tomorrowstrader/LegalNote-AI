import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Activity, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Case } from "@shared/schema";

export default function MyProfile() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [hourlyRate, setHourlyRate] = useState('');

  useEffect(() => {
    if (user?.hourlyRate) {
      setHourlyRate(user.hourlyRate);
    }
  }, [user?.hourlyRate]);
  
  const displayName = user?.firstName && user?.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user?.email?.split('@')[0] || '';

  const { data: cases, isLoading: loadingCases } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
  });

  const hourlyRateMutation = useMutation({
    mutationFn: async (rate: string) => {
      return await apiRequest("PATCH", "/api/user/hourly-rate", { hourlyRate: rate });
    },
    onSuccess: () => {
      toast({ title: "Hourly rate updated", description: "Your default hourly rate has been saved." });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: () => {
      toast({ title: "Failed to update", description: "Could not save your hourly rate.", variant: "destructive" });
    },
  });

  // Calculate user statistics
  const totalCases = cases?.length || 0;
  const successfulCases = cases?.filter(c => c.status === 'completed').length || 0;
  const failedCases = cases?.filter(c => c.status === 'failed').length || 0;
  const processingCases = cases?.filter(c => c.status === 'processing').length || 0;
  const successRate = totalCases > 0 ? Math.round((successfulCases / totalCases) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-8">
        <Button
          variant="ghost"
          onClick={() => setLocation('/')}
          className="mb-6 gap-2"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-foreground">My Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your personal settings and preferences
          </p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile" data-testid="tab-profile-info">Profile</TabsTrigger>
            <TabsTrigger value="usage" data-testid="tab-usage">Usage</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your display name and contact details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name</Label>
                <Input id="display-name" defaultValue={displayName} data-testid="input-display-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" defaultValue={user?.email || ''} disabled data-testid="input-email" />
                <p className="text-xs text-muted-foreground">Contact your administrator to change your email</p>
              </div>
              <Button className="bg-accent hover:bg-accent" data-testid="button-save-profile">Save Changes</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input id="current-password" type="password" data-testid="input-current-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input id="new-password" type="password" data-testid="input-new-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input id="confirm-password" type="password" data-testid="input-confirm-password" />
              </div>
              <Button className="bg-accent hover:bg-accent" data-testid="button-update-password">Update Password</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Configure how you receive updates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive email updates on case processing</p>
                </div>
                <Switch defaultChecked data-testid="switch-email-notifications" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Processing Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified when documents are ready</p>
                </div>
                <Switch defaultChecked data-testid="switch-processing-alerts" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Billing & Time Recording</CardTitle>
              <CardDescription>Set your default hourly rate for time entries</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="hourly-rate">Default Hourly Rate (GBP)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="hourly-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="250.00"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    className="max-w-[200px]"
                    data-testid="input-hourly-rate"
                  />
                  <Button
                    onClick={() => hourlyRateMutation.mutate(hourlyRate)}
                    disabled={hourlyRateMutation.isPending || !hourlyRate}
                    className="bg-accent hover:bg-accent"
                    data-testid="button-save-hourly-rate"
                  >
                    {hourlyRateMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Save Rate"
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  This rate will be pre-filled when recording billable time after sessions
                </p>
              </div>
            </CardContent>
          </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  <CardTitle>My Usage Statistics</CardTitle>
                </div>
                <CardDescription>Track your case activity and success rate</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loadingCases ? (
                  <div className="text-center py-4 text-muted-foreground">Loading usage data...</div>
                ) : (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Total Cases Created</Label>
                        <span className="text-sm font-medium">{totalCases} cases</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mt-2">
                        <div className="text-center p-3 border rounded-md">
                          <p className="text-2xl font-semibold text-green-500">{successfulCases}</p>
                          <p className="text-xs text-muted-foreground">Successful</p>
                        </div>
                        <div className="text-center p-3 border rounded-md">
                          <p className="text-2xl font-semibold text-amber-500">{processingCases}</p>
                          <p className="text-xs text-muted-foreground">Processing</p>
                        </div>
                        <div className="text-center p-3 border rounded-md">
                          <p className="text-2xl font-semibold text-red-500">{failedCases}</p>
                          <p className="text-xs text-muted-foreground">Failed</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Success Rate</Label>
                        <span className="text-sm font-medium">{successRate}%</span>
                      </div>
                      <Progress value={successRate} className="h-2" data-testid="progress-success-rate" />
                      <p className="text-xs text-muted-foreground">
                        {successRate >= 90 ? '✅ Excellent success rate' : successRate >= 70 ? '✓ Good success rate' : 'Some cases need attention'}
                      </p>
                    </div>

                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        All API costs are covered by your firm administrator. Focus on creating quality case notes.
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
