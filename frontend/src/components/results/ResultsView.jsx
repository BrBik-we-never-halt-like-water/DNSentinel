/**
 * Results view: domain header, headline stats, security scorecard, and the
 * category → tab navigation over the individual check panes.
 *
 * Tab ids, categories and their order come straight from the legacy TAB_CAT map, so
 * deep links (?tab=…) and the information hierarchy are preserved.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Radar, GitCompare, Link2, FileText, Download, ClipboardCheck, ChevronRight, Construction,
} from 'lucide-react';
import { Button, Card, LoadingBlock, Pill, SeverityBadge, Skeleton } from '../ui/index.jsx';
import { CAT_LABEL, EXPLAIN, TAB_CAT } from '../../constants/legacy.js';
import { collectFindings, catIssueCounts, issueTotal } from '../../utils/findings.js';
import { computeHealth, tabHealth, HEALTH_TEXT } from '../../utils/health.js';
import { safeCopy } from '../../utils/format.js';
import { getExplainPrefs, setExplainPref } from '../../utils/storage.js';
import { useToasts } from '../../hooks/useToasts.jsx';
import * as Panes from '../panes/index.jsx';
import { ReportNav, CATEGORIES, TABS_BY_CAT, TAB_LABEL } from './ReportNav.jsx';


/** Which state slot backs each tab (mirrors the legacy `go()` assignments). */
const TAB_SLOT = {
  dns: 'dns', whois: 'whois', geoip: 'geoip', propagation: 'prop',
  ssl: 'ssl', security: 'bl', headers: 'headers', csp: 'csp', dnssec: 'dnssec',
  'dnssec-chain': 'dnssecChain', ocsp: 'ocsp', hsts: 'hsts', takeover: 'takeover',
  emailsec: 'emailsec', mx: 'mx', mtasts: 'mtasts',
  ipv6: 'ipv6', trace: 'trace', ports: 'ports',
  http: 'http', redirect: 'redirect', tech: 'tech', cors: 'cors', robots: 'robots',
  ct: 'ct', typosquat: 'typosquat',
};

/** Tab id → pane component. Covers every key in TAB_CAT (all 26 tabs). */
const PANE_COMPONENTS = {
  dns: Panes.DnsPane,
  ssl: Panes.SslPane,
  'dnssec-chain': Panes.DnssecChainPane,
  typosquat: Panes.TyposquatPane,
  mtasts: Panes.MtastsPane,
  ipv6: Panes.Ipv6Pane,
  http: Panes.HttpPane,
  redirect: Panes.RedirectPane,
  robots: Panes.RobotsPane,
  cors: Panes.CorsPane,
  ct: Panes.CtPane,
  tech: Panes.TechPane,
  trace: Panes.TracePane,
  mx: Panes.MxPane,
  takeover: Panes.TakeoverPane,
  csp: Panes.CspPane,
  ocsp: Panes.OcspPane,
  hsts: Panes.HstsPane,
  headers: Panes.HeadersPane,
  dnssec: Panes.DnssecPane,
  emailsec: Panes.EmailSecPane,
  whois: Panes.WhoisPane,
  security: Panes.SecurityPane,
  propagation: Panes.PropagationPane,
  geoip: Panes.GeoPane,
  ports: Panes.PortsPane,
};

