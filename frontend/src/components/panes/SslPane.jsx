/**
 * SSL / TLS pane — port of the legacy renderSsl() (the largest renderer, 231 lines).
 *
 * Every field, badge, threshold and label is preserved:
 *  • grade letter + score, days-remaining thresholds (>90 ok, >30 warn, else err)
 *  • cert type EV/OV/DV with the same tooltips, wildcard / must-staple / CAA badges
 *  • SHA-1 and long-lived (>398d) warning banners
 *  • protocol + PFS pills, certificate detail grid, SHA-256 fingerprint with copy
 *  • Subject Alt Names with the same >20 collapse rule and copy-all
 *  • expandable certificate chain with per-cert details, PEM download / view
 *  • known vulnerabilities, client handshake simulation table, recommendations
 */
import { useState } from 'react';
import { Unlock, Download, Eye, ChevronUp, ChevronDown, Link2, AlertTriangle, Monitor, Lightbulb } from 'lucide-react';
import { Card, Pill, ErrorBlock } from '../ui/index.jsx';
import { safeCopy, downloadFile } from '../../utils/format.js';
import { useToasts } from '../../hooks/useToasts.jsx';

/* Same client → icon map as the legacy pane. */
const CLIENT_ICONS = {
  'Firefox 120': '🦊', 'Chrome 120': '🌐', 'Safari 17': '🧭', 'Edge 120': '🔷',
  'Android 13': '📱', 'Java 8u291': '☕', 'IE 11 Win 7': '🪟',
};

const CERT_TYPE_DESC = {
  EV: 'Extended Validation — org identity verified by CA',
  OV: 'Organization Validation — org name verified',
  DV: 'Domain Validation — only domain ownership checked',
};
const CERT_TYPE_TONE = { EV: 'warn', OV: 'info', DV: 'neutral' };

/** Days-remaining tone, using the legacy breakpoints. */
const dayTone = (d) => (d > 90 ? 'text-state-ok' : d > 30 ? 'text-state-warn' : 'text-state-err');
const CHAIN_TONE = { leaf: 'accent', intermediate: 'purple', root: 'brand' };
const CHAIN_LABEL = { leaf: 'Leaf Certificate', root: 'Root CA' };

function CopyInline({ value, label = 'Copy' }) {
  const { toast } = useToasts();
  return (
    <button
      type="button"
      onClick={async () => { await safeCopy(value); toast('Copied to clipboard', 'ok', 1600); }}
      className="shrink-0 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-[10px] font-medium text-slateGray transition-colors hover:border-brand/40 hover:text-brand"
    >
      {label}
    </button>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slateGray/80">{label}</p>
      <div className="mt-0.5 text-[12px] text-ink-soft">{children}</div>
    </div>
  );
}

/* ── Certificate chain row ───────────────────────────────────────────────────── */

