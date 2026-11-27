import { motion } from "framer-motion";
import { Link } from "wouter";
import { SecondaryPageHeader } from "@/components/SecondaryPageHeader";
import {
  LegalPageFooter,
  LegalTable,
  legalBodyClass,
  legalH1Class,
  legalH2Class,
  legalH3Class,
  legalLinkClass,
  legalMutedClass,
  legalPageShellClass,
} from "@/components/LegalPageFooter";
import { useEffect } from "react";

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
    <div className={legalPageShellClass}>
      <SecondaryPageHeader />

      <main className="max-w-4xl mx-auto px-6 py-16">
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="prose prose-lg max-w-none"
        >
          <h1
            className={legalH1Class}
            data-testid="heading-privacy"
          >
            Privacy Policy
          </h1>
          <p className={`${legalMutedClass} mb-2`}>Last updated: November 2026</p>
          <p className={`text-sm ${legalMutedClass} mb-1`}>
            LegalNote Technologies Ltd (registered in England and Wales, No.
            16788981; ICO Reg. ZC176177)
          </p>
          <p className={`text-sm ${legalMutedClass} mb-8`}>
            Registered address: 71–75 Shelton Street, Covent Garden, London WC2H
            9JQ
          </p>

          <div className={legalBodyClass}>
            <section>
              <h2 className={legalH2Class}>
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
              <h2 className={legalH2Class}>
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
                      <Link href="/sub-processors" className={legalLinkClass}>
                        Sub-processor List
                      </Link>
                    </>,
                    "Third parties we engage to deliver the service.",
                  ],
                ]}
              />
              <p className="leading-relaxed mt-4">
                If you are a client of an organisation using LegalNote, contact that
                organisation about privacy requests for your matter data. They are
                the controller for that data; we act only as processor on their
                instructions.
              </p>
            </section>

            <section>
              <h2 className={legalH2Class}>
                3. Personal data we collect
              </h2>
              <h3 className={legalH3Class}>
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

              <h3 className={legalH3Class}>
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

              <h3 className={legalH3Class}>3.3 Technical data</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  IP address, browser and device information, and security logs.
                </li>
                <li>
                  Cookies and similar technologies (see our{" "}
                  <Link href="/cookies" className={legalLinkClass}>
                    Cookie Policy
                  </Link>
                  ).
                </li>
              </ul>

              <h3 className={legalH3Class}>
                3.4 People who book a call with us (LegalNote as controller)
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>What we hold:</strong> if you book a call at
                  legalnote.ai/talk, your name, work email, firm (if you give
                  it), your optional answer about how attendance notes are
                  written in your firm, the time you chose, and which link
                  brought you to the page.
                </li>
                <li>
                  <strong>What we use it for:</strong> arranging the call,
                  sending you the calendar invitation and a confirmation, and
                  following up with you about LegalNote afterwards. You can ask
                  us to stop at any time.
                </li>
                <li>
                  <strong>Where it is held:</strong> in LegalNote's own systems,
                  and the invitation in our Microsoft 365 calendar. We never
                  ask for client or matter details when you book.
                </li>
                <li>
                  <strong>Recording the call:</strong> LegalNote asks to join
                  the call and take a note, using the same consent email and
                  in-call consent step our customers use. You can decline, and
                  the call goes ahead without it. If you agree, the call is
                  recorded, transcribed and turned into a note for our own
                  records, by the same services and in the same EU regions
                  listed in section 5. The audio is deleted within 7 days, the
                  transcript and note are kept for up to 24 months after the
                  call, and the record of your consent decision is kept as
                  consent evidence (see section 6). We ask you not to mention
                  clients or matters on the call; if any client details are
                  mentioned, we delete them.
                </li>
                <li>
                  <strong>Backup booking page:</strong> if our own booking is
                  unavailable and you use the backup page instead, Cal.com,
                  Inc. in the United States handles that booking for us, under
                  its data processing terms and its Data Privacy Framework
                  certification.
                </li>
              </ul>
              <h3 className={legalH3Class}>
                3.5 People we contact about LegalNote (LegalNote as controller)
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Who:</strong> solicitors, partners and managers at
                  law firms, and people at IT providers and consultancies who
                  might work with us. We contact you in your work role only.
                </li>
                <li>
                  <strong>What we hold:</strong> your name, job title, firm or
                  company, business email and phone number, a link to your
                  public professional profile, where and when we found each
                  detail, our contact history with you, and whether you have
                  asked us not to contact you. Nothing about your private life.
                </li>
                <li>
                  <strong>Where we get it:</strong> your firm's or company's own
                  website, Companies House, professional
                  directories and event listings, public professional profiles
                  we view ourselves, and introductions from people who know
                  you. We do not use scraping tools on LinkedIn. We sometimes
                  use AI research tools to find and check publicly available
                  business details. We may check a firm's status on the SRA
                  register, but we don't use SRA data to choose who to
                  contact.
                </li>
                <li>
                  <strong>What we use it for:</strong> inviting you to see
                  LegalNote or proposing that we work together, following up,
                  and keeping a record of what was said. At a company or LLP we
                  may email your business address. Sole practitioners and
                  traditional partnerships we email only if you asked us to,
                  agreed to it, or were introduced to us. We check phone
                  numbers against the TPS and CTPS before any call.
                </li>
                <li>
                  <strong>Where it is held:</strong> in LegalNote's internal
                  systems, hosted on Railway (EU-West, Amsterdam) with the
                  database on Neon (AWS London), and sign-in through Google.
                </li>
                <li>
                  <strong>Telling you:</strong> our first message says who we
                  are, what we hold, where we found your details and how to opt
                  out. If we haven't contacted you within a month of finding
                  your details, we delete them.
                </li>
                <li>
                  <strong>Stopping:</strong> reply "stop" or email
                  privacy@legalnote.ai and we stop straight away. We keep only
                  your name, company and a note not to contact you, so that we
                  never contact you again by mistake.
                </li>
              </ul>
              <h3 className={legalH3Class}>
                3.6 Connected calendars (Google Calendar and Microsoft Outlook)
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>What we access:</strong> if a user connects Google Calendar or Microsoft Outlook to LegalNote, we can create events in that calendar and read its events: their times, titles, attendees, descriptions and video-call links. For Google, the only permission we ask for is to view and edit calendar events (Google calls this calendar.events). We never read email, contacts or files through this connection.
                </li>
                <li>
                  <strong>What we use it for:</strong> only for features the user can see in LegalNote: showing upcoming meetings so LegalNote can join and take the note with consent, creating calendar events for meetings booked in LegalNote and for case deadlines, and checking busy times so a booking never clashes with the diary.
                </li>
                <li>
                  <strong>What we never do:</strong> we don't sell calendar data, use it for advertising, or use it to develop, improve or train AI or machine-learning models. People at LegalNote don't read it unless the user asks us to (for example, for support), it's needed for security, or the law requires it.
                </li>
                <li>
                  <strong>Google's rules:</strong> LegalNote's use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="underline">Google API Services User Data Policy</a>, including the Limited Use requirements.
                </li>
                <li>
                  <strong>Stopping:</strong> disconnect the calendar in LegalNote (Firm Settings, Integrations), and we delete the saved connection. You can also remove LegalNote's access in your Google or Microsoft account settings, which stops it working straight away. Meetings already recorded in LegalNote stay until the firm deletes them.
                </li>
              </ul>
            </section>

            <section>
              <h2 className={legalH2Class}>
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
                    "Arranging a call you book with us, and following up about LegalNote",
                    "Legitimate interests, Art. 6(1)(f)",
                  ],
                  [
                    "Contacting people at law firms and IT providers about LegalNote or a partnership, and following up (section 3.5)",
                    "Legitimate interests, Art. 6(1)(f)",
                  ],
                  [
                    "Marketing emails to sole practitioners, traditional partnerships and other individuals, where the law requires consent",
                    "Consent, Art. 6(1)(a), or the soft opt-in for existing customers",
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
              <h2 className={legalH2Class}>
                5. Data storage, processing locations and security
              </h2>
              <h3 className={legalH3Class}>
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

              <h3 className={legalH3Class}>
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

              <h3 className={legalH3Class}>5.3 Security measures</h3>
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
              <h2 className={legalH2Class}>
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
                  [
                    "Call bookings made at legalnote.ai/talk",
                    "24 months after the call",
                    "Deleted automatically by the retention cleanup job",
                  ],
                  [
                    "Transcripts and notes of calls booked at legalnote.ai/talk",
                    "Up to 24 months after the call",
                    "Audio follows the 7-day rule above",
                  ],
                  [
                    "People we contact about LegalNote (section 3.5), not yet contacted",
                    "1 month from finding the details",
                    "Deleted if we haven't made contact",
                  ],
                  [
                    "People we contact about LegalNote, no reply",
                    "12 months from our last contact",
                    "Then deleted",
                  ],
                  [
                    "People we contact about LegalNote who replied, met us or declined",
                    "24 months from our last contact",
                    "Then deleted; customers and partners move to their own records",
                  ],
                  [
                    "People who asked us not to contact them",
                    "Name, company and a do-not-contact note only",
                    "Kept so that we can honour the request",
                  ],
                ]}
              />
              <p className="leading-relaxed mt-4">
                Firms remain responsible for professional retention obligations
                that exceed platform defaults.
              </p>
            </section>

            <section>
              <h2 className={legalH2Class}>
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
                    "Object to marketing",
                    "Ask us to stop contacting you about LegalNote at any time. We will, without exception",
                  ],
                  [
                    "Withdraw consent",
                    "Where processing is based on consent",
                  ],
                ]}
              />
              <p className="leading-relaxed mt-4">
                Account or website data:{" "}
                <a href="mailto:privacy@legalnote.ai" className={legalLinkClass}>
                  privacy@legalnote.ai
                </a>
                . Client or matter data: contact the organisation using LegalNote,
                which is the controller; LegalNote will assist them under the DPA. You may
                also complain to the ICO at{" "}
                <a
                  href="https://ico.org.uk/make-a-complaint"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={legalLinkClass}
                >
                  ico.org.uk/make-a-complaint
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className={legalH2Class}>
                8. Cookies
              </h2>
              <p className="leading-relaxed">
                We use strictly necessary cookies for authentication and session
                management, and a limited functional cookie for UI preferences.
                We do not use analytics or advertising cookies. See our{" "}
                <Link href="/cookies" className={legalLinkClass}>
                  Cookie Policy
                </Link>{" "}
                for details.
              </p>
            </section>

            <section>
              <h2 className={legalH2Class}>
                9. Sub-processors
              </h2>
              <p className="leading-relaxed mb-4">
                The current sub-processors used to deliver the service are listed
                below. The full list, with change log, is in our{" "}
                <Link href="/sub-processors" className={legalLinkClass}>
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
              <h2 className={legalH2Class}>
                10. Children's privacy
              </h2>
              <p className="leading-relaxed">
                LegalNote is a business service for legal professionals. We do
                not knowingly collect data from individuals under 18.
              </p>
            </section>

            <section>
              <h2 className={legalH2Class}>
                11. Changes to this policy
              </h2>
              <p className="leading-relaxed">
                We may update this Privacy Policy from time to time. Material
                changes will be notified to registered users, and the "last
                updated" date will be revised.
              </p>
            </section>

            <section>
              <h2 className={legalH2Class}>
                12. Contact us
              </h2>
              <p className="leading-relaxed mb-4">
                Data protection:{" "}
                <a href="mailto:privacy@legalnote.ai" className={legalLinkClass}>
                  privacy@legalnote.ai
                </a>
                . Support:{" "}
                <a href="mailto:support@legalnote.ai" className={legalLinkClass}>
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
