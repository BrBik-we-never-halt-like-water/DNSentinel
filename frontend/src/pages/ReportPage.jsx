/**
 * Report page — /report?domain=…&tab=…
 *
 * Owns the scan for one domain. The URL is the source of truth: changing ?domain=
 * starts a new scan, and the active section is mirrored into ?tab= so a report can be
 * shared, bookmarked and reloaded exactly as the legacy app allowed.
 *
 * The scan pipeline itself is untouched — same useScan hook, same endpoints, same
 * ordering. Only where the results are presented has changed.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { ResultsView } from '../components/results/ResultsView.jsx';
import { Button, Spinner } from '../components/ui/index.jsx';
import { useScan } from '../hooks/useScan.js';
import { useToasts } from '../hooks/useToasts.jsx';
import { isWatched } from '../utils/storage.js';
import { saveSnapshot, gradeChangeNotice } from '../utils/snapshots.js';
import { addWatch, removeWatch } from '../utils/monitor.js';
import { normalizeDomain } from '../utils/format.js';

export function ReportPage({ user, onOpenCompare, onOpenMonitor }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToasts();

  const domainParam = params.get('domain') || '';
  const tabParam = params.get('tab') || null;

  const { domain, data, analyzing, started, pending, run } = useScan();
  const [watching, setWatching] = useState(false);
  const [query, setQuery] = useState(domainParam);

  /* Nothing to report on without a domain — send them back to the search. */
  useEffect(() => {
    if (!domainParam) navigate('/', { replace: true });
  }, [domainParam, navigate]);

  /* The URL drives the scan: a new ?domain= (deep link, Compare, re-search) rescans. */
  useEffect(() => {
    if (domainParam) {
      setQuery(domainParam);
      run(domainParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainParam]);

  /* Keep the tab in the URL without stacking history entries. */
  const syncTab = useCallback(
    (tab) => {
      const next = new URLSearchParams(params);
      if (tab && tab !== 'overview') next.set('tab', tab);
      else next.delete('tab');
      if (next.toString() !== params.toString()) setParams(next, { replace: true });
    },
    [params, setParams]
  );

  /* Title reflects the report, so browser history and tabs are readable. */
  useEffect(() => {
    document.title = domainParam ? `${domainParam} — DNSentinel report` : 'DNSentinel — Domain Intelligence';
    return () => {
      document.title = 'DNSentinel — Domain Intelligence';
    };
  }, [domainParam]);

  /**
   * Save a snapshot when the scan settles and surface any grade change against the
   * previous snapshot for this domain (legacy saveSnapshot + notifyGradeChange).
   */
  const wasAnalyzing = useRef(false);
  useEffect(() => {
    if (wasAnalyzing.current && !analyzing && domain) {
      const prev = saveSnapshot(domain, data, { authenticated: !!user });
      const notice = gradeChangeNotice(prev, domain, data);
      if (notice) toast(notice.message, notice.type, notice.ms);
      setWatching(isWatched(domain));
    }
    wasAnalyzing.current = analyzing;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyzing, domain]);

  useEffect(() => {
    setWatching(domain ? isWatched(domain) : false);
  }, [domain]);

  const toggleWatch = () => {
    if (!domain) { toast('Run an analysis first', 'warn'); return; }
    if (isWatched(domain)) {
      removeWatch(domain, { authenticated: !!user });
      setWatching(false);
      toast(`Stopped monitoring ${domain}`, 'info', 2200);
    } else {
      addWatch(domain, data, { authenticated: !!user });
      setWatching(true);
      toast(
        user ? `Now monitoring ${domain} — email alerts on` : `Now monitoring ${domain} for changes`,
        'ok'
      );
    }
  };

  /* Re-scan from the report page without going back to the landing page. */
  const submitSearch = (e) => {
    e.preventDefault();
    const d = normalizeDomain(query);
    if (!d) { toast('Enter a domain to analyze', 'warn'); return; }
    if (d === domainParam) { run(d); return; } // same domain: just refresh
    navigate(`/report?domain=${encodeURIComponent(d)}`);
  };

  if (!domainParam) return null;

  const pendingCount = Object.values(pending).filter(Boolean).length;

  return (
    <>
      {/* Report toolbar: back to search, a compact re-search, live scan state. */}
      <div className="sticky top-16 z-30 border-b border-line bg-surface/85 backdrop-blur-md" data-print="hide">
        <div className="shell flex flex-wrap items-center gap-3 py-3">
          <Link
            to="/"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-slateGray transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            New scan
          </Link>

          <form onSubmit={submitSearch} className="flex min-w-0 flex-1 items-center gap-2">
            <label htmlFor="report-search" className="sr-only">Analyze another domain</label>
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slateGray"
                aria-hidden="true"
              />
              <input
                id="report-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                spellCheck="false"
                autoComplete="off"
                placeholder="Analyze another domain"
                className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-3 font-mono text-[13px] text-ink outline-none transition-shadow placeholder:font-sans placeholder:text-slateGray/70 focus:border-brand focus:shadow-ring"
              />
            </div>
            <Button type="submit" size="sm" loading={analyzing}>
              {analyzing ? 'Scanning' : 'Analyze'}
            </Button>
          </form>

          {analyzing && (
            <p className="flex shrink-0 items-center gap-2 text-[12.5px] text-slateGray">
              <Spinner className="h-3.5 w-3.5" />
              {/* `pending` is a map of slot -> in-flight, not a count. */}
              {pendingCount} check{pendingCount !== 1 ? 's' : ''} left
            </p>
          )}
        </div>
      </div>

      {started && (
        <ResultsView
          domain={domain}
          data={data}
          analyzing={analyzing}
          pending={pending}
          initialTab={tabParam}
          watching={watching}
          onToggleWatch={toggleWatch}
          onOpenCompare={onOpenCompare}
          onOpenMonitor={onOpenMonitor}
          onTabChange={syncTab}
        />
      )}
    </>
  );
}
