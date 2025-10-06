import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, Building2, Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function Settings() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account, firm, and team settings
          </p>
        </div>

        <Tabs defaultValue="account" className="space-y-6">
          <TabsList>
            <TabsTrigger value="account" data-testid="tab-account">Account</TabsTrigger>
            <TabsTrigger value="firm" data-testid="tab-firm">Firm</TabsTrigger>
            <TabsTrigger value="team" data-testid="tab-team">Team</TabsTrigger>
            <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Update your personal details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First Name</Label>
                    <Input id="first-name" defaultValue="John" data-testid="input-first-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last Name</Label>
                    <Input id="last-name" defaultValue="Smith" data-testid="input-last-name" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue="j.smith@lawfirm.co.uk" data-testid="input-email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Input id="role" defaultValue="Senior Solicitor" disabled data-testid="input-role" />
                </div>
                <Button className="bg-accent hover:bg-accent" data-testid="button-save-account">Save Changes</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Configure your notification preferences</CardDescription>
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
          </TabsContent>

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
                  {[
                    { name: "John Smith", email: "j.smith@lawfirm.co.uk", role: "Admin" },
                    { name: "Sarah Johnson", email: "s.johnson@lawfirm.co.uk", role: "Solicitor" },
                    { name: "Michael Brown", email: "m.brown@lawfirm.co.uk", role: "Solicitor" },
                    { name: "Emma Davis", email: "e.davis@lawfirm.co.uk", role: "Paralegal" },
                  ].map((member, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-md" data-testid={`team-member-${index}`}>
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                      <Badge variant={member.role === "Admin" ? "default" : "secondary"}>
                        {member.role}
                      </Badge>
                    </div>
                  ))}
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
