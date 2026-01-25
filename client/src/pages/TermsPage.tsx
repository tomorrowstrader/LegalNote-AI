import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import { ArrowLeft, Mail } from "lucide-react";
import { useEffect } from "react";

export default function TermsPage() {
  useEffect(() => {
    document.title = "Terms of Service - LegalNote AI";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'LegalNote AI Terms of Service. Read the terms and conditions governing your use of our legal documentation platform.');
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
    
    setOrCreateMeta('og:title', 'Terms of Service - LegalNote AI');
    setOrCreateMeta('og:description', 'Terms and conditions for using LegalNote AI legal documentation platform.');
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
          <h1 className="text-4xl font-medium text-[hsl(25,30%,12%)] mb-2" data-testid="heading-terms">
            Terms of Service
          </h1>
          <p className="text-[hsl(25,20%,45%)] mb-8">Last updated: January 2026</p>

          <div className="space-y-8 text-[hsl(25,20%,30%)]">
            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">1. Agreement to Terms</h2>
              <p className="leading-relaxed">
                By accessing or using LegalNote AI ("the Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you must not access or use the Platform. These Terms constitute a legally binding agreement between you and LegalNote AI.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">2. Description of Service</h2>
              <p className="leading-relaxed mb-4">
                LegalNote AI provides a compliance-first documentation platform designed for UK solicitors and legal professionals. The Platform enables:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Audio recording of client meetings with consent capture</li>
                <li>AI-powered transcription and document generation</li>
                <li>Creation of attendance notes, summaries, and action items</li>
                <li>Document management with comprehensive audit trails</li>
                <li>Secure sharing and collaboration features</li>
              </ul>
              <p className="leading-relaxed mt-4">
                <strong>Important:</strong> LegalNote AI is a documentation tool. It does not provide legal advice, legal analysis, or professional legal services. The Platform records, transcribes, and formats your own professional work.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">3. Eligibility and Registration</h2>
              <p className="leading-relaxed mb-4">
                To use the Platform, you must:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Be a qualified legal professional or work under the supervision of one</li>
                <li>Be at least 18 years of age</li>
                <li>Provide accurate and complete registration information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Accept responsibility for all activities under your account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">4. Subscription and Payment</h2>
              <p className="leading-relaxed mb-4">
                Access to the Platform requires a paid subscription. By subscribing, you agree to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Pay all applicable fees as described at the time of purchase</li>
                <li>Provide valid payment information and authorise recurring charges</li>
                <li>Accept that subscriptions automatically renew unless cancelled</li>
                <li>Cancel at least 30 days before renewal to avoid being charged for the next period</li>
              </ul>
              <p className="leading-relaxed mt-4">
                All fees are non-refundable except as required by law or as expressly stated in these Terms. Prices may change with 30 days' notice.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">5. Acceptable Use</h2>
              <p className="leading-relaxed mb-4">You agree not to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Use the Platform for any unlawful purpose or in violation of professional regulations</li>
                <li>Upload or transmit any content that infringes intellectual property rights</li>
                <li>Attempt to circumvent security measures or access unauthorised areas</li>
                <li>Interfere with the Platform's operation or other users' access</li>
                <li>Use automated systems to access the Platform without permission</li>
                <li>Reverse engineer, decompile, or disassemble any aspect of the Platform</li>
                <li>Share account credentials or allow unauthorised access to your account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">6. Your Content and Data</h2>
              <p className="leading-relaxed mb-4">
                You retain all ownership rights to content you upload or create using the Platform ("Your Content"). By using the Platform, you grant us a limited licence to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Store, process, and display Your Content as necessary to provide the service</li>
                <li>Create transcripts and documents from your audio recordings</li>
                <li>Maintain backup copies for service reliability</li>
              </ul>
              <p className="leading-relaxed mt-4">
                <strong>AI Training Prohibition:</strong> We guarantee that Your Content will never be used to train AI models. This commitment is contractually binding with all our AI service providers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">7. Client Consent</h2>
              <p className="leading-relaxed">
                You are solely responsible for obtaining appropriate consent from clients and other parties before recording meetings. The Platform provides consent capture tools, but compliance with applicable laws and professional regulations regarding recording consent remains your responsibility. LegalNote AI cannot verify that consent was properly obtained.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">8. Data Retention and Deletion</h2>
              <p className="leading-relaxed mb-4">
                Our data retention practices include:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Audio Files:</strong> Automatically and permanently deleted within 7 days of creation</li>
                <li><strong>Documents:</strong> Retained for the duration of your subscription</li>
                <li><strong>Account Data:</strong> Deleted within 90 days of account closure upon request</li>
                <li><strong>Audit Logs:</strong> Retained as required for regulatory compliance</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">9. Intellectual Property</h2>
              <p className="leading-relaxed">
                The Platform, including all software, features, design, and documentation, is owned by LegalNote AI and protected by intellectual property laws. These Terms do not grant you any rights to our trademarks, logos, or other proprietary materials except as expressly provided.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">10. Disclaimer of Warranties</h2>
              <p className="leading-relaxed">
                THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE. AI-GENERATED CONTENT MAY CONTAIN ERRORS AND SHOULD BE REVIEWED BY QUALIFIED PROFESSIONALS BEFORE USE.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">11. Limitation of Liability</h2>
              <p className="leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, LEGALNOTE AI SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE PLATFORM. OUR TOTAL LIABILITY SHALL NOT EXCEED THE FEES PAID BY YOU IN THE 12 MONTHS PRECEDING THE CLAIM.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">12. Indemnification</h2>
              <p className="leading-relaxed">
                You agree to indemnify and hold harmless LegalNote AI from any claims, damages, losses, or expenses arising from: (a) your use of the Platform; (b) your violation of these Terms; (c) your violation of any third-party rights; or (d) your failure to obtain proper consent for recordings.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">13. Termination</h2>
              <p className="leading-relaxed mb-4">
                We may suspend or terminate your access to the Platform:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>For violation of these Terms</li>
                <li>For non-payment of fees</li>
                <li>If required by law</li>
                <li>If we cease to offer the Platform</li>
              </ul>
              <p className="leading-relaxed mt-4">
                You may terminate your account at any time by contacting us. Upon termination, your right to use the Platform ceases immediately, though certain provisions of these Terms survive termination.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">14. Changes to Terms</h2>
              <p className="leading-relaxed">
                We may modify these Terms at any time. Material changes will be notified via email or prominent notice on the Platform at least 30 days before taking effect. Continued use of the Platform after changes become effective constitutes acceptance of the modified Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">15. Governing Law and Disputes</h2>
              <p className="leading-relaxed">
                These Terms are governed by the laws of England and Wales. Any disputes shall be resolved in the courts of England and Wales, unless mandatory consumer protection laws provide otherwise. Before initiating legal proceedings, you agree to attempt resolution through good-faith negotiation.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">16. General Provisions</h2>
              <p className="leading-relaxed mb-4">
                These Terms constitute the entire agreement between you and LegalNote AI regarding the Platform. If any provision is found unenforceable, the remaining provisions continue in effect. Our failure to enforce any right does not waive that right. You may not assign these Terms; we may assign them in connection with a merger or acquisition.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">17. Contact</h2>
              <p className="leading-relaxed">
                For questions about these Terms, please contact us at <a href="mailto:support@legalnote.ai" className="text-[hsl(18,65%,45%)] hover:underline">support@legalnote.ai</a>.
              </p>
            </section>
          </div>
        </motion.article>
      </main>

      <footer className="bg-[hsl(20,30%,10%)] border-t border-[hsl(20,25%,18%)]">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-white/40">
              © {new Date().getFullYear()} LegalNote. All rights reserved.
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
