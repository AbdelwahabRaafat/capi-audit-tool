/**
 * Netlify Function: send-lead
 * Handles general service inquiries from the landing page / pricing page modal.
 * Sends a rich notification to the owner via Resend.
 *
 * POST /api/send-lead
 * Body: { name, email, websiteUrl, service, adSpend, platform, auditId, message }
 */

const https = require('https');

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

function row(label, value, color) {
  if (!value) return '';
  return `<tr>
    <td style="padding:10px 16px;border-bottom:1px solid #1e2a3a;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;width:130px;vertical-align:top;">${label}</td>
    <td style="padding:10px 16px;border-bottom:1px solid #1e2a3a;color:${color || '#f1f5f9'};font-size:13px;font-weight:600;">${value}</td>
  </tr>`;
}

function buildLeadHTML({ name, email, websiteUrl, service, adSpend, platform, auditId, message }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>New Service Inquiry</title></head>
<body style="margin:0;padding:0;background:#080b14;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080b14;padding:40px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#7c3aed);border-radius:16px 16px 0 0;padding:28px 32px;">
            <div style="color:white;font-size:20px;font-weight:800;letter-spacing:-0.5px;">
              SignalAudit — New Service Inquiry
            </div>
            <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-top:4px;">
              A prospect has requested a strategic call
            </div>
          </td>
        </tr>

        <!-- Service badge -->
        <tr>
          <td style="background:#0f1520;padding:24px 32px 0;">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:8px;">Service of Interest</div>
            <div style="display:inline-block;padding:10px 20px;background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(124,58,237,0.15));border:1px solid rgba(99,102,241,0.35);border-radius:10px;color:#a5b4fc;font-size:15px;font-weight:700;">
              ${service || 'General Inquiry'}
            </div>
          </td>
        </tr>

        <!-- Details table -->
        <tr>
          <td style="background:#0f1520;padding:20px 32px 0;">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:10px;">Lead Details</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#161e30;border:1px solid #1e2a3a;border-radius:12px;overflow:hidden;border-collapse:collapse;">
              ${row('Name', name)}
              ${row('Email', `<a href="mailto:${email}" style="color:#6366f1;text-decoration:none;">${email}</a>`, '')}
              ${row('Website', websiteUrl)}
              ${row('Monthly Spend', adSpend, '#86efac')}
              ${row('Platform', platform)}
              ${auditId ? row('Audit Report ID', `<span style="font-family:monospace;color:#a5b4fc;letter-spacing:0.05em;">${auditId}</span>`, '') : ''}
              ${message ? row('Message', `<em style="color:#94a3b8;font-style:italic;">${message}</em>`, '') : ''}
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#080b14;border-top:1px solid #1e2a3a;padding:16px 32px;border-radius:0 0 16px 16px;text-align:center;margin-top:0;">
            <p style="color:#475569;font-size:11px;margin:16px 0 0;">
              Submitted: ${new Date().toUTCString()} &nbsp;|&nbsp; SignalAudit Lead System
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const { name, email, websiteUrl, service, adSpend, platform, auditId, message } = JSON.parse(event.body || '{}');

    if (!email || !email.includes('@')) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid email required' }) };
    }

    const fromEmail   = process.env.FROM_EMAIL   || 'onboarding@resend.dev';
    const notifyEmail = process.env.NOTIFY_EMAIL || fromEmail;

    await resendSend({
      from: `SignalAudit Leads <${fromEmail}>`,
      to: [notifyEmail],
      subject: `New Inquiry: ${service || 'General'} — ${name || email} ${auditId ? `| ID: ${auditId}` : ''}`,
      html: buildLeadHTML({ name, email, websiteUrl, service, adSpend, platform, auditId, message }),
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };

  } catch (err) {
    console.error('send-lead error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to send', detail: err.message }),
    };
  }
};
