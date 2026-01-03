import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Scale, FileText, ShieldCheck, Clock, Calendar, Check, Building2, User, ArrowRight, Mail, Linkedin, CheckCircle2, XCircle, FileCheck, ClipboardCheck, Users, Gavel } from "lucide-react";
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
    <div className="min-h-screen bg-white">
      {/* Floating CTA - Fixed at bottom on mobile */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden">
        <Button 
          onClick={handleLogin}
          className="bg-[hsl(30,8%,15%)] text-white hover:bg-[hsl(30,8%,20%)] rounded-full px-8 py-6 text-base shadow-2xl"
          data-testid="button-floating-cta"
        >
          Book a demo
        </Button>
      </div>

      {/* Announcement Bar */}
      <div className="bg-[hsl(30,15%,75%)] text-[hsl(30,10%,20%)]">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-center gap-2 text-sm">
          <span className="font-medium">News</span>
          <span className="text-[hsl(30,10%,35%)]">|</span>
          <span>LegalNote now integrates with Clio Manage</span>
          <button 
            onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
            className="font-medium hover:underline ml-1"
            data-testid="button-announcement-readmore"
          >
            Read more →
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Logo variant="wordmark" size="xl" tone="light" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-2 sm:gap-6"
            >
              <Button 
                variant="ghost"
                size="sm"
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-[hsl(30,8%,25%)] hover:text-[hsl(30,8%,10%)] font-normal text-sm sm:text-base px-2 sm:px-4"
                data-testid="button-nav-features"
              >
                <span className="hidden sm:inline">How It Works</span>
                <span className="sm:hidden">Features</span>
              </Button>
              <Button 
                variant="ghost"
                size="sm"
                onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-[hsl(30,8%,25%)] hover:text-[hsl(30,8%,10%)] font-normal text-sm sm:text-base px-2 sm:px-4"
                data-testid="button-nav-pricing"
              >
                Pricing
              </Button>
              <Button 
                variant="ghost"
                size="sm"
                onClick={handleLogin}
                className="text-[hsl(30,8%,25%)] hover:text-[hsl(30,8%,10%)] font-normal text-sm sm:text-base px-2 sm:px-4"
                data-testid="button-nav-login"
              >
                Log in
              </Button>
            </motion.div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Editorial Style */}
      <div className="relative bg-white">
        <div className="max-w-7xl mx-auto px-6 pt-8 sm:pt-16 pb-12">
          <motion.div 
            className="max-w-4xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <motion.h1 
              className="text-[2.75rem] sm:text-6xl lg:text-7xl font-normal text-[hsl(30,8%,15%)] mb-8 leading-[1.1] tracking-tight" 
              style={{ fontFamily: "'Lora', Georgia, serif" }}
              data-testid="text-app-title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Meeting to matter,<br />
              built for compliance.
            </motion.h1>
          </motion.div>
        </div>

        {/* Hero Image Section */}
        <div className="relative px-6 mb-12">
          <motion.div
            className="max-w-7xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* Left panel - App preview mockup */}
              <div className="bg-[hsl(30,15%,75%)] rounded-lg sm:rounded-xl p-6 sm:p-8 aspect-[4/3] flex items-center justify-center">
                <div className="bg-white rounded-lg shadow-xl p-4 sm:p-5 w-full max-w-[280px]">
                  <div className="text-sm font-medium text-[hsl(30,8%,25%)] mb-3">Record meeting</div>
                  <div className="text-xs text-[hsl(30,8%,50%)] mb-4 leading-relaxed">
                    Capture attendance notes with<br />consent-first workflows
                  </div>
                  <div className="bg-[hsl(30,8%,15%)] text-white text-xs py-2 px-4 rounded text-center">
                    Start recording
                  </div>
                </div>
              </div>
              {/* Right panel - Abstract legal imagery */}
              <div className="bg-[hsl(30,15%,75%)] rounded-lg sm:rounded-xl aspect-[4/3] flex items-center justify-center overflow-hidden">
                <div className="text-[hsl(30,10%,55%)] text-center p-4">
                  <Scale className="w-16 h-16 mx-auto mb-2 opacity-40" />
                  <span className="text-sm opacity-60">Compliance-first documentation</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Hero Description */}
        <div className="max-w-7xl mx-auto px-6 pb-20">
          <motion.p 
            className="text-lg sm:text-xl text-[hsl(30,8%,45%)] max-w-2xl leading-relaxed" 
            style={{ fontFamily: "'Lora', Georgia, serif" }}
            data-testid="text-app-description"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            Spend less time on admin, and more time on the work only lawyers can do. LegalNote frees you from manual note-taking so you can move faster, and deliver more for your clients.
          </motion.p>
          
          {/* Desktop CTA */}
          <motion.div 
            className="hidden md:block mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Button 
              onClick={handleLogin}
              className="bg-[hsl(30,8%,15%)] text-white hover:bg-[hsl(30,8%,20%)] rounded-full px-10 py-6 text-base"
              data-testid="button-get-started"
            >
              Book a demo
            </Button>
          </motion.div>
        </div>
      </div>

      {/* What LegalNote Does - Value Proposition */}
      <div className="relative bg-[hsl(30,10%,96%)] py-20 border-y border-[hsl(30,10%,90%)]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-4xl font-normal text-[hsl(30,8%,15%)] mb-6" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Attendance records that evidence professional judgement
            </h2>
            <p className="text-lg text-[hsl(30,8%,45%)] leading-relaxed max-w-3xl mx-auto" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              LegalNote captures what was said, what was decided, and what must happen next, then forms a reviewable attendance note that preserves reasoning, actions, and instructions for professional finalisation. Records are timestamped, contemporaneous, and aligned with how regulators expect legal work to be evidenced.
            </p>
          </motion.div>
        </div>
      </div>

      {/* How It Works Section */}
      <div id="how-it-works" className="relative py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-sm font-medium text-[hsl(30,8%,50%)] uppercase tracking-wider mb-4 block">
              How It Works
            </span>
            <h2 className="text-4xl sm:text-5xl font-normal text-[hsl(30,8%,15%)] mb-6" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Attendance records, formed at source
            </h2>
            <p className="text-xl text-[hsl(30,8%,50%)] max-w-3xl mx-auto" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              LegalNote supports practitioners by capturing client meetings through consent-first workflows designed for UK-regulated legal environments.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {[
              { 
                step: "1", 
                title: "Capture with consent", 
                description: "Start with built-in consent workflows that explain, obtain, and record client consent to recording. Works with in-person meetings or import from Zoom, Teams, and Google Meet." 
              },
              { 
                step: "2", 
                title: "Review and refine", 
                description: "Conversations are securely transcribed and formed into a structured attendance note reflecting instructions, advice, decisions, and follow-up actions aligned with SRA expectations." 
              },
              { 
                step: "3", 
                title: "Finalise and evidence", 
                description: "The practitioner remains in control: LegalNote proposes the structure and content, but professional judgement determines what is kept, amended, or removed before the record is finalised." 
              },
            ].map((item, index) => (
              <motion.div 
                key={item.step}
                className="relative"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
              >
                {index > 0 && (
                  <div className="hidden md:block absolute top-12 -left-6 lg:-left-8">
                    <ArrowRight className="w-6 h-6 text-[hsl(30,15%,80%)]" />
                  </div>
                )}
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-[hsl(30,15%,75%)] flex items-center justify-center text-2xl font-medium text-[hsl(30,8%,25%)] mx-auto mb-6">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-medium text-[hsl(30,8%,15%)] mb-4">{item.title}</h3>
                  <p className="text-[hsl(30,8%,50%)] leading-relaxed">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section - Compliance Focus */}
      <div className="relative bg-[hsl(30,10%,96%)] py-24 border-y border-[hsl(30,10%,90%)]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-sm font-medium text-[hsl(30,8%,50%)] uppercase tracking-wider mb-4 block">
              Features
            </span>
            <h2 className="text-4xl sm:text-5xl font-normal text-[hsl(30,8%,15%)] mb-6" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Decisions don't get lost. Actions don't drift.
            </h2>
            <p className="text-xl text-[hsl(30,8%,50%)] max-w-3xl mx-auto" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              LegalNote identifies decisions, next steps, and responsibilities as they arise in conversation—so they are not buried in a long transcript or forgotten notebook.
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { 
                icon: FileCheck, 
                title: "Contemporaneous Records", 
                description: "Attendance records formed at source, not days later. Timestamped and evidential, aligned with SRA expectations for detailed, contemporaneous file notes." 
              },
              { 
                icon: ClipboardCheck, 
                title: "Consent-First Capture", 
                description: "Workflows make it straightforward to explain, obtain, and record client consent to recording—meeting expectations of confidentiality and transparency." 
              },
              { 
                icon: Scale, 
                title: "Professional Control", 
                description: "LegalNote proposes structure and content; the practitioner exercises judgement and signs off the attendance record. AI-assisted, not AI-decided." 
              },
              { 
                icon: Calendar, 
                title: "Actions Surfaced & Diarised", 
                description: "Decisions and next steps are identified, surfaced, and synced to your calendar while remaining linked to the attendance record and matter history." 
              },
              { 
                icon: FileText, 
                title: "Living Matter Record", 
                description: "Instead of static files, LegalNote helps create a living record: what was known, what was agreed, and why specific actions were taken at each stage." 
              },
              { 
                icon: ShieldCheck, 
                title: "Audit-Ready Trail", 
                description: "Reviewable, timestamped attendance notes create a coherent audit trail across the life of a matter. HMAC-SHA256 signatures ensure tamper detection." 
              },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <div className="group h-full p-8 rounded-xl bg-white border border-[hsl(30,10%,88%)] hover:shadow-md transition-all duration-300">
                  <div className="w-12 h-12 rounded-lg bg-[hsl(30,15%,75%)] flex items-center justify-center mb-5">
                    <feature.icon className="w-6 h-6 text-[hsl(30,8%,30%)]" />
                  </div>
                  <h3 className="text-xl font-medium text-[hsl(30,8%,15%)] mb-3">{feature.title}</h3>
                  <p className="text-[hsl(30,8%,50%)] leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Differentiation Section */}
      <div className="relative bg-white py-24">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-sm font-medium text-[hsl(30,8%,50%)] uppercase tracking-wider mb-4 block">
              Why LegalNote
            </span>
            <h2 className="text-4xl sm:text-5xl font-normal text-[hsl(30,8%,15%)] mb-6" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Not another note-taking app
            </h2>
            <p className="text-xl text-[hsl(30,8%,50%)] max-w-3xl mx-auto" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              LegalNote is a compliance-first attendance record system built for regulated legal practice—not a generic dictation tool or AI note-taker.
            </p>
          </motion.div>

          <motion.div
            className="overflow-hidden rounded-xl border border-[hsl(30,10%,88%)] bg-white"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[hsl(30,10%,90%)]">
                    <th className="text-left p-6 text-[hsl(30,8%,45%)] font-medium">Dimension</th>
                    <th className="text-left p-6 text-[hsl(30,8%,55%)] font-medium bg-[hsl(30,10%,97%)]">Typical dictation / note apps</th>
                    <th className="text-left p-6 font-medium text-[hsl(30,8%,15%)] bg-[hsl(30,15%,75%)]/20">LegalNote</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {[
                    { 
                      dimension: "Primary output", 
                      generic: "Audio file, raw transcript, or generic summary focused on convenience", 
                      legalnote: "Structured attendance record aligned with legal training and regulatory expectations" 
                    },
                    { 
                      dimension: "Legal domain awareness", 
                      generic: "Little or no awareness of legal duties, SRA guidance, or evidential standards", 
                      legalnote: "Built around the role of attendance notes in evidencing competent service and defensible decision-making" 
                    },
                    { 
                      dimension: "Point in workflow", 
                      generic: "Used after the fact to \"type up\" notes or dictate for later transcription", 
                      legalnote: "Operates at the point of instruction, forming the attendance record as the matter unfolds" 
                    },
                    { 
                      dimension: "Treatment of actions", 
                      generic: "Actions are buried in text or left to the user to extract manually", 
                      legalnote: "Decisions and next steps are identified, surfaced, and diarised while remaining tied to the matter record" 
                    },
                    { 
                      dimension: "Consent and client care", 
                      generic: "Recording and consent left to firm-by-firm improvisation", 
                      legalnote: "Consent-first capture workflows designed for regulated professional environments" 
                    },
                    { 
                      dimension: "Role of practitioner", 
                      generic: "Tool is effectively an audio/typing assistant", 
                      legalnote: "Tool proposes structure; practitioner exercises judgement and signs off the attendance record" 
                    },
                  ].map((row, index) => (
                    <tr key={index} className="border-b border-[hsl(30,10%,92%)] last:border-b-0">
                      <td className="p-6 font-medium text-[hsl(30,8%,25%)]">{row.dimension}</td>
                      <td className="p-6 text-[hsl(30,8%,55%)] bg-[hsl(30,10%,97%)]">
                        <div className="flex items-start gap-2">
                          <XCircle className="w-4 h-4 text-[hsl(0,40%,55%)] mt-0.5 flex-shrink-0" />
                          <span>{row.generic}</span>
                        </div>
                      </td>
                      <td className="p-6 text-[hsl(30,8%,30%)] bg-[hsl(30,15%,75%)]/20">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[hsl(30,8%,35%)] mt-0.5 flex-shrink-0" />
                          <span>{row.legalnote}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Trust & Compliance Section */}
      <div className="relative bg-[hsl(30,10%,96%)] py-24 border-y border-[hsl(30,10%,90%)]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-sm font-medium text-[hsl(30,8%,50%)] uppercase tracking-wider mb-4 block">
              Security & Compliance
            </span>
            <h2 className="text-4xl sm:text-5xl font-normal text-[hsl(30,8%,15%)] mb-6" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Built to evidence professional judgement
            </h2>
            <p className="text-xl text-[hsl(30,8%,50%)] max-w-3xl mx-auto" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Designed around the reality that detailed attendance notes are a core strand of evidencing competent service and defensible decision-making.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: ShieldCheck, title: "GDPR Compliant", description: "Full compliance with UK GDPR including data subject rights and processing records." },
              { icon: Gavel, title: "SRA Aligned", description: "Workflows designed to support SRA Standards and Regulations requirements." },
              { icon: Clock, title: "Contemporaneous", description: "Timestamped records created at point of instruction, not reconstructed later." },
              { icon: Users, title: "UK Data Centres", description: "All data stored exclusively in UK-based data centres for regulatory compliance." },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                className="text-center p-6"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <div className="w-16 h-16 rounded-xl bg-white border border-[hsl(30,10%,88%)] flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-8 h-8 text-[hsl(30,8%,35%)]" />
                </div>
                <h3 className="text-lg font-medium text-[hsl(30,8%,15%)] mb-2">{item.title}</h3>
                <p className="text-sm text-[hsl(30,8%,50%)]">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div id="pricing" className="relative bg-white py-24">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-sm font-medium text-[hsl(30,8%,50%)] uppercase tracking-wider mb-4 block">
              Pricing
            </span>
            <h2 className="text-4xl sm:text-5xl font-normal text-[hsl(30,8%,15%)] mb-6" style={{ fontFamily: "'Lora', Georgia, serif" }}>Simple, transparent pricing</h2>
            <p className="text-xl text-[hsl(30,8%,50%)] max-w-2xl mx-auto mb-10" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Choose the plan that fits your practice. All plans include a 14-day professional evaluation.
            </p>
            
            <div className="inline-flex items-center gap-1 p-1 bg-[hsl(30,10%,95%)] border border-[hsl(30,10%,88%)] rounded-xl">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-6 py-3 rounded-lg text-sm font-medium transition-all ${
                  billingPeriod === 'monthly' 
                    ? 'bg-white text-[hsl(30,8%,15%)] shadow-sm' 
                    : 'text-[hsl(30,8%,50%)] hover:text-[hsl(30,8%,30%)]'
                }`}
                data-testid="button-monthly-billing"
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('annual')}
                className={`px-6 py-3 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  billingPeriod === 'annual' 
                    ? 'bg-white text-[hsl(30,8%,15%)] shadow-sm' 
                    : 'text-[hsl(30,8%,50%)] hover:text-[hsl(30,8%,30%)]'
                }`}
                data-testid="button-annual-billing"
              >
                Annual
                <span className={`text-xs px-2 py-0.5 rounded-full ${billingPeriod === 'annual' ? 'bg-[hsl(30,15%,75%)] text-[hsl(30,8%,20%)]' : 'bg-[hsl(30,15%,75%)]/30 text-[hsl(30,8%,40%)]'}`}>
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
              <div className="h-full p-8 rounded-xl bg-white border border-[hsl(30,10%,88%)]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-[hsl(30,10%,95%)] flex items-center justify-center">
                    <User className="w-5 h-5 text-[hsl(30,8%,45%)]" />
                  </div>
                  <h3 className="text-2xl font-medium text-[hsl(30,8%,15%)]">Solo</h3>
                </div>
                <p className="text-[hsl(30,8%,50%)] mb-6">Perfect for solo practitioners</p>
                <div className="mb-8">
                  <span className="text-5xl font-medium text-[hsl(30,8%,15%)]">£{getSoloPrice()}</span>
                  <span className="text-[hsl(30,8%,50%)] ml-2">/{billingPeriod === 'monthly' ? 'month' : 'year'}</span>
                </div>
                <ul className="space-y-4 mb-8">
                  {[
                    'Unlimited recordings',
                    'AI transcription with speaker ID',
                    'Attendance note generation',
                    'AI summaries & action items',
                    'Secure document sharing',
                    'Firm branding on exports',
                    'Google & Outlook calendar sync',
                    'GDPR compliance tools',
                    'Email support',
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-[hsl(30,8%,40%)] flex-shrink-0" />
                      <span className="text-[hsl(30,8%,45%)]">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  onClick={handleLogin} 
                  variant="outline"
                  className="w-full h-12 border-[hsl(30,10%,80%)] text-[hsl(30,8%,30%)] hover:bg-[hsl(30,10%,95%)]" 
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
              <div className="relative h-full p-8 rounded-xl bg-[hsl(30,15%,75%)]/10 border-2 border-[hsl(30,15%,75%)]/40">
                <div className="absolute -top-3 right-8">
                  <span className="px-4 py-1.5 rounded-full bg-[hsl(30,15%,75%)] text-[hsl(30,8%,20%)] text-sm font-medium">
                    Most Popular
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-[hsl(30,15%,75%)]/30 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[hsl(30,8%,35%)]" />
                  </div>
                  <h3 className="text-2xl font-medium text-[hsl(30,8%,15%)]">Team</h3>
                </div>
                <p className="text-[hsl(30,8%,50%)] mb-6">For boutique law firms</p>
                <div className="mb-2">
                  <span className="text-5xl font-medium text-[hsl(30,8%,15%)]">£{getTeamPrice()}</span>
                  <span className="text-[hsl(30,8%,50%)] ml-2">/month base</span>
                </div>
                <p className="text-sm text-[hsl(30,8%,50%)] mb-6">+ £49/month per additional user</p>
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
                      <Check className="w-5 h-5 text-[hsl(30,8%,40%)] flex-shrink-0" />
                      <span className="text-[hsl(30,8%,45%)]">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  onClick={handleLogin} 
                  className="w-full h-12 bg-[hsl(30,8%,15%)] hover:bg-[hsl(30,8%,20%)] text-white font-medium" 
                  data-testid="button-team-signup"
                >
                  Begin Evaluation
                </Button>
              </div>
            </motion.div>
          </div>

          <p className="text-center text-sm text-[hsl(30,8%,50%)] mt-8">
            All prices exclude VAT. Cancel anytime during your evaluation period.
          </p>
        </div>
      </div>

      {/* Final CTA Section */}
      <div className="relative py-24 overflow-hidden bg-[hsl(30,8%,12%)]">
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl sm:text-5xl font-normal text-white mb-6" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Never have a file note gap again
            </h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto mb-10" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Join solicitors across the UK who are creating contemporaneous, evidential attendance records with LegalNote.
            </p>
            <Button 
              onClick={handleLogin} 
              size="lg"
              className="bg-white text-[hsl(30,8%,15%)] hover:bg-white/90 rounded-full text-base px-10 py-6"
              data-testid="button-cta-signup"
            >
              Start Your Free Evaluation
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative bg-[hsl(30,8%,8%)] border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <div className="mb-4">
                <Logo variant="wordmark" size="xl" tone="dark" />
              </div>
              <p className="text-white/50 mb-6 max-w-sm leading-relaxed">
                A compliance-first attendance record system built for regulated UK legal practice. Contemporaneous records that evidence professional judgement.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60">
                  GDPR Compliant
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60">
                  SRA Aligned
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60">
                  UK Data Centres
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-white mb-4">Product</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <button 
                    onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                    className="text-white/50 hover:text-white transition-colors"
                    data-testid="link-footer-features"
                  >
                    How It Works
                  </button>
                </li>
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
