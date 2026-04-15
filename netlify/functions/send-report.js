/**
 * Netlify Function: send-report
 * Receives audit data + PDF base64 from the browser,
 * sends a branded email with PDF attachment via Resend.
 *
 * POST /api/send-report
 * Body: { name, email, businessName, websiteUrl, score, gradeKey, signalLoss, issues[], pdfBase64 }
 */

const https = require('https');

/* ── Grade labels (server-side, no i18n needed — always English in email) ── */
const GRADES = {
  grade_strong:   { label: 'Strong Signal',   color: '#22c55e', emoji: '🟢' },
  grade_moderate: { label: 'Moderate Risk',   color: '#f59e0b', emoji: '🟡' },
  grade_high:     { label: 'High Risk',       color: '#f97316', emoji: '🟠' },
  grade_critical: { label: 'Critical',        color: '#ef4444', emoji: '🔴' },
};

/* ── Call Resend REST API directly (no SDK needed, keeps bundle tiny) ── */
function resendSend(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Resend error ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/* ── Build the HTML email body ── */
function buildEmailHTML({ name, businessName, websiteUrl, score, gradeKey, signalLoss, issues }) {
  const grade  = GRADES[gradeKey] || GRADES.grade_high;
  const first  = name ? name.split(' ')[0] : 'there';
  const biz    = businessName || 'your business';
  const topIssues = (issues || []).slice(0, 3);

  const issueRows = topIssues.map(issue => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #1e2a3a;">
        <span style="font-size:16px;">${issue.icon}</span>
        <strong style="color:#f1f5f9;font-size:13px;margin-left:10px;">${issue.title}</strong>
        <span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:100px;background:rgba(239,68,68,0.15);color:#fca5a5;font-size:10px;font-weight:700;text-transform:uppercase;">${issue.badge}</span>
        <div style="color:#94a3b8;font-size:12px;margin-top:4px;padding-left:26px;">${issue.body}</div>
      </td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Your Meta Signal Audit Report</title>
</head>
<body style="margin:0;padding:0;background:#080b14;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080b14;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#7c3aed);border-radius:16px 16px 0 0;padding:32px 36px;">
            <div style="color:white;font-size:22px;font-weight:800;letter-spacing:-0.5px;">
              📡 Signal<strong>Audit</strong>
            </div>
            <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-top:4px;">
              Meta CAPI Signal Intelligence Platform
            </div>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="background:#0f1520;padding:32px 36px 24px;">
            <p style="color:#94a3b8;font-size:15px;margin:0 0 8px;">Hi ${first},</p>
            <p style="color:#f1f5f9;font-size:18px;font-weight:700;margin:0 0 6px;">
              Your Meta Signal Audit Report for <span style="color:#818cf8;">${biz}</span> is ready.
            </p>
            ${websiteUrl ? `<p style="color:#64748b;font-size:12px;margin:0;">Website audited: <a href="${websiteUrl}" style="color:#6366f1;">${websiteUrl}</a></p>` : ''}
          </td>
        </tr>

        <!-- Score Card -->
        <tr>
          <td style="background:#0f1520;padding:0 36px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#161e30;border:1px solid #1e2a3a;border-radius:12px;overflow:hidden;">
              <tr>
                <td style="padding:24px 28px;border-right:1px solid #1e2a3a;width:140px;text-align:center;vertical-align:middle;">
                  <div style="font-size:52px;font-weight:900;color:${grade.color};line-height:1;">${score.toFixed(1)}</div>
                  <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin-top:4px;">Signal Score</div>
                </td>
                <td style="padding:24px 28px;vertical-align:middle;">
                  <div style="font-size:16px;font-weight:800;color:${grade.color};margin-bottom:8px;">${grade.emoji} ${grade.label}</div>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;padding-bottom:6px;">EST. SIGNAL LOSS</td>
                    </tr>
                    <tr>
                      <td>
                        <div style="background:#1e2a3a;border-radius:100px;height:8px;width:100%;overflow:hidden;">
                          <div style="background:#ef4444;height:100%;width:${signalLoss}%;border-radius:100px;"></div>
                        </div>
                        <div style="color:#ef4444;font-size:20px;font-weight:800;margin-top:6px;">~${signalLoss}%</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Issues -->
        ${topIssues.length > 0 ? `
        <tr>
          <td style="background:#0f1520;padding:0 36px 28px;">
            <div style="color:#f1f5f9;font-size:14px;font-weight:700;margin-bottom:12px;">
              Top Issues Found (${topIssues.length} shown — see full report in attachment)
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#161e30;border:1px solid #1e2a3a;border-radius:12px;overflow:hidden;">
              ${issueRows}
            </table>
          </td>
        </tr>` : ''}

        <!-- CTA -->
        <tr>
          <td style="background:#0f1520;padding:0 36px 36px;text-align:center;">
            <div style="background:linear-gradient(135deg,rgba(99,102,241,0.12),rgba(124,58,237,0.12));border:1px solid rgba(99,102,241,0.25);border-radius:12px;padding:28px;">
              <div style="color:#f1f5f9;font-size:16px;font-weight:700;margin-bottom:8px;">
                Ready to fix these issues?
              </div>
              <div style="color:#94a3b8;font-size:13px;margin-bottom:20px;">
                Book a free 15-minute call and we'll walk through your report together.
              </div>
              <a href="https://yourdomain.com" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#7c3aed);color:white;font-size:14px;font-weight:700;padding:13px 28px;border-radius:10px;text-decoration:none;">
                Book a Free Call →
              </a>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#080b14;border-top:1px solid #1e2a3a;padding:20px 36px;border-radius:0 0 16px 16px;text-align:center;">
            <p style="color:#475569;font-size:11px;margin:0;">
              © 2025 SignalAudit — Independent CAPI Services. Not affiliated with Meta.<br/>
              Your full report is attached as a PDF.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/* ── Build the lead notification email (to you) ── */
function buildNotificationHTML({ name, email, businessName, websiteUrl, score, gradeKey, signalLoss, issues, auditId }) {
  const grade = GRADES[gradeKey] || GRADES.grade_high;
  const issueList = (issues || []).map(i => `• ${i.icon} ${i.title} [${i.badge}]`).join('\n');
  return `<div style="font-family:monospace;background:#0f1520;color:#f1f5f9;padding:24px;border-radius:8px;">
  <h2 style="color:#818cf8;margin:0 0 16px;">🔔 New Audit Lead</h2>
  <table>
    ${auditId ? `<tr><td style="color:#64748b;padding:4px 16px 4px 0;">Audit ID:</td><td><strong style="color:#a5b4fc;letter-spacing:0.05em;">${auditId}</strong></td></tr>` : ''}
    <tr><td style="color:#64748b;padding:4px 16px 4px 0;">Name:</td><td><strong>${name || '—'}</strong></td></tr>
    <tr><td style="color:#64748b;padding:4px 16px 4px 0;">Email:</td><td><strong><a href="mailto:${email}" style="color:#6366f1;">${email}</a></strong></td></tr>
    <tr><td style="color:#64748b;padding:4px 16px 4px 0;">Business:</td><td><strong>${businessName || '—'}</strong></td></tr>
    <tr><td style="color:#64748b;padding:4px 16px 4px 0;">Website:</td><td>${websiteUrl || '—'}</td></tr>
    <tr><td style="color:#64748b;padding:4px 16px 4px 0;">Score:</td><td style="color:${grade.color};font-weight:700;">${score.toFixed(1)}/10 — ${grade.emoji} ${grade.label}</td></tr>
    <tr><td style="color:#64748b;padding:4px 16px 4px 0;">Signal Loss:</td><td style="color:#ef4444;font-weight:700;">~${signalLoss}%</td></tr>
    <tr><td style="color:#64748b;padding:4px 16px 4px 0;">Issues:</td><td>${(issues || []).length} found</td></tr>
  </table>
  <pre style="color:#94a3b8;font-size:12px;margin-top:12px;white-space:pre-wrap;">${issueList}</pre>
  <p style="color:#64748b;font-size:11px;margin-top:16px;">Submitted: ${new Date().toUTCString()}</p>
</div>`;
}

/* ── Main handler ── */
exports.handler = async (event) => {
  /* Only allow POST */
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  /* CORS headers */
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const data = JSON.parse(event.body || '{}');
    const { name, email, businessName, websiteUrl, score, gradeKey, signalLoss, issues, auditId, pdfBase64 } = data;

    /* Validate */
    if (!email || !email.includes('@')) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid email required' }) };
    }
    if (!pdfBase64) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'PDF data missing' }) };
    }

    const fromEmail  = process.env.FROM_EMAIL  || 'onboarding@resend.dev';
    const notifyEmail = process.env.NOTIFY_EMAIL || fromEmail;
    const bizName    = businessName || 'your business';
    const scoreVal   = parseFloat(score) || 0;

    /* 1. Send report to the user */
    await resendSend({
      from: `SignalAudit <${fromEmail}>`,
      to: [email],
      subject: `Your Meta Signal Audit Report — ${scoreVal.toFixed(1)}/10 for ${bizName}`,
      html: buildEmailHTML({ name, businessName, websiteUrl, score: scoreVal, gradeKey, signalLoss, issues }),
      attachments: [
        {
          filename: `Signal-Audit-${bizName.replace(/\s+/g, '-')}.pdf`,
          content: pdfBase64,
        },
      ],
    });

    /* 2. Notify yourself of the new lead */
    await resendSend({
      from: `SignalAudit Leads <${fromEmail}>`,
      to: [notifyEmail],
      subject: `New Audit Lead: ${name || 'Unknown'} — ${bizName} (Score: ${scoreVal.toFixed(1)})`,
      html: buildNotificationHTML({ name, email, businessName, websiteUrl, score: scoreVal, gradeKey, signalLoss, issues, auditId }),
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Report sent successfully' }),
    };

  } catch (err) {
    console.error('send-report error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to send report', detail: err.message }),
    };
  }
};
