/**
 * DNSSEC pane — port of the legacy renderDnssec().
 *
 * Preserved: the good/incomplete/other rating vocabulary and labels
 * ("Configured" / "Partial" / "Not Configured"), the DNSKEY and DS record listings
 * with their key-type / algorithm / key-tag / digest fields, and the Issues and
 * Recommendations callouts.
 */
import { Card, Pill, ErrorBlock } from '../ui/index.jsx';
import { PaneHero, PaneGrid, RecordCard, NoteCard } from './shared.jsx';

export function DnssecPane({ data }) {
  if (!data) return null;
  if (data.error) return <Card><ErrorBlock message={data.error} /></Card>;

  const rating = data.rating || 'unknown';
  const tone = rating === 'good' ? 'ok' : rating === 'incomplete' ? 'warn' : 'neutral';
  const label = rating === 'good' ? 'Configured' : rating === 'incomplete' ? 'Partial' : 'Not Configured';

  const dnskeys = data.checks?.dnskey?.present ? data.checks.dnskey.records || [] : [];
  const dsRecords = data.checks?.ds?.present ? data.checks.ds.records || [] : [];

  return (
    <div>
      <PaneHero
        icon={rating === 'good' ? '🔐' : '🔓'}
        tone={tone}
        title={label}
        subtitle={`DNSSEC status for ${data.domain || ''}`}
      />

      <PaneGrid>
        <RecordCard badge="DNSKEY" badgeTone="accent" title="DNS keys">
          {dnskeys.length ? (
            <div className="space-y-2">
              {dnskeys.map((r, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-50/50 px-3 py-2.5">
                  <Pill tone="accent">{r.keyType}</Pill>
                  <span className="text-[12px] text-ink-soft">
                    Algorithm {String(r.algorithm)} · KeyTag {String(r.keyTag)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-slateGray">No DNSKEY records found</p>
          )}
        </RecordCard>

        <RecordCard badge="DS" badgeTone="ok" title="Delegation signer">
          {dsRecords.length ? (
            <div className="space-y-2">
              {dsRecords.map((r, i) => (
                <div key={i} className="rounded-lg bg-state-okSoft px-3 py-2.5">
                  <span className="text-[12px] text-ink-soft">
                    KeyTag {String(r.keyTag)} · Algorithm {String(r.algorithm)} · Digest {String(r.digestType)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-slateGray">No DS records found at parent zone</p>
          )}
        </RecordCard>
      </PaneGrid>

      <NoteCard title="Issues" items={data.issues || []} tone="err" bullet="•" />
      <NoteCard title="Recommendations" items={data.recommendations || []} tone="warn" bullet="→" />
    </div>
  );
}
