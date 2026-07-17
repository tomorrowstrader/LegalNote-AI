import { motion } from "framer-motion";
import { Link } from "wouter";
import { SecondaryPageHeader } from "@/components/SecondaryPageHeader";
import { LegalPageFooter, LegalTable } from "@/components/LegalPageFooter";
import { useEffect } from "react";

const linkClass = "text-[hsl(18,65%,45%)] hover:underline";
const h3Class = "text-xl font-medium text-[hsl(25,30%,15%)] mb-3 mt-6";

export default function PrivacyPage() {
  useEffect(() => {
    document.title = "Privacy Policy - LegalNote";

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        "LegalNote Privacy Policy. How we collect, use, and protect personal data under UK GDPR, including UK/EU privileged processing controls."
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

    setOrCreateMeta("og:title", "Privacy Policy - LegalNote");
    setOrCreateMeta(
      "og:description",
      "How LegalNote collects, uses, and protects personal data."
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
            data-testid="heading-privacy"
          >
            Privacy Policy
          </h1>
          <p className="text-[hsl(25,20%,45%)] mb-2">Last updated: July 2026</p>
          <p className="text-sm text-[hsl(25,20%,45%)] mb-1">
            LegalNote Technologies Ltd (registered in England and Wales, No.
            16788981; ICO Reg. ZC176177)
          </p>
          <p className="text-sm text-[hsl(25,20%,45%)] mb-8">
            Registered address: 71–75 Shelton Street, Covent Garden, London WC2H
            9JQ
          </p>

          <div className="space-y-8 text-[hsl(25,20%,30%)]">
            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                1. Introduction
              </h2>
              <p className="leading-relaxed mb-4">
                LegalNote Technologies Ltd ("LegalNote", "we", "us", "our") is
                committed to protecting the privacy of our users and their
                clients. This Privacy Policy explains how we collect, use, store
                and protect personal data when you use our legal documentation
                platform at legalnote.ai.
              </p>
              <p className="leading-relaxed">
                LegalNote is a compliance-first documentation tool designed for
                UK solicitors and law firms. It records meetings with consent,
                transcribes them, and generates attendance notes and related
                documents for solicitor review. It does not provide legal advice.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                2. Data controller and processor roles
              </h2>
              <LegalTable
                headers={["Role", "Entity", "Responsibility"]}
                rows={[
                  [
                    "Controller (account and billing data)",
                    "LegalNote Technologies Ltd",
                    "Determines the purposes and means of processing for user account, authentication, billing, and website and enquiry data.",
                  ],
                  [
                    "Controller (client and matter data)",
                    "Your law firm",
                    "Determines the purposes and means of processing client and matter data.",
                  ],
                  [
                    "Processor (client and matter data)",
                    "LegalNote Technologies Ltd",
                    "Processes recordings, transcripts, documents, consent and audit data on behalf of your firm under our Data Processing Agreement.",
                  ],
                  [
                    "Sub-processors",
                    <>
                      See section 9 and the{" "}
                      <Link href="/sub-processors" className={linkClass}>
                        Sub-processor List
                      </Link>
                    </>,
                    "Third parties we engage to deliver the service.",
                  ],
                ]}
              />
              <p className="leading-relaxed mt-4">
                If you are a client of a law firm using LegalNote, please contact
                your solicitor for privacy requests about your matter data. Your
                solicitor is the controller for that data; we act only as
                processor on their instructions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                3. Personal data we collect
              </h2>
              <h3 className={h3Class}>
                3.1 Account data (solicitor and firm users) — LegalNote as
                controller
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Name, email address, firm name and branding preferences.
                </li>
                <li>
                  Authentication identity from Google or Microsoft sign-in (we
                  do not store your Google or Microsoft passwords).
                </li>
                <li>
                  Session and usage data necessary to operate the service.
                </li>
                <li>
                  Billing contact details and payment tokens processed via Stripe
                  (we do not store full card numbers).
                </li>
              </ul>

              <h3 className={h3Class}>
                3.2 Client and matter data — LegalNote as processor
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Audio recordings of meetings (browser recording and, where
                  used, meeting-bot imports).
                </li>
                <li>Transcripts generated from recordings.</li>
                <li>
                  Client names, matter references, case details and related
                  document content.
                </li>
                <li>
                  Sealed consent records (content hash, signature, timestamps and
                  related audit linkage).
                </li>
                <li>
                  Generated documents, for example attendance notes, summaries
                  and client-facing drafts.
                </li>
                <li>
                  Optional integration data you connect, for example calendar
                  events, Clio matters, or SharePoint and OneDrive files.
                </li>
              </ul>

              <h3 className={h3Class}>3.3 Technical data</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  IP address, browser and device information, and security logs.
                </li>
                <li>
                  Cookies and similar technologies (see our{" "}
                  <Link href="/cookies" className={linkClass}>
                    Cookie Policy
                  </Link>
                  ).
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                4. How we use personal data, and the legal basis
              </h2>
              <p className="leading-relaxed mb-4">
                For the account, billing and website data for which LegalNote is
                the controller, our legal bases under the UK GDPR are as follows:
              </p>
              <LegalTable
                headers={[
                  "Purpose",
                  "Legal basis (LegalNote as controller)",
                ]}
                rows={[
                  [
                    "Provide and secure the service",
                    "Contract performance, Art. 6(1)(b)",
                  ],
                  [
                    "Authenticate users (Google or Microsoft OAuth and session)",
                    "Contract performance, Art. 6(1)(b)",
                  ],
                  [
                    "Billing and subscription administration",
                    "Contract performance, Art. 6(1)(b)",
                  ],
                  [
                    "Service communications (account, security, product notices)",
                    "Legitimate interests, Art. 6(1)(f)",
                  ],
                  [
                    "Marketing, where applicable",
                    "Consent, Art. 6(1)(a)",
                  ],
                ]}
              />
              <p className="leading-relaxed mt-4 mb-4">
                For client and matter data, LegalNote acts as processor. We
                process that data only on the documented instructions of your
                firm under Article 28 of the UK GDPR. Your firm, as controller,
                determines the lawful basis under Article 6 (and, where special
                category or criminal offence data is involved, the condition
                under Articles 9 and 10 and the Data Protection Act 2018). We do
                not determine the purposes of processing matter data, and we do
                not rely on a legal basis of our own for it.
              </p>
              <p className="leading-relaxed">
                We do not use client audio, transcripts, or case content to train
                foundation models. Privileged client content is processed solely
                to deliver the service you requested.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                5. Data storage, processing locations and security
              </h2>
              <h3 className={h3Class}>
                5.1 Processing locations (aligned with production controls)
              </h3>
              <p className="leading-relaxed mb-4">
                Production configuration keeps the following privileged
                processing within the United Kingdom or the European Economic
                Area:
              </p>
              <LegalTable
                headers={["Activity", "Provider", "Location in production"]}
                rows={[
                  [
                    "Object storage (audio)",
                    "Backblaze B2",
                    "EU Central (Amsterdam); EU endpoint enforced",
                  ],
                  [
                    "Speech to text",
                    "AssemblyAI",
                    "EU endpoint (api.eu.assemblyai.com), Dublin",
                  ],
                  [
                    "Privileged document and note generation",
                    "AWS Bedrock (Anthropic Claude, EU inference profile)",
                    "UK/EU regions only; global cross-region routing disabled",
                  ],
                  [
                    "Database",
                    "Neon (PostgreSQL, on AWS)",
                    "AWS eu-west-2 (London)",
                  ],
                  [
                    "Application hosting",
                    "Railway",
                    "EU-West (Amsterdam)",
                  ],
                  [
                    "Transactional email",
                    "AWS SES",
                    "AWS eu-west-2 (London)",
                  ],
                ]}
              />

              <h3 className={h3Class}>
                5.2 Other processing that may involve transfers outside the UK
                or EEA
              </h3>
              <LegalTable
                headers={["Activity", "Provider", "Notes"]}
                rows={[
                  [
                    "Meeting-bot import",
                    "Recall.ai",
                    "Configured to the EU (Frankfurt) region and monitored; retrieved audio is stored in EU object storage.",
                  ],
                  [
                    "Authentication",
                    "Google, Microsoft",
                    "OAuth identity verification.",
                  ],
                  [
                    "Optional calendar, email and file connectors",
                    "Google, Microsoft Graph",
                    "Only when you connect the integration.",
                  ],
                  [
                    "Optional practice management",
                    "Clio",
                    "EU Clio endpoint (eu.app.clio.com); only when connected.",
                  ],
                  [
                    "SMS access codes",
                    "Twilio",
                    "Phone numbers and one-time codes, where the feature is enabled.",
                  ],
                  [
                    "Payments",
                    "Stripe",
                    "Billing data only; no matter content.",
                  ],
                ]}
              />
              <p className="leading-relaxed mt-4 mb-4">
                Where personal data is transferred outside the United Kingdom or
                the EEA, we rely on appropriate safeguards such as an adequacy
                decision (including the EU-US Data Privacy Framework and its UK
                Extension where applicable), the UK International Data Transfer
                Agreement or Addendum, and/or Standard Contractual Clauses,
                together with technical measures (encryption in transit, access
                controls and data minimisation).
              </p>
              <p className="leading-relaxed">
                We do not claim that all personal data never leaves the UK or EU.
                Privileged audio transcription and privileged note generation are
                engineered for UK and EU processing. Authentication, billing,
                messaging, optional integrations and meeting-bot capture may
                involve other locations as described above. Each of our core
                sub-processors is a United States company or has a United States
                parent, so a residual exposure to United States law, including
                the CLOUD Act, remains that the choice of region does not remove;
                we address this through the safeguards above and the
                government-access terms in our sub-processor agreements.
              </p>

              <h3 className={h3Class}>5.3 Security measures</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  TLS for data in transit; HSTS and security headers in
                  production.
                </li>
                <li>
                  Encryption at rest as provided by our infrastructure vendors
                  (database and object storage).
                </li>
                <li>Firm-scoped and user-scoped access controls.</li>
                <li>
                  Sealed consent events (content hash and HMAC signature)
                  required before AI processing.
                </li>
                <li>
                  Chained audit logging with HMAC-SHA256 tamper detection.
                </li>
                <li>
                  Session cookies set httpOnly, sameSite lax, and secure in
                  production, with a four-hour session lifetime.
                </li>
                <li>
                  Access to firm data by LegalNote personnel is restricted to the
                  minimum necessary and is logged.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                6. Data retention
              </h2>
              <LegalTable
                headers={["Data type", "Retention", "Notes"]}
                rows={[
                  [
                    "Session audio (the substantive recording)",
                    "Put beyond use within 7 days of processing",
                    "Enforced in the application and by a storage-layer lifecycle rule",
                  ],
                  [
                    "Consent evidence segment",
                    "Retained as consent evidence only",
                    "A short extract of the consent disclosure and acceptance, separate from the session audio; not used for transcription, generation or model improvement",
                  ],
                  [
                    "Transcripts and generated documents",
                    "Until deleted by the firm or on account termination",
                    "No automatic short-cycle deletion",
                  ],
                  [
                    "Share links",
                    "Deleted 7 days after expiry",
                    "Retention cleanup job",
                  ],
                  [
                    "Consent and audit records",
                    "Up to 6 years, for regulatory and defence purposes",
                    "Firms should confirm operational retention with LegalNote",
                  ],
                  [
                    "Account and billing data",
                    "While the account is active, then as needed for legal and accounting obligations",
                    "",
                  ],
                ]}
              />
              <p className="leading-relaxed mt-4">
                Firms remain responsible for professional retention obligations
                that exceed platform defaults.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                7. Your rights under the UK GDPR
              </h2>
              <LegalTable
                headers={["Right", "Description"]}
                rows={[
                  ["Access", "Request a copy of your personal data"],
                  ["Rectification", "Correct inaccurate personal data"],
                  [
                    "Erasure",
                    "Request deletion in applicable circumstances",
                  ],
                  [
                    "Restriction",
                    "Limit processing in applicable circumstances",
                  ],
                  [
                    "Portability",
                    "Receive data in a portable format where applicable",
                  ],
                  [
                    "Object",
                    "Object to processing based on legitimate interests",
                  ],
                  [
                    "Withdraw consent",
                    "Where processing is based on consent",
                  ],
                ]}
              />
              <p className="leading-relaxed mt-4">
                Account or website data:{" "}
                <a href="mailto:privacy@legalnote.ai" className={linkClass}>
                  privacy@legalnote.ai
                </a>
                . Client or matter data: contact your solicitor, who is the
                controller; LegalNote will assist them under the DPA. You may
                also complain to the ICO at{" "}
                <a
                  href="https://ico.org.uk/make-a-complaint"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  ico.org.uk/make-a-complaint
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                8. Cookies
              </h2>
              <p className="leading-relaxed">
                We use strictly necessary cookies for authentication and session
                management, and a limited functional cookie for UI preferences.
                We do not use analytics or advertising cookies. See our{" "}
                <Link href="/cookies" className={linkClass}>
                  Cookie Policy
                </Link>{" "}
                for details.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                9. Sub-processors
              </h2>
              <p className="leading-relaxed mb-4">
                The current sub-processors used to deliver the service are listed
                below. The full list, with change log, is in our{" "}
                <Link href="/sub-processors" className={linkClass}>
                  Sub-processor List
                </Link>
                .
              </p>
              <LegalTable
                headers={["Sub-processor", "Purpose", "Location posture"]}
                rows={[
                  [
                    "AssemblyAI",
                    "Transcription",
                    "EU endpoint (Dublin)",
                  ],
                  [
                    "AWS Bedrock",
                    "Privileged AI document generation",
                    "UK/EU region and EU inference profile",
                  ],
                  [
                    "Backblaze B2",
                    "Audio object storage",
                    "EU Central (Amsterdam)",
                  ],
                  [
                    "Neon (on AWS)",
                    "PostgreSQL database",
                    "AWS eu-west-2 (London)",
                  ],
                  [
                    "Railway",
                    "Application hosting",
                    "EU-West (Amsterdam)",
                  ],
                  [
                    "AWS SES",
                    "Transactional email",
                    "AWS eu-west-2 (London)",
                  ],
                  [
                    "Recall.ai",
                    "Meeting-bot import",
                    "EU (Frankfurt)",
                  ],
                  [
                    "Google LLC",
                    "Sign-in; optional Calendar",
                    "International",
                  ],
                  [
                    "Microsoft Corporation",
                    "Sign-in; optional Outlook and SharePoint",
                    "International / customer tenant",
                  ],
                  [
                    "Clio",
                    "Optional practice management sync",
                    "EU Clio endpoint",
                  ],
                  [
                    "Twilio",
                    "SMS access codes for share links",
                    "International",
                  ],
                  [
                    "Stripe",
                    "Payments",
                    "International (billing data only)",
                  ],
                ]}
              />
              <p className="leading-relaxed mt-4">
                We will notify customers of material sub-processor changes as
                described in the DPA.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                10. Children's privacy
              </h2>
              <p className="leading-relaxed">
                LegalNote is a business service for legal professionals. We do
                not knowingly collect data from individuals under 18.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                11. Changes to this policy
              </h2>
              <p className="leading-relaxed">
                We may update this Privacy Policy from time to time. Material
                changes will be notified to registered users, and the "last
                updated" date will be revised.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                12. Contact us
              </h2>
              <p className="leading-relaxed mb-4">
                Data protection:{" "}
                <a href="mailto:privacy@legalnote.ai" className={linkClass}>
                  privacy@legalnote.ai
                </a>
                . Support:{" "}
                <a href="mailto:support@legalnote.ai" className={linkClass}>
                  support@legalnote.ai
                </a>
                .
              </p>
              <p className="leading-relaxed mb-4">
                LegalNote Technologies Ltd (No. 16788981; ICO Reg. ZC176177),
                71–75 Shelton Street, Covent Garden, London WC2H 9JQ, United
                Kingdom.
              </p>
              <p className="leading-relaxed text-sm italic">
                This Privacy Policy is governed by the laws of England and Wales.
                It reflects verified production behaviour as of July 2026 and is
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
