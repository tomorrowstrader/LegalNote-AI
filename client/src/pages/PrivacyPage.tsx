import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import { ArrowLeft, Mail } from "lucide-react";
import { useEffect } from "react";

export default function PrivacyPage() {
  useEffect(() => {
    document.title = "Privacy Policy - LegalNote AI";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'LegalNote AI Privacy Policy. Learn how we collect, use, and protect your personal data in compliance with GDPR and UK data protection law.');
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
    
    setOrCreateMeta('og:title', 'Privacy Policy - LegalNote AI');
    setOrCreateMeta('og:description', 'How LegalNote AI collects, uses, and protects your personal data.');
    setOrCreateMeta('og:type', 'website');
    setOrCreateMeta('og:url', window.location.href);
    setOrCreateMeta('og:site_name', 'LegalNote AI');
  }, []);

  return (
    <div className="min-h-screen bg-[hsl(30,25%,97%)]">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg shadow-sm border-b border-[hsl(30,20%,90%)]">
        <div className="max-w-7xl mx-auto px-6 py-4">
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

      <main className="max-w-4xl mx-auto px-6 py-16">
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="prose prose-lg max-w-none"
        >
          <h1 className="text-4xl font-medium text-[hsl(25,30%,12%)] mb-2" data-testid="heading-privacy">
            Privacy Policy
          </h1>
          <p className="text-[hsl(25,20%,45%)] mb-8">Last updated: January 2026</p>

          <div className="space-y-8 text-[hsl(25,20%,30%)]">
            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">1. Introduction</h2>
              <p className="leading-relaxed mb-4">
                LegalNote AI ("we", "our", "us") is committed to protecting and respecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our legal documentation platform.
              </p>
              <p className="leading-relaxed">
                We are registered with the Information Commissioner's Office (ICO) and comply with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">2. Data Controller</h2>
              <p className="leading-relaxed">
                LegalNote AI is the data controller responsible for your personal data. For any questions about this policy or our data practices, contact us at <a href="mailto:support@legalnote.ai" className="text-[hsl(18,65%,45%)] hover:underline">support@legalnote.ai</a>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">3. Information We Collect</h2>
              <p className="leading-relaxed mb-4">We collect the following categories of personal data:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Account Information:</strong> Name, email address, firm details, and professional credentials when you register.</li>
                <li><strong>Usage Data:</strong> Information about how you use our platform, including access times, pages viewed, and features used.</li>
                <li><strong>Audio Recordings:</strong> Meeting recordings you create using our platform, which are processed for transcription and then deleted within 7 days.</li>
                <li><strong>Document Data:</strong> Transcripts, attendance notes, summaries, and other documents generated through the platform.</li>
                <li><strong>Technical Data:</strong> IP address, browser type, device information, and cookies for platform functionality.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">4. How We Use Your Information</h2>
              <p className="leading-relaxed mb-4">We process your personal data for the following purposes:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>To provide and maintain our legal documentation services</li>
                <li>To process audio recordings and generate transcripts and documents</li>
                <li>To authenticate your identity and secure your account</li>
                <li>To communicate with you about your account and our services</li>
                <li>To comply with legal obligations, including maintaining audit trails</li>
                <li>To improve our platform and develop new features</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">5. Legal Basis for Processing</h2>
              <p className="leading-relaxed mb-4">We process your personal data under the following legal bases:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Contract:</strong> Processing necessary to perform our contract with you.</li>
                <li><strong>Legal Obligation:</strong> Processing required to comply with applicable laws.</li>
                <li><strong>Legitimate Interests:</strong> Processing for our legitimate business interests, such as improving our services, provided these do not override your rights.</li>
                <li><strong>Consent:</strong> Where you have given explicit consent for specific processing activities.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">6. Data Retention</h2>
              <p className="leading-relaxed mb-4">
                We apply the principle of data minimisation and retain personal data only as long as necessary:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Audio Recordings:</strong> Automatically deleted within 7 days of creation.</li>
                <li><strong>Documents and Transcripts:</strong> Retained for the duration of your subscription plus a reasonable period thereafter.</li>
                <li><strong>Audit Logs:</strong> Retained for 7 years to support regulatory compliance.</li>
                <li><strong>Account Information:</strong> Retained while your account is active and for a reasonable period after closure.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">7. Data Location and Security</h2>
              <p className="leading-relaxed mb-4">
                All personal data is processed and stored exclusively within the UK/EU. Your data never leaves UK/EU jurisdiction, ensuring full GDPR compliance.
              </p>
              <p className="leading-relaxed">
                We implement appropriate technical and organisational measures to protect your personal data, including encryption in transit (TLS 1.3) and at rest (AES-256), access controls, and regular security assessments.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">8. Third-Party Processors</h2>
              <p className="leading-relaxed mb-4">
                We use carefully selected third-party processors to provide our services. All processors are bound by data processing agreements that prohibit the use of your data for any purpose other than providing services to us:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Transcription services (with contractual guarantees against AI training)</li>
                <li>Cloud infrastructure providers (UK/EU-based data centres)</li>
                <li>Email communication services</li>
                <li>Payment processors</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">9. Your Rights</h2>
              <p className="leading-relaxed mb-4">Under UK GDPR, you have the following rights:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Access:</strong> Request a copy of your personal data.</li>
                <li><strong>Rectification:</strong> Request correction of inaccurate data.</li>
                <li><strong>Erasure:</strong> Request deletion of your data in certain circumstances.</li>
                <li><strong>Restriction:</strong> Request limitation of processing in certain circumstances.</li>
                <li><strong>Portability:</strong> Request transfer of your data in a machine-readable format.</li>
                <li><strong>Objection:</strong> Object to processing based on legitimate interests.</li>
              </ul>
              <p className="leading-relaxed mt-4">
                To exercise these rights, contact us at <a href="mailto:support@legalnote.ai" className="text-[hsl(18,65%,45%)] hover:underline">support@legalnote.ai</a>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">10. Cookies</h2>
              <p className="leading-relaxed">
                We use essential cookies required for platform functionality and authentication. We do not use advertising or tracking cookies. Session cookies expire when you close your browser; persistent cookies are used only for authentication purposes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">11. Changes to This Policy</h2>
              <p className="leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date. We encourage you to review this policy periodically.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">12. Contact and Complaints</h2>
              <p className="leading-relaxed mb-4">
                For any questions or concerns about this Privacy Policy or our data practices, please contact us at <a href="mailto:support@legalnote.ai" className="text-[hsl(18,65%,45%)] hover:underline">support@legalnote.ai</a>.
              </p>
              <p className="leading-relaxed">
                You have the right to lodge a complaint with the Information Commissioner's Office (ICO) if you believe your data protection rights have been infringed. Visit <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer" className="text-[hsl(18,65%,45%)] hover:underline">ico.org.uk</a> for more information.
              </p>
            </section>
          </div>
        </motion.article>
      </main>

      <footer className="bg-[hsl(20,30%,10%)] border-t border-[hsl(20,25%,18%)]">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-white/40">
              © {new Date().getFullYear()} LegalNote AI. All rights reserved.
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link 
                href="/privacy"
                className="text-white/50 hover:text-white transition-colors"
                data-testid="link-footer-privacy"
              >
                Privacy Policy
              </Link>
              <Link 
                href="/terms"
                className="text-white/50 hover:text-white transition-colors"
                data-testid="link-footer-terms"
              >
                Terms of Service
              </Link>
              <a 
                href="mailto:support@legalnote.ai"
                className="flex items-center gap-2 text-white/50 hover:text-white transition-colors"
                data-testid="link-footer-contact"
              >
                <Mail className="w-4 h-4" />
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
