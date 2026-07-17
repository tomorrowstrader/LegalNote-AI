import { motion } from "framer-motion";
import { Link } from "wouter";
import { SecondaryPageHeader } from "@/components/SecondaryPageHeader";
import { LegalPageFooter } from "@/components/LegalPageFooter";
import { useEffect } from "react";

const linkClass = "text-[hsl(18,65%,45%)] hover:underline";
const h3Class = "text-xl font-medium text-[hsl(25,30%,15%)] mb-3 mt-6";

export default function TermsPage() {
  useEffect(() => {
    document.title = "Terms of Service - LegalNote";

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        "LegalNote Terms of Service. Terms governing use of our legal documentation platform for UK solicitors."
      );
    }

    const setOrCreateMeta = (property: string, content: string) => {
      let meta = document.querySelector(`meta[property="${property}"]`);
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("property", property);
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    };

    setOrCreateMeta("og:title", "Terms of Service - LegalNote");
    setOrCreateMeta(
      "og:description",
      "Terms and conditions for using LegalNote."
    );
    setOrCreateMeta("og:type", "website");
    setOrCreateMeta("og:url", window.location.href);
    setOrCreateMeta("og:site_name", "LegalNote");
  }, []);

  return (
    <div className="min-h-screen bg-[hsl(30,25%,97%)] dark:bg-background">
      <SecondaryPageHeader />

      <main className="max-w-4xl mx-auto px-6 py-16">
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="prose prose-lg max-w-none"
        >
          <h1
            className="text-4xl font-medium text-[hsl(25,30%,12%)] mb-2"
            data-testid="heading-terms"
          >
            Terms of Service
          </h1>
          <p className="text-[hsl(25,20%,45%)] mb-8">Last updated: July 2026</p>

          <div className="space-y-8 text-[hsl(25,20%,30%)]">
            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                1. Introduction
              </h2>
              <p className="leading-relaxed mb-4">
                These Terms of Service ("Terms") govern your use of the LegalNote
                platform ("Service") provided by LegalNote Technologies Ltd
                ("LegalNote", "we", "us", "our"), a company registered in England
                and Wales (No. 16788981).
              </p>
              <p className="leading-relaxed mb-4">
                By accessing or using the Service, you agree to be bound by these
                Terms. If you do not agree, you may not use the Service.
              </p>
              <p className="leading-relaxed">
                <strong>Order of precedence.</strong> Where you and LegalNote
                have entered into a signed order form, evaluation agreement or
                other commercial agreement for the Service, that agreement
                prevails over these Terms to the extent of any conflict. These
                Terms, the{" "}
                <Link href="/privacy" className={linkClass}>
                  Privacy Policy
                </Link>
                , the{" "}
                <Link href="/cookies" className={linkClass}>
                  Cookie Policy
                </Link>{" "}
                and the Data Processing Agreement otherwise apply.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                2. Service description
              </h2>
              <p className="leading-relaxed mb-4">
                LegalNote is a compliance-first legal documentation platform that
                enables you to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  record client meetings with consent capture and sealing;
                </li>
                <li>
                  generate speaker-attributed transcripts using AI speech
                  recognition;
                </li>
                <li>
                  create attendance notes, summaries and related documentation
                  using AI (privileged generation runs on AWS Bedrock in an EU
                  configuration in production);
                </li>
                <li>maintain audit trails and consent evidence;</li>
                <li>
                  share documents securely with clients, including optional SMS
                  or password gates; and
                </li>
                <li>
                  optionally connect calendar, practice-management (Clio EU), and
                  Microsoft file-storage integrations.
                </li>
              </ul>
              <p className="leading-relaxed mt-4">
                <strong>Important.</strong> LegalNote is a documentation tool. It
                does not provide legal advice, legal analysis, or replace
                professional judgment. All AI-generated output requires solicitor
                review and approval before use, filing, or client communication.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                3. Eligibility
              </h2>
              <p className="leading-relaxed">
                The Service is intended for solicitors regulated by the
                Solicitors Regulation Authority, law firms and legal practices in
                the United Kingdom, and legal professionals in EU or EEA
                jurisdictions where use is lawful. You must be at least 18 years
                old and have authority to bind your firm to these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                4. Account registration and authentication
              </h2>
              <h3 className={h3Class}>4.1 Account creation</h3>
              <p className="leading-relaxed">
                You must provide accurate information when creating or
                maintaining an account.
              </p>
              <h3 className={h3Class}>4.2 Authentication</h3>
              <p className="leading-relaxed">
                Access is via Google and/or Microsoft OAuth and a server-managed
                session. You are responsible for securing the accounts and
                devices you use to authenticate.
              </p>
              <h3 className={h3Class}>4.3 Firm accounts</h3>
              <p className="leading-relaxed">
                If you register or administer an account on behalf of a firm, you
                represent that you have authority to bind the firm to these Terms
                and the DPA.
              </p>
              <h3 className={h3Class}>4.4 Account security</h3>
              <p className="leading-relaxed">
                Notify us promptly of any unauthorised access. We are not liable
                for losses arising from unauthorised use of your credentials or
                OAuth accounts, except to the extent caused by our own failure to
                take reasonable care or as otherwise required by law.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                5. Acceptable use
              </h2>
              <h3 className={h3Class}>5.1 You may</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>use the Service for legitimate legal documentation purposes;</li>
                <li>
                  record meetings where you have obtained appropriate consent;
                </li>
                <li>
                  generate, edit and export documents for your practice; and
                </li>
                <li>
                  share documents with clients via secure links where permitted.
                </li>
              </ul>
              <h3 className={h3Class}>5.2 You may not</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>use the Service for any unlawful purpose;</li>
                <li>
                  record individuals without the required knowledge and consent;
                </li>
                <li>attempt to access another user's or firm's data;</li>
                <li>
                  reverse engineer, decompile or circumvent security controls,
                  except where such restriction is prohibited by law;
                </li>
                <li>upload malware or attempt to compromise the Service;</li>
                <li>
                  resell or redistribute the Service without authorisation; or
                </li>
                <li>
                  present AI-generated content as reviewed professional work
                  without the review required by clause 7.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                6. Client consent and compliance
              </h2>
              <h3 className={h3Class}>6.1 Your responsibility</h3>
              <p className="leading-relaxed">
                You are solely responsible for obtaining valid consent before
                recording; complying with the UK GDPR, the Data Protection Act
                2018, SRA rules and other applicable law; ensuring recording is
                lawful in the relevant jurisdiction; and reviewing and approving
                all AI-generated documents before reliance or disclosure.
              </p>
              <h3 className={h3Class}>6.2 Consent features</h3>
              <p className="leading-relaxed">
                LegalNote provides tools to capture and seal consent, including
                hashing, signing and audit linkage, and preserves a consent
                evidence segment. These tools support, but do not replace, your
                professional obligations.
              </p>
              <h3 className={h3Class}>6.3 Processing gate</h3>
              <p className="leading-relaxed">
                AI processing of recordings is designed to require sealed
                consent. You must not attempt to bypass consent controls.
              </p>
              <h3 className={h3Class}>6.4 Professional compliance</h3>
              <p className="leading-relaxed">
                LegalNote is designed to support professional record-keeping. It
                does not guarantee regulatory compliance. You remain responsible
                for meeting your professional obligations.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                7. AI-generated content
              </h2>
              <h3 className={h3Class}>7.1 Nature of AI output</h3>
              <p className="leading-relaxed">
                Transcripts and documents may contain errors, omissions,
                misattributions or inaccuracies.
              </p>
              <h3 className={h3Class}>7.2 Solicitor review required</h3>
              <p className="leading-relaxed">
                All AI-generated documents must be reviewed and approved by a
                qualified solicitor before being used, sent to clients, filed or
                relied upon. No document is released to a client through the
                platform until a fee earner has adopted it.
              </p>
              <h3 className={h3Class}>7.3 No legal advice</h3>
              <p className="leading-relaxed">
                LegalNote does not provide legal advice. AI output is a drafting
                aid, not a substitute for professional judgment.
              </p>
              <h3 className={h3Class}>7.4 Accuracy limitations</h3>
              <p className="leading-relaxed">
                Transcription and generation quality depend on audio quality,
                accents, overlapping speech, terminology and other factors. We do
                not warrant that any output is complete or correct; our
                obligation is to produce it with reasonable skill and care.
              </p>
              <h3 className={h3Class}>
                7.5 No model training on your client content
              </h3>
              <p className="leading-relaxed">
                We do not use your client audio, transcripts or case content to
                train foundation models.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                8. Data protection
              </h2>
              <h3 className={h3Class}>8.1 Roles</h3>
              <p className="leading-relaxed">
                Your firm is the data controller for client and matter data
                processed through the Service. LegalNote is the data processor
                for that client and matter data, and the controller for account,
                billing and related business data as described in the{" "}
                <Link href="/privacy" className={linkClass}>
                  Privacy Policy
                </Link>
                .
              </p>
              <h3 className={h3Class}>8.2 Data Processing Agreement</h3>
              <p className="leading-relaxed">
                Use of the Service for client and matter data is subject to our
                Data Processing Agreement, which forms part of these Terms. Where
                a separately signed DPA exists between you and LegalNote, that
                signed DPA governs.
              </p>
              <h3 className={h3Class}>8.3 Privacy and cookies</h3>
              <p className="leading-relaxed">
                Our{" "}
                <Link href="/privacy" className={linkClass}>
                  Privacy Policy
                </Link>{" "}
                and{" "}
                <Link href="/cookies" className={linkClass}>
                  Cookie Policy
                </Link>{" "}
                explain how we collect and use data. By using the Service, you
                acknowledge you have read them.
              </p>
              <h3 className={h3Class}>8.4 Sub-processors</h3>
              <p className="leading-relaxed">
                You authorise LegalNote to engage sub-processors as listed in the{" "}
                <Link href="/sub-processors" className={linkClass}>
                  Sub-processor List
                </Link>
                , subject to the DPA notice process.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                9. Subscription and payment
              </h2>
              <h3 className={h3Class}>9.1 Plans</h3>
              <p className="leading-relaxed">
                The Service is offered on a subscription or agreed commercial
                basis. Current pricing is shown on our website, in-app, or in
                your order form.
              </p>
              <h3 className={h3Class}>9.2 Payment</h3>
              <p className="leading-relaxed">
                Fees are billed as stated for your plan, processed via Stripe,
                and exclusive of VAT unless stated otherwise.
              </p>
              <h3 className={h3Class}>9.3 Cancellation</h3>
              <p className="leading-relaxed">
                You may cancel in accordance with your plan. Cancellation takes
                effect at the end of the current billing period unless otherwise
                agreed. No refunds for partial periods unless required by law or
                expressly agreed.
              </p>
              <h3 className={h3Class}>9.4 Price changes</h3>
              <p className="leading-relaxed">
                We may change prices with reasonable notice, for example 30 days.
                Continued use after the effective date constitutes acceptance,
                unless you cancel before then.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                10. Intellectual property
              </h2>
              <h3 className={h3Class}>10.1 LegalNote IP</h3>
              <p className="leading-relaxed">
                The Service, including software, design, logos and documentation,
                is owned by LegalNote Technologies Ltd or its licensors.
              </p>
              <h3 className={h3Class}>10.2 Your content</h3>
              <p className="leading-relaxed">
                You, or your firm or clients as applicable, retain ownership of
                content you upload or create. You grant LegalNote a limited
                licence to process that content solely to provide the Service. To
                the extent any intellectual property right in a document produced
                from your matters vests in LegalNote, including under section
                9(3) of the Copyright, Designs and Patents Act 1988, we assign it
                to you and do not assert it.
              </p>
              <h3 className={h3Class}>10.3 Feedback</h3>
              <p className="leading-relaxed">
                If you provide feedback or suggestions, we may use them without
                obligation to you.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                11. Confidentiality
              </h2>
              <p className="leading-relaxed">
                We will treat client and matter data as confidential; access it
                only as needed to provide the Service, maintain security, comply
                with law, or as otherwise permitted under the DPA; maintain
                appropriate security measures; and not sell client or matter data
                for third-party marketing. Access to firm data by LegalNote
                personnel is logged for audit purposes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                12. Service availability
              </h2>
              <p className="leading-relaxed">
                We aim to provide reliable service but do not guarantee
                uninterrupted availability. Scheduled maintenance will be
                notified where reasonably possible. We may modify, suspend or
                discontinue features with reasonable notice, and will communicate
                material changes where practicable. If we identify a risk to the
                security or integrity of your data, we may suspend the Service or
                the affected part of it immediately, tell you why, and restore it
                as soon as it is safe to do so.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                13. Warranties and limitation of liability
              </h2>
              <h3 className={h3Class}>13.1 Service warranty</h3>
              <p className="leading-relaxed">
                We warrant that we will provide the Service with reasonable skill
                and care. Except for that warranty, and to the extent permitted
                by law, the Service is provided without further warranties,
                whether express or implied, including any implied warranty as to
                the accuracy or completeness of AI-generated output, which
                requires the solicitor review described in clause 7. Nothing in
                these Terms excludes or limits our liability for failing to
                provide the Service with reasonable skill and care.
              </p>
              <h3 className={h3Class}>13.2 Limitation</h3>
              <p className="leading-relaxed">
                To the maximum extent permitted by law, we are not liable for
                indirect, incidental, special, consequential or punitive damages.
                Subject to clause 13.3, and except where a signed order form or
                commercial agreement provides otherwise, our total liability
                arising out of or in connection with the Service in any 12-month
                period is limited to the greater of the fees you paid in that
                period and £50,000. We are not liable for regulatory action,
                professional complaints, or malpractice claims arising from your
                use of the Service or from reliance on AI output without the
                review required by clause 7.
              </p>
              <h3 className={h3Class}>13.3 Exceptions</h3>
              <p className="leading-relaxed">
                Nothing in these Terms limits liability for death or personal
                injury caused by negligence, for fraud or fraudulent
                misrepresentation, or for any liability that cannot be excluded
                or limited by law.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                14. Indemnification
              </h2>
              <p className="leading-relaxed">
                You agree to indemnify and hold harmless LegalNote and its
                officers, directors, employees and agents from third-party
                claims, damages or expenses arising from your breach of these
                Terms, your breach of your data protection or professional
                obligations, or a claim that content you upload infringes a third
                party's rights. This indemnity does not apply to the extent a
                claim arises from LegalNote's own breach of these Terms or its
                own negligence.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                15. Termination
              </h2>
              <h3 className={h3Class}>15.1 By you</h3>
              <p className="leading-relaxed">
                You may terminate by cancelling your subscription and/or
                contacting{" "}
                <a href="mailto:support@legalnote.ai" className={linkClass}>
                  support@legalnote.ai
                </a>
                .
              </p>
              <h3 className={h3Class}>15.2 By us</h3>
              <p className="leading-relaxed">
                We may suspend or terminate if you materially breach these Terms,
                fail to pay fees, or engage in conduct harmful to the Service or
                other users, giving notice and an opportunity to remedy where the
                breach is capable of remedy.
              </p>
              <h3 className={h3Class}>15.3 Effect</h3>
              <p className="leading-relaxed">
                On termination, access ceases. You may export your data within
                the period stated in the DPA and Privacy Policy. Remaining data
                is deleted or retained as described in those documents and
                applicable law.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                16. Dispute resolution
              </h2>
              <p className="leading-relaxed">
                These Terms are governed by the laws of England and Wales, and
                disputes are subject to the exclusive jurisdiction of the courts
                of England and Wales. Before commencing proceedings, please
                contact{" "}
                <a href="mailto:legal@legalnote.ai" className={linkClass}>
                  legal@legalnote.ai
                </a>{" "}
                to attempt informal resolution.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                17. General
              </h2>
              <p className="leading-relaxed">
                These Terms, together with the{" "}
                <Link href="/privacy" className={linkClass}>
                  Privacy Policy
                </Link>
                ,{" "}
                <Link href="/cookies" className={linkClass}>
                  Cookie Policy
                </Link>{" "}
                and DPA (and any signed order form or commercial agreement, which
                prevails on conflict), constitute the entire agreement between
                you and LegalNote regarding the Service. If any provision is
                unenforceable, the remainder continues in effect. Failure to
                enforce a right is not a waiver of it. You may not assign these
                Terms without our consent; we may assign to an affiliate or a
                successor to our business, and will notify you if we do.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                18. Contact
              </h2>
              <p className="leading-relaxed mb-4">
                Support:{" "}
                <a href="mailto:support@legalnote.ai" className={linkClass}>
                  support@legalnote.ai
                </a>
                . Legal:{" "}
                <a href="mailto:legal@legalnote.ai" className={linkClass}>
                  legal@legalnote.ai
                </a>
                .
              </p>
              <p className="leading-relaxed mb-4">
                LegalNote Technologies Ltd (No. 16788981), 71–75 Shelton Street,
                Covent Garden, London WC2H 9JQ, United Kingdom.
              </p>
              <p className="leading-relaxed text-sm italic">
                These Terms are governed by the laws of England and Wales and are
                not legal advice.
              </p>
            </section>
          </div>
        </motion.article>
      </main>

      <LegalPageFooter />
    </div>
  );
}
