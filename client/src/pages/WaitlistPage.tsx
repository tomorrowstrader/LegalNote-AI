import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles, Clock, CheckCircle, Mail, ArrowRight } from "lucide-react";

export default function WaitlistPage() {
  const [, setLocation] = useLocation();
  
  const { data: user, isLoading } = useQuery<{
    id: string;
    username: string;
    email: string;
    role: string;
  }>({
    queryKey: ["/api/auth/user"],
  });

  useEffect(() => {
    if (!isLoading && user?.role === "admin") {
      setLocation("/admin");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[hsl(30,25%,97%)] flex items-center justify-center">
        <div className="animate-pulse text-[hsl(25,20%,40%)]">Loading...</div>
      </div>
    );
  }

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[hsl(30,25%,97%)] to-[hsl(30,30%,94%)]">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[hsl(18,70%,42%)]/10 mb-6">
            <Sparkles className="w-10 h-10 text-[hsl(18,70%,42%)]" />
          </div>
          <h1 
            className="text-4xl font-normal text-[hsl(25,25%,20%)] mb-4"
            style={{ fontFamily: "'Lora', Georgia, serif" }}
          >
            You're on the Waitlist
          </h1>
          <p className="text-lg text-[hsl(25,20%,40%)] max-w-2xl mx-auto">
            Thank you for your interest in LegalNote AI. We're currently in private beta 
            and will notify you as soon as access becomes available.
          </p>
        </div>

        <Card className="mb-8 border-[hsl(30,20%,85%)] bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[hsl(25,25%,25%)]">
              <Clock className="w-5 h-5 text-[hsl(18,70%,42%)]" />
              What Happens Next
            </CardTitle>
            <CardDescription className="text-[hsl(25,20%,45%)]">
              Here's what to expect while you wait
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[hsl(18,70%,42%)]/10 flex items-center justify-center">
                <span className="text-sm font-medium text-[hsl(18,70%,42%)]">1</span>
              </div>
              <div>
                <h3 className="font-medium text-[hsl(25,25%,25%)]">Confirmation Email</h3>
                <p className="text-sm text-[hsl(25,20%,45%)]">
                  You'll receive an email confirming your place on the waitlist with early access benefits.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[hsl(18,70%,42%)]/10 flex items-center justify-center">
                <span className="text-sm font-medium text-[hsl(18,70%,42%)]">2</span>
              </div>
              <div>
                <h3 className="font-medium text-[hsl(25,25%,25%)]">Priority Access</h3>
                <p className="text-sm text-[hsl(25,20%,45%)]">
                  Early access members receive priority onboarding and preferential pricing.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[hsl(18,70%,42%)]/10 flex items-center justify-center">
                <span className="text-sm font-medium text-[hsl(18,70%,42%)]">3</span>
              </div>
              <div>
                <h3 className="font-medium text-[hsl(25,25%,25%)]">Launch Notification</h3>
                <p className="text-sm text-[hsl(25,20%,45%)]">
                  We'll email you the moment your account is activated with full platform access.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8 border-[hsl(30,20%,85%)] bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[hsl(25,25%,25%)]">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Early Access Benefits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {[
                "20% discount on first year subscription",
                "Free implementation consultation (£1,000 value)",
                "Priority support during onboarding",
                "Direct input on feature development",
                "Exclusive 'Founding Member' designation"
              ].map((benefit, index) => (
                <li key={index} className="flex items-center gap-3">
                  <ArrowRight className="w-4 h-4 text-[hsl(18,70%,42%)]" />
                  <span className="text-[hsl(25,20%,35%)]">{benefit}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="text-center space-y-4">
          <p className="text-sm text-[hsl(25,20%,45%)]">
            Questions? Reach out to us at{" "}
            <a 
              href="mailto:support@legalnote.ai" 
              className="text-[hsl(18,70%,42%)] hover:underline"
              data-testid="link-contact-email"
            >
              support@legalnote.ai
            </a>
          </p>
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="border-[hsl(30,20%,80%)] text-[hsl(25,20%,35%)]"
            data-testid="button-logout"
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
