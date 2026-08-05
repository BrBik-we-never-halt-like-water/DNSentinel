import { useCallback, useEffect, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { Decor, Footer, Navbar } from './components/layout/AppShell.jsx';
import { LandingPage } from './pages/LandingPage.jsx';
import { ReportPage } from './pages/ReportPage.jsx';
import { LoginModal } from './components/overlays/LoginModal.jsx';
import { CompareModal } from './components/overlays/CompareModal.jsx';
import { MonitorModal } from './components/overlays/MonitorModal.jsx';
import { BulkModal } from './components/overlays/BulkModal.jsx';
import { useToasts } from './hooks/useToasts.jsx';
import { authApi, syncApi } from './utils/api.js';
import { clearAccountCaches, setSnaps, setWatch } from './utils/storage.js';

/**
 * App shell: session, navigation chrome and the overlays — all shared across routes.
 *
 * Routes:
 *   /        landing page with the search
 *   /report  one domain's report (?domain= drives the scan, ?tab= the section)
 *
 * `server.js` already answers every non-/api path with the SPA shell
 * (`app.get('*')`), so /report survives a direct load or refresh with no backend
 * change.
 */
export default function App() {
  const { toast } = useToasts();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [overlay, setOverlay] = useState(null); // 'login' | 'compare' | 'monitor' | 'bulk'

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

  const close = () => setOverlay(null);
  const overlayProps = {
    onOpenCompare: () => setOverlay('compare'),
    onOpenMonitor: () => setOverlay('monitor'),
    onOpenBulk: () => setOverlay('bulk'),
  };

  return (
    <>
      <Decor />
      <Navbar user={user} onSignIn={() => setOverlay('login')} onSignOut={signOut} />

      <main>
        <Routes>
          <Route path="/" element={<LandingPage {...overlayProps} />} />
          <Route
            path="/report"
            element={
              <ReportPage
                user={user}
                onOpenCompare={overlayProps.onOpenCompare}
                onOpenMonitor={overlayProps.onOpenMonitor}
              />
            }
          />
          {/* Unknown client paths fall back to the landing page. */}
          <Route path="*" element={<LandingPage {...overlayProps} />} />
        </Routes>
      </main>

      <Footer />

      <LoginModal open={overlay === 'login'} onClose={close} />
      <CompareModal
        open={overlay === 'compare'}
        onClose={close}
        currentDomain={new URLSearchParams(window.location.search).get('domain') || ''}
        onPickDomain={(d) => navigate(`/report?domain=${encodeURIComponent(d)}`)}
      />
      <MonitorModal open={overlay === 'monitor'} onClose={close} user={user} />
      <BulkModal open={overlay === 'bulk'} onClose={close} />
    </>
  );
}
