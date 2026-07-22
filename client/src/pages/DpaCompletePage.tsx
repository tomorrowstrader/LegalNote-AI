import { useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { SecondaryPageHeader } from "@/components/SecondaryPageHeader";
import { LegalPageFooter } from "@/components/LegalPageFooter";
import { Button } from "@/components/ui/button";

const linkClass = "text-[hsl(18,65%,45%)] hover:underline";

/** Legacy DocuSign return URL — redirect users to the click-to-accept flow. */
export default function DpaCompletePage() {
  useEffect(() => {
    document.title = "DPA acceptance - LegalNote";
  }, []);

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
          <h1 className="text-3xl font-medium text-[hsl(25,30%,12%)] mb-4">
            Acceptance has moved
          </h1>
          <p className="text-[hsl(25,20%,35%)] leading-relaxed mb-8">
            LegalNote now uses click-to-accept for the DPA and Governed Evaluation
            Agreement. If you have a signed acceptance link from LegalNote, open
            it to continue. Otherwise contact{" "}
            <a href="mailto:legal@legalnote.ai" className={linkClass}>
              legal@legalnote.ai
            </a>
            .
          </p>
          <Button asChild className="bg-[hsl(18,65%,45%)] hover:bg-[hsl(18,65%,38%)] text-white">
            <Link href="/dpa" data-testid="link-back-dpa">
              Go to DPA page
            </Link>
          </Button>
        </motion.div>
      </main>
      <LegalPageFooter />
    </div>
  );
}
