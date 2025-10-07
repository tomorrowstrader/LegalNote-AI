import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Activity } from "lucide-react";
import { useLocation } from "wouter";

export default function MyProfile() {
  const [, setLocation] = useLocation();

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
                <Input id="display-name" defaultValue="John Smith" data-testid="input-display-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" defaultValue="j.smith@lawfirm.co.uk" disabled data-testid="input-email" />
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
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  <CardTitle>Monthly Usage</CardTitle>
                </div>
                <CardDescription>Track your transcription usage this month</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Full Meeting Transcriptions</Label>
                    <span className="text-sm font-medium">28 / 50 recordings</span>
                  </div>
                  <Progress value={56} className="h-2" data-testid="progress-meetings" />
                  <p className="text-xs text-muted-foreground">
                    You've used 56% of your monthly meeting transcription allocation
                  </p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Quick Voice Notes</Label>
                    <span className="text-sm font-medium">143 / 200 notes</span>
                  </div>
                  <Progress value={71.5} className="h-2" data-testid="progress-notes" />
                  <p className="text-xs text-muted-foreground">
                    You've used 71.5% of your monthly quick notes allocation
                  </p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Total Audio Minutes</Label>
                    <span className="text-sm font-medium">1,247 / 2,500 minutes</span>
                  </div>
                  <Progress value={49.88} className="h-2" data-testid="progress-minutes" />
                  <p className="text-xs text-muted-foreground">
                    ✅ Well within limits - 1,253 minutes remaining this month
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Your usage resets on the 1st of each month. Limits: 50 full meetings, 200 quick notes, 2,500 total audio minutes.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
