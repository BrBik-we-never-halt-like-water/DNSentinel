/**
 * Landing sections. These reorganise the EXISTING product story into a scannable
 * page — hero, capabilities, how-it-works, FAQ. No new product features are implied:
 * every capability listed maps to a check the API already performs.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Search, ArrowRight, ShieldCheck, Globe2, Mail, Network, Lock, Eye, Radar,
  GitCompare, ListChecks, ChevronDown, Sparkles, Gauge, FileText,
} from 'lucide-react';
import { Button, Card, Pill } from '../ui/index.jsx';
import { getSearchHistory } from '../../utils/storage.js';

const EXAMPLES = ['github.com', 'cloudflare.com', 'google.com', 'vercel.com'];

/* ── Search: the focal point of the page ─────────────────────────────────────── */

export function SearchPanel({ onSubmit, analyzing, compact }) {
  const [value, setValue] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const wrapRef = useRef(null);

  useEffect(() => setHistory(getSearchHistory()), []);

  // Dismiss the history dropdown on outside click / Escape.
  useEffect(() => {
    if (!showHistory) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowHistory(false);
    };
    const onKey = (e) => e.key === 'Escape' && setShowHistory(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [showHistory]);

  const submit = (e) => {
    e?.preventDefault();
    setShowHistory(false);
    onSubmit(value);
    setHistory(getSearchHistory());
  };

  const pick = (d) => {
    setValue(d);
    setShowHistory(false);
    onSubmit(d);
  };

  return (
    <div ref={wrapRef} className="relative z-30 mx-auto w-full max-w-2xl">
      <form onSubmit={submit} className="group">
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface/90 p-2 shadow-card backdrop-blur-xl transition-shadow focus-within:border-brand/50 focus-within:shadow-ring sm:flex-row sm:items-center">
          <label htmlFor="domain-input" className="sr-only">
            Domain to analyze
          </label>
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slateGray"
              aria-hidden="true"
            />
            <input
              id="domain-input"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => history.length && setShowHistory(true)}
              placeholder="example.com or https://example.com"
              autoComplete="off"
              spellCheck="false"
              className="h-12 w-full bg-transparent pl-11 pr-3 font-mono text-[14.5px] text-ink outline-none placeholder:text-slateGray/70"
            />
          </div>
          <Button type="submit" size="lg" loading={analyzing} className="shrink-0 sm:w-auto">
            {analyzing ? 'Analyzing…' : 'Analyze'}
            {!analyzing && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </Button>
        </div>
      </form>

      {showHistory && history.length > 0 && (
        <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-2xl border border-line bg-surface shadow-modal">
          <p className="px-4 pb-1.5 pt-3 text-2xs font-bold uppercase tracking-[0.12em] text-slateGray">
            Recent
          </p>
          {history.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => pick(d)}
              className="flex w-full items-center gap-2.5 border-t border-line/70 px-4 py-2.5 text-left transition-colors hover:bg-brand-50"
            >
              <Search className="h-3.5 w-3.5 shrink-0 text-slateGray" aria-hidden="true" />
              <span className="font-mono text-[13px] text-ink-soft">{d}</span>
            </button>
          ))}
        </div>
      )}

      {!compact && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-slateGray">Try:</span>
          {EXAMPLES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => pick(d)}
              className="rounded-full border border-line bg-surface px-3.5 py-1.5 font-mono text-xs text-slateGray transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:bg-brand-50 hover:text-brand"
            >
              {d}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Hero ────────────────────────────────────────────────────────────────────── */

export function Hero({ onSubmit, analyzing, onOpenCompare, onOpenMonitor, onOpenBulk }) {
  return (
    <section className="relative pb-16 pt-20 sm:pt-24">
      <div className="shell text-center">
        <div className="mb-7 flex justify-center">
          <Pill tone="brand" className="animate-fadeUp gap-2 px-4 py-1.5 text-[11.5px] tracking-[0.1em]">
            <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-accent" aria-hidden="true" />
            DOMAIN INTELLIGENCE PLATFORM
          </Pill>
        </div>

        <h1 className="animate-fadeUp text-balance text-4xl font-extrabold leading-[1.05] tracking-tightest text-ink [animation-delay:60ms] sm:text-5xl lg:text-6xl">
          Know everything about
          <br className="hidden sm:block" />{' '}
          <span className="bg-gradient-to-r from-brand via-brand-500 to-accent bg-clip-text text-transparent">
            any domain
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl animate-fadeUp text-[15px] leading-relaxed text-slateGray [animation-delay:120ms] sm:text-base">
          One scan returns DNS records, WHOIS registration, TLS posture, email
          authentication, global propagation and security findings — with a plain-English
          fix for every issue.
        </p>

        <div className="mt-10 animate-fadeUp [animation-delay:180ms]">
          <SearchPanel onSubmit={onSubmit} analyzing={analyzing} />
        </div>

        <div className="mt-7 flex animate-fadeUp flex-wrap items-center justify-center gap-2.5 [animation-delay:240ms]">
          <Button variant="secondary" size="sm" onClick={onOpenCompare}>
            <GitCompare className="h-4 w-4" aria-hidden="true" />
            Compare &amp; history
          </Button>
          <Button variant="secondary" size="sm" onClick={onOpenMonitor}>
            <Radar className="h-4 w-4" aria-hidden="true" />
            Monitoring
          </Button>
          <Button variant="secondary" size="sm" onClick={onOpenBulk}>
            <ListChecks className="h-4 w-4" aria-hidden="true" />
            Bulk scan
          </Button>
        </div>

        <p className="mt-8 animate-fadeUp text-xs text-slateGray/80 [animation-delay:300ms]">
          Free · No account required · 26 checks per scan
        </p>
      </div>
    </section>
  );
}

/* ── Capabilities ────────────────────────────────────────────────────────────── */

const CAPABILITIES = [
  { icon: Globe2, title: 'DNS & records', body: 'A, AAAA, MX, TXT, NS, CNAME, SOA, CAA, SRV and PTR records with TTLs, plus registration data from RDAP with WHOIS fallback.' },
  { icon: Lock, title: 'TLS & certificates', body: 'SSL-Labs-style grading: protocol support, cipher and PFS analysis, chain validation and known-vulnerability checks.' },
  { icon: Mail, title: 'Email authentication', body: 'SPF, DKIM and DMARC policy strength, MX topology with STARTTLS probing, and MTA-STS / DANE enforcement.' },
  { icon: ShieldCheck, title: 'Security posture', body: 'Security headers, Content-Security-Policy grading, DNSSEC chain of trust, OCSP stapling and HSTS preload status.' },
  { icon: Network, title: 'Network reach', body: 'Global propagation across seven public resolvers, IPv6 dual-stack checks, GeoIP and common-port exposure.' },
  { icon: Eye, title: 'Threat intelligence', body: 'Certificate Transparency history, registered typosquat look-alikes and dangling-CNAME subdomain takeover risks.' },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-24 py-16">
      <div className="shell">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Capabilities</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Twenty-six checks, one report
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slateGray">
            Every check runs in parallel and streams into the report as it completes —
            you start reading results in seconds, not minutes.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map(({ icon: Icon, title, body }) => (
            <Card key={title} hover className="p-6">
              <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="text-[15px] font-bold">{title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-slateGray">{body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── How it works ────────────────────────────────────────────────────────────── */

const STEPS = [
  { icon: Search, title: 'Enter a domain', body: 'Paste a hostname or full URL. Input is normalised, and private or internal addresses are rejected.' },
  { icon: Gauge, title: 'Checks run in parallel', body: 'Six requests stay in flight at a time. Each pane fills in the moment its own check returns.' },
  { icon: FileText, title: 'Read the scorecard', body: 'Findings are ranked by severity with a copy-ready fix, and the grade shows exactly how it was calculated.' },
];

export function Process() {
  return (
    <section id="how" className="scroll-mt-24 py-16">
      <div className="shell">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            From domain to answers in three steps
          </h2>
        </div>

        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="relative">
              <Card className="h-full p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
                </div>
                <h3 className="text-[15px] font-bold">{title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-slateGray">{body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── FAQ ─────────────────────────────────────────────────────────────────────── */

const FAQS = [
  { q: 'Is DNSentinel free to use?', a: 'Yes. Scans are free and need no account. Signing in only adds cross-device history and email alerts for domains you monitor.' },
  { q: 'How is the health grade calculated?', a: 'DNS hygiene 50, email authentication 20, TLS certificate 30 and blacklist reputation 10. Checks that did not run drop out of the total rather than counting against you, so a partial scan still gives an honest percentage. Click the grade to see the full breakdown.' },
  { q: 'Do you store the domains I scan?', a: 'Recent searches and report snapshots live in your browser’s local storage. They are only synced to the server if you sign in, and signing out clears the local copies.' },
  { q: 'Is there an API?', a: 'Yes — every check is available as a JSON endpoint, plus an aggregate /api/scan call and an embeddable status badge. See the API documentation for details.' },
  { q: 'How often can I scan?', a: 'Anonymous use shares a generous per-IP limit of roughly 20 full analyses per minute. Responses are cached server-side for about five minutes, so repeat lookups are instant.' },
];

export function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="scroll-mt-24 py-16">
      <div className="shell">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">FAQ</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Common questions
          </h2>
        </div>

        <div className="mx-auto mt-10 max-w-3xl space-y-3">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <Card key={item.q} className="overflow-hidden">
                <h3>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="text-[14.5px] font-semibold text-ink">{item.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slateGray transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                </h3>
                {isOpen && (
                  <p className="animate-fadeIn border-t border-line px-5 py-4 text-[13.5px] leading-relaxed text-slateGray">
                    {item.a}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function TrustStrip() {
  return (
    <section className="border-y border-line bg-surface py-10">
      <div className="shell">
        <div className="grid gap-6 text-center sm:grid-cols-3">
          {[
            { icon: Sparkles, stat: '26', label: 'checks per scan' },
            { icon: Globe2, stat: '7', label: 'global DNS resolvers' },
            { icon: ShieldCheck, stat: '56', label: 'security findings detected' },
          ].map(({ icon: Icon, stat, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
              <p className="font-display text-3xl font-extrabold text-ink">{stat}</p>
              <p className="text-[13px] text-slateGray">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
