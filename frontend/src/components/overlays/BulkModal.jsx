/**
 * Bulk scan overlay — port of runBulk/bulkGrade/renderBulk/exportBulkCsv.
 *
 * Preserved exactly: input split on newlines/commas/whitespace, de-duplicated, capped
 * at 25; four endpoints per domain; 3 concurrent workers; progressive result rows;
 * grade colour tiers; and the CSV column order.
 */
import { useRef, useState } from 'react';
import { ListChecks, Download } from 'lucide-react';
import { Modal } from './Modal.jsx';
import { Button, Spinner } from '../ui/index.jsx';
import { fetchJSON } from '../../utils/api.js';
import { normalizeDomain, downloadFile } from '../../utils/format.js';
import { useToasts } from '../../hooks/useToasts.jsx';

const GRADE_TEXT = (g) => {
  if (!g || g === '—') return 'text-slateGray';
  if (g === 'A+' || g === 'A' || g === 'B') return 'text-state-ok';
  if (g === 'C') return 'text-state-warn';
  return 'text-state-err';
};

/** Grade one domain from the same four checks the legacy bulk scan used. */
async function bulkGrade(domain, signal) {
  const [dns, ssl, email, bl] = await Promise.all([
    fetchJSON('/api/dns-lookup', { domain, resolver: 'balanced' }, signal).catch(() => ({ error: 1 })),
    fetchJSON('/api/ssl', { domain }, signal).catch(() => ({ error: 1 })),
    fetchJSON('/api/email-security', { domain }, signal).catch(() => ({ error: 1 })),
    fetchJSON('/api/blacklist-check', { domain }, signal).catch(() => ({ error: 1 })),
  ]);
  // Same shared scoring module as the main report — never a second implementation.
  const h = window.HetOpsScore?.computeHealthScore({ dns, ssl, emailsec: email, blacklist: bl });
  return {
    domain,
    pct: h ? h.pct : null,
    grade: h ? h.grade : '—',
    sslDays: ssl && !ssl.error ? ssl.certificate?.daysRemaining ?? null : null,
    blacklisted: bl && !bl.error && bl.results ? bl.results.some((r) => r.listed) : null,
    tls: ssl && !ssl.error ? ssl.grade?.letter || null : null,
  };
}

export function BulkModal({ open, onClose }) {
  const { toast } = useToasts();
  const [text, setText] = useState('');
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [running, setRunning] = useState(false);
  const abortRef = useRef(null);

  const run = async () => {
    const domains = [
      ...new Set(text.split(/[\n,\s]+/).map((d) => normalizeDomain(d)).filter(Boolean)),
    ].slice(0, 25);

    if (!domains.length) {
      toast('Enter at least one domain', 'warn');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRunning(true);
    setResults([]);
    setTotal(domains.length);

    const collected = [];
    let i = 0;
    // 3 concurrent workers, as in the legacy implementation.
    const worker = async () => {
      while (i < domains.length) {
        const d = domains[i++];
        let row;
        try {
          row = await bulkGrade(d, controller.signal);
        } catch {
          row = { domain: d, grade: '—', pct: null, sslDays: null, blacklisted: null, tls: null };
        }
        collected.push(row);
        setResults([...collected]); // progressive rows
      }
    };
    await Promise.all([worker(), worker(), worker()]);

    setRunning(false);
    toast(`Scanned ${collected.length} domain${collected.length !== 1 ? 's' : ''}`, 'ok');
  };

  const exportCsv = () => {
    const head = 'domain,grade,score,tls_grade,cert_days,blacklisted';
    const lines = results.map((r) =>
      [r.domain, r.grade, r.pct ?? '', r.tls ?? '', r.sslDays ?? '', r.blacklisted == null ? '' : r.blacklisted].join(',')
    );
    downloadFile('dnsentinel-bulk-scan.csv', [head, ...lines].join('\n'), 'text/csv');
    toast('CSV exported', 'ok');
  };

  return (
    <Modal open={open} onClose={onClose} title="Bulk Scan" icon={ListChecks} maxWidth="max-w-3xl">
      <p className="mb-3 text-[13px] leading-relaxed text-slateGray">
        Paste up to 25 domains (one per line or comma-separated). Each gets a quick health grade,
        certificate, blacklist and DNS check.
      </p>

      <label htmlFor="bulk-text" className="sr-only">Domains to scan</label>
      <textarea
        id="bulk-text"
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'github.com\ncloudflare.com\nexample.com'}
        className="w-full resize-y rounded-xl border border-line bg-surface px-3.5 py-3 font-mono text-[13px] leading-relaxed text-ink outline-none transition-shadow placeholder:text-slateGray/60 focus:border-brand focus:shadow-ring"
      />

      <Button className="mt-3 w-full" size="lg" onClick={run} loading={running}>
        {running ? 'Scanning…' : 'Scan domains'}
      </Button>

      {(results.length > 0 || running) && (
        <>
          <div className="mb-2.5 mt-6 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slateGray">
              Results {running ? `(${results.length}/${total})` : `· ${total}`}
            </p>
            {!running && results.length > 0 && (
              <Button variant="ghost" size="sm" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Export CSV
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr>
                  {['Domain', 'Grade', 'TLS', 'Cert', 'Blacklist'].map((h) => (
                    <th
                      key={h}
                      className="border-b border-line px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-slateGray"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.domain}>
                    <td className="border-b border-line px-3 py-2.5">
                      <a
                        href={`/?domain=${encodeURIComponent(r.domain)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[13px] text-brand hover:underline"
                      >
                        {r.domain}
                      </a>
                    </td>
                    <td className={`border-b border-line px-3 py-2.5 font-mono text-[13px] font-bold ${GRADE_TEXT(r.grade)}`}>
                      {r.grade}
                      {r.pct != null && <span className="ml-1 font-normal text-slateGray">{r.pct}</span>}
                    </td>
                    <td className="border-b border-line px-3 py-2.5 font-mono text-[13px] text-ink-soft">
                      {r.tls || '—'}
                    </td>
                    <td className="border-b border-line px-3 py-2.5 font-mono text-[13px] text-ink-soft">
                      {r.sslDays != null ? `${r.sslDays}d` : '—'}
                    </td>
                    <td className="border-b border-line px-3 py-2.5 font-mono text-[13px]">
                      {r.blacklisted == null ? (
                        <span className="text-ink-soft">—</span>
                      ) : r.blacklisted ? (
                        <span className="text-state-err">listed</span>
                      ) : (
                        <span className="text-ink-soft">clean</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {running && (
            <p className="mt-3 flex items-center gap-2.5 text-[12.5px] text-slateGray">
              <Spinner className="h-3.5 w-3.5" />
              Scanning…
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
