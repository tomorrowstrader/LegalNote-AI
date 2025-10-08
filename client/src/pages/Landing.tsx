import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Scale, FileText, ShieldCheck, Clock } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-foreground mb-4" data-testid="text-app-title">
            LegalNote AI
          </h1>
          <p className="text-xl text-muted-foreground mb-8" data-testid="text-app-description">
            Professional legal documentation platform for solicitors
          </p>
          <Button 
            onClick={handleLogin} 
            size="lg" 
            className="bg-accent hover:bg-accent"
            data-testid="button-login"
          >
            Sign in to Continue
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <Card>
            <CardHeader>
              <Scale className="w-10 h-10 text-accent mb-2" />
              <CardTitle>Legal Compliance</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                GDPR-compliant client consent tracking with full audit trail
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <FileText className="w-10 h-10 text-accent mb-2" />
              <CardTitle>AI Documentation</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Automatically generate attendance notes and legal opinions from recordings
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <ShieldCheck className="w-10 h-10 text-accent mb-2" />
              <CardTitle>Secure Storage</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Enterprise-grade security with private object storage and access control
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Clock className="w-10 h-10 text-accent mb-2" />
              <CardTitle>24hr Audio Deletion</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Automatic audio expiration with permanent transcript retention
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
