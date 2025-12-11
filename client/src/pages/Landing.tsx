import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scale, FileText, ShieldCheck, Clock, Mic, Calendar, Check, Building2, User, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Price {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string } | null;
  metadata: Record<string, string>;
}

interface Product {
  id: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: Price[];
}

export default function Landing() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  const { data: productsData } = useQuery<{ products: Product[] }>({
    queryKey: ['/api/stripe/products'],
  });

  const products = productsData?.products || [];
  const soloProduct = products.find(p => p.metadata?.plan === 'solo');
  const teamProduct = products.find(p => p.metadata?.plan === 'team');

  const getSoloPrice = () => {
    if (!soloProduct) return billingPeriod === 'monthly' ? 99 : 999;
    const price = soloProduct.prices.find(p => 
      p.recurring?.interval === (billingPeriod === 'monthly' ? 'month' : 'year')
    );
    return price ? price.unit_amount / 100 : (billingPeriod === 'monthly' ? 99 : 999);
  };

  const getTeamPrice = () => {
    if (!teamProduct) return 199;
    const price = teamProduct.prices.find(p => p.recurring?.interval === 'month');
    return price ? price.unit_amount / 100 : 199;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        <div className="relative max-w-6xl mx-auto px-4 pt-12 pb-16 sm:pt-20 sm:pb-24">
          <div className="text-center">
            <Badge variant="secondary" className="mb-4">
              GDPR Compliant
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-4 tracking-tight" data-testid="text-app-title">
              LegalNote AI
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8" data-testid="text-app-description">
              Professional legal documentation platform for UK solicitors. Record client meetings, generate attendance notes automatically, and share documents securely.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                onClick={handleLogin} 
                size="lg" 
                className="min-w-[200px]"
                data-testid="button-get-started"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Start Free Trial
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                data-testid="button-view-pricing"
              >
                View Pricing
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              14-day free trial. No credit card required.
            </p>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Everything You Need</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Streamline your practice with AI-powered documentation tools designed specifically for UK solicitors.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover-elevate">
            <CardHeader>
              <Mic className="w-10 h-10 text-primary mb-2" />
              <CardTitle>AI Transcription</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Record client meetings and get accurate transcripts with speaker identification. AssemblyAI-powered for professional accuracy.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <FileText className="w-10 h-10 text-primary mb-2" />
              <CardTitle>Attendance Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                AI-generated attendance notes in professional legal format. Export to Word or PDF with your firm's branding.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <Scale className="w-10 h-10 text-primary mb-2" />
              <CardTitle>GDPR Compliant</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Built-in consent management, audit trails, and automatic data retention. Full compliance documentation included.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <ShieldCheck className="w-10 h-10 text-primary mb-2" />
              <CardTitle>Secure Sharing</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Share documents with clients via secure links. Optional SMS 2FA and password protection for sensitive materials.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <Calendar className="w-10 h-10 text-primary mb-2" />
              <CardTitle>Calendar Sync</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Sync case deadlines to Google Calendar or Outlook. Never miss an important date with automatic reminders.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <Clock className="w-10 h-10 text-primary mb-2" />
              <CardTitle>7-Day Audio Retention</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Audio files automatically deleted after 7 days. Transcripts and documents retained permanently for your records.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pricing Section */}
      <div id="pricing" className="bg-muted/30 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
              Choose the plan that fits your practice. All plans include a 14-day free trial.
            </p>
            
            {/* Billing Toggle */}
            <div className="inline-flex items-center gap-2 p-1 bg-muted rounded-lg">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  billingPeriod === 'monthly' 
                    ? 'bg-background shadow-sm text-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                data-testid="button-monthly-billing"
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('annual')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  billingPeriod === 'annual' 
                    ? 'bg-background shadow-sm text-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                data-testid="button-annual-billing"
              >
                Annual
                <Badge variant="secondary" className="ml-2">Save 16%</Badge>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Solo Plan */}
            <Card className="relative">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-5 h-5 text-primary" />
                  <CardTitle>Solo</CardTitle>
                </div>
                <CardDescription>
                  Perfect for solo practitioners
                </CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">£{getSoloPrice()}</span>
                  <span className="text-muted-foreground">/{billingPeriod === 'monthly' ? 'month' : 'year'}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {[
                    'Unlimited recordings',
                    'AI transcription with speaker ID',
                    'Attendance note generation',
                    'AI summaries',
                    'Secure document sharing',
                    'Firm branding on exports',
                    'Google & Outlook calendar sync',
                    'GDPR compliance tools',
                    'Email support',
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button onClick={handleLogin} className="w-full" data-testid="button-solo-signup">
                  Start Free Trial
                </Button>
              </CardFooter>
            </Card>

            {/* Team Plan */}
            <Card className="relative border-primary">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
              </div>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  <CardTitle>Team</CardTitle>
                </div>
                <CardDescription>
                  For boutique law firms
                </CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">£{getTeamPrice()}</span>
                  <span className="text-muted-foreground">/month base</span>
                  <p className="text-sm text-muted-foreground mt-1">+ £49/month per additional user</p>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {[
                    'Everything in Solo',
                    'Multi-user access',
                    'Team collaboration',
                    'Case assignment',
                    'Admin dashboard',
                    'User activity reports',
                    'Audit log exports',
                    'Priority support',
                    'Custom onboarding',
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button onClick={handleLogin} className="w-full" data-testid="button-team-signup">
                  Start Free Trial
                </Button>
              </CardFooter>
            </Card>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            All prices exclude VAT. Cancel anytime during your trial.
          </p>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to Streamline Your Practice?</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
          Join solicitors across the UK who are saving hours every week with LegalNote AI.
        </p>
        <Button 
          onClick={handleLogin} 
          size="lg"
          data-testid="button-cta-signup"
        >
          Start Your Free Trial
        </Button>
      </div>

      {/* Footer */}
      <div className="border-t bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground">
              LegalNote AI - Professional Legal Documentation
            </div>
            <div className="text-sm text-muted-foreground">
              Designed for UK Solicitors
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
