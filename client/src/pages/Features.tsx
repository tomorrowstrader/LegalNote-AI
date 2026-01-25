import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileCheck, ClipboardCheck, Scale, Calendar, FileText, ShieldCheck, ArrowLeft, Mic, Brain, FileOutput, Users, Lock, Search, Bell, AlertTriangle, PoundSterling, Link2, Database, Cloud, CalendarClock, Building2, Briefcase } from "lucide-react";
import { motion } from "framer-motion";
import Logo from "@/components/Logo";
import { SiMicrosoftoutlook } from "react-icons/si";
import { FcGoogle } from "react-icons/fc";

export default function Features() {
  const coreFeatures = [
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
      description: "Follow-ups surface automatically and sync to your calendar, remaining linked to the matter record so nothing falls through the cracks." 
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
  ];

  const workflowSteps = [
    { icon: Mic, title: "Record", description: "Capture client meetings with consent-first workflows. One click to start, automatic pause detection." },
    { icon: Brain, title: "Process", description: "AI transcription with speaker diarization, legal vocabulary recognition, and intelligent structuring." },
    { icon: FileOutput, title: "Document", description: "Professional attendance notes, summaries, and action items—ready for your review and sign-off." },
  ];

  const additionalFeatures = [
    { icon: Users, title: "Speaker Identification", description: "Automatically identify and label speakers throughout the meeting for clear attribution." },
    { icon: Lock, title: "Black Box Security", description: "Triple-layer redundancy ensures your records are protected and recoverable." },
    { icon: Search, title: "Full-Text Search", description: "Search across all your transcripts and documents to find exactly what was said." },
    { icon: Bell, title: "Smart Reminders", description: "Automatic follow-up reminders linked to action items extracted from meetings." },
  ];

  const practiceSafeguards = [
    { 
      icon: AlertTriangle, 
      title: "Scope Creep Detection", 
      description: "Flags when conversation moves outside the agreed matter scope. Helps prevent write-offs and protects against work done without proper instruction.",
      badge: "Coming Soon",
      example: "Client discussing employment dispute starts asking about property division—LegalNote surfaces a prompt before you document advice on an unrelated matter."
    },
    { 
      icon: PoundSterling, 
      title: "Cost Warning Prompts", 
      description: "Notifies when estimated billable time approaches the client's agreed budget. Prevents fee disputes before they arise.",
      badge: "Coming Soon",
      example: "As the meeting approaches the 1-hour mark on a fixed-fee matter, a gentle indicator appears so you can manage client expectations in real-time."
    },
  ];

  const integrations = [
    { 
      icon: Briefcase, 
      title: "Clio Manage", 
      description: "Import matters directly from Clio. Link LegalNote cases to your existing matters for seamless workflow.",
      logo: "clio"
    },
    { 
      icon: CalendarClock, 
      title: "Google Calendar", 
      description: "Bidirectional sync. Action items from meetings appear as calendar events. See upcoming client meetings in LegalNote.",
      logo: "google"
    },
    { 
      icon: CalendarClock, 
      title: "Outlook Calendar", 
      description: "Full Microsoft 365 integration. Meeting reminders, follow-up scheduling, and calendar sync.",
      logo: "outlook"
    },
    { 
      icon: Cloud, 
      title: "SharePoint / OneDrive", 
      description: "Automatic document sync to your firm's Microsoft cloud. Organised folder structure by client and matter.",
      logo: "microsoft"
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-[hsl(30,20%,90%)]">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <Link href="/" data-testid="link-features-logo">
              <Logo variant="wordmark" size="xl" tone="light" />
            </Link>
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost"
                size="sm"
                asChild
                className="text-[hsl(25,25%,25%)] hover:text-[hsl(18,65%,45%)]"
                data-testid="button-features-back"
              >
                <Link href="/">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative bg-white py-20">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            className="text-center max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-sm font-medium text-[hsl(18,65%,45%)] uppercase tracking-wider mb-4 block">
              Features
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-normal text-[hsl(25,30%,12%)] mb-6" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Built for how solicitors actually work
            </h1>
            <p className="text-xl text-[hsl(25,20%,40%)]" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Every feature designed around the reality of regulated legal practice—not retrofitted from generic note-taking software.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Workflow Section */}
      <div className="bg-[hsl(30,25%,94%)] py-20 border-y border-[hsl(30,20%,85%)]">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl font-normal text-[hsl(25,30%,12%)] mb-4" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Three steps to evidential records
            </h2>
            <p className="text-lg text-[hsl(25,20%,40%)]">
              From meeting to matter file in minutes, not hours.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {workflowSteps.map((step, index) => (
              <motion.div
                key={step.title}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="w-16 h-16 rounded-2xl bg-[hsl(18,65%,45%)] flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <step.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-medium text-[hsl(25,30%,12%)] mb-2">{step.title}</h3>
                <p className="text-[hsl(25,20%,40%)]">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Core Features Grid */}
      <div className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl font-normal text-[hsl(25,30%,12%)] mb-4" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Core capabilities
            </h2>
            <p className="text-lg text-[hsl(25,20%,40%)] max-w-2xl mx-auto">
              Decisions don't get lost. Actions don't drift. Everything linked to the matter record.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coreFeatures.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="p-8 rounded-xl bg-white border border-[hsl(30,20%,88%)] shadow-sm hover:shadow-md transition-shadow"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[hsl(18,55%,88%)] to-[hsl(18,60%,80%)] flex items-center justify-center mb-5">
                  <feature.icon className="w-7 h-7 text-[hsl(18,65%,42%)]" />
                </div>
                <h3 className="text-xl font-medium text-[hsl(25,30%,12%)] mb-3">{feature.title}</h3>
                <p className="text-[hsl(25,20%,40%)] leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Additional Features */}
      <div className="bg-[hsl(30,25%,96%)] py-20 border-t border-[hsl(30,20%,88%)]">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-normal text-[hsl(25,30%,12%)] mb-4" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              And more
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {additionalFeatures.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="p-6 rounded-xl bg-white border border-[hsl(30,20%,88%)]"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <feature.icon className="w-8 h-8 text-[hsl(18,65%,45%)] mb-4" />
                <h3 className="text-lg font-medium text-[hsl(25,30%,12%)] mb-2">{feature.title}</h3>
                <p className="text-sm text-[hsl(25,20%,45%)]">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Practice Safeguards */}
      <div className="py-20 bg-white" data-testid="section-practice-safeguards">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-sm font-medium text-[hsl(18,65%,45%)] uppercase tracking-wider mb-4 block">
              Practice Safeguards
            </span>
            <h2 className="text-3xl sm:text-4xl font-normal text-[hsl(25,30%,12%)] mb-4" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Protect your practice, protect your fees
            </h2>
            <p className="text-lg text-[hsl(25,20%,40%)] max-w-2xl mx-auto">
              Intelligent guardrails that surface during documentation—helping you catch issues before they become problems.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {practiceSafeguards.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="p-8 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                data-testid={`card-safeguard-${index}`}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="w-14 h-14 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <feature.icon className="w-7 h-7 text-amber-600" />
                  </div>
                  <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-xs">
                    {feature.badge}
                  </Badge>
                </div>
                <h3 className="text-xl font-medium text-[hsl(25,30%,12%)] mb-3">{feature.title}</h3>
                <p className="text-[hsl(25,20%,40%)] mb-4 leading-relaxed">{feature.description}</p>
                <div className="bg-white/60 rounded-lg p-4 border border-amber-200/50">
                  <p className="text-sm text-[hsl(25,20%,35%)] italic">
                    <span className="font-medium not-italic text-amber-700">Example: </span>
                    {feature.example}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Integrations */}
      <div className="py-20 bg-[hsl(30,25%,94%)] border-y border-[hsl(30,20%,85%)]" data-testid="section-integrations">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-sm font-medium text-[hsl(18,65%,45%)] uppercase tracking-wider mb-4 block">
              Integrations
            </span>
            <h2 className="text-3xl sm:text-4xl font-normal text-[hsl(25,30%,12%)] mb-4" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Works with your existing tools
            </h2>
            <p className="text-lg text-[hsl(25,20%,40%)] max-w-2xl mx-auto">
              Connect LegalNote to your practice management system, calendar, and cloud storage. No duplicate data entry.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {integrations.map((integration, index) => (
              <motion.div
                key={integration.title}
                className="p-6 rounded-xl bg-white border border-[hsl(30,20%,88%)] shadow-sm"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                data-testid={`card-integration-${index}`}
              >
                <div className="w-12 h-12 rounded-xl bg-[hsl(30,25%,96%)] flex items-center justify-center mb-4">
                  {integration.logo === "google" && <FcGoogle className="w-6 h-6" />}
                  {integration.logo === "outlook" && <SiMicrosoftoutlook className="w-6 h-6 text-[#0078D4]" />}
                  {integration.logo === "microsoft" && <Cloud className="w-6 h-6 text-[#0078D4]" />}
                  {integration.logo === "clio" && <Briefcase className="w-6 h-6 text-[hsl(18,65%,45%)]" />}
                </div>
                <h3 className="text-lg font-medium text-[hsl(25,30%,12%)] mb-2">{integration.title}</h3>
                <p className="text-sm text-[hsl(25,20%,45%)] leading-relaxed">{integration.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-[hsl(20,35%,18%)] py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl font-normal text-white mb-6" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Ready to see it in action?
            </h2>
            <p className="text-lg text-[hsl(30,30%,70%)] mb-8">
              Join solicitors across the UK and EU creating contemporaneous, evidential attendance records.
            </p>
            <Button 
              size="lg"
              className="bg-[hsl(18,70%,42%)] text-white"
              asChild
              data-testid="button-features-pricing"
            >
              <Link href="/#pricing">
                View Pricing
              </Link>
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[hsl(20,30%,10%)] border-t border-[hsl(20,25%,18%)] py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-white/40" data-testid="text-features-copyright">
              © {new Date().getFullYear()} LegalNote AI. All rights reserved.
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/privacy" className="text-white/50 hover:text-white transition-colors" data-testid="link-features-privacy">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-white/50 hover:text-white transition-colors" data-testid="link-features-terms">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
