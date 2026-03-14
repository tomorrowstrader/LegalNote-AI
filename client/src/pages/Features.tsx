import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileCheck, ClipboardCheck, Scale, Calendar, FileText, ShieldCheck, ArrowLeft, Mic, Brain, FileOutput, Users, Lock, Search, Bell, AlertTriangle, PoundSterling, Cloud, CalendarClock, Briefcase, Lightbulb, Focus, ListChecks, FolderOpen, CalendarCheck } from "lucide-react";
import { motion } from "framer-motion";
import Logo from "@/components/Logo";
import { LeadMagnetForm } from "@/components/LeadMagnetForm";
import { SecondaryPageHeader } from "@/components/SecondaryPageHeader";
import { useState, useRef, useEffect } from "react";

export default function Features() {
  const [, setLocation] = useLocation();
  const [showLeadMagnetForm, setShowLeadMagnetForm] = useState(false);
  const [showFloatingCTA, setShowFloatingCTA] = useState(false);
  
  const coreCapabilitiesRef = useRef<HTMLElement>(null);
  const readyToSeeRef = useRef<HTMLDivElement>(null);

  const handleViewPricing = () => {
    setLocation("/");
    setTimeout(() => {
      document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleRequestAccess = () => {
    setShowLeadMagnetForm(true);
  };

  useEffect(() => {
    const handleScroll = () => {
      if (coreCapabilitiesRef.current && readyToSeeRef.current) {
        const y = window.scrollY + window.innerHeight / 2;
        const coreTop = coreCapabilitiesRef.current.offsetTop;
        const readyTop = readyToSeeRef.current.offsetTop - 100;
        setShowFloatingCTA(y >= coreTop && y < readyTop);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const coreFeatures = [
    { 
      icon: FileCheck, 
      title: "Contemporaneous Records", 
      description: "Attendance records formed at source, not days later. Timestamped and evidential, aligned with SRA expectations for detailed, contemporaneous file notes." 
    },
    { 
      icon: ClipboardCheck, 
      title: "Consent-First Capture", 
      description: "Workflows make it straightforward to explain, obtain, and record client consent to recording, meeting expectations of confidentiality and transparency." 
    },
    { 
      icon: Scale, 
      title: "Professional Control", 
      description: "LegalNote proposes structure and content; the practitioner exercises judgement and signs off the attendance record. Professional control at every step." 
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
    { icon: Brain, title: "Process", description: "Transcription with speaker diarization, legal vocabulary recognition, and structured formatting." },
    { icon: FileOutput, title: "Document", description: "Attendance notes, matter record and obligations log. Ready for your review and sign-off." },
  ];

  const additionalFeatures = [
    { icon: Users, title: "Speaker Identification", description: "Automatically identify and label speakers throughout the meeting for clear attribution." },
    { icon: Lock, title: "Black Box Security", description: "Triple-layer redundancy ensures your records are protected and recoverable." },
    { icon: Search, title: "Matter-Wide Search", description: "Find anything across transcripts, attendance notes, matter records and obligations. From a single search bar. No more hunting through paper notes, emails, and Word documents." },
    { icon: Bell, title: "Smart Reminders", description: "Automatic follow-up reminders linked to obligations extracted from the meeting record." },
  ];

  const practiceSafeguards = [
    { 
      icon: AlertTriangle, 
      title: "Scope Creep Detection", 
      description: "During your post-meeting review, flags when conversation moved outside the agreed matter scope. Helps prevent write-offs and protects against documenting advice given without proper instruction.",
      badge: "Coming Soon",
      example: "Before you sign off on the attendance note, LegalNote highlights: 'This conversation touched on property matters, but this case is filed under Employment Law. Review before finalising.'"
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
      description: "Bidirectional sync. Obligations from meetings appear as calendar events. See upcoming client meetings in LegalNote.",
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

  const neuroInclusiveFeatures = [
    {
      icon: Focus,
      title: "Zero Note-Taking During Meetings",
      description: "The solicitor is fully present. No divided attention, no scrambling to write while listening. LegalNote captures everything, so cognitive bandwidth stays on the client.",
      differentiator: "Generic meeting apps record audio. LegalNote removes the documentation burden entirely. The output is already in the format your firm and the SRA expect."
    },
    {
      icon: FileCheck,
      title: "SRA-Formatted Attendance Notes",
      description: "LegalNote produces structured attendance notes aligned to regulatory expectations. No reformatting, no reorganising, no second pass.",
      differentiator: "Tools like Otter and Fireflies generate generic summaries. LegalNote produces the specific document your file actually needs, eliminating the executive function step of restructuring output."
    },
    {
      icon: ShieldCheck,
      title: "Automated Consent Documentation",
      description: "GDPR-compliant consent is captured and logged before the meeting begins. One fewer procedural step to remember under pressure.",
      differentiator: "Forgetting consent isn't just embarrassing. It's a regulatory breach. No generic meeting app handles this. LegalNote makes it automatic."
    },
    {
      icon: ListChecks,
      title: "Obligations Extracted and Diarised",
      description: "Obligations are identified in the transcript, linked to the matter, and synced to your calendar for approval. Nothing falls through.",
      differentiator: "Generic apps may list action items. LegalNote integrates obligations into a legal workflow with deadlines, matter linking, and calendar sync, closing the loop automatically."
    },
    {
      icon: FolderOpen,
      title: "Matter-Linked Organisation",
      description: "Every transcript, attendance note, matter record and obligation is connected to its case. No flat file lists, no hunting across folders.",
      differentiator: "When juggling multiple matters, this structure mirrors how a solicitor's workflow needs to operate, compensating for the organisational overhead that affects neurodivergent practitioners most."
    },
    {
      icon: Lock,
      title: "Tamper-Evident Audit Trail",
      description: "Cryptographic signatures prove proper process was followed. If someone later questions whether the right steps were taken, the record speaks for itself.",
      differentiator: "This protects neurodivergent solicitors disproportionately, removing the anxiety of 'did I follow the right process?' with verifiable, timestamped evidence."
    },
  ];

  const neuroInclusiveRoadmap = [
    {
      icon: Lightbulb,
      title: "Meeting Preparation Prompts",
      description: "Before a scheduled meeting, LegalNote surfaces the last attendance note, outstanding actions, and key client details for that matter. A 30-second context refresh between back-to-back meetings.",
      badge: "Coming Soon"
    },
    {
      icon: CalendarCheck,
      title: "Cognitive Load Dashboard",
      description: "A personal view showing open actions across all matters, cases that haven't been touched recently, and upcoming deadlines. One screen replacing the mental juggling that causes things to fall through cracks.",
      badge: "Coming Soon"
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-background">
      <SecondaryPageHeader />

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
              Every feature designed around the reality of regulated legal practice. Not retrofitted from generic note-taking software.
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
      <section ref={coreCapabilitiesRef} className="py-20">
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
      </section>

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

      {/* Neuro-Inclusive Practice */}
      <div className="py-20 bg-white" data-testid="section-neuro-inclusive">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-sm font-medium text-[hsl(18,65%,45%)] uppercase tracking-wider mb-4 block">
              Neuro-Inclusive Practice
            </span>
            <h2 className="text-3xl sm:text-4xl font-normal text-[hsl(25,30%,12%)] mb-4" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              Reducing cognitive load by design
            </h2>
            <p className="text-lg text-[hsl(25,20%,40%)] max-w-3xl mx-auto mb-3">
              Every feature in LegalNote removes a step your brain would otherwise have to manage. For neurodivergent solicitors, including those with ADHD, dyslexia, and autism, this isn't a convenience. It's a reasonable adjustment.
            </p>
            <p className="text-base text-[hsl(25,15%,50%)] max-w-2xl mx-auto">
              These aren't additional features. They're existing capabilities viewed through the lens of the Equality Act 2010 and the SRA's guidance on reasonable adjustments.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {neuroInclusiveFeatures.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="p-6 rounded-xl bg-gradient-to-br from-[hsl(210,30%,97%)] to-[hsl(210,20%,95%)] border border-[hsl(210,20%,88%)]"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                data-testid={`card-neuro-inclusive-${index}`}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(210,40%,90%)] to-[hsl(210,35%,85%)] flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-[hsl(210,50%,40%)]" />
                </div>
                <h3 className="text-lg font-medium text-[hsl(25,30%,12%)] mb-2">{feature.title}</h3>
                <p className="text-sm text-[hsl(25,20%,40%)] mb-3 leading-relaxed">{feature.description}</p>
                <div className="bg-white/70 rounded-lg p-3 border border-[hsl(210,20%,90%)]">
                  <p className="text-xs text-[hsl(210,30%,35%)] leading-relaxed">
                    <span className="font-semibold text-[hsl(210,50%,40%)]">Why this matters: </span>
                    {feature.differentiator}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div 
            className="text-center mb-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="text-2xl font-normal text-[hsl(25,30%,12%)] mb-2" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              On the roadmap
            </h3>
            <p className="text-base text-[hsl(25,20%,40%)]">
              Purpose-built features designed specifically to reduce cognitive overhead further.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-12">
            {neuroInclusiveRoadmap.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="p-6 rounded-xl bg-gradient-to-br from-[hsl(210,25%,96%)] to-white border border-dashed border-[hsl(210,20%,82%)]"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                data-testid={`card-neuro-roadmap-${index}`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-[hsl(210,35%,90%)] flex items-center justify-center shrink-0">
                    <feature.icon className="w-5 h-5 text-[hsl(210,50%,45%)]" />
                  </div>
                  <Badge variant="outline" className="bg-[hsl(210,30%,94%)] text-[hsl(210,50%,40%)] border-[hsl(210,25%,82%)] text-xs" data-testid={`badge-neuro-roadmap-${index}`}>
                    {feature.badge}
                  </Badge>
                </div>
                <h3 className="text-lg font-medium text-[hsl(25,30%,12%)] mb-2">{feature.title}</h3>
                <p className="text-sm text-[hsl(25,20%,40%)] leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="text-center bg-[hsl(210,25%,96%)] rounded-xl p-8 border border-[hsl(210,20%,88%)] max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            data-testid="card-neuro-inclusive-summary"
          >
            <p className="text-lg text-[hsl(25,25%,25%)] leading-relaxed" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              "The real differentiator isn't a single feature. It's the combination within a legal-specific context. No generic meeting app produces SRA-compliant attendance notes, logs consent, creates an audit trail, extracts obligations into a matter-linked calendar, and tracks document versions. All without the solicitor lifting a pen."
            </p>
            <p className="text-sm text-[hsl(25,15%,50%)] mt-4">
              That combination is the reasonable adjustment.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Practice Safeguards */}
      <div className="py-20 bg-[hsl(30,25%,96%)]" data-testid="section-practice-safeguards">
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
              Intelligent guardrails that surface during documentation, helping you catch issues before they become problems.
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
                  <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-xs" data-testid={`badge-safeguard-status-${index}`}>
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
                <div className="w-12 h-12 rounded-xl bg-[hsl(30,25%,96%)] flex items-center justify-center mb-4" data-testid={`icon-integration-${index}`}>
                  {integration.logo === "google" && <Calendar className="w-6 h-6 text-[#4285F4]" />}
                  {integration.logo === "outlook" && <CalendarClock className="w-6 h-6 text-[#0078D4]" />}
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
      <div ref={readyToSeeRef} className="bg-[hsl(20,35%,18%)] py-20">
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
              onClick={handleViewPricing}
              data-testid="button-features-pricing"
            >
              View Pricing
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[hsl(20,30%,10%)] border-t border-[hsl(20,25%,18%)] py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-white/40" data-testid="text-features-copyright">
              © {new Date().getFullYear()} LegalNote. All rights reserved.
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

      {/* Floating CTA - Fixed at bottom on mobile */}
      <motion.div 
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden"
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: showFloatingCTA ? 1 : 0, 
          pointerEvents: showFloatingCTA ? 'auto' : 'none' 
        }}
        transition={{ duration: 0.3 }}
      >
        <Button 
          onClick={handleRequestAccess}
          size="lg"
          className="bg-[hsl(18,70%,42%)] text-white rounded-full shadow-2xl"
          data-testid="button-features-floating-cta"
        >
          Request Early Access
        </Button>
      </motion.div>

      <LeadMagnetForm
        open={showLeadMagnetForm}
        onOpenChange={setShowLeadMagnetForm}
      />
    </div>
  );
}
