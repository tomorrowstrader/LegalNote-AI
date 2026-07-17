import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Link, useSearch } from "wouter";
import { CheckCircle2, XCircle, AlertTriangle, Clock } from "lucide-react";
import { SecondaryPageHeader } from "@/components/SecondaryPageHeader";
import { LegalPageFooter } from "@/components/LegalPageFooter";
import { Button } from "@/components/ui/button";

const linkClass = "text-[hsl(18,65%,45%)] hover:underline";

type CompleteEvent =
  | "signing_complete"
  | "decline"
  | "cancel"
  | "ttl_expired"
  | "exception"
  | "fax_pending"
  | "session_timeout"
  | "viewing_complete"
  | "id_check_failed"
  | "access_code_failed"
  | string;

function parseEvent(search: string): CompleteEvent {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return (params.get("event") || "").toLowerCase();
}

export default function DpaCompletePage() {
  const search = useSearch();
  const event = useMemo(() => parseEvent(search), [search]);

  useEffect(() => {
    document.title = "DPA signing result - LegalNote";
  }, []);

  const content = (() => {
    switch (event) {
      case "signing_complete":
        return {
          icon: CheckCircle2,
          title: "DPA signed",
          body: "Thank you. DocuSign will email a copy of the executed Data Processing Agreement to the address you provided. Our team will use that record for your governed evaluation.",
          tone: "success" as const,
        };
      case "decline":
        return {
          icon: XCircle,
          title: "Signing declined",
          body: "You declined to sign the DPA. If this was unintentional, you can start again from the DPA page, or contact legal@legalnote.ai.",
          tone: "error" as const,
        };
      case "cancel":
      case "viewing_complete":
        return {
          icon: AlertTriangle,
          title: "Signing cancelled",
          body: "The DocuSign session ended without a completed signature. You can return to the DPA page to try again when ready.",
          tone: "warn" as const,
        };
      case "ttl_expired":
      case "session_timeout":
        return {
          icon: Clock,
          title: "Session expired",
          body: "The signing link expired (DocuSign embedded sessions are short-lived). Please start a new signing session from the DPA page.",
          tone: "warn" as const,
        };
      default:
        return {
          icon: AlertTriangle,
          title: "Signing incomplete",
          body: event
            ? `DocuSign returned status “${event}”. You can return to the DPA page to try again, or email legal@legalnote.ai for help.`
            : "No signing result was received. If you completed signing, check your email for the DocuSign confirmation. Otherwise, start again from the DPA page.",
          tone: "warn" as const,
        };
    }
  })();

  const Icon = content.icon;
  const iconColor =
    content.tone === "success"
      ? "text-emerald-700"
      : content.tone === "error"
        ? "text-red-700"
        : "text-[hsl(18,65%,40%)]";

  return (
    <div className="min-h-screen bg-[hsl(30,25%,97%)] dark:bg-background">
      <SecondaryPageHeader />

      <main className="max-w-2xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
          data-testid="dpa-complete"
        >
          <Icon className={`mx-auto h-12 w-12 mb-6 ${iconColor}`} aria-hidden />
          <h1 className="text-3xl font-medium text-[hsl(25,30%,12%)] mb-4">
            {content.title}
          </h1>
          <p className="text-[hsl(25,20%,35%)] leading-relaxed mb-8">
            {content.body}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild className="bg-[hsl(18,65%,45%)] hover:bg-[hsl(18,65%,38%)] text-white">
              <Link href="/dpa" data-testid="link-back-dpa">
                Back to DPA
              </Link>
            </Button>
            <Link href="/privacy" className={`${linkClass} text-sm`}>
              Privacy Policy
            </Link>
          </div>
        </motion.div>
      </main>

      <LegalPageFooter />
    </div>
  );
}
