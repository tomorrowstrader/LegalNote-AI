import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowRight, ArrowDown } from "lucide-react";
import Logo from "@/components/Logo";
import "./talk.css";

type Availability =
  | { available: true; timeZone: string; durationMinutes: number; slots: string[] }
  | { available: false; fallbackUrl: string };

const TZ = "Europe/London";
const JAZZ_EMAIL = "jazz.dennis@legalnote.ai";
const FALLBACK_URL = "https://cal.com/jazz-legalnote-technologies/discovery";

const dayKey = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const dayName = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short" }).format(new Date(iso));
const dayDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" }).format(new Date(iso));
const timeOf = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
const longWhen = (iso: string) =>
  `${new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso))} at ${timeOf(iso)} UK time`;

/** Channel tag from ?src= or ?utm_source=, kept to a short safe word. */
function readSource(): string | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("src") || params.get("utm_source");
  if (!raw) return null;
  const clean = raw.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 60);
  return clean || null;
}

export default function TalkPage() {
  const [, setLocation] = useLocation();
  const source = useMemo(readSource, []);

  useEffect(() => {
    document.title = "Book a call with Jazz | LegalNote";
  }, []);

  const { data, isLoading, refetch } = useQuery<Availability>({
    queryKey: ["/api/public/discovery-call/availability"],
    queryFn: async () => {
      const res = await fetch("/api/public/discovery-call/availability", { credentials: "omit" });
      if (!res.ok) throw new Error("availability");
      return res.json();
    },
    staleTime: 30_000,
    retry: 1,
  });

  const days = useMemo(() => {
    if (!data?.available) return [];
    const map = new Map<string, string[]>();
    for (const s of data.slots) {
      const k = dayKey(s);
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return Array.from(map.entries()).map(([key, slots]) => ({ key, slots }));
  }, [data]);

  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", firm: "", intakeAnswer: "", website: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offerBackup, setOfferBackup] = useState(false);

  useEffect(() => {
    if (!day && days.length) setDay(days[0].key);
  }, [days, day]);

  const daySlots = days.find((d) => d.key === day)?.slots ?? [];
  const canSubmit = !!slot && form.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(form.email) && !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!slot || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    setOfferBackup(false);
    try {
      const res = await fetch("/api/public/discovery-call", {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: slot,
          name: form.name,
          email: form.email,
          firm: form.firm || null,
          intakeAnswer: form.intakeAnswer || null,
          source,
          website: form.website,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.message || "Something went wrong. Please try again.");
        setOfferBackup(res.status >= 500);
        if (res.status === 409) {
          setSlot(null);
          refetch();
        }
        return;
      }
      const via = body?.platform === "meet" ? "meet" : "teams";
      setLocation(`/booked?at=${encodeURIComponent(body.startsAt)}&via=${via}`);
    } catch {
      setError("We couldn't reach LegalNote. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="lnb">
      <header className="lnb-in lnb-nav">
        <a href="/" aria-label="LegalNote home">
          <Logo variant="wordmark" size="md" tone="light" />
        </a>
        <a className="lnb-navlink" href="/demo/family">See the showroom</a>
      </header>

      <main>
        <section className="lnb-in lnb-hero">
          <div className="lnb-hero-copy">
            <span className="lnb-cap">Twenty minutes with the founder</span>
            <h1 className="lnb-disp lnb-h1">
              See what a <em className="lnb-gilt" style={{ fontStyle: "normal" }}>defensible</em> attendance note looks like.
            </h1>
            <span className="lnb-cursorline">20 minutes · video call · UK time</span>
            <p className="lnb-p">
              A short call about how your firm records client meetings today, and whether LegalNote fits the way you
              work. No slide deck and no hard sell.
            </p>
            <a className="lnb-cta" href="#book">
              Choose a time
              <span className="lnb-orb" aria-hidden><ArrowDown size={18} strokeWidth={2} /></span>
            </a>
          </div>

          <aside className="lnb-wg lnb-host">
            <img src="/images/jazz-dennis-portrait.jpg" alt="Jazz Dennis" width={936} height={1030} />
            <div className="lnb-host-name">
              <h2 className="lnb-disp lnb-h3">Jazz Dennis</h2>
              <span className="lnb-cap">Founder, LegalNote</span>
            </div>
            <p className="lnb-sm">
              I've spent my career in technology inside law firms and regulated institutions, including Clifford Chance,
              Coutts and Lloyd's of London. I'm not a solicitor, so I'll ask how your process works rather than tell you
              how to run it.
            </p>
          </aside>
        </section>

        <div className="lnb-in"><div className="lnb-rule" aria-hidden><span /><i /><span /></div></div>

        <section className="lnb-in" style={{ display: "flex", flexDirection: "column", gap: 28, paddingBlock: "clamp(40px,6vw,72px)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="lnb-cap">What we'll cover</span>
            <h2 className="lnb-disp lnb-h2">Twenty minutes, three parts.</h2>
          </div>
          <div className="lnb-tiles">
            {[
              ["01", "How notes are made in your firm", "Who writes them, when, and what happens when one is questioned months later."],
              ["02", "LegalNote in the room", "LegalNote joins our call, after the same consent email your clients would get. I'll then take you through a fictional matter, from the meeting to the filed attendance note."],
              ["03", "Whether it fits", "If it doesn't suit your firm, I'll say so. If it might, we'll talk about a governed evaluation."],
            ].map(([n, title, body]) => (
              <article key={n} className="lnb-paper lnb-tile">
                <span className="lnb-tile-n">{n}</span>
                <h3 className="lnb-disp lnb-h3">{title}</h3>
                <p className="lnb-sm">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="book" className="lnb-in" style={{ display: "flex", flexDirection: "column", gap: 24, scrollMarginTop: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="lnb-cap">Book the call</span>
            <h2 className="lnb-disp lnb-h2">Pick a time that suits you.</h2>
            <p className="lnb-sm">Times are in UK time, Monday to Friday.</p>
          </div>

          {isLoading ? (
            <div className="lnb-wg" style={{ padding: 26, display: "grid", gap: 10 }}>
              <div className="lnb-skel" /><div className="lnb-skel" /><div className="lnb-skel" />
            </div>
          ) : !data || !data.available || days.length === 0 ? (
            <div className="lnb-wg" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
              <h3 className="lnb-disp lnb-h3">
                {data && data.available ? "The diary is full for the next three weeks." : "Online booking is taking a short break."}
              </h3>
              <p className="lnb-p">
                You can still book: use the backup booking page, or email me and I'll find a time.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a
                  className="lnb-cta"
                  href={(data && !data.available && data.fallbackUrl) || FALLBACK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Backup booking page
                  <span className="lnb-orb" aria-hidden><ArrowRight size={18} strokeWidth={2} /></span>
                </a>
                <a className="lnb-cta cream" href={`mailto:${JAZZ_EMAIL}?subject=${encodeURIComponent("LegalNote: a 20-minute call")}`}>
                  Email Jazz
                  <span className="lnb-orb" aria-hidden><ArrowRight size={18} strokeWidth={2} /></span>
                </a>
              </div>
            </div>
          ) : (
            <div className="lnb-wg lnb-book">
              <div className="lnb-days">
                <span className="lnb-cap">1 · Day</span>
                <div className="lnb-daylist" role="group" aria-label="Choose a day">
                  {days.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      className="lnb-pill lnb-day"
                      aria-pressed={day === d.key}
                      onClick={() => {
                        setDay(d.key);
                        setSlot(null);
                      }}
                    >
                      {dayName(d.slots[0])}
                      <small>{dayDate(d.slots[0])}</small>
                    </button>
                  ))}
                </div>
                <span className="lnb-cap" style={{ marginTop: 8 }}>2 · Time</span>
                <div className="lnb-timelist" role="group" aria-label="Choose a time">
                  {daySlots.map((s) => (
                    <button key={s} type="button" className="lnb-pill" aria-pressed={slot === s} onClick={() => setSlot(s)}>
                      <span className="lnb-mono" style={{ fontSize: 14 }}>{timeOf(s)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <form className="lnb-times lnb-form" onSubmit={submit} noValidate>
                <span className="lnb-cap">3 · Your details</span>
                <div className="lnb-chosen" aria-live="polite">
                  {slot ? longWhen(slot) : "Choose a day and time first."}
                </div>
                <div className="lnb-row">
                  <div className="lnb-field">
                    <label htmlFor="talk-name">Your name</label>
                    <input id="talk-name" className="lnb-input" autoComplete="name" value={form.name} maxLength={120}
                      onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div className="lnb-field">
                    <label htmlFor="talk-email">Work email</label>
                    <input id="talk-email" type="email" className="lnb-input" autoComplete="email" value={form.email} maxLength={255}
                      onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                  </div>
                </div>
                <div className="lnb-field">
                  <label htmlFor="talk-firm">Firm <span>(optional)</span></label>
                  <input id="talk-firm" className="lnb-input" autoComplete="organization" value={form.firm} maxLength={160}
                    onChange={(e) => setForm({ ...form, firm: e.target.value })} />
                </div>
                <div className="lnb-field">
                  <label htmlFor="talk-intake">How are attendance notes written in your firm today? <span>(optional)</span></label>
                  <textarea id="talk-intake" className="lnb-input" value={form.intakeAnswer} maxLength={600}
                    placeholder="For example: typed up after the meeting from handwritten notes"
                    onChange={(e) => setForm({ ...form, intakeAnswer: e.target.value })} />
                  <p className="lnb-sm" style={{ fontSize: 13 }}>Please don't include client or matter details.</p>
                </div>
                <div className="lnb-hp" aria-hidden>
                  <label htmlFor="talk-website">Website</label>
                  <input id="talk-website" tabIndex={-1} autoComplete="off" value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })} />
                </div>
                {error && (
                  <p className="lnb-error" role="alert">
                    {error}
                    {offerBackup && (
                      <>
                        {" "}
                        <a href={FALLBACK_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
                          Open the backup booking page
                        </a>
                        .
                      </>
                    )}
                  </p>
                )}
                <button type="submit" className="lnb-cta" disabled={!canSubmit}>
                  {submitting ? "Booking…" : "Book the call"}
                  <span className="lnb-orb" aria-hidden><ArrowRight size={18} strokeWidth={2} /></span>
                </button>
                <p className="lnb-sm" style={{ fontSize: 13 }}>
                  LegalNote will ask to join and take a note of the call, so you'll get our consent email. Saying no is
                  fine and the call still goes ahead.
                </p>
                <p className="lnb-sm" style={{ fontSize: 13 }}>
                  We'll use your details to arrange the call and to follow up with you about LegalNote, and keep them for
                  up to 24 months after the call. See our <a href="/privacy" style={{ textDecoration: "underline" }} target="_blank" rel="noopener noreferrer">privacy policy</a>.
                </p>
              </form>
            </div>
          )}
        </section>
      </main>

      <footer className="lnb-foot">
        <div className="lnb-in">
          <span>LegalNote Technologies Ltd, 71–75 Shelton Street, London WC2H 9JQ</span>
          <span><a href="/privacy">Privacy</a> · <a href="/security">Security</a> · <a href={`mailto:${JAZZ_EMAIL}`} target="_blank" rel="noopener noreferrer">{JAZZ_EMAIL}</a></span>
        </div>
      </footer>
    </div>
  );
}
