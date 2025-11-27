import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Scale, FileText, ShieldCheck, Clock } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex flex-col">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background px-4 pt-6 pb-4 sm:py-12 lg:py-16">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-2 sm:mb-3 lg:mb-4" data-testid="text-app-title">
            LegalNote AI
          </h1>
          <p className="text-sm sm:text-lg lg:text-xl text-muted-foreground" data-testid="text-app-description">
            Professional legal documentation platform for solicitors
          </p>
          <Button 
            onClick={handleLogin} 
            size="lg" 
            className="bg-accent hover:bg-accent hidden sm:inline-flex mt-6 lg:mt-8"
            data-testid="button-login-desktop"
          >
            Sign in to Continue
          </Button>
        </div>
      </div>

      {/* Scrollable Cards Section with top padding to account for fixed header */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 sm:pb-12 pt-40 sm:pt-56 lg:pt-72">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-4 lg:gap-6 max-w-6xl mx-auto">
          <Card>
            <CardHeader className="p-3 sm:p-4 lg:p-6">
              <Scale className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-accent mb-1 sm:mb-2" />
              <CardTitle className="text-sm sm:text-base lg:text-lg">Legal Compliance</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0 lg:p-6 lg:pt-0">
              <CardDescription className="text-xs sm:text-sm">
                GDPR-compliant client consent tracking with full audit trail
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 sm:p-4 lg:p-6">
              <FileText className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-accent mb-1 sm:mb-2" />
              <CardTitle className="text-sm sm:text-base lg:text-lg">AI Documentation</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0 lg:p-6 lg:pt-0">
              <CardDescription className="text-xs sm:text-sm">
                Automatically generate professional attendance notes from recordings
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 sm:p-4 lg:p-6">
              <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-accent mb-1 sm:mb-2" />
              <CardTitle className="text-sm sm:text-base lg:text-lg">Secure Storage</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0 lg:p-6 lg:pt-0">
              <CardDescription className="text-xs sm:text-sm">
                Enterprise-grade security with private object storage and access control
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 sm:p-4 lg:p-6">
              <Clock className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-accent mb-1 sm:mb-2" />
              <CardTitle className="text-sm sm:text-base lg:text-lg">24hr Audio Deletion</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0 lg:p-6 lg:pt-0">
              <CardDescription className="text-xs sm:text-sm">
                Automatic audio expiration with permanent transcript retention
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile bottom button - in thumb zone for easy access */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background to-background/95 border-t sm:hidden flex-shrink-0 z-50">
        <Button 
          onClick={handleLogin} 
          size="lg" 
          className="w-full bg-accent hover:bg-accent"
          data-testid="button-login"
        >
          Sign in to Continue
        </Button>
      </div>
    </div>
  );
}
