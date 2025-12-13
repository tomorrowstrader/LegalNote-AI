import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scale, FileText, ShieldCheck, Clock, Mic, Calendar, Check, Building2, User, Sparkles, ArrowRight, Mail, Linkedin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";

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
          <motion.div 
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <Badge variant="secondary" className="mb-4">
                GDPR Compliant
              </Badge>
            </motion.div>
            <motion.h1 
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-4 tracking-tight" 
              data-testid="text-app-title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              LegalNote AI
            </motion.h1>
            <motion.p 
              className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8" 
              data-testid="text-app-description"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              Professional legal documentation platform for UK solicitors. Record client meetings, generate attendance notes automatically, and share documents securely.
            </motion.p>
            <motion.div 
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Button 
                onClick={handleLogin} 
                size="lg" 
                className="min-w-[200px]"
                data-testid="button-get-started"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Start Your Evaluation
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                data-testid="button-view-pricing"
              >
                View Pricing
              </Button>
            </motion.div>
            <motion.p 
              className="text-sm text-muted-foreground mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              14-Day Professional Evaluation Period. No payment taken until evaluation ends.
            </motion.p>
          </motion.div>
        </div>
      </div>

      {/* Features Grid */}
      <motion.div 
        className="max-w-6xl mx-auto px-4 py-16"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Everything You Need</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Streamline your practice with AI-powered documentation tools designed specifically for UK solicitors.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: Mic, title: "AI Transcription", description: "Record client meetings and get accurate transcripts with speaker identification. AssemblyAI-powered for professional accuracy." },
            { icon: FileText, title: "Attendance Notes", description: "AI-generated attendance notes in professional legal format. Export to Word or PDF with your firm's branding." },
            { icon: Scale, title: "GDPR Compliant", description: "Built-in consent management, audit trails, and automatic data retention. Full compliance documentation included." },
            { icon: ShieldCheck, title: "Secure Sharing", description: "Share documents with clients via secure links. Optional SMS 2FA and password protection for sensitive materials." },
            { icon: Calendar, title: "Calendar Sync", description: "Sync case deadlines to Google Calendar or Outlook. Never miss an important date with automatic reminders." },
            { icon: Clock, title: "7-Day Audio Retention", description: "Audio files automatically deleted after 7 days. Transcripts and documents retained permanently for your records." },
          ].map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <Card className="hover-elevate h-full">
                <CardHeader>
                  <feature.icon className="w-10 h-10 text-primary mb-2" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* How It Works Section */}
      <motion.div 
        className="bg-muted/30 py-16"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              From meeting to matter documentation in three simple steps.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <motion.div 
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Record & Consent</h3>
              <p className="text-muted-foreground">
                Start a recording with built-in consent capture. Works with in-person meetings or import from Zoom, Teams, and Meet.
              </p>
            </motion.div>

            <motion.div 
              className="text-center relative"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="hidden md:block absolute top-8 -left-4 w-8">
                <ArrowRight className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Processing</h3>
              <p className="text-muted-foreground">
                Our AI transcribes your meeting with speaker identification and generates professional attendance notes and summaries.
              </p>
            </motion.div>

            <motion.div 
              className="text-center relative"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div className="hidden md:block absolute top-8 -left-4 w-8">
                <ArrowRight className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Share & Export</h3>
              <p className="text-muted-foreground">
                Export branded documents to PDF or Word. Share securely with clients via protected links with optional SMS 2FA.
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Pricing Section */}
      <div id="pricing" className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
              Choose the plan that fits your practice. All plans include a 14-Day Professional Evaluation Period.
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
                  Begin Evaluation
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
                  Begin Evaluation
                </Button>
              </CardFooter>
            </Card>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            All prices exclude VAT. Cancel anytime during your evaluation period.
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
          Start Your Evaluation
        </Button>
      </div>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <h3 className="text-lg font-semibold mb-3">LegalNote AI</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Professional legal documentation platform built specifically for UK solicitors. 
                GDPR compliant, SRA-aligned, designed to streamline your practice.
              </p>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-xs">GDPR Compliant</Badge>
                <Badge variant="outline" className="text-xs">UK Data Centres</Badge>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <button 
                    onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                    className="hover:text-foreground transition-colors"
                    data-testid="link-footer-pricing"
                  >
                    Pricing
                  </button>
                </li>
                <li>
                  <span className="text-muted-foreground/60">Documentation (Coming Soon)</span>
                </li>
                <li>
                  <span className="text-muted-foreground/60">API (Coming Soon)</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-3">Contact</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <a 
                    href="mailto:hello@legalnote.ai" 
                    className="hover:text-foreground transition-colors"
                    data-testid="link-footer-email"
                  >
                    hello@legalnote.ai
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Linkedin className="w-4 h-4" />
                  <a 
                    href="https://linkedin.com/company/legalnote-ai" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors"
                    data-testid="link-footer-linkedin"
                  >
                    LinkedIn
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} LegalNote AI. All rights reserved.
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="text-muted-foreground/60">Privacy Policy (Coming Soon)</span>
              <span className="text-muted-foreground/60">Terms of Service (Coming Soon)</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
