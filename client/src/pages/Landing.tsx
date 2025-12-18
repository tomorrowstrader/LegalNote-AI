import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scale, FileText, ShieldCheck, Clock, Mic, Calendar, Check, Building2, User, Sparkles, ArrowRight, Mail, Linkedin, Quote, Lock, Server } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Logo from "@/components/Logo";

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
    <div className="min-h-screen bg-[hsl(220,85%,3%)]">
      {/* Navigation */}
      <nav className="relative z-10 max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <motion.div 
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Logo variant="icon" size="lg" className="invert" />
            <span className="text-2xl font-bold text-white">LegalNote AI</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Button 
              onClick={handleLogin}
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              data-testid="button-nav-login"
            >
              Log in
            </Button>
          </motion.div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div 
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at top left, 
              hsl(220, 75%, 12%) 0%, 
              hsl(220, 80%, 6%) 35%,
              hsl(220, 85%, 3%) 70%,
              hsl(220, 90%, 2%) 100%
            )`
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[hsl(220,85%,3%)]" />
        
        <div className="relative max-w-7xl mx-auto px-6 pt-16 pb-32 sm:pt-24 sm:pb-40">
          <motion.div 
            className="max-w-4xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <motion.p
              className="text-[hsl(45,85%,55%)] font-medium mb-6 tracking-wide"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              Professional Legal Documentation
            </motion.p>
            
            <motion.h1 
              className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-8 leading-[1.1] tracking-tight" 
              data-testid="text-app-title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              From client meeting to compliant documentation in minutes
            </motion.h1>
            
            <motion.p 
              className="text-xl sm:text-2xl text-white/70 max-w-3xl mb-10 leading-relaxed" 
              data-testid="text-app-description"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              Record, transcribe, and generate attendance notes automatically. Built specifically for UK solicitors with GDPR compliance at its core.
            </motion.p>
            
            <motion.div 
              className="flex flex-col sm:flex-row gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Button 
                onClick={handleLogin} 
                size="lg" 
                className="bg-white text-[hsl(220,85%,8%)] hover:bg-white/90 text-lg px-8 h-14"
                data-testid="button-get-started"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Start Free Evaluation
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                className="border-white/20 text-white hover:bg-white/10 text-lg px-8 h-14"
                data-testid="button-view-pricing"
              >
                View Pricing
              </Button>
            </motion.div>
            
            <motion.p 
              className="text-white/50 mt-6 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              14-day professional evaluation. No payment required.
            </motion.p>
          </motion.div>
        </div>
      </div>

      {/* Features Section */}
      <div className="relative bg-[hsl(220,85%,3%)] py-24">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Everything you need to streamline your practice
            </h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              AI-powered documentation tools designed specifically for the way solicitors work.
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Mic, title: "AI Transcription", description: "Record client meetings and get accurate transcripts with speaker identification. Powered by AssemblyAI for professional-grade accuracy." },
              { icon: FileText, title: "Attendance Notes", description: "AI-generated attendance notes in professional legal format. Export to Word or PDF with your firm's branding." },
              { icon: Scale, title: "Built-in Compliance", description: "Consent management, comprehensive audit trails, and automatic data retention policies. Full GDPR documentation included." },
              { icon: ShieldCheck, title: "Secure Sharing", description: "Share documents via encrypted links. Optional SMS two-factor authentication and password protection." },
              { icon: Calendar, title: "Calendar Integration", description: "Sync case deadlines to Google Calendar or Outlook. Smart reminders ensure you never miss critical dates." },
              { icon: Clock, title: "Smart Retention", description: "Audio files auto-delete after 7 days. Transcripts and documents retained permanently for your records." },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <div className="group h-full p-8 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 hover:border-white/20 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-[hsl(45,85%,55%)]/10 flex items-center justify-center mb-5">
                    <feature.icon className="w-6 h-6 text-[hsl(45,85%,55%)]" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                  <p className="text-white/60 leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="relative py-24 overflow-hidden">
        <div 
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, 
              hsl(220, 85%, 3%) 0%,
              hsl(220, 75%, 8%) 50%,
              hsl(220, 85%, 3%) 100%
            )`
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              How it works
            </h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              From meeting to matter documentation in three simple steps.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {[
              { step: "1", title: "Record & Consent", description: "Start a recording with built-in consent capture. Works with in-person meetings or import recordings from Zoom, Teams, and Google Meet." },
              { step: "2", title: "AI Processing", description: "Our AI transcribes your meeting with speaker identification and generates professional attendance notes, summaries, and action items." },
              { step: "3", title: "Share & Export", description: "Export branded documents to PDF or Word. Share securely with clients via protected links with optional SMS two-factor authentication." },
            ].map((item, index) => (
              <motion.div 
                key={item.step}
                className="relative text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
              >
                {index > 0 && (
                  <div className="hidden md:block absolute top-12 -left-6 lg:-left-8">
                    <ArrowRight className="w-6 h-6 text-white/20" />
                  </div>
                )}
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[hsl(45,85%,55%)] to-[hsl(45,85%,40%)] flex items-center justify-center text-4xl font-bold text-[hsl(220,85%,8%)] mx-auto mb-6">
                  {item.step}
                </div>
                <h3 className="text-2xl font-semibold text-white mb-4">{item.title}</h3>
                <p className="text-white/60 leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Trust & Compliance Section */}
      <div className="relative bg-[hsl(220,85%,3%)] py-24">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Security & Compliance
            </h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              Built from the ground up with the highest standards of data protection and regulatory compliance.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: ShieldCheck, title: "GDPR Compliant", description: "Full compliance with UK GDPR requirements including data subject rights and processing records." },
              { icon: Lock, title: "End-to-End Encryption", description: "All data encrypted in transit and at rest using industry-standard AES-256 encryption." },
              { icon: Server, title: "UK Data Centres", description: "All data stored exclusively in UK-based data centres for regulatory compliance." },
              { icon: Scale, title: "SRA Aligned", description: "Designed to support solicitors in meeting SRA Standards and Regulations requirements." },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                className="text-center p-6"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-8 h-8 text-[hsl(45,85%,55%)]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-white/50">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Testimonial Section */}
      <div className="relative py-24 overflow-hidden">
        <div 
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, 
              hsl(220, 85%, 3%) 0%,
              hsl(220, 70%, 10%) 50%,
              hsl(220, 85%, 3%) 100%
            )`
          }}
        />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Quote className="w-12 h-12 text-[hsl(45,85%,55%)]/30 mx-auto mb-8" />
            <blockquote className="text-2xl sm:text-3xl lg:text-4xl font-medium text-white leading-relaxed mb-8">
              "LegalNote AI has transformed how we document client meetings. What used to take hours now takes minutes, with better accuracy and full compliance."
            </blockquote>
            <div className="text-white/60">
              <p className="font-medium text-white">Sarah Mitchell</p>
              <p className="text-sm">Senior Partner, Mitchell & Associates</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Pricing Section */}
      <div id="pricing" className="relative bg-[hsl(220,85%,3%)] py-24">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">Simple, transparent pricing</h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto mb-10">
              Choose the plan that fits your practice. All plans include a 14-day professional evaluation.
            </p>
            
            <div className="inline-flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-xl">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-6 py-3 rounded-lg text-sm font-medium transition-all ${
                  billingPeriod === 'monthly' 
                    ? 'bg-white text-[hsl(220,85%,8%)]' 
                    : 'text-white/60 hover:text-white'
                }`}
                data-testid="button-monthly-billing"
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('annual')}
                className={`px-6 py-3 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  billingPeriod === 'annual' 
                    ? 'bg-white text-[hsl(220,85%,8%)]' 
                    : 'text-white/60 hover:text-white'
                }`}
                data-testid="button-annual-billing"
              >
                Annual
                <span className={`text-xs px-2 py-0.5 rounded-full ${billingPeriod === 'annual' ? 'bg-[hsl(45,85%,55%)] text-[hsl(220,85%,8%)]' : 'bg-[hsl(45,85%,55%)]/20 text-[hsl(45,85%,55%)]'}`}>
                  Save 16%
                </span>
              </button>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <div className="h-full p-8 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Solo</h3>
                </div>
                <p className="text-white/50 mb-6">Perfect for solo practitioners</p>
                <div className="mb-8">
                  <span className="text-5xl font-bold text-white">£{getSoloPrice()}</span>
                  <span className="text-white/50 ml-2">/{billingPeriod === 'monthly' ? 'month' : 'year'}</span>
                </div>
                <ul className="space-y-4 mb-8">
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
                    <li key={i} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-[hsl(45,85%,55%)] flex-shrink-0" />
                      <span className="text-white/70">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  onClick={handleLogin} 
                  className="w-full h-12 bg-white/10 hover:bg-white/20 text-white border border-white/20" 
                  data-testid="button-solo-signup"
                >
                  Begin Evaluation
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="relative h-full p-8 rounded-2xl bg-gradient-to-b from-[hsl(45,85%,55%)]/20 to-[hsl(45,85%,55%)]/5 border border-[hsl(45,85%,55%)]/30">
                <div className="absolute -top-3 right-8">
                  <span className="px-4 py-1.5 rounded-full bg-[hsl(45,85%,55%)] text-[hsl(220,85%,8%)] text-sm font-medium">
                    Most Popular
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[hsl(45,85%,55%)]/20 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[hsl(45,85%,55%)]" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Team</h3>
                </div>
                <p className="text-white/50 mb-6">For boutique law firms</p>
                <div className="mb-2">
                  <span className="text-5xl font-bold text-white">£{getTeamPrice()}</span>
                  <span className="text-white/50 ml-2">/month base</span>
                </div>
                <p className="text-sm text-white/40 mb-6">+ £49/month per additional user</p>
                <ul className="space-y-4 mb-8">
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
                    <li key={i} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-[hsl(45,85%,55%)] flex-shrink-0" />
                      <span className="text-white/70">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  onClick={handleLogin} 
                  className="w-full h-12 bg-[hsl(45,85%,55%)] hover:bg-[hsl(45,85%,60%)] text-[hsl(220,85%,8%)] font-medium" 
                  data-testid="button-team-signup"
                >
                  Begin Evaluation
                </Button>
              </div>
            </motion.div>
          </div>

          <p className="text-center text-sm text-white/40 mt-8">
            All prices exclude VAT. Cancel anytime during your evaluation period.
          </p>
        </div>
      </div>

      {/* Final CTA Section */}
      <div className="relative py-24 overflow-hidden">
        <div 
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at bottom center, 
              hsl(220, 75%, 15%) 0%, 
              hsl(220, 85%, 3%) 70%
            )`
          }}
        />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Ready to transform your practice?
            </h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto mb-10">
              Join solicitors across the UK who are saving hours every week with LegalNote AI.
            </p>
            <Button 
              onClick={handleLogin} 
              size="lg"
              className="bg-white text-[hsl(220,85%,8%)] hover:bg-white/90 text-lg px-10 h-14"
              data-testid="button-cta-signup"
            >
              Start Your Free Evaluation
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative bg-[hsl(220,90%,2%)] border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <h3 className="text-2xl font-bold text-white mb-4">LegalNote AI</h3>
              <p className="text-white/50 mb-6 max-w-sm leading-relaxed">
                Professional legal documentation platform built specifically for UK solicitors. 
                GDPR compliant, SRA-aligned, designed to streamline your practice.
              </p>
              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60">
                  GDPR Compliant
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60">
                  UK Data Centres
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <button 
                    onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                    className="text-white/50 hover:text-white transition-colors"
                    data-testid="link-footer-pricing"
                  >
                    Pricing
                  </button>
                </li>
                <li>
                  <span className="text-white/30">Documentation (Coming Soon)</span>
                </li>
                <li>
                  <span className="text-white/30">API (Coming Soon)</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Contact</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <a 
                    href="mailto:hello@legalnote.ai" 
                    className="flex items-center gap-2 text-white/50 hover:text-white transition-colors"
                    data-testid="link-footer-email"
                  >
                    <Mail className="w-4 h-4" />
                    hello@legalnote.ai
                  </a>
                </li>
                <li>
                  <a 
                    href="https://linkedin.com/company/legalnote-ai" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-white/50 hover:text-white transition-colors"
                    data-testid="link-footer-linkedin"
                  >
                    <Linkedin className="w-4 h-4" />
                    LinkedIn
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-white/40">
              © {new Date().getFullYear()} LegalNote AI. All rights reserved.
            </div>
            <div className="flex items-center gap-6 text-sm text-white/30">
              <span>Privacy Policy (Coming Soon)</span>
              <span>Terms of Service (Coming Soon)</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