function ChainRow({ cert, index, isLast, onDownload, onView }) {
  const [open, setOpen] = useState(true);
  const tone = CHAIN_TONE[cert.type] || 'neutral';
  const label = CHAIN_LABEL[cert.type] || 'Intermediate CA';
  const daysLeft = cert.daysRemaining;

  const fpRaw = cert.fingerprint256 ? cert.fingerprint256.split(':').join('').toLowerCase() : '';
  const fpDisplay = fpRaw ? (fpRaw.match(/.{1,32}/g) || []).join(' ') : '';

  return (
    <div className={`border-b border-line/70 last:border-0 ${index === 0 ? 'bg-brand-50/40' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-muted/60"
      >
        {/* Chain connector: line above/below the node, as in the legacy tree */}
        <span className="flex flex-col items-center gap-0.5" aria-hidden="true">
          {index > 0 && <span className="h-3.5 w-px bg-line-strong" />}
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone === 'accent' ? 'bg-accent' : tone === 'purple' ? 'bg-brand-400' : 'bg-brand'}`} />
          {!isLast && <span className="h-3.5 w-px bg-line-strong" />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={tone === 'purple' ? 'brand' : tone}>{label}</Pill>
            {cert.sha1Signed && <Pill tone="err">SHA-1 ⚠</Pill>}
            <span className="truncate text-[13px] font-semibold text-ink">
              {cert.subject?.CN || cert.subject?.O || 'Unknown'}
            </span>
          </div>
          {(cert.issuer?.O || cert.issuer?.CN) && (
            <p className="mt-0.5 truncate text-[10.5px] text-slateGray">
              Issued by {cert.issuer.CN || cert.issuer.O}
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className={`text-sm font-bold ${dayTone(daysLeft)}`}>
            {daysLeft > 0 ? `${daysLeft}d` : cert.isExpired ? 'EXPIRED' : '—'}
          </p>
          <p className="text-[9px] text-slateGray">remaining</p>
        </div>

        {open ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-slateGray" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slateGray" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="mb-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Subject">
              {cert.subject?.CN || '—'}
              {cert.subject?.O && <p className="text-[10.5px] text-slateGray">{cert.subject.O}</p>}
            </Field>
            <Field label="Issuer">{cert.issuer?.CN || '—'}</Field>
            <Field label="Valid from">{cert.validFrom || '—'}</Field>
            <Field label="Expires">
              <span className={dayTone(daysLeft)}>{cert.validTo || '—'}</span>
            </Field>
            {cert.keyBits && <Field label="Key">{cert.keyBits}-bit {cert.keyType || ''}</Field>}
            {cert.serialNumber && (
              <Field label="Serial">
                <span className="break-all font-mono text-[10.5px]">{cert.serialNumber}</span>
              </Field>
            )}
            {cert.signatureAlgorithm && (
              <Field label="Signature">
                <span className={cert.sha1Signed ? 'text-state-err' : ''}>{cert.signatureAlgorithm}</span>
              </Field>
            )}
            {cert.ocspURI && (
              <Field label="OCSP">
                <span className="break-all font-mono text-[10.5px] text-brand">{cert.ocspURI}</span>
              </Field>
            )}
          </div>

          {fpDisplay && (
            <div className="mb-2.5">
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slateGray/80">
                SHA-256 fingerprint
              </p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all font-mono text-[10px] text-slateGray">{fpDisplay}</code>
                <CopyInline value={fpRaw} />
              </div>
            </div>
          )}

          {cert.pem && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onDownload(index)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand/25 bg-brand-50 px-3 py-1.5 text-[11px] font-semibold text-brand transition-colors hover:bg-brand-100"
              >
                <Download className="h-3 w-3" aria-hidden="true" />Download PEM
              </button>
              <button
                type="button"
                onClick={() => onView(index)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[11px] font-medium text-slateGray transition-colors hover:text-ink"
              >
                <Eye className="h-3 w-3" aria-hidden="true" />View PEM
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Handshake simulation ────────────────────────────────────────────────────── */

/** Protocol pill tone — same tiering as the legacy protoColor(). */
function protoTone(proto, supported) {
  if (!supported) return 'err';
  if (!proto) return 'neutral';
  if (proto.includes('1.3')) return 'ok';
  if (proto.includes('1.2')) return 'accent';
  if (proto.includes('1.1')) return 'warn';
  return 'err';
}

function Simulations({ sim }) {
  if (!sim.length) {
    return <p className="px-4 py-4 text-[13px] text-slateGray">No simulation data available</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr className="bg-surface-soft">
            {['Client', 'Protocol', 'Cipher', 'PFS', 'OK'].map((h, i) => (
              <th
                key={h}
                className={`px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slateGray ${i >= 3 ? 'text-center' : 'text-left'}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sim.map((s, i) => {
            const cipherShort = s.cipher ? (s.cipher.length > 28 ? s.cipher.slice(0, 26) + '…' : s.cipher) : '—';
            return (
              <tr key={i} className="border-t border-line/70 transition-colors hover:bg-brand-50/40">
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="text-base leading-none" aria-hidden="true">{CLIENT_ICONS[s.client] || '💻'}</span>
                    <span className="text-[12px] font-semibold text-ink">{s.client}</span>
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <Pill tone={protoTone(s.protocol, s.supported)}>{s.protocol || 'Failed'}</Pill>
                </td>
                <td className="max-w-[200px] truncate px-3 py-2.5 font-mono text-[10.5px] text-slateGray" title={s.cipher || ''}>
                  {cipherShort}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {s.pfs ? <Pill tone="ok">PFS</Pill> : <span className="text-[10px] text-slateGray">—</span>}
                </td>
                <td className="px-3 py-2.5 text-center text-[15px]">
                  <span className={s.supported ? 'text-state-ok' : 'text-state-err'} aria-hidden="true">
                    {s.supported ? '✓' : '✗'}
                  </span>
                  <span className="sr-only">{s.supported ? 'supported' : 'not supported'}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Pane ────────────────────────────────────────────────────────────────────── */

export function SslPane({ data }) {
  const { toast } = useToasts();
  const [showAllSans, setShowAllSans] = useState(false);

  if (!data) return null;

  if (data.error) {
    return (
      <Card className="flex items-center gap-4 p-6">
        <Unlock className="h-8 w-8 shrink-0 text-state-err" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-state-err">SSL Unavailable</p>
          <p className="mt-0.5 break-words font-mono text-[12px] text-slateGray">{data.error}</p>
        </div>
      </Card>
    );
  }

  const cert = data.certificate || data;
  const prot = data.protocols || {};
  const vuln = data.vulnerabilities || {};
  const pfs = data.pfs || {};
  const chain = data.certificate?.chain || cert.chain || [];
  const sim = data.handshakeSimulations || [];
  const grade = data.grade || { letter: 'F', score: 0 };
  const days = cert.daysRemaining;
  const recs = data.recommendations || [];
  const sans = cert.subjectAltNames || [];
  const sanCollapsible = sans.length > 20; // same rule as the legacy pane

  const ct = cert.certType || 'DV';

  const gradeTone = /^A/.test(grade.letter || '')
    ? 'text-state-ok'
    : /^B/.test(grade.letter || '')
      ? 'text-state-warn'
      : 'text-state-err';

  const downloadCert = (i) => {
    const pem = chain[i]?.pem;
    if (!pem) return;
    const cn = (chain[i].subject?.CN || `cert-${i}`).replace(/[^a-z0-9.-]/gi, '_');
    downloadFile(`${cn}.pem`, pem, 'application/x-pem-file');
    toast('Certificate downloaded', 'ok');
  };

  const downloadFullChain = () => {
    const pems = chain.map((c) => c.pem).filter(Boolean).join('\n');
    if (!pems) return;
    const cn = (cert.subject?.CN || 'chain').replace(/[^a-z0-9.-]/gi, '_');
    downloadFile(`${cn}-fullchain.pem`, pems, 'application/x-pem-file');
    toast('Full chain downloaded', 'ok');
  };

  const viewCertPem = (i) => {
    const pem = chain[i]?.pem;
    if (!pem) return;
    const w = window.open('', '_blank');
    if (!w) { toast('Popup blocked — allow popups to view the PEM', 'warn'); return; }
    // Written as text into a pre element rather than interpolated markup.
    w.document.title = `Certificate ${i} PEM`;
    const pre = w.document.createElement('pre');
    pre.style.cssText = 'white-space:pre-wrap;word-break:break-all;font-family:monospace;font-size:12px;padding:20px;line-height:1.5';
    pre.textContent = pem;
    w.document.body.style.cssText = 'margin:0;background:#F8FAFC;color:#0F172A';
    w.document.body.appendChild(pre);
  };

  const vulnList = Object.entries(vuln).filter(([, v]) => v && v.vulnerable);

  return (
    <div className="space-y-3.5">
      {/* Deep-analysis warning banners */}
      {cert.sha1Signed && (
        <div className="flex items-center gap-2 rounded-xl border border-state-err/25 bg-state-errSoft px-4 py-2.5 text-[12.5px] font-medium text-state-err">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Signed with SHA-1 — deprecated and insecure
        </div>
      )}
      {cert.longLivedCert && (
        <div className="flex items-center gap-2 rounded-xl border border-state-warn/25 bg-state-warnSoft px-4 py-2.5 text-[12.5px] font-medium text-state-warn">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Validity period {cert.validityPeriodDays}d exceeds the 398-day industry maximum
        </div>
      )}

      <div className="grid items-start gap-3.5 lg:grid-cols-[260px_1fr]">
        {/* Grade card */}
        <Card className="p-6 text-center">
          <p className="text-2xs font-bold uppercase tracking-[0.12em] text-slateGray">SSL grade</p>
          <p className={`mt-3 font-display text-[68px] font-extrabold leading-none ${gradeTone}`}>
            {grade.letter || 'F'}
          </p>
          <p className="mt-1.5 text-[13px] text-slateGray">Score: {grade.score || 0}/100</p>
          <div className="my-3.5 h-1 overflow-hidden rounded-full bg-surface-muted">
            <div
              className={`h-full rounded-full ${/^A/.test(grade.letter || '') ? 'bg-state-ok' : /^B/.test(grade.letter || '') ? 'bg-state-warn' : 'bg-state-err'}`}
              style={{ width: `${grade.score || 0}%` }}
            />
          </div>
          <div className="rounded-xl bg-surface-soft px-3 py-3">
            <p className={`text-[26px] font-bold leading-none ${dayTone(days)}`}>{days > 0 ? days : '✗'}</p>
            <p className="mt-1 text-[10.5px] text-slateGray">days remaining</p>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            <Pill tone={CERT_TYPE_TONE[ct] || 'neutral'} title={CERT_TYPE_DESC[ct] || ''}>{ct}</Pill>
            {cert.isWildcard && <Pill tone="warn">Wildcard</Pill>}
            {cert.mustStaple && <Pill tone="ok">Must-Staple</Pill>}
            {cert.caaMatch === true && <Pill tone="ok">CAA Match ✓</Pill>}
            {cert.caaMatch === false && <Pill tone="err">CAA Mismatch ✗</Pill>}
          </div>
        </Card>

        <div className="space-y-3">
          {/* Protocols */}
          <Card className="p-4">
            <p className="mb-2.5 text-2xs font-semibold uppercase tracking-[0.06em] text-slateGray">
              Protocols &amp; ciphers
            </p>
            <div className="flex flex-wrap gap-2">
              {prot.tls13 ? <Pill tone="ok">TLS 1.3 ✓</Pill> : <Pill tone="err">TLS 1.3 ✗</Pill>}
              {prot.tls12 ? <Pill tone="ok">TLS 1.2 ✓</Pill> : <Pill tone="warn">TLS 1.2 ✗</Pill>}
              {prot.tls11 && <Pill tone="warn">TLS 1.1 ⚠</Pill>}
              {prot.tls10 && <Pill tone="warn">TLS 1.0 ⚠</Pill>}
              {prot.sslv3 && <Pill tone="err">SSL 3.0 ✗</Pill>}
              {pfs.supported === true && <Pill tone="ok">PFS ✓</Pill>}
              {pfs.supported === false && <Pill tone="warn">No PFS ✗</Pill>}
            </div>
          </Card>

          {/* Certificate detail */}
          <Card className="p-4">
            <p className="mb-2.5 text-2xs font-semibold uppercase tracking-[0.06em] text-slateGray">Certificate</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Field label="Subject">
                <span className="font-semibold">{cert.subject?.CN || cert.subject?.O || '—'}</span>
              </Field>
              <Field label="Issuer">{cert.issuerCN || cert.issuer?.O || cert.issuer?.CN || '—'}</Field>
              <Field label="Valid from">{cert.validFrom || '—'}</Field>
              <Field label="Expires">
                <span className={dayTone(days)}>{cert.validTo || '—'}</span>
              </Field>
              <Field label="Key">
                <span className={cert.keyStrength === 'weak' ? 'text-state-err' : cert.keyStrength ? 'text-state-ok' : ''}>
                  {cert.keyBits ? `${cert.keyBits}-bit ${cert.keyType || ''}` : '—'}
                  {cert.keyStrength && <span className="ml-1 text-[10.5px]">({cert.keyStrength})</span>}
                </span>
              </Field>
              <Field label="Chain">
                <span className={chain.length >= 2 ? 'text-state-ok' : 'text-state-warn'}>
                  {chain.length} cert{chain.length !== 1 ? 's' : ''} {chain.length >= 2 ? '✓' : '⚠'}
                </span>
              </Field>
              {cert.sanCount ? (
                <Field label="SANs">{cert.sanCount} name{cert.sanCount !== 1 ? 's' : ''}</Field>
              ) : null}
              {cert.validityPeriodDays ? (
                <Field label="Issued for">
                  <span className={cert.longLivedCert ? 'text-state-warn' : ''}>{cert.validityPeriodDays}d</span>
                </Field>
              ) : null}
            </div>

            {cert.fingerprint256 && (
              <div className="mt-3 border-t border-line pt-3">
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slateGray/80">
                  SHA-256 fingerprint
                </p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all font-mono text-[9.5px] text-slateGray">
                    {cert.fingerprint256}
                  </code>
                  <CopyInline value={cert.fingerprint256} />
                </div>
              </div>
            )}
          </Card>

          {/* Subject Alt Names */}
          {sans.length > 0 && (
            <Card className="p-4">
              <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.06em] text-slateGray">
                Subject alt names ({sans.length})
              </p>
              <div className={`flex flex-wrap gap-1.5 ${sanCollapsible && !showAllSans ? 'max-h-20 overflow-hidden' : ''}`}>
                {sans.map((s) => (
                  <Pill key={s} className="font-mono">{s}</Pill>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {sanCollapsible && (
                  <button
                    type="button"
                    onClick={() => setShowAllSans((v) => !v)}
                    className="text-[11px] font-medium text-brand hover:underline"
                  >
                    {showAllSans ? 'Collapse' : `Show all ${sans.length}`}
                  </button>
                )}
                <CopyInline value={sans.join('\n')} label="Copy all" />
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Certificate chain */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <Link2 className="h-4 w-4 text-brand" aria-hidden="true" />
            Certificate chain ({chain.length})
          </p>
          <div className="flex gap-2">
            {chain.some((c) => c.pem) && (
              <button
                type="button"
                onClick={downloadFullChain}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand/25 bg-brand-50 px-3 py-1.5 text-[11px] font-semibold text-brand transition-colors hover:bg-brand-100"
              >
                <Download className="h-3 w-3" aria-hidden="true" />Full chain PEM
              </button>
            )}
            {chain[0]?.pem && (
              <button
                type="button"
                onClick={() => downloadCert(0)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent-50 px-3 py-1.5 text-[11px] font-semibold text-accent-700 transition-colors hover:bg-accent-100"
              >
                <Download className="h-3 w-3" aria-hidden="true" />Leaf cert
              </button>
            )}
          </div>
        </div>
        {chain.length ? (
          chain.map((c, i) => (
            <ChainRow
              key={i}
              cert={c}
              index={i}
              isLast={i === chain.length - 1}
              onDownload={downloadCert}
              onView={viewCertPem}
            />
          ))
        ) : (
          <p className="px-5 py-5 text-[13px] text-slateGray">No chain data available</p>
        )}
      </Card>

      {/* Vulnerabilities + handshake simulation */}
      <div className="grid items-start gap-3.5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-line bg-surface-soft/60 px-4 py-3">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <AlertTriangle className="h-4 w-4 text-state-warn" aria-hidden="true" />
              Known vulnerabilities
            </p>
          </div>
          <div className="space-y-2 p-4">
            {vulnList.length ? (
              vulnList.map(([k, v]) => (
                <div key={k} className="rounded-lg border border-state-err/25 bg-state-errSoft px-3 py-2">
                  <p className="text-[12.5px] font-semibold text-state-err">⚠ {k}</p>
                  <p className="mt-0.5 text-[11px] text-slateGray">{v.details || 'Vulnerable'}</p>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-state-ok">✓ No known vulnerabilities detected</p>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-soft/60 px-4 py-3">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <Monitor className="h-4 w-4 text-brand" aria-hidden="true" />
              Client handshake simulation
            </p>
            <span className="shrink-0 text-[11px] text-slateGray">{sim.length} clients</span>
          </div>
          <Simulations sim={sim} />
        </Card>
      </div>

      {/* Recommendations */}
      {recs.length > 0 && (
        <Card className="border-state-warn/20 bg-state-warnSoft p-5">
          <p className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-state-warn">
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
            Recommendations
          </p>
          <div className="space-y-1.5">
            {recs.map((r, i) => (
              <p key={i} className="rounded-lg bg-white/60 px-3 py-2 text-[12.5px] text-ink-soft">→ {r}</p>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
