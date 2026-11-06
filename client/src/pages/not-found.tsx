import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { queryClient } from "@/lib/queryClient";

export default function NotFound() {
  // Read the cached session rather than subscribing with useAuth: a second
  // observer re-runs the auth check, and the router hides this page while
  // that check is loading.
  const isAuthenticated = !!queryClient.getQueryData(["/api/auth/user"]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3">
            <Compass className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden="true" />
            <h1 className="text-xl font-semibold text-foreground" data-testid="text-not-found-title">
              We couldn't find that page
            </h1>
          </div>
          <p className="text-sm text-muted-foreground" data-testid="text-not-found-body">
            The link may be mistyped or out of date. Your cases and documents are not affected.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild data-testid="button-not-found-home">
              <a href="/">{isAuthenticated ? "Go to dashboard" : "Go to home page"}</a>
            </Button>
            {!isAuthenticated && (
              <Button asChild variant="outline" data-testid="button-not-found-sign-in">
                <a href="/login">Sign in</a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
