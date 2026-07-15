import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, LogOut } from "lucide-react";

export default function AccessPending() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-10 pb-10 text-center space-y-5">
          <div className="flex items-center justify-center">
            <div className="rounded-full bg-muted p-4">
              <Shield className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold" data-testid="heading-access-pending">
              Access pending
            </h1>
            <p className="text-muted-foreground text-sm">
              Your account signed in successfully. LegalNote is currently in limited early access —
              your administrator will enable full access shortly.
            </p>
            {user?.email && (
              <p className="text-xs text-muted-foreground">
                Signed in as <span className="font-medium">{user.email}</span>
              </p>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => { window.location.href = "/api/logout"; }}
            data-testid="button-sign-out-access-pending"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
