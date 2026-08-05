/**
 * Email authentication pane — port of the legacy renderEmailSec().
 *
 * Preserved: rating vocabulary and colours, per-record scores with the 85/60
 * breakpoints, SPF policy badge semantics (-all ok, +all err, else warn), DMARC
 * policy/pct/rua badges and alignment line, DKIM selector list, BIMI logo URL, and
 * the recommendations block.
 */
import { Card, Pill, ErrorBlock } from '../ui/index.jsx';
import {
  PaneHero, PaneGrid, RecordCard, RecordValue, IssueList, MissingRecord, NoteCard,
  ScoreBar, ratingTone, ratingLabel, scoreTone,
} from './shared.jsx';

/** SPF qualifier → tone: `-all` hard fail is good, `+all` allows anyone. */
const spfPolicyTone = (p) => (p === '-all' ? 'ok' : p === '+all' ? 'err' : 'warn');

/** DMARC policy → tone: reject best, quarantine partial, none ineffective. */
const dmarcPolicyTone = (p) => (p === 'reject' ? 'ok' : p === 'quarantine' ? 'warn' : 'err');

export function EmailSecPane({ data }) {
  if (!data) return null;
  if (data.error) return <Card><ErrorBlock message={data.error} /></Card>;

  const spf = data.spf || {};
  const dmarc = data.dmarc || {};
  const dkim = data.dkim || {};
  const bimi = data.bimi || {};

  const tone = ratingTone(data.rating);

  return (
    <div>
      <PaneHero
        icon="📧"
        tone={tone}
        title={`${ratingLabel(data.rating)} Email Authentication`}
        subtitle={`Score: ${data.overallScore}/100 for ${data.domain || ''}`}
        score={data.overallScore}
        badges={
          <>
            <Pill tone={spf.present ? 'ok' : 'err'}>SPF {spf.present ? '✓' : '✗'}</Pill>
            <Pill tone={dmarc.present ? 'ok' : 'err'}>DMARC {dmarc.present ? '✓' : '✗'}</Pill>
            <Pill tone={dkim.present ? 'ok' : 'err'}>DKIM {dkim.present ? '✓' : '✗'}</Pill>
            <Pill tone={bimi.present ? 'ok' : 'neutral'}>BIMI {bimi.present ? '✓' : '✗'}</Pill>
          </>
        }
      />

      <PaneGrid>
        {/* SPF */}
        <RecordCard
          badge="SPF"
          badgeTone="warn"
          title="Sender Policy Framework"
          meta={`${spf.score || 0}/100`}
          metaTone={scoreTone(spf.score || 0)}
        >
          {spf.present ? (
            <>
              <RecordValue>{spf.record || ''}</RecordValue>
              {spf.policy && (
                <Pill tone={spfPolicyTone(spf.policy)} className="mb-2.5 font-mono">
                  {spf.policy}
                </Pill>
              )}
              <ScoreBar score={spf.score || 0} tone={scoreTone(spf.score || 0)} />
              <div className="mt-2.5">
                <IssueList issues={spf.issues || []} />
              </div>
            </>
          ) : (
            <MissingRecord
              label="No SPF record found"
              hint={`Publish a TXT record at ${data.domain || ''} starting with v=spf1`}
            />
          )}
        </RecordCard>

        {/* DMARC */}
        <RecordCard
          badge="DMARC"
          badgeTone="info"
          title="Domain-based Message Authentication"
          meta={`${dmarc.score || 0}/100`}
          metaTone={scoreTone(dmarc.score || 0)}
        >
          {dmarc.present ? (
            <>
              <RecordValue>{dmarc.record || ''}</RecordValue>
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {dmarc.policy && <Pill tone={dmarcPolicyTone(dmarc.policy)}>{dmarc.policy}</Pill>}
                {dmarc.pct != null && dmarc.pct < 100 && <Pill tone="warn">pct={dmarc.pct}%</Pill>}
                {dmarc.rua ? <Pill tone="ok">Reports ✓</Pill> : <Pill tone="warn">No Reports</Pill>}
              </div>
              {dmarc.adkim && (
                <p className="text-[11.5px] text-slateGray">
                  DKIM alignment: {dmarc.adkim === 's' ? 'strict' : 'relaxed'} · SPF alignment:{' '}
                  {dmarc.aspf === 's' ? 'strict' : 'relaxed'}
                </p>
              )}
              <ScoreBar score={dmarc.score || 0} tone={scoreTone(dmarc.score || 0)} className="mt-2" />
              <div className="mt-2.5">
                <IssueList issues={dmarc.issues || []} />
              </div>
            </>
          ) : (
            <MissingRecord
              label="No DMARC record found"
              hint={`Publish a TXT record at _dmarc.${data.domain || ''}`}
            />
          )}
        </RecordCard>

        {/* DKIM */}
        <RecordCard badge="DKIM" badgeTone="ok" title="DomainKeys Identified Mail">
          {dkim.present ? (
            <>
              <Pill tone="ok">✓ DKIM configured</Pill>
              <p className="mb-1.5 mt-3 text-[11.5px] text-slateGray">Found selectors:</p>
              <div className="flex flex-wrap gap-1.5">
                {(dkim.selectors || []).map((s) => (
                  <Pill key={s} className="font-mono">{s}</Pill>
                ))}
              </div>
            </>
          ) : (
            <MissingRecord
              label="No DKIM public keys found"
              hint="Checked 16 common selectors — configure DKIM signing with your mail provider"
            />
          )}
        </RecordCard>

        {/* BIMI */}
        <RecordCard badge="BIMI" badgeTone="brand" title="Brand Indicators for Message Identification">
          {bimi.present ? (
            <>
              <Pill tone="ok">✓ BIMI record present</Pill>
              {bimi.logoUrl && (
                <p className="mt-3 text-[11.5px] text-slateGray">
                  Logo: <span className="break-all font-mono text-brand">{bimi.logoUrl}</span>
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-[13px] text-slateGray">No BIMI record</p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-slateGray/80">
                BIMI displays your brand logo in supporting email clients. Requires DMARC enforcement
                (p=quarantine/reject).
              </p>
            </>
          )}
        </RecordCard>
      </PaneGrid>

      <NoteCard title="Recommendations" items={data.recommendations || []} tone="warn" bullet="→" />
    </div>
  );
}
