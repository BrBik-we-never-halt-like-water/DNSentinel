import { useCallback, useEffect, useRef, useState } from 'react';
import { Decor, Footer, Navbar } from './components/layout/AppShell.jsx';
import { Faq, Features, Hero, Process, TrustStrip } from './components/sections/Landing.jsx';
import { ResultsView } from './components/results/ResultsView.jsx';
import { LoginModal } from './components/overlays/LoginModal.jsx';
import { CompareModal } from './components/overlays/CompareModal.jsx';
import { MonitorModal } from './components/overlays/MonitorModal.jsx';
import { BulkModal } from './components/overlays/BulkModal.jsx';
import { useScan } from './hooks/useScan.js';
import { useToasts } from './hooks/useToasts.jsx';
import { authApi, syncApi } from './utils/api.js';
import { clearAccountCaches, isWatched, setSnaps, setWatch } from './utils/storage.js';
import { saveSnapshot, gradeChangeNotice } from './utils/snapshots.js';
import { addWatch, removeWatch } from './utils/monitor.js';

export default function App() {
  const { domain, data, analyzing, started, pending, run } = useScan();
  const { toast } = useToasts();

  const [user, setUser] = useState(null);
  const [overlay, setOverlay] = useState(null); // 'login' | 'compare' | 'monitor' | 'bulk'
  const [watching, setWatching] = useState(false);

  /**
   * When signed in the server is the source of truth — pull history and alerts into
   * the same local stores the UI already reads from (legacy pullServerData).
   */
  const pullServerData = useCallback(async () => {
    try {
      const [h, a] = await Promise.all([
        syncApi.getHistory().catch(() => ({})),
        syncApi.getAlerts().catch(() => ({})),
      ]);
      if (Array.isArray(h.history)) setSnaps(h.history.slice(0, 40));
      if (Array.isArray(a.alerts)) {
        setWatch(
          a.alerts.map((x) => ({
            domain: x.domain,
            addedAt: x.lastChecked || Date.now(),
            baseline: x.last || {},
            last: x.last || null,
            lastChanges: [],
            emailEnabled: x.emailEnabled !== false,
          }))
        );
      }
    } catch {
      /* ignore — local stores stay as they are */
    }
  }, []);

  /* ── Session ──────────────────────────────────────────────────────────────── */
  const refreshAuth = useCallback(async () => {
    try {
      const d = await authApi.me();
      const u = d.authenticated ? { email: d.email } : null;
      setUser(u);
      if (u) await pullServerData();
    } catch {
      setUser(null);
    }
  }, [pullServerData]);

  useEffect(() => { refreshAuth(); }, [refreshAuth]);

  const signOut = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    setUser(null);
    clearAccountCaches();
    setOverlay(null);
    setWatching(false);
    toast('Signed out', 'info', 2000);
  };

  /* ── Magic-link return: surface the result then clean the URL ─────────────── */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const auth = p.get('auth');
    if (auth) {
      if (auth === 'ok') { toast('Signed in successfully', 'ok'); refreshAuth(); }
      else if (auth === 'invalid') toast('That sign-in link is invalid or expired', 'err', 5000);
      p.delete('auth');
      const qs = p.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
    }
  }, [toast, refreshAuth]);

  /* ── ?domain= / ?tab= deep links, as the legacy app supported ─────────────── */
  const [initialTab, setInitialTab] = useState(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const d = p.get('domain');
    const t = p.get('tab');
    if (t) setInitialTab(t);
    if (d) run(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Save a snapshot when a scan finishes and report any grade change against the
   * previous snapshot for that domain (legacy saveSnapshot + notifyGradeChange).
   * Keyed on the analyzing→idle transition so it fires exactly once per scan.
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

  // Keep the Watch button in sync with the watchlist (legacy syncWatchBtn).
  useEffect(() => {
    setWatching(domain ? isWatched(domain) : false);
  }, [domain, overlay]);

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

  const close = () => setOverlay(null);

  return (
    <>
      <Decor />
      <Navbar user={user} onSignIn={() => setOverlay('login')} onSignOut={signOut} />

      <main>
        <Hero
          onSubmit={run}
          analyzing={analyzing}
          onOpenCompare={() => setOverlay('compare')}
          onOpenMonitor={() => setOverlay('monitor')}
          onOpenBulk={() => setOverlay('bulk')}
        />

        {started && (
          <ResultsView
            domain={domain}
            data={data}
            analyzing={analyzing}
            pending={pending}
            initialTab={initialTab}
            watching={watching}
            onToggleWatch={toggleWatch}
            onOpenCompare={() => setOverlay('compare')}
            onOpenMonitor={() => setOverlay('monitor')}
          />
        )}

        {!started && (
          <>
            <TrustStrip />
            <Features />
            <Process />
            <Faq />
          </>
        )}
      </main>

      <Footer />

      <LoginModal open={overlay === 'login'} onClose={close} />
      <CompareModal
        open={overlay === 'compare'}
        onClose={close}
        currentDomain={domain}
        onPickDomain={run}
      />
      <MonitorModal open={overlay === 'monitor'} onClose={close} user={user} />
      <BulkModal open={overlay === 'bulk'} onClose={close} />
    </>
  );
}
