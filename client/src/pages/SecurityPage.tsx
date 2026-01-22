import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import { 
  Shield, 
  Lock, 
  Server, 
  Eye, 
  FileCheck, 
  Users, 
  Database, 
  Key,
  CheckCircle,
  ChevronDown,
  Mail,
  Linkedin,
  ArrowLeft
} from "lucide-react";
import { useState, useEffect } from "react";

interface FAQItemProps {
  question: string;
  answer: string;
}

function FAQItem({ question, answer }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-[hsl(30,20%,88%)]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex items-center justify-between text-left"
        data-testid={`faq-toggle-${question.slice(0, 20).replace(/\s+/g, '-').toLowerCase()}`}
      >
        <span className="text-lg font-medium text-[hsl(25,30%,15%)] pr-8">{question}</span>
        <ChevronDown 
          className={`w-5 h-5 text-[hsl(25,20%,45%)] transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="pb-6"
        >
          <p className="text-[hsl(25,20%,40%)] leading-relaxed">{answer}</p>
        </motion.div>
      )}
    </div>
  );
}

export default function SecurityPage() {
  useEffect(() => {
    document.title = "Security - LegalNote AI | Enterprise-Grade Data Protection for UK Solicitors";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'LegalNote keeps your client data safe with world-class security and data privacy measures. UK data residency, GDPR compliance, encryption, and comprehensive audit trails.');
    }
    
    const setOrCreateMeta = (property: string, content: string) => {
      let meta = document.querySelector(`meta[property="${property}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('property', property);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };
    
    setOrCreateMeta('og:title', 'Security - LegalNote AI | Enterprise-Grade Data Protection');
    setOrCreateMeta('og:description', 'World-class security for UK legal practice. UK data residency, GDPR compliance, encryption, and comprehensive audit trails.');
    setOrCreateMeta('og:type', 'website');
    setOrCreateMeta('og:url', window.location.href);
    setOrCreateMeta('og:site_name', 'LegalNote AI');
    setOrCreateMeta('og:image', 'https://legalnote.ai/og-security.png');
  }, []);

  const securityFeatures = [
    {
      icon: Lock,
      title: "End-to-End Encryption",
      description: "All data is encrypted in transit using TLS 1.3 and at rest using AES-256 encryption. Your client communications remain confidential at every stage."
    },
    {
      icon: Server,
      title: "UK Data Residency",
      description: "All data is processed and stored exclusively in UK data centres. Your client information never leaves UK jurisdiction, ensuring compliance with domestic regulations."
    },
    {
      icon: Eye,
      title: "No AI Model Training",
      description: "We contractually guarantee that your data is never used to train AI models. Your confidential client information remains exactly that—confidential."
    },
    {
      icon: FileCheck,
      title: "Comprehensive Audit Trail",
      description: "Every action is logged with cryptographic signatures using HMAC-SHA256, creating tamper-evident records that stand up to regulatory scrutiny."
    },
    {
      icon: Users,
      title: "Role-Based Access Control",
      description: "Granular permissions ensure team members only access what they need. Admin controls, user management, and activity monitoring come as standard."
    },
    {
      icon: Database,
      title: "Automated Data Lifecycle",
      description: "GDPR-compliant data retention with configurable policies. Audio files auto-delete after your specified retention period while maintaining documentation."
    }
  ];

  const complianceStandards = [
    {
      name: "GDPR",
      description: "Full compliance with EU/UK General Data Protection Regulation",
      details: "https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/"
    },
    {
      name: "SRA Aligned",
      description: "Designed to support Solicitors Regulation Authority requirements",
      details: "https://www.sra.org.uk/solicitors/standards-regulations/"
    },
    {
      name: "ICO Registered",
      description: "Registered with the Information Commissioner's Office",
      details: "https://ico.org.uk/"
    },
    {
      name: "UK CYBER ESSENTIALS",
      description: "Government-backed scheme for cyber security best practices",
      details: "https://www.ncsc.gov.uk/cyberessentials/overview"
    }
  ];

  const faqs = [
    {
      question: "How does LegalNote protect my client data?",
      answer: "LegalNote employs multiple layers of protection: TLS 1.3 encryption for all data in transit, AES-256 encryption for data at rest, UK-only data residency, role-based access controls, and comprehensive audit logging with cryptographic signatures. We treat every piece of client information as privileged and confidential."
    },
    {
      question: "Where is my data stored and processed?",
      answer: "All data is stored and processed exclusively in UK data centres. We use Neon's UK region for database hosting and UK-based object storage for audio files. Your client data never leaves UK jurisdiction."
    },
    {
      question: "Does LegalNote use my data to train AI models?",
      answer: "Absolutely not. We contractually guarantee that your data is never used to train AI models. We use OpenAI and AssemblyAI for transcription and document generation, but with data processing agreements that prohibit any training on your data. Your confidential information remains yours alone."
    },
    {
      question: "How does the audit trail work?",
      answer: "Every significant action in LegalNote—document creation, sharing, viewing, editing—is logged with a timestamp, user identifier, and action details. Each log entry is signed with HMAC-SHA256, creating a tamper-evident chain of evidence. You can export the complete audit trail as CSV for regulatory submissions or internal review."
    },
    {
      question: "What happens to recordings after the retention period?",
      answer: "Audio recordings are automatically deleted after your configured retention period (default 7 days). Before deletion, transcripts and documents are preserved as the permanent record of the meeting. This approach balances storage efficiency with comprehensive documentation."
    },
    {
      question: "How does LegalNote handle client consent?",
      answer: "LegalNote includes a built-in consent capture workflow. Before any recording begins, you capture client consent with timestamp verification. This consent record is permanently linked to the case file and appears in the audit trail, providing defensible documentation of proper procedure."
    },
    {
      question: "Can I control who accesses what within my firm?",
      answer: "Yes. LegalNote provides role-based access control with user-level permissions. Administrators can manage team access, monitor activity, and control which users can perform specific actions. All access is logged and auditable."
    }
  ];

  return (
    <div className="min-h-screen bg-[hsl(30,25%,97%)]">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg shadow-sm border-b border-[hsl(30,20%,90%)]">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <Link href="/" data-testid="link-logo-home">
              <span className="cursor-pointer">
                <Logo variant="wordmark" size="xl" tone="light" />
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm"
                className="text-[hsl(25,25%,25%)] font-normal"
                data-testid="button-back-home"
                asChild
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

      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(30,30%,95%)] via-white to-[hsl(18,30%,95%)]" />
        <div className="relative max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(18,50%,92%)] text-[hsl(18,60%,35%)] text-sm font-medium mb-6"
              data-testid="badge-security-enterprise"
            >
              <Shield className="w-4 h-4" />
              Enterprise-Grade Security
            </div>
            <h1 
              className="text-4xl sm:text-5xl lg:text-6xl font-medium text-[hsl(25,30%,12%)] mb-6 leading-tight"
              data-testid="heading-security-hero"
            >
              For the Most{" "}
              <span className="text-[hsl(18,65%,45%)]">Sensitive Matters</span>
            </h1>
            <p className="text-xl text-[hsl(25,20%,40%)] mb-10 leading-relaxed" style={{ fontFamily: "'Lora', Georgia, serif" }}>
              LegalNote keeps your client data safe with world-class security and data privacy measures designed specifically for regulated UK legal practice.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                size="lg"
                className="bg-[hsl(18,70%,42%)] text-white font-medium"
                data-testid="button-security-request-access"
                asChild
              >
                <Link href="/#pricing">
                  Request Access
                </Link>
              </Button>
              <Button 
                variant="outline"
                size="lg"
                className="border-[hsl(30,20%,80%)] text-[hsl(25,25%,25%)]"
                data-testid="button-security-contact"
                asChild
              >
                <a href="mailto:security@legalnote.ai">
                  <Mail className="w-4 h-4 mr-2" />
                  Contact Security Team
                </a>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 
              className="text-3xl sm:text-4xl font-medium text-[hsl(25,30%,12%)] mb-4"
              data-testid="heading-security-protection"
            >
              Enterprise-Grade Protection
            </h2>
            <p className="text-lg text-[hsl(25,20%,40%)] max-w-2xl mx-auto">
              Built from the ground up with security as a foundation, not an afterthought.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {securityFeatures.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="p-6 rounded-xl bg-[hsl(30,25%,97%)] border border-[hsl(30,20%,90%)]"
              >
                <div className="w-12 h-12 rounded-lg bg-[hsl(18,50%,90%)] flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-[hsl(18,65%,40%)]" />
                </div>
                <h3 className="text-xl font-medium text-[hsl(25,30%,12%)] mb-2">{feature.title}</h3>
                <p className="text-[hsl(25,20%,40%)] leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-[hsl(30,25%,97%)]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 
              className="text-3xl sm:text-4xl font-medium text-[hsl(25,30%,12%)] mb-4"
              data-testid="heading-security-compliance"
            >
              Compliant with Industry Standards
            </h2>
            <p className="text-lg text-[hsl(25,20%,40%)] max-w-2xl mx-auto">
              Aligned with the regulatory frameworks that matter for UK legal practice.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {complianceStandards.map((standard, index) => (
              <motion.a
                key={standard.name}
                href={standard.details}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="group p-6 rounded-xl bg-white border border-[hsl(30,20%,88%)] hover-elevate transition-all text-center"
                data-testid={`link-compliance-${standard.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="w-16 h-16 rounded-full bg-[hsl(18,50%,92%)] flex items-center justify-center mx-auto mb-4">
                  <Key className="w-8 h-8 text-[hsl(18,65%,40%)]" />
                </div>
                <h3 className="text-lg font-semibold text-[hsl(25,30%,12%)] mb-2">{standard.name}</h3>
                <p className="text-sm text-[hsl(25,20%,45%)]">{standard.description}</p>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 
                className="text-3xl sm:text-4xl font-medium text-[hsl(25,30%,12%)] mb-6"
                data-testid="heading-security-fundamental"
              >
                Security is Fundamental to Everything We Do
              </h2>
              <p className="text-lg text-[hsl(25,20%,40%)] mb-8 leading-relaxed">
                We've built a comprehensive system that protects data at every level—from robust user authentication to vigilant activity monitoring. Our approach combines proven security technologies with rigorous protocols, ensuring that client information remains secure throughout its lifecycle.
              </p>
              <ul className="space-y-4">
                {[
                  "Session timeout with automatic logout after inactivity",
                  "Failed login tracking and suspicious activity detection",
                  "Secure share links with optional password and SMS 2FA",
                  "Input sanitization against XSS, SQL injection, and path traversal",
                  "Content Security Policy and security headers via Helmet",
                  "Rate limiting on authentication and sensitive endpoints"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[hsl(18,65%,45%)] flex-shrink-0 mt-0.5" />
                    <span className="text-[hsl(25,20%,35%)]">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="p-8 rounded-2xl bg-gradient-to-br from-[hsl(18,40%,92%)] to-[hsl(30,30%,95%)] border border-[hsl(30,20%,85%)]">
                <div className="text-center mb-6">
                  <Shield className="w-16 h-16 text-[hsl(18,65%,45%)] mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-[hsl(25,30%,12%)]">Black Box Protection</h3>
                </div>
                <p className="text-[hsl(25,20%,40%)] text-center mb-6">
                  Triple-layer redundancy ensures your documentation is protected against any single point of failure:
                </p>
                <div className="space-y-3">
                  {[
                    "Primary database with automated backups",
                    "Encrypted object storage for audio files",
                    "Cryptographically signed audit trail"
                  ].map((layer, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/60">
                      <div className="w-8 h-8 rounded-full bg-[hsl(18,60%,88%)] flex items-center justify-center text-sm font-medium text-[hsl(18,65%,40%)]">
                        {i + 1}
                      </div>
                      <span className="text-[hsl(25,20%,30%)] font-medium">{layer}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[hsl(30,25%,97%)]">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 
              className="text-3xl sm:text-4xl font-medium text-[hsl(25,30%,12%)] mb-4"
              data-testid="heading-security-faq"
            >
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-[hsl(25,20%,40%)]">
              Common questions about LegalNote's security practices.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-xl border border-[hsl(30,20%,88%)] overflow-hidden"
          >
            {faqs.map((faq, index) => (
              <FAQItem key={index} question={faq.question} answer={faq.answer} />
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-[hsl(20,30%,10%)]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 
              className="text-3xl sm:text-4xl font-medium text-white mb-6"
              data-testid="heading-security-questions"
            >
              Questions About Our Security?
            </h2>
            <p className="text-lg text-white/60 mb-10 max-w-2xl mx-auto">
              Our team is available to discuss your specific security and compliance requirements. We're happy to provide additional documentation for your due diligence process.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                size="lg"
                className="bg-white text-[hsl(20,30%,10%)] font-medium"
                data-testid="button-contact-security"
                asChild
              >
                <a href="mailto:security@legalnote.ai">
                  <Mail className="w-4 h-4 mr-2" />
                  security@legalnote.ai
                </a>
              </Button>
              <Button 
                variant="outline"
                size="lg"
                className="border-white/30 text-white"
                data-testid="button-security-cta"
                asChild
              >
                <Link href="/#pricing">
                  Request Access
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="relative bg-[hsl(20,30%,10%)] border-t border-[hsl(20,25%,18%)]">
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
                  <Link 
                    href="/#how-it-works"
                    className="text-white/50 hover:text-white transition-colors"
                    data-testid="link-footer-features"
                  >
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/#pricing"
                    className="text-white/50 hover:text-white transition-colors"
                    data-testid="link-footer-pricing"
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/security"
                    className="text-white/50 hover:text-white transition-colors"
                    data-testid="link-footer-security"
                  >
                    Security
                  </Link>
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
                    href="https://www.linkedin.com/company/legalnotehq/" 
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
