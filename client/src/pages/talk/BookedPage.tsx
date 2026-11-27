import { useEffect, useMemo } from "react";
import { ArrowRight, Check } from "lucide-react";
import Logo from "@/components/Logo";
import "./talk.css";

const TZ = "Europe/London";
const JAZZ_EMAIL = "jazz.dennis@legalnote.ai";

function readBooking(): { when: string | null; platform: string } {
  const params = new URLSearchParams(window.location.search);
  const at = params.get("at");
  const platform = params.get("via") === "meet" ? "Google Meet" : "Microsoft Teams";
  if (!at) return { when: null, platform };
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return { when: null, platform };
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return { when: `${day} at ${time} UK time`, platform };
}

export default function BookedPage() {
  const { when, platform } = useMemo(readBooking, []);

  useEffect(() => {
    document.title = "You're booked in | LegalNote";
  }, []);

  return (
    <div className="lnb">
      <header className="lnb-in lnb-nav">
        <a href="/" aria-label="LegalNote home">
          <Logo variant="wordmark" size="md" tone="light" />
        </a>
      </header>

      <main className="lnb-in" style={{ display: "flex", flexDirection: "column", gap: 32, paddingBlock: "clamp(24px,5vw,56px)" }}>
        <section style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 18 }}>
          <div className="lnb-seal" aria-hidden><Check size={34} strokeWidth={1.6} /></div>
          <span className="lnb-cap">Booked</span>
          <h1 className="lnb-disp lnb-h1" style={{ maxWidth: 820 }}>
            Thank you. <em className="lnb-gilt" style={{ fontStyle: "normal" }}>You're booked in.</em>
          </h1>
          {when && <span className="lnb-cursorline">{when} · {platform} · 20 minutes</span>}
        </section>

        <div className="lnb-rule" aria-hidden><span /><i /><span /></div>

        <section className="lnb-tiles four">
          {[
            ["01", "Look out for the invitation", `A ${platform} invitation is on its way from my calendar, with a short confirmation email from LegalNote. Please accept it so the call sits in your diary.`],
            ["02", "Then the consent email", "You'll also get LegalNote's recording consent email, exactly as your clients would. Agree or decline: the call goes ahead either way."],
            ["03", "Nothing to prepare", "Please don't mention real clients or matters on the call. I'll show you the rest on a fictional matter."],
            ["04", "Need a different time?", `Reply to the invitation or email ${JAZZ_EMAIL} and we'll find another.`],
          ].map(([n, title, body]) => (
            <article key={n} className="lnb-paper lnb-tile">
              <span className="lnb-tile-n">{n}</span>
              <h2 className="lnb-disp lnb-h3">{title}</h2>
              <p className="lnb-sm">{body}</p>
            </article>
          ))}
        </section>

        <section className="lnb-wg" style={{ padding: "clamp(24px,4vw,40px)", display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 560 }}>
            <span className="lnb-cap">While you wait</span>
            <h2 className="lnb-disp lnb-h2">Walk through the showroom.</h2>
            <p className="lnb-sm">A fictional family matter, from the meeting to the finished attendance note.</p>
          </div>
          <a className="lnb-cta" href="/demo/family">
            Open the showroom
            <span className="lnb-orb" aria-hidden><ArrowRight size={18} strokeWidth={2} /></span>
          </a>
        </section>
      </main>

      <footer className="lnb-foot">
        <div className="lnb-in">
          <span>LegalNote Technologies Ltd, 71–75 Shelton Street, London WC2H 9JQ</span>
          <span><a href="/privacy">Privacy</a> · <a href={`mailto:${JAZZ_EMAIL}`} target="_blank" rel="noopener noreferrer">{JAZZ_EMAIL}</a></span>
        </div>
      </footer>
    </div>
  );
}
