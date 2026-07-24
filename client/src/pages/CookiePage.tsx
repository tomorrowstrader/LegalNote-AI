import { motion } from "framer-motion";
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

export default function CookiePage() {
  useEffect(() => {
    document.title = "Cookie Policy - LegalNote";

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        "LegalNote Cookie Policy. How we use cookies and similar technologies on legalnote.ai and the LegalNote application."
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

    setOrCreateMeta("og:title", "Cookie Policy - LegalNote");
    setOrCreateMeta(
      "og:description",
      "How LegalNote uses cookies and similar technologies."
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
            data-testid="heading-cookies"
          >
            Cookie Policy
          </h1>
          <p className={`${legalMutedClass} mb-8`}>Last updated: July 2026</p>

          <div className={legalBodyClass}>
            <section>
              <h2 className={legalH2Class}>
                1. Introduction
              </h2>
              <p className="leading-relaxed">
                This Cookie Policy explains how LegalNote Technologies Ltd
                ("LegalNote", "we", "us", "our") uses cookies and similar
                technologies on legalnote.ai and the LegalNote application.
              </p>
            </section>

            <section>
              <h2 className={legalH2Class}>
                2. What are cookies?
              </h2>
              <p className="leading-relaxed">
                Cookies are small text files stored on your device when you visit
                a website. They help the Service authenticate you and remember
                limited interface preferences.
              </p>
            </section>

            <section>
              <h2 className={legalH2Class}>
                3. Cookies we use
              </h2>
              <h3 className={legalH3Class}>3.1 Strictly necessary cookies</h3>
              <p className="leading-relaxed mb-4">
                These cookies are required for the Service to function and cannot
                be disabled if you wish to use authenticated features.
              </p>
              <LegalTable
                headers={["Cookie", "Purpose", "Duration"]}
                rows={[
                  [
                    <code key="sid">connect.sid</code>,
                    "Server-side session identifier (express-session with a Postgres session store). Authenticates your logged-in session after Google or Microsoft sign-in.",
                    "Approximately 4 hours (aligned to session lifetime)",
                  ],
                ]}
              />
              <p className="leading-relaxed mt-4">
                In production this cookie is set httpOnly, sameSite lax, and
                secure.
              </p>

              <h3 className={legalH3Class}>3.2 Functional cookies</h3>
              <LegalTable
                headers={["Cookie", "Purpose", "Duration"]}
                rows={[
                  [
                    <code key="sidebar">sidebar_state</code>,
                    "Remembers whether the in-app sidebar is open or collapsed.",
                    "Persistent (long max-age set by the client UI)",
                  ],
                ]}
              />

              <h3 className={legalH3Class}>3.3 Cookies we do not use</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  We do not set analytics cookies (no Google Analytics, PostHog,
                  Mixpanel or similar in the application).
                </li>
                <li>We do not use marketing or advertising cookies.</li>
                <li>
                  We do not set a separate CSRF cookie in current code.
                </li>
                <li>
                  Theme and many UI preferences are stored in local or session
                  storage, not cookies.
                </li>
              </ul>

              <h3 className={legalH3Class}>3.4 Local storage (not cookies)</h3>
              <p className="leading-relaxed">
                The application may store non-cookie data in browser storage, for
                example UI drafts or preferences. This is limited to operating
                the product and is not used for cross-site advertising.
              </p>
            </section>

            <section>
              <h2 className={legalH2Class}>
                4. Third-party cookies and related technologies
              </h2>
              <p className="leading-relaxed mb-4">
                When you use certain features, third parties may process data or
                set their own cookies on their domains:
              </p>
              <LegalTable
                headers={["Service", "When it appears", "More information"]}
                rows={[
                  [
                    "Google",
                    "Sign-in, and optional Google Calendar",
                    <a
                      key="google"
                      href="https://policies.google.com/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={legalLinkClass}
                    >
                      policies.google.com/privacy
                    </a>,
                  ],
                  [
                    "Microsoft",
                    "Sign-in, and optional Outlook or SharePoint",
                    <a
                      key="ms"
                      href="https://privacy.microsoft.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={legalLinkClass}
                    >
                      privacy.microsoft.com
                    </a>,
                  ],
                  [
                    "Stripe",
                    "Checkout and billing",
                    <a
                      key="stripe"
                      href="https://stripe.com/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={legalLinkClass}
                    >
                      stripe.com/privacy
                    </a>,
                  ],
                ]}
              />
              <p className="leading-relaxed mt-4">
                OAuth providers may set cookies on their own domains during
                sign-in. LegalNote does not control those cookies.
              </p>
            </section>

            <section>
              <h2 className={legalH2Class}>
                5. Managing cookies
              </h2>
              <p className="leading-relaxed">
                You can view, delete or block cookies in your browser settings.
                Blocking{" "}
                <code>connect.sid</code> will prevent you from remaining signed
                in, and authenticated use of LegalNote will not work.
              </p>
            </section>

            <section>
              <h2 className={legalH2Class}>
                6. Do Not Track
              </h2>
              <p className="leading-relaxed">
                LegalNote does not currently alter its behaviour in response to
                "Do Not Track" signals. We do not operate third-party advertising
                trackers in the application.
              </p>
            </section>

            <section>
              <h2 className={legalH2Class}>
                7. Changes to this policy
              </h2>
              <p className="leading-relaxed">
                We may update this Cookie Policy from time to time. Changes will
                be posted with an updated "last updated" date.
              </p>
            </section>

            <section>
              <h2 className={legalH2Class}>
                8. Contact us
              </h2>
              <p className="leading-relaxed mb-4">
                Email:{" "}
                <a href="mailto:privacy@legalnote.ai" className={legalLinkClass}>
                  privacy@legalnote.ai
                </a>
                .
              </p>
              <p className="leading-relaxed mb-4">
                LegalNote Technologies Ltd (No. 16788981), 71–75 Shelton Street,
                Covent Garden, London WC2H 9JQ, United Kingdom.
              </p>
              <p className="leading-relaxed text-sm italic">
                This Cookie Policy is governed by the laws of England and Wales.
                It reflects cookies actually set by LegalNote application code as
                of July 2026 and is not legal advice.
              </p>
            </section>
          </div>
        </motion.article>
      </main>

      <LegalPageFooter />
    </div>
  );
}
