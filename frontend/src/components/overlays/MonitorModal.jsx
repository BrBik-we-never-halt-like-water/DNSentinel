/**
 * Monitoring + Account overlay — port of openMonitor/renderMonitor/refreshMonitor and
 * renderAccountPanel/saveAccountSettings/createKey/deleteKey.
 *
 * Preserved: status dot levels, the stat chips (cert / domain / TLS / blacklist / A),
 * per-domain change lists, email-alert toggles (signed-in only), remove, "Check all
 * now", the 15-minute auto-poll while the tab is open, and the account section with
 * webhook URL, weekly digest and API-key management.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Radar, RefreshCw, AlertTriangle, Info, Save, Plus, ExternalLink } from 'lucide-react';
import { Modal } from './Modal.jsx';
import { Button, Pill, Spinner } from '../ui/index.jsx';
import { getWatch } from '../../utils/storage.js';
import { monStatusLevel, refreshAll, removeWatch, setAlertEmail } from '../../utils/monitor.js';
import { relTime, safeCopy } from '../../utils/format.js';
import { syncApi } from '../../utils/api.js';
import { useToasts } from '../../hooks/useToasts.jsx';

const DOT = {
  ok: 'bg-state-ok', warn: 'bg-state-warn', err: 'bg-state-err', idle: 'bg-slateGray/40',
};

/** Auto-poll interval — same 15 minutes the legacy app used while the tab is open. */
const POLL_MS = 15 * 60 * 1000;

