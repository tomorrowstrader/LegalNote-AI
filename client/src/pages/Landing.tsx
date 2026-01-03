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
    <div className="min-h-screen bg-[hsl(0,0%,98%)]">
      {/* Navigation */}
      <nav className="relative z-10 max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Logo variant="wordmark" size="lg" tone="light" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-4"
          >
            <Button 
              variant="ghost"
              onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-[hsl(0,0%,30%)] hover:text-[hsl(0,0%,10%)]"
              data-testid="button-nav-features"
            >
              How It Works
            </Button>
            <Button 
              variant="ghost"
              onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-[hsl(0,0%,30%)] hover:text-[hsl(0,0%,10%)]"
              data-testid="button-nav-pricing"
            >
              Pricing
            </Button>
            <Button 
              onClick={handleLogin}
              className="bg-[hsl(0,0%,8%)] text-white hover:bg-[hsl(0,0%,15%)]"
              data-testid="button-nav-login"
            >
              Log in
            </Button>
          </motion.div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(45,85%,95%)] via-white to-white opacity-60" />
        
        <div className="relative max-w-7xl mx-auto px-6 pt-16 pb-24 sm:pt-24 sm:pb-32">
          <motion.div 
            className="max-w-4xl mx-auto text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(45,85%,55%)]/10 border border-[hsl(45,85%,55%)]/20 mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Scale className="w-4 h-4 text-[hsl(45,70%,40%)]" />
              <span className="text-sm font-medium text-[hsl(45,70%,35%)]">Built for UK Regulated Legal Practice</span>
            </motion.div>
            
            <motion.h1 
              className="text-5xl sm:text-6xl lg:text-7xl font-bold text-[hsl(0,0%,8%)] mb-8 leading-[1.1] tracking-tight font-serif" 
              data-testid="text-app-title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Meeting to matter.{" "}
              <span className="text-[hsl(45,70%,40%)]">Built for compliance.</span>
            </motion.h1>
            
            <motion.p 
              className="text-xl sm:text-2xl text-[hsl(0,0%,40%)] max-w-3xl mx-auto mb-10 leading-relaxed" 
              data-testid="text-app-description"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              LegalNote turns conversations into structured, contemporaneous attendance records that can stand up to scrutiny—without asking practitioners to reconstruct the matter after the fact.
            </motion.p>
            
            <motion.div 
              className="flex flex-col sm:flex-row gap-4 justify-center mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Button 
                onClick={handleLogin} 
                size="lg" 
                className="bg-[hsl(0,0%,8%)] text-white hover:bg-[hsl(0,0%,15%)] text-lg px-8 h-14"
                data-testid="button-get-started"
              >
                Start Free Evaluation
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                className="border-[hsl(0,0%,80%)] text-[hsl(0,0%,25%)] hover:bg-[hsl(0,0%,95%)] text-lg px-8 h-14"
                data-testid="button-learn-more"
              >
                See How It Works
              </Button>
            </motion.div>

            <motion.div 
              className="flex flex-wrap items-center justify-center gap-6 text-sm text-[hsl(0,0%,50%)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[hsl(45,70%,40%)]" />
                Consent-first capture
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[hsl(45,70%,40%)]" />
                SRA-aligned workflows
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[hsl(45,70%,40%)]" />
                14-day professional evaluation
              </span>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* What LegalNote Does - Value Proposition */}
      <div className="relative bg-[hsl(0,0%,96%)] py-20 border-y border-[hsl(0,0%,90%)]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-[hsl(0,0%,8%)] mb-6 font-serif">
              Attendance records that evidence professional judgement
            </h2>
            <p className="text-lg text-[hsl(0,0%,40%)] leading-relaxed max-w-3xl mx-auto">
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
            <Badge variant="secondary" className="mb-4">
              How It Works
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-bold text-[hsl(0,0%,8%)] mb-6 font-serif">
              Attendance records, formed at source
            </h2>
            <p className="text-xl text-[hsl(0,0%,45%)] max-w-3xl mx-auto">
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
                    <ArrowRight className="w-6 h-6 text-[hsl(0,0%,80%)]" />
                  </div>
                )}
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[hsl(45,85%,55%)] to-[hsl(45,70%,45%)] flex items-center justify-center text-3xl font-bold text-white mx-auto mb-6 shadow-lg">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-semibold text-[hsl(0,0%,10%)] mb-4">{item.title}</h3>
                  <p className="text-[hsl(0,0%,45%)] leading-relaxed">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section - Compliance Focus */}
      <div className="relative bg-[hsl(0,0%,96%)] py-24 border-y border-[hsl(0,0%,90%)]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="secondary" className="mb-4">
              Features
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-bold text-[hsl(0,0%,8%)] mb-6 font-serif">
              Decisions don't get lost. Actions don't drift.
            </h2>
            <p className="text-xl text-[hsl(0,0%,45%)] max-w-3xl mx-auto">
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
                <div className="group h-full p-8 rounded-2xl bg-white border border-[hsl(0,0%,90%)] hover:border-[hsl(45,85%,55%)]/30 hover:shadow-lg transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-[hsl(45,85%,55%)]/10 flex items-center justify-center mb-5">
                    <feature.icon className="w-6 h-6 text-[hsl(45,70%,40%)]" />
                  </div>
                  <h3 className="text-xl font-semibold text-[hsl(0,0%,10%)] mb-3">{feature.title}</h3>
                  <p className="text-[hsl(0,0%,45%)] leading-relaxed">{feature.description}</p>
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
            <Badge variant="secondary" className="mb-4">
              Why LegalNote
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-bold text-[hsl(0,0%,8%)] mb-6 font-serif">
              Not another note-taking app
            </h2>
            <p className="text-xl text-[hsl(0,0%,45%)] max-w-3xl mx-auto">
              LegalNote is a compliance-first attendance record system built for regulated legal practice—not a generic dictation tool or AI note-taker.
            </p>
          </motion.div>

          <motion.div
            className="overflow-hidden rounded-2xl border border-[hsl(0,0%,88%)] bg-white shadow-sm"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[hsl(0,0%,90%)]">
                    <th className="text-left p-6 text-[hsl(0,0%,40%)] font-medium">Dimension</th>
                    <th className="text-left p-6 text-[hsl(0,0%,50%)] font-medium bg-[hsl(0,0%,97%)]">Typical dictation / note apps</th>
                    <th className="text-left p-6 font-medium text-[hsl(0,0%,10%)] bg-[hsl(45,85%,55%)]/5">LegalNote</th>
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
                    <tr key={index} className="border-b border-[hsl(0,0%,92%)] last:border-b-0">
                      <td className="p-6 font-medium text-[hsl(0,0%,20%)]">{row.dimension}</td>
                      <td className="p-6 text-[hsl(0,0%,50%)] bg-[hsl(0,0%,97%)]">
                        <div className="flex items-start gap-2">
                          <XCircle className="w-4 h-4 text-[hsl(0,50%,50%)] mt-0.5 flex-shrink-0" />
                          <span>{row.generic}</span>
                        </div>
                      </td>
                      <td className="p-6 text-[hsl(0,0%,25%)] bg-[hsl(45,85%,55%)]/5">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[hsl(45,70%,40%)] mt-0.5 flex-shrink-0" />
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
      <div className="relative bg-[hsl(0,0%,96%)] py-24 border-y border-[hsl(0,0%,90%)]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="secondary" className="mb-4">
              Security & Compliance
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-bold text-[hsl(0,0%,8%)] mb-6 font-serif">
              Built to evidence professional judgement
            </h2>
            <p className="text-xl text-[hsl(0,0%,45%)] max-w-3xl mx-auto">
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
                <div className="w-16 h-16 rounded-2xl bg-white border border-[hsl(0,0%,88%)] flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <item.icon className="w-8 h-8 text-[hsl(45,70%,40%)]" />
                </div>
                <h3 className="text-lg font-semibold text-[hsl(0,0%,10%)] mb-2">{item.title}</h3>
                <p className="text-sm text-[hsl(0,0%,50%)]">{item.description}</p>
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
            <Badge variant="secondary" className="mb-4">
              Pricing
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-bold text-[hsl(0,0%,8%)] mb-6 font-serif">Simple, transparent pricing</h2>
            <p className="text-xl text-[hsl(0,0%,45%)] max-w-2xl mx-auto mb-10">
              Choose the plan that fits your practice. All plans include a 14-day professional evaluation.
            </p>
            
            <div className="inline-flex items-center gap-1 p-1 bg-[hsl(0,0%,95%)] border border-[hsl(0,0%,88%)] rounded-xl">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-6 py-3 rounded-lg text-sm font-medium transition-all ${
                  billingPeriod === 'monthly' 
                    ? 'bg-white text-[hsl(0,0%,10%)] shadow-sm' 
                    : 'text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,30%)]'
                }`}
                data-testid="button-monthly-billing"
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('annual')}
                className={`px-6 py-3 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  billingPeriod === 'annual' 
                    ? 'bg-white text-[hsl(0,0%,10%)] shadow-sm' 
                    : 'text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,30%)]'
                }`}
                data-testid="button-annual-billing"
              >
                Annual
                <span className={`text-xs px-2 py-0.5 rounded-full ${billingPeriod === 'annual' ? 'bg-[hsl(45,85%,55%)] text-white' : 'bg-[hsl(45,85%,55%)]/20 text-[hsl(45,70%,35%)]'}`}>
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
              <div className="h-full p-8 rounded-2xl bg-white border border-[hsl(0,0%,88%)] shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[hsl(0,0%,95%)] flex items-center justify-center">
                    <User className="w-5 h-5 text-[hsl(0,0%,40%)]" />
                  </div>
                  <h3 className="text-2xl font-bold text-[hsl(0,0%,10%)]">Solo</h3>
                </div>
                <p className="text-[hsl(0,0%,50%)] mb-6">Perfect for solo practitioners</p>
                <div className="mb-8">
                  <span className="text-5xl font-bold text-[hsl(0,0%,10%)]">£{getSoloPrice()}</span>
                  <span className="text-[hsl(0,0%,50%)] ml-2">/{billingPeriod === 'monthly' ? 'month' : 'year'}</span>
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
                      <Check className="w-5 h-5 text-[hsl(45,70%,40%)] flex-shrink-0" />
                      <span className="text-[hsl(0,0%,40%)]">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  onClick={handleLogin} 
                  variant="outline"
                  className="w-full h-12 border-[hsl(0,0%,80%)] text-[hsl(0,0%,25%)] hover:bg-[hsl(0,0%,95%)]" 
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
              <div className="relative h-full p-8 rounded-2xl bg-gradient-to-b from-[hsl(45,85%,55%)]/10 to-[hsl(45,85%,55%)]/5 border-2 border-[hsl(45,85%,55%)]/30 shadow-sm">
                <div className="absolute -top-3 right-8">
                  <span className="px-4 py-1.5 rounded-full bg-[hsl(45,85%,55%)] text-white text-sm font-medium shadow-sm">
                    Most Popular
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[hsl(45,85%,55%)]/20 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[hsl(45,70%,40%)]" />
                  </div>
                  <h3 className="text-2xl font-bold text-[hsl(0,0%,10%)]">Team</h3>
                </div>
                <p className="text-[hsl(0,0%,50%)] mb-6">For boutique law firms</p>
                <div className="mb-2">
                  <span className="text-5xl font-bold text-[hsl(0,0%,10%)]">£{getTeamPrice()}</span>
                  <span className="text-[hsl(0,0%,50%)] ml-2">/month base</span>
                </div>
                <p className="text-sm text-[hsl(0,0%,50%)] mb-6">+ £49/month per additional user</p>
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
                      <Check className="w-5 h-5 text-[hsl(45,70%,40%)] flex-shrink-0" />
                      <span className="text-[hsl(0,0%,40%)]">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  onClick={handleLogin} 
                  className="w-full h-12 bg-[hsl(45,85%,55%)] hover:bg-[hsl(45,85%,50%)] text-white font-medium" 
                  data-testid="button-team-signup"
                >
                  Begin Evaluation
                </Button>
              </div>
            </motion.div>
          </div>

          <p className="text-center text-sm text-[hsl(0,0%,50%)] mt-8">
            All prices exclude VAT. Cancel anytime during your evaluation period.
          </p>
        </div>
      </div>

      {/* Final CTA Section */}
      <div className="relative py-24 overflow-hidden bg-[hsl(0,0%,8%)]">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(45,85%,55%)]/10 via-transparent to-transparent" />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6 font-serif">
              Never have a file note gap again
            </h2>
            <p className="text-xl text-white/70 max-w-2xl mx-auto mb-10">
              Join solicitors across the UK who are creating contemporaneous, evidential attendance records with LegalNote.
            </p>
            <Button 
              onClick={handleLogin} 
              size="lg"
              className="bg-white text-[hsl(0,0%,8%)] hover:bg-white/90 text-lg px-10 h-14"
              data-testid="button-cta-signup"
            >
              Start Your Free Evaluation
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative bg-[hsl(0,0%,5%)] border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <div className="mb-4">
                <Logo variant="wordmark" size="lg" tone="dark" />
              </div>
              <p className="text-white/50 mb-6 max-w-sm leading-relaxed">
                A compliance-first attendance record system built for regulated UK legal practice. Contemporaneous records that evidence professional judgement.
              </p>
              <div className="flex items-center gap-3">
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
              <h4 className="font-semibold text-white mb-4">Product</h4>
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
