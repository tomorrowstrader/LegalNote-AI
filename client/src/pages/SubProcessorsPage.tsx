import { motion } from "framer-motion";
import { SecondaryPageHeader } from "@/components/SecondaryPageHeader";
import { LegalPageFooter, LegalTable } from "@/components/LegalPageFooter";
import { useEffect } from "react";

const linkClass = "text-[hsl(18,65%,45%)] hover:underline";

export default function SubProcessorsPage() {
  useEffect(() => {
    document.title = "Sub-processors - LegalNote";

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        "LegalNote sub-processor list. Third parties engaged to process personal data on behalf of customers."
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

    setOrCreateMeta("og:title", "Sub-processors - LegalNote");
    setOrCreateMeta(
      "og:description",
      "Third-party sub-processors engaged by LegalNote Technologies Ltd."
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
            data-testid="heading-subprocessors"
          >
            Sub-processor List
          </h1>
          <p className="text-[hsl(25,20%,45%)] mb-8">
            Last updated: July 2026 · Version 3.0
          </p>

          <div className="space-y-8 text-[hsl(25,20%,30%)]">
            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                Overview
              </h2>
              <p className="leading-relaxed mb-4">
                This document lists the third-party sub-processors engaged by
                LegalNote Technologies Ltd to process personal data on behalf of
                customers (law firms and legal professionals), based on the
                integrations present in the production platform. In accordance
                with our Data Processing Agreement, we will notify customers at
                least 30 days before adding or replacing a material
                sub-processor, or as otherwise required by the DPA.
              </p>
              <p className="leading-relaxed">
                Each of the core sub-processors below is a United States company
                or has a United States parent. Client data is stored and
                processed in the region shown, but a residual exposure to United
                States law, including the CLOUD Act, remains that the choice of
                region does not remove. We address this through the transfer
                safeguards recorded below and the government-access terms in each
                sub-processor agreement.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                Core privileged processing
              </h2>
              <LegalTable
                headers={[
                  "Sub-processor",
                  "Purpose",
                  "Region",
                  "Transfer position",
                ]}
                rows={[
                  [
                    "AssemblyAI Inc.",
                    "Audio transcription with speaker diarization",
                    "EU endpoint (Dublin), enforced in production",
                    "EU SCCs + UK Addendum; DPF / UK Extension certified. No model training via the EU endpoint.",
                  ],
                  [
                    "Amazon Web Services (Bedrock)",
                    "Privileged AI generation (attendance notes, letters, summaries)",
                    "UK/EU region and EU inference profile; global routing disabled",
                    "AWS GDPR DPA + UK Addendum (SCCs / UK IDTA); DPF certified. Inputs and outputs not used to train any model.",
                  ],
                  [
                    "Backblaze Inc.",
                    "Object storage for audio",
                    "EU Central (Amsterdam)",
                    "EEA/EU DPA and UK Residents DPA (SCCs). Support is US-based; support access is treated as a US transfer.",
                  ],
                  [
                    "Recall.ai (Hyperdoc Inc.)",
                    "Meeting-bot import (audio-only)",
                    "EU (Frankfurt), configured and monitored",
                    "EU and UK DPA (SCCs + UK Addendum). Customer data not used to train any model.",
                  ],
                ]}
              />
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                Infrastructure
              </h2>
              <LegalTable
                headers={[
                  "Sub-processor",
                  "Purpose",
                  "Region",
                  "Transfer position",
                ]}
                rows={[
                  [
                    "Neon (Databricks)",
                    "PostgreSQL database",
                    "AWS eu-west-2 (London)",
                    "Databricks DPA executed; Neon covered by DPF / UK Extension; SCCs + UK IDTA. Contracting via the Neon Platform Services Product Specific Schedule.",
                  ],
                  [
                    "Railway Corporation",
                    "Application hosting",
                    "EU-West (Amsterdam), pinned and monitored",
                    "Railway DPA executed (SCCs Module 2/3, Clause 9 Option 1; UK Addendum). EU region is a paid-plan option.",
                  ],
                  [
                    "AWS SES",
                    "Transactional email (notification and link only)",
                    "AWS eu-west-2 (London)",
                    "Same AWS GDPR DPA and UK Addendum as Bedrock and Neon. No document content.",
                  ],
                ]}
              />
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                Identity, communications and payments
              </h2>
              <LegalTable
                headers={[
                  "Sub-processor",
                  "Purpose",
                  "Data",
                  "Transfer position",
                ]}
                rows={[
                  [
                    "Google LLC",
                    "Sign-in (OAuth); optional Calendar",
                    "Identity fields; calendar events when connected",
                    "Adequacy / SCCs / IDTA as applicable",
                  ],
                  [
                    "Microsoft Corporation",
                    "Sign-in (OAuth); optional Outlook, SharePoint, OneDrive",
                    "Identity fields; calendar and files when connected",
                    "Adequacy / SCCs / IDTA; customer tenant",
                  ],
                  [
                    "Twilio Inc.",
                    "SMS one-time access codes for share links",
                    "Phone numbers; codes",
                    "EU SCCs + UK IDTA; DPF certified. IE1 (Ireland) SMS residency where enabled.",
                  ],
                  [
                    "Stripe Inc.",
                    "Payment processing",
                    "Billing contact and payment tokens (no full card number stored by LegalNote)",
                    "DPF / SCCs / UK IDTA. Billing data only; no matter content.",
                  ],
                ]}
              />
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                Optional practice integrations
              </h2>
              <LegalTable
                headers={["Sub-processor", "Purpose", "Region", "Notes"]}
                rows={[
                  [
                    "Clio",
                    "Optional practice-management sync",
                    "EU Clio API (eu.app.clio.com)",
                    "Only when the firm connects Clio",
                  ],
                ]}
              />
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                Explicitly not used
              </h2>
              <LegalTable
                headers={["Former item", "Current status"]}
                rows={[
                  [
                    "OpenAI for privileged document generation",
                    "Not used in production privileged paths. Production requires AWS Bedrock (EU). OpenAI appears only in non-production test tooling and is not a production sub-processor.",
                  ],
                  [
                    "Resend for transactional email",
                    "Removed. Transactional email now runs on AWS SES (eu-west-2, London).",
                  ],
                  [
                    "Replit Auth as live authentication",
                    "Not used. Live authentication is Google/Microsoft OAuth with connect.sid sessions; the filename replitAuth.ts is historical.",
                  ],
                ]}
              />
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                Data residency summary
              </h2>
              <LegalTable
                headers={["Processing activity", "Posture"]}
                rows={[
                  [
                    "Audio transcription",
                    "EU (AssemblyAI Dublin endpoint)",
                  ],
                  [
                    "Privileged LLM / notes",
                    "EU (AWS Bedrock, EU inference profile)",
                  ],
                  [
                    "Object storage (audio)",
                    "EU (Backblaze Amsterdam)",
                  ],
                  [
                    "Database",
                    "UK (Neon, AWS eu-west-2 London)",
                  ],
                  [
                    "Application hosting",
                    "EU (Railway Amsterdam)",
                  ],
                  [
                    "Transactional email",
                    "UK (AWS SES eu-west-2 London)",
                  ],
                  [
                    "Meeting-bot import",
                    "EU (Recall.ai Frankfurt)",
                  ],
                  [
                    "Auth / billing / SMS",
                    "May be international (Google, Microsoft, Stripe, Twilio)",
                  ],
                  ["Optional Clio", "EU API"],
                ]}
              />
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                International transfer safeguards
              </h2>
              <p className="leading-relaxed">
                Where personal data is transferred outside the United Kingdom or
                the EEA, LegalNote relies on one or more of: an adequacy
                decision, including the EU-US Data Privacy Framework and its UK
                Extension where the recipient is certified; the UK IDTA or UK
                Addendum and/or EU Standard Contractual Clauses; and technical
                measures including encryption in transit, access controls and
                data minimisation.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-[hsl(25,30%,15%)] mb-4">
                Change log
              </h2>
              <LegalTable
                headers={["Date", "Change"]}
                rows={[
                  [
                    "July 2026",
                    "Resend removed; AWS SES added for transactional email (eu-west-2).",
                  ],
                  [
                    "July 2026",
                    "Neon (Databricks) and Railway DPAs executed; regions confirmed (Neon London, Railway Amsterdam).",
                  ],
                  [
                    "July 2026",
                    "Recall.ai region confirmed EU (Frankfurt).",
                  ],
                ]}
              />
              <p className="leading-relaxed mt-6 mb-4">
                LegalNote Technologies Ltd (No. 16788981), 71–75 Shelton Street,
                Covent Garden, London WC2H 9JQ, United Kingdom. Contact:{" "}
                <a href="mailto:privacy@legalnote.ai" className={linkClass}>
                  privacy@legalnote.ai
                </a>
                .
              </p>
              <p className="leading-relaxed text-sm italic">
                This Sub-processor List is governed by the laws of England and
                Wales and is not legal advice.
              </p>
            </section>
          </div>
        </motion.article>
      </main>

      <LegalPageFooter />
    </div>
  );
}
