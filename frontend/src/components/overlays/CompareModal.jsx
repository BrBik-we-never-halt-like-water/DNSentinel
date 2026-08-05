/**
 * Compare & History overlay — port of openCompare/renderCompare/renderHistory.
 *
 * Preserved: the CMP_METRICS row set with winner/loser highlighting, the default
 * A/B selection (A = current domain or newest, B = next distinct domain), the
 * per-domain delta arrows and score sparklines, relative timestamps, click-a-row to
 * re-scan, and "Clear history".
 */
import { useMemo, useState } from 'react';
import { GitCompare } from 'lucide-react';
import { Modal } from './Modal.jsx';
import { Button } from '../ui/index.jsx';
import { getSnaps, clearSnaps } from '../../utils/storage.js';
import { CMP_METRICS, latestPerDomain, gradeTone } from '../../utils/snapshots.js';
import { relTime } from '../../utils/format.js';
import { useToasts } from '../../hooks/useToasts.jsx';

const GRADE_TEXT = { ok: 'text-state-ok', warn: 'text-state-warn', err: 'text-state-err', muted: 'text-slateGray' };

/** Score sparkline, oldest → newest (legacy sparkline()). */
function Sparkline({ values }) {
  if (!values || values.length < 2) return <span className="w-[72px] shrink-0" />;
  const w = 72;
  const h = 20;
  const n = values.length;
  const pts = values
    .map((v, i) => {
      const x = (i / (n - 1)) * w;
      const y = h - 2 - (Math.max(0, Math.min(100, v)) / 100) * (h - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const rising = values[values.length - 1] >= values[0];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 opacity-90" aria-hidden="true">
      <polyline
        points={pts}
        fill="none"
        stroke={rising ? '#0F9D74' : '#DC2626'}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CompareModal({ open, onClose, currentDomain, onPickDomain }) {
  const { toast } = useToasts();
  const [version, setVersion] = useState(0); // bumped to re-read storage after clearing

  const snaps = useMemo(() => (open ? getSnaps() : []), [open, version]);
  const domains = useMemo(() => (open ? latestPerDomain() : []), [open, version]);

  // Default A = current domain if present, else newest; B = next distinct domain.
  const defaultA = domains.some((s) => s.domain === currentDomain) ? currentDomain : domains[0]?.domain || '';
  const defaultB = domains.find((s) => s.domain !== defaultA)?.domain || '';
  const [a, setA] = useState(null);
  const [b, setB] = useState(null);
  const selA = a ?? defaultA;
  const selB = b ?? defaultB;

  const A = domains.find((s) => s.domain === selA);
  const B = domains.find((s) => s.domain === selB);

  const doClear = () => {
    clearSnaps();
    setVersion((v) => v + 1);
    setA('');
    setB('');
    toast('Scan history cleared', 'info', 2000);
  };

  return (
    <Modal open={open} onClose={onClose} title="Compare & History" icon={GitCompare} maxWidth="max-w-3xl">
      {/* A / B selectors */}
      <div className="mb-5 flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center sm:gap-3">
        <select
          aria-label="First domain to compare"
          value={selA}
          onChange={(e) => setA(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 font-mono text-[13px] text-ink outline-none transition-shadow focus:border-brand focus:shadow-ring"
        >
          {domains.map((s) => (
            <option key={s.domain} value={s.domain}>{s.domain}</option>
          ))}
        </select>
        <span className="text-center text-[12px] font-bold uppercase text-slateGray">vs</span>
        <select
          aria-label="Second domain to compare"
          value={selB}
          onChange={(e) => setB(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 font-mono text-[13px] text-ink outline-none transition-shadow focus:border-brand focus:shadow-ring"
        >
          {domains.map((s) => (
            <option key={s.domain} value={s.domain}>{s.domain}</option>
          ))}
        </select>
      </div>

      {/* Metric table */}
      {A && B ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse">
            <thead>
              <tr>
                {['Metric', A.domain, B.domain].map((h, i) => (
                  <th
                    key={i}
                    className="border-b border-line px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-slateGray"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CMP_METRICS.map(([label, key, fmt, better]) => {
                const va = A[key];
                const vb = B[key];
                // Only numeric, differing values get a winner/loser treatment.
                let ca = 'text-ink';
                let cb = 'text-ink';
                if (better !== 'none' && typeof va === 'number' && typeof vb === 'number' && va !== vb) {
                  const aWins = better === 'higher' ? va > vb : va < vb;
                  ca = aWins ? 'text-state-ok' : 'text-slateGray';
                  cb = aWins ? 'text-slateGray' : 'text-state-ok';
                }
                return (
                  <tr key={key}>
                    <td className="border-b border-line px-3 py-2.5 text-[12px] text-slateGray">{label}</td>
                    <td className={`border-b border-line px-3 py-2.5 font-mono text-[13px] font-semibold ${ca}`}>
                      {fmt(va)}
                    </td>
                    <td className={`border-b border-line px-3 py-2.5 font-mono text-[13px] font-semibold ${cb}`}>
                      {fmt(vb)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-5 text-center text-[13px] text-slateGray">
          Run at least two domains to compare them side by side.
        </p>
      )}

      {/* Recent scans */}
      <p className="mb-2.5 mt-6 text-[11px] font-bold uppercase tracking-[0.08em] text-slateGray">Recent scans</p>

      {snaps.length ? (
        <>
          <div className="flex flex-col gap-1.5">
            {snaps.map((s, i) => {
              // Previous snapshot of the SAME domain, for the delta arrow.
              const prev = snaps.slice(i + 1).find((p) => p.domain === s.domain);
              const showDelta = prev && prev.pct != null && s.pct != null && prev.pct !== s.pct;
              const up = showDelta && s.pct > prev.pct;
              // Series is oldest→newest, so reverse the recency-ordered list.
              const series = snaps.filter((p) => p.domain === s.domain && p.pct != null).map((p) => p.pct).reverse();
              return (
                <button
                  key={`${s.domain}-${s.ts}`}
                  type="button"
                  onClick={() => {
                    onClose();
                    onPickDomain(s.domain);
                  }}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface-soft/50 px-3 py-2.5 text-left transition-colors hover:border-brand/30 hover:bg-brand-50/40"
                >
                  <span className={`w-9 shrink-0 text-center font-display text-lg font-extrabold ${GRADE_TEXT[gradeTone(s.grade)]}`}>
                    {s.grade || '—'}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink">{s.domain}</span>
                  <Sparkline values={series} />
                  {showDelta && (
                    <span className={`shrink-0 text-[11px] font-bold ${up ? 'text-state-ok' : 'text-state-err'}`}>
                      {up ? '▲' : '▼'}
                      {Math.abs(s.pct - prev.pct)}
                    </span>
                  )}
                  <span className="shrink-0 text-[11px] text-slateGray">
                    {s.pct != null ? `${s.pct}/100 · ` : ''}
                    {relTime(s.ts)}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-2.5 text-right">
            <Button variant="ghost" size="sm" onClick={doClear}>Clear history</Button>
          </div>
        </>
      ) : (
        <p className="py-4 text-center text-[13px] text-slateGray">
          No scans yet — analyze a domain to start building history.
        </p>
      )}
    </Modal>
  );
}