export function MonitorModal({ open, onClose, user }) {
  const { toast } = useToasts();
  const [watch, setWatch] = useState([]);
  const [checking, setChecking] = useState(false);
  const abortRef = useRef(null);

  const reload = useCallback(() => setWatch(getWatch()), []);

  useEffect(() => {
    if (open) reload();
  }, [open, reload]);

  const runCheck = useCallback(
    async (silent) => {
      if (checking) return;
      setChecking(true);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const { watch: next, totalChanges, notices } = await refreshAll(controller.signal);
        setWatch([...next]);
        notices.forEach((n) => toast(n, 'warn', 6500));
        if (!silent) {
          toast(
            totalChanges
              ? `${totalChanges} change${totalChanges !== 1 ? 's' : ''} detected`
              : 'All monitored domains unchanged',
            'ok',
            2600
          );
        }
      } finally {
        setChecking(false);
      }
    },
    [checking, toast]
  );

  // Auto-poll while the tab is open, matching the legacy behaviour. Runs regardless of
  // whether the overlay is visible, so alerts still surface as toasts.
  useEffect(() => {
    const id = setInterval(() => {
      if (getWatch().length) runCheck(true);
    }, POLL_MS);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drop = (domain) => {
    setWatch([...removeWatch(domain, { authenticated: !!user })]);
    toast(`Stopped monitoring ${domain}`, 'info', 2000);
  };

  const toggleEmail = (domain, enabled) => {
    setWatch([...setAlertEmail(domain, enabled, { authenticated: !!user })]);
    toast(enabled ? `Email alerts on for ${domain}` : `Email alerts off for ${domain}`, 'info', 2000);
  };

  return (
    <Modal open={open} onClose={onClose} title="Domain Monitoring" icon={Radar} maxWidth="max-w-3xl">
      <div className="mb-4 flex items-center gap-3">
        <p className="flex-1 text-[12px] text-slateGray">
          {watch.length ? `${watch.length} domain${watch.length !== 1 ? 's' : ''} monitored` : ''}
        </p>
        <Button variant="secondary" size="sm" onClick={() => runCheck(false)} loading={checking}>
          {!checking && <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
          Check all now
        </Button>
      </div>

      {watch.length === 0 ? (
        <p className="py-5 text-center text-[13px] leading-relaxed text-slateGray">
          No domains monitored yet. Analyze a domain and press <strong className="font-semibold text-ink">Watch</strong>{' '}
          to track it for certificate expiry, blacklisting and DNS changes.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {watch.map((w) => {
            const s = w.last;
            const lvl = monStatusLevel(s);
            const stats = [];
            if (s) {
              if (s.sslDays != null) stats.push(['Cert', `${s.sslDays}d`]);
              if (s.whoisDays != null) stats.push(['Domain', `${s.whoisDays}d`]);
              if (s.grade) stats.push(['TLS', s.grade]);
              if (s.blacklisted != null) stats.push(['Blacklist', s.blacklisted ? 'listed' : 'clean']);
              if (s.aRecords?.length) {
                stats.push(['A', `${s.aRecords[0]}${s.aRecords.length > 1 ? ` +${s.aRecords.length - 1}` : ''}`]);
              }
            }
            return (
              <div key={w.domain} className="rounded-xl border border-line bg-surface-soft/50 px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[lvl]}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-ink">
                    {w.domain}
                  </span>
                  {user && (
                    <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-slateGray">
                      <input
                        type="checkbox"
                        checked={w.emailEnabled !== false}
                        onChange={(e) => toggleEmail(w.domain, e.target.checked)}
                        className="cursor-pointer accent-brand"
                      />
                      Email me
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => drop(w.domain)}
                    className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[11px] text-slateGray transition-colors hover:border-state-err/30 hover:text-state-err"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {stats.length ? (
                    stats.map(([k, v]) => (
                      <Pill key={k}>
                        {k} <strong className="font-semibold text-ink">{v}</strong>
                      </Pill>
                    ))
                  ) : (
                    <Pill>Not checked yet</Pill>
                  )}
                </div>

                {w.lastChanges?.length > 0 && (
                  <div className="mt-2.5 flex flex-col gap-1.5">
                    {w.lastChanges.map((c, i) => (
                      <p
                        key={i}
                        className="flex items-center gap-2 rounded-lg border border-state-warn/20 bg-state-warnSoft px-2.5 py-1.5 text-[11.5px] text-state-warn"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {c}
                      </p>
                    ))}
                  </div>
                )}

                <p className="mt-2 text-[10.5px] text-slateGray/80">
                  {s ? `Last checked ${relTime(s.ts)}` : `Added ${relTime(w.addedAt)}`}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {user && <AccountPanel />}

      <p className="mt-5 flex items-start gap-2 border-t border-line pt-4 text-[11.5px] leading-relaxed text-slateGray">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
        <span>
          Checks run automatically every 15 minutes while this tab is open.{' '}
          {user ? (
            <>
              Email alerts are sent to <strong className="font-semibold text-ink">{user.email}</strong> even when the
              tab is closed.
            </>
          ) : (
            <>
              <strong className="font-semibold text-ink">Sign in</strong> to receive email alerts even when the tab is
              closed.
            </>
          )}
        </span>
      </p>
    </Modal>
  );
}

/* ── Account settings (signed-in only) ───────────────────────────────────────── */

function AccountPanel() {
  const { toast } = useToasts();
  const [loading, setLoading] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [keys, setKeys] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settings, keyData] = await Promise.all([
        syncApi.getSettings().catch(() => ({})),
        syncApi.getKeys().then((d) => d.keys || []).catch(() => []),
      ]);
      setWebhookUrl(settings.webhookUrl || '');
      setDigestEnabled(!!settings.digestEnabled);
      setKeys(keyData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await syncApi.putSettings({ webhookUrl: webhookUrl.trim(), digestEnabled });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Save failed');
      toast('Settings saved', 'ok');
    } catch (e) {
      toast(e.message || 'Could not save settings', 'err');
    } finally {
      setSaving(false);
    }
  };

  const createKey = async () => {
    try {
      const r = await syncApi.createKey('API key');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      // The full key is only ever returned once, so copy it immediately.
      if (d.key) {
        await safeCopy(d.key);
        toast('API key created & copied — store it now', 'ok', 4000);
      }
      load();
    } catch (e) {
      toast(e.message || 'Could not create key', 'err');
    }
  };

  const revokeKey = async (key) => {
    try {
      await syncApi.deleteKey(key);
    } catch {
      /* ignore */
    }
    load();
    toast('API key revoked', 'info', 2000);
  };

  if (loading) {
    return (
      <p className="mt-5 flex items-center gap-2.5 border-t border-line pt-4 text-[12.5px] text-slateGray">
        <Spinner className="h-3.5 w-3.5" />
        Loading account settings…
      </p>
    );
  }

  return (
    <>
      <section className="mt-5 border-t border-line pt-4">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slateGray">Alert delivery</h3>

        <label htmlFor="acct-webhook" className="mb-1.5 block text-[13px] text-ink-soft">
          Webhook URL <span className="text-[11px] text-slateGray">(Slack / Discord / generic)</span>
        </label>
        <input
          id="acct-webhook"
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://hooks.slack.com/…"
          className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 font-mono text-[12px] text-ink outline-none transition-shadow focus:border-brand focus:shadow-ring"
        />

        <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-soft">
          <input
            type="checkbox"
            checked={digestEnabled}
            onChange={(e) => setDigestEnabled(e.target.checked)}
            className="cursor-pointer accent-brand"
          />
          Email me a weekly summary of monitored domains
        </label>

        <Button variant="secondary" size="sm" className="mt-3" onClick={save} loading={saving}>
          {!saving && <Save className="h-3.5 w-3.5" aria-hidden="true" />}
          Save settings
        </Button>
      </section>

      <section className="mt-5 border-t border-line pt-4">
        <h3 className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.08em] text-slateGray">
          Developer API
          <a
            href="/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium normal-case tracking-normal text-brand hover:underline"
          >
            Docs <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </h3>

        <div className="flex flex-col gap-1.5">
          {keys.length ? (
            keys.map((k) => (
              <div
                key={k.key}
                className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-soft/50 px-3 py-2"
              >
                <code className="font-mono text-[12px] text-brand">
                  {k.key.slice(0, 10)}…{k.key.slice(-4)}
                </code>
                <span className="min-w-0 flex-1 truncate text-[12px] text-slateGray">{k.label || ''}</span>
                <button
                  type="button"
                  onClick={() => revokeKey(k.key)}
                  className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[11px] text-slateGray transition-colors hover:border-state-err/30 hover:text-state-err"
                >
                  Revoke
                </button>
              </div>
            ))
          ) : (
            <p className="py-1 text-[12px] text-slateGray/80">No keys yet.</p>
          )}
        </div>

        <Button variant="secondary" size="sm" className="mt-3" onClick={createKey}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Create API key
        </Button>
      </section>
    </>
  );
}
