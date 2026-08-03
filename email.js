// ── Email delivery (nodemailer over SMTP) ──────────────────────
// Configure via environment variables:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE (true/false), MAIL_FROM
// If SMTP_HOST is not set the module runs in "console mode": emails are logged to
// stdout instead of sent, so local development and CI work without a mail server.
const nodemailer = require('nodemailer');

const HOST = process.env.SMTP_HOST;
const FROM = process.env.MAIL_FROM || process.env.SMTP_USER || 'DNSentinel <no-reply@dns.brbik.com>';
const enabled = !!HOST;

let transporter = null;
if (enabled) {
  transporter = nodemailer.createTransport({
    host: HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

const brandShell = (title, bodyHtml) => `
  <div style="background:#050514;padding:32px;font-family:'Segoe UI',Arial,sans-serif;color:#f1f5f9">
    <div style="max-width:520px;margin:0 auto;background:#0c0c1e;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:28px">
      <div style="font-weight:900;font-style:italic;font-size:22px;letter-spacing:-.5px;margin-bottom:18px">
        <span style="color:#f1f5f9">HET</span><span style="color:#10b981">OPS_</span>
        <span style="font-style:normal;font-weight:600;font-size:13px;color:rgba(241,245,249,.5);margin-left:6px">DNS Intelligence</span>
      </div>
      <h1 style="font-size:18px;margin:0 0 14px">${title}</h1>
      ${bodyHtml}
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,.08);font-size:11px;color:rgba(241,245,249,.4)">
        Sent by DNSentinel · If you didn't request this you can safely ignore it.
      </div>
    </div>
  </div>`;

async function send({ to, subject, html, text }) {
  if (!enabled) {
    console.log(`\n[email:console] To: ${to}\nSubject: ${subject}\n${text || '(html email)'}\n`);
    return { consoleMode: true };
  }
  return transporter.sendMail({ from: FROM, to, subject, html, text });
}

function sendMagicLink(to, url) {
  const html = brandShell('Sign in to DNSentinel', `
    <p style="font-size:14px;color:rgba(241,245,249,.7);line-height:1.6">Click the button below to sign in. This link expires in 15 minutes and can be used once.</p>
    <a href="${url}" style="display:inline-block;margin:18px 0;background:linear-gradient(135deg,#10b981,#059669);color:#031b12;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:10px">Sign in &rarr;</a>
    <p style="font-size:12px;color:rgba(241,245,249,.45);line-height:1.5">Button not working? <a href="${url}" style="color:#10b981;text-decoration:underline">Use this sign-in link</a> instead.</p>`);
  return send({ to, subject: 'Your DNSentinel sign-in link', html, text: `Sign in to DNSentinel: ${url}` });
}

function sendAlertEmail(to, domain, changes) {
  const items = changes.map(c => `<li style="margin:6px 0;color:#f59e0b">${escapeHtml(c)}</li>`).join('');
  const html = brandShell(`Changes detected for ${escapeHtml(domain)}`, `
    <p style="font-size:14px;color:rgba(241,245,249,.7);line-height:1.6">We detected the following change(s) on a domain you're monitoring:</p>
    <ul style="padding-left:18px;font-size:14px">${items}</ul>
    <a href="${process.env.APP_URL || 'https://dns.brbik.com'}/?domain=${encodeURIComponent(domain)}" style="display:inline-block;margin-top:14px;background:rgba(16,185,129,.14);border:1px solid rgba(16,185,129,.32);color:#10b981;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:10px">View full report →</a>`);
  return send({ to, subject: `[DNSentinel] ${domain}: ${changes[0]}`, html, text: `${domain}\n` + changes.map(c => '- ' + c).join('\n') });
}

// Weekly digest: one row per monitored domain with its current status.
function sendDigest(to, rows) {
  const base = process.env.APP_URL || 'https://dns.brbik.com';
  const body = rows.map(r => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.07);font-family:monospace;font-size:13px">
        <a href="${base}/?domain=${encodeURIComponent(r.domain)}" style="color:#10b981;text-decoration:none">${escapeHtml(r.domain)}</a>
      </td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.07);font-size:13px;color:rgba(241,245,249,.75)">${escapeHtml(r.summary)}</td>
    </tr>`).join('');
  const html = brandShell('Your weekly domain report', `
    <p style="font-size:14px;color:rgba(241,245,249,.7);line-height:1.6">Status of the ${rows.length} domain${rows.length !== 1 ? 's' : ''} you're monitoring:</p>
    <table style="width:100%;border-collapse:collapse;margin-top:8px">${body}</table>
    <a href="${base}" style="display:inline-block;margin-top:18px;background:rgba(16,185,129,.14);border:1px solid rgba(16,185,129,.32);color:#10b981;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:10px">Open DNSentinel →</a>`);
  const text = rows.map(r => `${r.domain}: ${r.summary}`).join('\n');
  return send({ to, subject: `[DNSentinel] Weekly report — ${rows.length} domain${rows.length !== 1 ? 's' : ''}`, html, text });
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = { enabled, send, sendMagicLink, sendAlertEmail, sendDigest };
