import { useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { SecondaryPageHeader } from "@/components/SecondaryPageHeader";
import { LegalPageFooter } from "@/components/LegalPageFooter";
import { Button } from "@/components/ui/button";

const linkClass = "text-[hsl(18,65%,45%)] hover:underline";

export default function DpaPreviewPage() {
  useEffect(() => {
    document.title = "DPA preview - LegalNote";
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/dpa/document"],
    queryFn: async () => {
      const res = await fetch("/api/dpa/document", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load DPA");
      return res.text();
    },
  });

  return (
    <div className="min-h-screen bg-[hsl(30,25%,97%)] dark:bg-background">
      <SecondaryPageHeader />

      <main className="max-w-4xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-sm text-[hsl(25,20%,45%)] mb-4">
            <Link href="/dpa" className={linkClass}>
              ← Back to DPA signing
            </Link>
          </p>
          <h1
            className="text-4xl font-medium text-[hsl(25,30%,12%)] mb-2"
            data-testid="heading-dpa-preview"
          >
            DPA preview
          </h1>
          <p className="text-sm text-[hsl(25,20%,45%)] mb-8">
            Current text of the Data Processing Agreement. Acceptance binds to
            the exact bytes hashed at the moment you confirm.
          </p>

          {isLoading && (
            <div className="flex items-center gap-2 text-[hsl(25,20%,45%)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading agreement…
            </div>
          )}

          {isError && (
            <p className="text-sm text-red-700">
              Could not load the DPA text. Contact{" "}
              <a href="mailto:legal@legalnote.ai" className={linkClass}>
                legal@legalnote.ai
              </a>
              .
            </p>
          )}

          {data && (
            <pre
              className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[hsl(25,20%,30%)] border border-[hsl(25,15%,85%)] bg-white/60 rounded-md p-6 max-h-[70vh] overflow-y-auto"
              data-testid="dpa-preview-body"
            >
              {data}
            </pre>
          )}

          <div className="mt-10">
            <Button asChild className="bg-[hsl(18,65%,45%)] hover:bg-[hsl(18,65%,38%)] text-white">
              <Link href="/dpa" data-testid="link-sign-dpa">
                Continue to accept
              </Link>
            </Button>
          </div>
        </motion.div>
      </main>

      <LegalPageFooter />
    </div>
  );
}