export function ResultsView({ domain, data, analyzing, pending, initialTab, watching, onToggleWatch, onOpenCompare, onOpenMonitor, onTabChange }) {
  const [cat, setCat] = useState(() => (initialTab && TAB_CAT[initialTab]) || 'overview');
  const [tab, setTab] = useState(() => (initialTab && TAB_CAT[initialTab] ? initialTab : 'overview'));
  const { toast } = useToasts();

  const findings = useMemo(() => collectFindings(data), [data]);
  const health = useMemo(() => computeHealth(data), [data]);
  const counts = useMemo(() => catIssueCounts(data), [data]);
  const catHealth = useMemo(() => tabHealth(data), [data]);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  // The route owns the URL; just report the active tab upward.
  useEffect(() => {
    onTabChange?.(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Opening a category lands on its first section.
  const selectCat = (c) => {
    setCat(c);
    setTab(c === 'overview' ? 'overview' : TABS_BY_CAT[c][0]);
  };

  const sectionTitle = tab === 'overview' ? 'Report overview' : TAB_LABEL[tab] || tab;

  const goToTab = (t) => {
    setCat(TAB_CAT[t] || 'overview');
    setTab(t);
    document.getElementById('report-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const share = async () => {
    const url = `${location.origin}/report?domain=${encodeURIComponent(domain)}${tab !== 'overview' ? `&tab=${tab}` : ''}`;
    await safeCopy(url);
    toast('Report link copied', 'ok');
  };

  /**
   * Inject a branded header into the report for the print only, then remove it when
   * the dialog closes (legacy exportPDF). The @media print block in index.css reveals
   * #pdfPrintHeader and hides the interactive chrome.
   */
  const exportPdf = () => {
    const host = document.getElementById('report');
    if (!host) return;
    let hdr = document.getElementById('pdfPrintHeader');
    if (!hdr) {
      hdr = document.createElement('div');
      hdr.id = 'pdfPrintHeader';
      host.insertBefore(hdr, host.firstChild);
    }
    // textContent throughout: the domain is user input and must never be markup.
    hdr.textContent = '';
    const wm = document.createElement('div');
    wm.className = 'pdf-wm';
    wm.textContent = 'DNSentinel Report';
    const meta = document.createElement('div');
    meta.className = 'pdf-meta';
    const grade = health ? ' \u00b7 Grade ' + health.grade + ' (' + health.pct + '/100)' : '';
    meta.textContent = domain + grade + ' \u2014 generated ' + new Date().toLocaleString();
    hdr.appendChild(wm);
    hdr.appendChild(meta);

    toast('Opening print dialog — choose "Save as PDF"', 'info', 2600);
    const cleanup = () => {
      hdr?.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 350);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ domain, generatedAt: new Date().toISOString(), results: data }, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dnsentinel-${domain}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Report exported as JSON', 'ok');
  };

  return (
    <div id="report" className="shell scroll-mt-20 pb-24">
      <DomainHeader
        domain={domain}
        health={health}
        analyzing={analyzing}
        onShare={share}
        onExport={exportJson}
        onPdf={exportPdf}
        onCompare={onOpenCompare}
        onMonitor={onOpenMonitor}
        watching={watching}
        onToggleWatch={onToggleWatch}
        breakdownOpen={breakdownOpen}
        onToggleBreakdown={() => setBreakdownOpen((v) => !v)}
      />

      {breakdownOpen && <ScoreBreakdown health={health} onJump={goToTab} />}

      {/* Small screens: navigation as a strip above the content. */}
      <ReportNav
        variant="strip"
        className="lg:hidden"
        cat={cat}
        tab={tab}
        counts={counts}
        catHealth={catHealth}
        onSelectCat={selectCat}
        onSelectTab={setTab}
      />

      <div className="lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-6">
        <ReportNav
          className="hidden lg:block"
          cat={cat}
          tab={tab}
          counts={counts}
          catHealth={catHealth}
          onSelectCat={selectCat}
          onSelectTab={setTab}
        />

        <section id="report-section" className="min-w-0 scroll-mt-24">
          <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">
              {sectionTitle}
            </h2>
            {cat !== 'overview' && (
              <p className="text-[12.5px] text-slateGray">
                {CAT_LABEL[cat]} · section {TABS_BY_CAT[cat].indexOf(tab) + 1} of {TABS_BY_CAT[cat].length}
              </p>
            )}
          </header>

          {tab === 'overview' ? (
            <>
              <StatCards data={data} pending={pending} onJump={goToTab} />
              <Overview findings={findings} health={health} counts={counts} analyzing={analyzing} onJump={goToTab} />
              <Scorecard
                findings={findings}
                health={health}
                analyzing={analyzing}
                domain={domain}
                onJump={goToTab}
              />
            </>
          ) : (
            <PaneHost tab={tab} data={data} pending={pending} />
          )}
        </section>
      </div>
    </div>
  );
}

/* ── Domain header ───────────────────────────────────────────────────────────── */

function DomainHeader({ domain, health, analyzing, onShare, onExport, onPdf, onCompare, onMonitor, watching, onToggleWatch, breakdownOpen, onToggleBreakdown }) {
  const pct = health?.pct ?? 0;
  /**
   * Ring / grade colour straight from the percentage, using the legacy score bands
   * (>=85 good, >=70 acceptable, >=50 warning, else bad). Deriving it from `pct` rather
   * than matching on the tone *string* means no vocabulary mismatch can silently fall
   * through to the neutral colour — which is exactly what happened here: a healthy
   * domain scoring 87 rendered a purple ring next to a green grade.
   */
  const toneStroke = !health
    ? '#6D28D9'
    : health.pct >= 70
      ? '#0F9D74'
      : health.pct >= 50
        ? '#B45309'
        : '#DC2626';

  return (
    <Card className="mb-3.5 overflow-hidden">
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">Report for</p>
          <h2 className="mt-1 truncate font-mono text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
            {domain}
          </h2>
          {analyzing && (
            <p className="mt-2 flex items-center gap-2 text-[12.5px] text-slateGray">
              <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-accent" aria-hidden="true" />
              Running checks…
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <button
            type="button"
            onClick={onToggleBreakdown}
            aria-expanded={breakdownOpen}
            title="See how this grade is calculated"
            className="flex items-center gap-4 rounded-2xl px-2 py-1 text-left transition-colors hover:bg-surface-muted/60"
          >
            <div className="relative h-[84px] w-[84px] shrink-0">
              <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
                <circle cx="40" cy="40" r="34" fill="none" stroke="#E2E8F0" strokeWidth="6" />
                {/*
                  pathLength="100" normalises the geometry so the dash values are plain
                  percentages — dasharray 100, offset 100-pct. Mixing a pixel-based
                  dasharray attribute with a CSS transition previously left the offset
                  pinned at the full circumference, which drew no arc at all (the colour
                  was always correct; the arc was simply invisible).
                */}
                <circle
                  cx="40" cy="40" r="34" fill="none" pathLength="100"
                  strokeWidth="6" strokeLinecap="round"
                  style={{
                    stroke: toneStroke,
                    strokeDasharray: 100,
                    strokeDashoffset: 100 - Math.max(0, Math.min(100, pct)),
                    transition: 'stroke-dashoffset .9s cubic-bezier(.4,0,.2,1), stroke .3s',
                  }}
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <span className="font-display text-lg font-extrabold text-ink">{health ? pct : '—'}</span>
              </div>
            </div>
            <div>
              <p className="font-display text-4xl font-extrabold leading-none" style={{ color: toneStroke }}>
                {health?.grade ?? '—'}
              </p>
              <p className="mt-1 text-2xs font-semibold uppercase tracking-[0.1em] text-slateGray">
                Health score
              </p>
              <p className="mt-0.5 text-[10px] text-slateGray/80 underline" data-print="hide">
                {breakdownOpen ? 'Hide breakdown' : 'How is this calculated?'}
              </p>
            </div>
          </button>

          <div className="flex flex-wrap gap-2" data-print="hide">
            <Button
              variant={watching ? 'accent' : 'secondary'}
              size="sm"
              onClick={onToggleWatch}
              title={watching ? 'Stop monitoring this domain' : 'Monitor this domain for changes'}
            >
              <Radar className="h-3.5 w-3.5" aria-hidden="true" />{watching ? 'Watching' : 'Watch'}
            </Button>
            <Button variant="secondary" size="sm" onClick={onMonitor} title="Open monitoring">
              Monitor
            </Button>
            <Button variant="secondary" size="sm" onClick={onCompare}>
              <GitCompare className="h-3.5 w-3.5" aria-hidden="true" />Compare
            </Button>
            <Button variant="secondary" size="sm" onClick={onShare}>
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />Share
            </Button>
            <Button variant="secondary" size="sm" onClick={onPdf}>
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />PDF
            </Button>
            <Button variant="secondary" size="sm" onClick={onExport}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />JSON
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ── Headline stat tiles ─────────────────────────────────────────────────────── */

function StatCards({ data, pending, onJump }) {
  const dnsTotal = data.dns?.summary?.totalRecords ?? data.dns?.totals?.records ?? null;
  const sslGrade = data.ssl?.error ? 'Error' : data.ssl?.grade?.letter ?? null;
  const emailScore = data.emailsec?.error ? null : data.emailsec?.overallScore ?? null;
  const blListed = data.bl?.results ? data.bl.results.filter((r) => r.listed).length : null;

  const tiles = [
    { key: 'dns', label: 'DNS records', tab: 'dns', value: dnsTotal, tone: 'neutral', loading: pending.dns },
    {
      key: 'ssl', label: 'SSL certificate', tab: 'ssl', value: sslGrade, loading: pending.ssl,
      tone: data.ssl?.error ? 'err' : /^A/.test(sslGrade || '') ? 'ok' : sslGrade ? 'warn' : 'neutral',
    },
    {
      key: 'email', label: 'Email security', tab: 'emailsec', value: emailScore != null ? `${emailScore}%` : null,
      loading: pending.emailsec, tone: emailScore >= 80 ? 'ok' : emailScore >= 50 ? 'warn' : emailScore != null ? 'err' : 'neutral',
    },
    {
      key: 'bl', label: 'Blacklist', tab: 'security', value: blListed == null ? null : blListed ? `${blListed} listed` : 'Clean',
      loading: pending.bl, tone: blListed ? 'err' : blListed === 0 ? 'ok' : 'neutral',
    },
  ];

  const TONE = { ok: 'text-state-ok', warn: 'text-state-warn', err: 'text-state-err', neutral: 'text-ink' };
  const BAR = { ok: 'bg-state-ok', warn: 'bg-state-warn', err: 'bg-state-err', neutral: 'bg-brand' };

  return (
    <div className="mb-3.5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.key} as="button" hover onClick={() => onJump(t.tab)} className="relative overflow-hidden p-5 text-left">
          <span className={`absolute inset-x-0 top-0 h-[3px] ${BAR[t.tone]}`} aria-hidden="true" />
          <p className="text-2xs font-bold uppercase tracking-[0.12em] text-slateGray">{t.label}</p>
          {t.loading ? (
            <Skeleton className="mt-3 h-6 w-16" />
          ) : (
            <p className={`mt-3 text-xl font-bold leading-none ${TONE[t.tone]}`}>{t.value ?? '—'}</p>
          )}
        </Card>
      ))}
    </div>
  );
}

/* ── Security scorecard ──────────────────────────────────────────────────────── */

function Scorecard({ findings, health, analyzing, domain, onJump }) {
  const { toast } = useToasts();
  const [showPassed, setShowPassed] = useState(false);

  if (!findings.length) {
    return analyzing ? (
      <Card className="mb-4 flex items-center gap-3 px-5 py-3.5">
        <span className="h-3.5 w-3.5 animate-spinSlow rounded-full border-2 border-brand/25 border-t-brand" aria-hidden="true" />
        <p className="text-[12.5px] text-slateGray">
          <strong className="font-semibold text-ink-soft">Security scorecard</strong> — calculating score, your
          records are loading below…
        </p>
      </Card>
    ) : null;
  }

  const issues = findings.filter((f) => f.sev !== 'good');
  const passed = findings.filter((f) => f.sev === 'good');
  const top3 = issues.slice(0, 3);

  const counts = findings.reduce((a, f) => ({ ...a, [f.sev]: (a[f.sev] || 0) + 1 }), {});
  const COUNT_TONE = { crit: 'err', high: 'err', med: 'warn', low: 'info', good: 'ok' };
  const COUNT_LABEL = { crit: 'Critical', high: 'High', med: 'Medium', low: 'Low', good: 'Passed' };

  const copyFix = async (f) => {
    await safeCopy(f.snippet(domain));
    toast('Fix copied to clipboard', 'ok');
  };

  return (
    <Card className="mb-5 p-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h3 className="flex items-center gap-2 text-[15px] font-bold">
          <ClipboardCheck className="h-4 w-4 text-brand" aria-hidden="true" />
          Security scorecard
        </h3>
        <div className="ml-auto flex flex-wrap gap-2">
          {['crit', 'high', 'med', 'low', 'good'].map(
            (s) => counts[s] ? <Pill key={s} tone={COUNT_TONE[s]}>{counts[s]} {COUNT_LABEL[s]}</Pill> : null
          )}
        </div>
      </div>

      {analyzing && (
        <p className="mb-4 flex items-center gap-2 text-[12.5px] text-slateGray">
          <span className="h-3 w-3 animate-spinSlow rounded-full border-2 border-brand/25 border-t-brand" aria-hidden="true" />
          Still analyzing — more findings may appear…
        </p>
      )}

      {!issues.length && !analyzing && (
        <p className="mb-4 rounded-xl border border-state-ok/20 bg-state-okSoft px-4 py-3 text-[13px] text-state-ok">
          All clear — no issues found across {findings.length} evaluated checks.
        </p>
      )}

      {top3.length > 0 && (
        <div className="mb-4 rounded-2xl border border-line bg-surface-soft/60 p-4">
          <p className="mb-3 text-2xs font-bold uppercase tracking-[0.1em] text-slateGray">
            Top {top3.length === 1 ? 'action' : `${top3.length} actions`} to improve this domain
          </p>
          <div className="space-y-3">
            {top3.map((f, i) => (
              <div key={f.id} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-brand/25 bg-brand-50 text-[11px] font-bold text-brand">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-ink">{f.title}</p>
                  {f.fix && <p className="mt-1 text-[12.5px] leading-relaxed text-slateGray">{f.fix}</p>}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {f.snippet && (
                    <Button variant="ghost" size="sm" onClick={() => copyFix(f)}>Copy fix</Button>
                  )}
                  {f.tab && (
                    <Button variant="ghost" size="sm" onClick={() => onJump(f.tab)}>
                      View <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {issues.length > 3 && (
        <div className="space-y-2">
          {issues.slice(3).map((f) => (
            <FindingRow key={f.id} f={f} domain={domain} onJump={onJump} onCopyFix={copyFix} />
          ))}
        </div>
      )}

      {passed.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowPassed((v) => !v)}
            aria-expanded={showPassed}
            className="inline-flex items-center gap-1.5 rounded-lg py-1.5 text-[12.5px] font-medium text-state-ok"
          >
            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showPassed ? 'rotate-90' : ''}`} aria-hidden="true" />
            {passed.length} check{passed.length !== 1 ? 's' : ''} passed
          </button>
          {showPassed && (
            <div className="mt-2 space-y-2">
              {passed.map((f) => (
                <FindingRow key={f.id} f={f} domain={domain} onJump={onJump} onCopyFix={copyFix} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <span className="text-xs text-slateGray">
          Grade:{' '}
          <strong className={health ? `text-state-${health.tone === 'okish' ? 'ok' : health.tone}` : 'text-ink'}>
            {health ? `${health.grade} · ${health.pct}/100` : '—'}
          </strong>
        </span>
      </div>
    </Card>
  );
}

const SEV_BORDER = {
  crit: 'border-l-state-err', high: 'border-l-red-400',
  med: 'border-l-state-warn', low: 'border-l-state-info', good: 'border-l-state-ok',
};

function FindingRow({ f, domain, onJump, onCopyFix }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border border-line border-l-[3px] bg-surface-soft/50 px-4 py-3 ${SEV_BORDER[f.sev]}`}>
      <SeverityBadge sev={f.sev} />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-ink">{f.title}</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-slateGray">{f.detail}</p>
        {f.fix && f.sev !== 'good' && (
          <p className="mt-2 rounded-lg bg-surface-muted px-3 py-2 text-[12.5px] text-ink-soft">
            <span className="mr-1 text-2xs font-bold uppercase tracking-wide text-brand">Fix:</span>
            {f.fix}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
        {f.snippet && <Button variant="ghost" size="sm" onClick={() => onCopyFix(f)}>Copy fix</Button>}
        {f.tab && <Button variant="ghost" size="sm" onClick={() => onJump(f.tab)}>View</Button>}
      </div>
    </div>
  );
}

/* ── Overview ────────────────────────────────────────────────────────────────── */

function Overview({ findings, health, counts, analyzing, onJump }) {
  if (!findings.length && analyzing) return <Card><LoadingBlock label="Building overview…" /></Card>;

  const crit = findings.filter((f) => f.sev === 'crit').length;
  const high = findings.filter((f) => f.sev === 'high').length;

  const verdict = !health
    ? 'Waiting for the first checks to return…'
    : crit
      ? `${crit} critical issue${crit !== 1 ? 's' : ''} need attention right away.`
      : high
        ? `No critical problems, but ${high} high-severity issue${high !== 1 ? 's' : ''} should be addressed.`
        : findings.some((f) => f.sev !== 'good')
          ? 'No serious problems — a few improvements are available.'
          : 'Everything checked came back clean.';

  const tone = crit ? 'text-state-err' : high ? 'text-state-warn' : 'text-state-ok';

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-6 border-b border-line pb-6 sm:flex-row sm:items-center">
        <div className="shrink-0 rounded-2xl border border-line bg-surface-soft px-6 py-4 text-center">
          <p className="font-display text-4xl font-extrabold leading-none text-ink">{health?.grade ?? '—'}</p>
          <p className="mt-1.5 text-[13px] font-semibold text-slateGray">
            {health ? `${health.pct}` : '—'}
            <span className="text-xs font-normal text-slateGray/70">/100</span>
          </p>
        </div>
        <p className={`text-balance text-[17px] font-semibold leading-relaxed ${tone}`}>{verdict}</p>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {Object.entries(CAT_LABEL).map(([key, label]) => {
          const c = counts[key] || {};
          const n = issueTotal(c);
          const dot = c.crit || c.high ? 'bg-state-err' : n ? 'bg-state-warn' : 'bg-state-ok';
          return (
            <button
              key={key}
              onClick={() => onJump(TABS_BY_CAT[key][0])}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface-soft/50 px-4 py-3 text-left transition-all hover:-translate-y-px hover:border-brand/30 hover:bg-brand-50/40"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
              <span className="text-[13px] font-semibold text-ink">{label}</span>
              <span className="ml-auto text-[12.5px] text-slateGray">
                {n ? `${n} issue${n !== 1 ? 's' : ''}` : 'No issues found'}
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slateGray" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* ── Pane host ───────────────────────────────────────────────────────────────── */

function PaneHost({ tab, data, pending }) {
  // Restore this tab's explainer state, then keep writing it back on toggle.
  const [explainOpen, setExplainOpen] = useState(() => !!getExplainPrefs()[tab]);
  useEffect(() => {
    setExplainOpen(!!getExplainPrefs()[tab]);
  }, [tab]);

  const slot = TAB_SLOT[tab];
  const payload = data[slot];
  const Component = PANE_COMPONENTS[tab];
  const explain = EXPLAIN[tab];

  return (
    <div className="space-y-3">
      {explain && (
        <details
          className="group rounded-xl border border-line bg-surface px-4 py-3"
          open={explainOpen}
          onToggle={(e) => {
            // Persist per tab under the legacy hetops_explain_open key.
            setExplainOpen(e.currentTarget.open);
            setExplainPref(tab, e.currentTarget.open);
          }}
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[12.5px] text-slateGray">
            <span className="grid h-4 w-4 place-items-center rounded-full border border-line text-[10px] font-bold">?</span>
            What is {explain.title}?
          </summary>
          <div className="mt-3 space-y-1.5 border-t border-line pt-3 text-[13px] leading-relaxed text-ink-soft">
            <p>{explain.what}</p>
            <p className="font-semibold text-state-warn">{explain.why}</p>
            <p className="font-mono text-[11.5px] text-slateGray">{explain.expert}</p>
          </div>
        </details>
      )}

      {pending[slot] ? (
        <Card><LoadingBlock label={`Running ${TAB_LABEL[tab]} check…`} /></Card>
      ) : Component ? (
        <Component data={payload} all={data} />
      ) : (
        <Card>
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-state-warnSoft text-state-warn">
              <Construction className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="text-[15px] font-semibold text-ink">
              {TAB_LABEL[tab]} pane not migrated yet
            </h3>
            <p className="max-w-md text-[13px] leading-relaxed text-slateGray">
              This check still runs and its data is in the report — the React view for it is
              pending. The live single-file app remains the production frontend until every
              pane reaches parity.
            </p>
            {payload && (
              <details className="w-full max-w-lg text-left">
                <summary className="cursor-pointer text-[12.5px] font-medium text-brand">
                  Show raw response
                </summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-ink p-4 font-mono text-[11px] leading-relaxed text-surface-soft">
                  {JSON.stringify(payload, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ── Score breakdown ─────────────────────────────────────────────────────────── */

/**
 * "How the grade is calculated" (legacy renderScoreBreakdown). Sections and rows come
 * straight from the shared scoring module's breakdown, so this stays correct if the
 * weighting ever changes — it renders whatever health-score.js reports.
 */
function ScoreBreakdown({ health, onJump }) {
  if (!health) return null;
  return (
    <Card className="mb-3.5 animate-fadeUp p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-3">
        <h3 className="text-sm font-bold text-ink">How the grade is calculated</h3>
        <p className="font-mono text-[12px] text-slateGray">
          {health.pts} of {health.tot} points → {health.pct}/100 ({health.grade})
        </p>
      </div>

      {health.breakdown.map((sec) => (
        <div key={sec.key || sec.label} className="mb-3">
          <div className="mb-1.5 flex justify-between text-[12px] font-bold text-ink-soft">
            <span>{sec.label}</span>
            <span className="font-mono text-slateGray">
              {sec.earned}/{sec.max}
            </span>
          </div>
          {sec.rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2.5 py-1 pl-2">
              <span
                className={`w-3.5 shrink-0 text-center text-[13px] ${r.ok ? 'text-state-ok' : 'text-state-err'}`}
                aria-hidden="true"
              >
                {r.ok ? '✓' : '✗'}
              </span>
              <span className="flex-1 text-[12.5px] text-ink-soft">{r.label}</span>
              <button
                type="button"
                onClick={() => onJump(r.tab)}
                title="View details"
                className="shrink-0 rounded-md border border-line px-2 py-0.5 font-mono text-[11px] text-slateGray transition-colors hover:border-brand/40 hover:text-brand"
              >
                {r.pts}/{r.max}
              </button>
            </div>
          ))}
        </div>
      ))}

      <p className="mt-3 border-t border-line pt-3 text-[11.5px] leading-relaxed text-slateGray">
        Score covers DNS, email, TLS and blacklist. Every other check appears as a finding in the
        scorecard above.
      </p>
    </Card>
  );
}

/**
 * Category health dot. Status is conveyed by SHAPE as well as colour — filled for ok,
 * hollow ring for warn, ringed fill for error — so it survives colour-blindness, and
 * carries an aria-label so it is never colour-only.
 */
function HealthDot({ status }) {
  const cls =
    status === 'ok'
      ? 'bg-state-ok'
      : status === 'warn'
        ? 'border-2 border-state-warn bg-transparent'
        : 'border-2 border-red-900/40 bg-state-err';
  return (
    <span
      role="img"
      aria-label={HEALTH_TEXT[status] || status}
      className={`ml-0.5 h-[7px] w-[7px] shrink-0 rounded-full ${cls}`}
    />
  );
}
