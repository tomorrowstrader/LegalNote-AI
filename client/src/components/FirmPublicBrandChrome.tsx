import { ShareBrandBar, ShareBrandFooter } from "@/components/ShareBrandChrome";

export type PublicFirmProfile = {
  firmName: string;
  logoUrl?: string | null;
  phone?: string | null;
  email?: string | null;
};

type FirmPublicBrandChromeProps = {
  firmProfile?: PublicFirmProfile | null;
};

/**
 * Public client pages: firm identity when configured, LegalNote chrome otherwise.
 */
export function FirmPublicBrandBar({ firmProfile }: FirmPublicBrandChromeProps) {
  const firmName = firmProfile?.firmName?.trim();
  const logoUrl = firmProfile?.logoUrl?.trim();

  if (!firmName) {
    return <ShareBrandBar />;
  }

  return (
    <header
      className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-sm pt-[env(safe-area-inset-top,0px)]"
      data-testid="firm-public-brand-bar"
    >
      <div className="container max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={firmName}
            className="h-8 w-auto max-w-[140px] object-contain shrink-0"
            data-testid="img-firm-logo"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate" data-testid="text-firm-name">
            {firmName}
          </p>
        </div>
      </div>
    </header>
  );
}

export function FirmPublicBrandFooter({ firmProfile }: FirmPublicBrandChromeProps) {
  const firmName = firmProfile?.firmName?.trim();
  const phone = firmProfile?.phone?.trim();
  const email = firmProfile?.email?.trim();

  if (!firmName) {
    return <ShareBrandFooter />;
  }

  return (
    <footer
      className="border-t border-border/50 py-6 mt-8"
      data-testid="firm-public-brand-footer"
    >
      <div className="container max-w-5xl mx-auto px-4 text-center space-y-1">
        <p className="text-xs font-medium text-foreground">{firmName}</p>
        {(phone || email) && (
          <p className="text-[11px] text-muted-foreground">
            {[phone, email].filter(Boolean).join(" · ")}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground pt-2">
          Secured by{" "}
          <a
            href="https://legalnote.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            LegalNote
          </a>
        </p>
      </div>
    </footer>
  );
}
