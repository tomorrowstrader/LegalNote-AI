import Logo from "@/components/Logo";

const HOMEPAGE_URL = "https://legalnote.ai";

/**
 * Subtle LegalNote chrome for public secure-share views.
 * Brand presence only — no marketing copy; document remains the focus.
 */
export function ShareBrandBar() {
  return (
    <header
      className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-sm pt-[env(safe-area-inset-top,0px)]"
      data-testid="share-brand-bar"
    >
      <div className="container max-w-5xl mx-auto px-4 h-12 flex items-center justify-between gap-3">
        <a
          href={HOMEPAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-sm opacity-90 hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="LegalNote home"
          data-testid="link-share-brand-home"
        >
          <Logo variant="wordmark" size="sm" tone="auto" />
        </a>
        <a
          href={HOMEPAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
          data-testid="link-share-learn-more"
        >
          legalnote.ai
        </a>
      </div>
    </header>
  );
}

export function ShareBrandFooter() {
  return (
    <footer
      className="border-t border-border/50 py-6 mt-8"
      data-testid="share-brand-footer"
    >
      <div className="container max-w-5xl mx-auto px-4 text-center">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Secured by{" "}
          <a
            href={HOMEPAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline hover:text-foreground transition-colors"
          >
            LegalNote
          </a>
          <span className="text-muted-foreground/70"> · Meeting to Matter</span>
        </p>
      </div>
    </footer>
  );
}
