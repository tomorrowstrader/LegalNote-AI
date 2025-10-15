import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, Building2, Bell, Activity, Download } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

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
            <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="firm" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  <CardTitle>Firm Details</CardTitle>
                </div>
                <CardDescription>Manage your law firm information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="firm-name">Firm Name</Label>
                  <Input id="firm-name" defaultValue="Smith & Partners LLP" data-testid="input-firm-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firm-address">Address</Label>
                  <Input id="firm-address" defaultValue="123 Legal Street, London, EC1A 1BB" data-testid="input-firm-address" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sra-number">SRA Number</Label>
                  <Input id="sra-number" defaultValue="123456" data-testid="input-sra-number" />
                </div>
                <Button className="bg-accent hover:bg-accent" data-testid="button-save-firm">Save Changes</Button>
              </CardContent>
            </Card>
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
                    teamMembers.map((member, index) => {
                      const displayName = member.firstName && member.lastName 
                        ? `${member.firstName} ${member.lastName}` 
                        : member.email?.split('@')[0] || 'User';
                      const successRate = member.totalCases > 0 
                        ? Math.round((member.successfulCases / member.totalCases) * 100) 
                        : 0;
                      
                      return (
                        <div key={member.id} className="space-y-3 p-4 border rounded-md" data-testid={`usage-member-${index}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{displayName}</p>
                              <p className="text-sm text-muted-foreground">{member.email}</p>
                            </div>
                            {member.totalCosts > 1.0 && (
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
                              <p className="font-medium">£{member.totalCosts.toFixed(2)}</p>
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
