/**
 * Netlify Function: send-lead
 * Receives a general service inquiry from the landing page modal.
 * Sends a notification email to the owner via Resend.
 *
 * POST /api/send-lead
 * Body: { name, email, websiteUrl, service }
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

function buildLeadHTML({ name, email, websiteUrl, service }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>New Service Inquiry</title></head>
<body style="margin:0;padding:0;background:#080b14;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080b14;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

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

        <!-- Body -->
        <tr>
          <td style="background:#0f1520;padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;padding:8px 0 4px;">Service of Interest</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(124,58,237,0.15));border:1px solid rgba(99,102,241,0.3);border-radius:8px;color:#a5b4fc;font-size:15px;font-weight:700;">
                  ${service || 'General Inquiry'}
                </td>
              </tr>
              <tr><td style="padding-top:20px;"></td></tr>
              <tr>
                <td style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;padding-bottom:8px;">Lead Details</td>
              </tr>
              <tr>
                <td style="background:#161e30;border:1px solid #1e2a3a;border-radius:10px;overflow:hidden;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:12px 16px;border-bottom:1px solid #1e2a3a;color:#64748b;font-size:12px;width:100px;">Name</td>
                      <td style="padding:12px 16px;border-bottom:1px solid #1e2a3a;color:#f1f5f9;font-size:13px;font-weight:600;">${name || '—'}</td>
                    </tr>
                    <tr>
                      <td style="padding:12px 16px;border-bottom:1px solid #1e2a3a;color:#64748b;font-size:12px;">Email</td>
                      <td style="padding:12px 16px;border-bottom:1px solid #1e2a3a;">
                        <a href="mailto:${email}" style="color:#6366f1;font-size:13px;font-weight:600;text-decoration:none;">${email}</a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:12px 16px;color:#64748b;font-size:12px;">Website</td>
                      <td style="padding:12px 16px;color:#94a3b8;font-size:13px;">${websiteUrl || '—'}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#080b14;border-top:1px solid #1e2a3a;padding:16px 32px;border-radius:0 0 16px 16px;text-align:center;">
            <p style="color:#475569;font-size:11px;margin:0;">
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
    const { name, email, websiteUrl, service } = JSON.parse(event.body || '{}');

    if (!email || !email.includes('@')) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid email required' }) };
    }

    const fromEmail   = process.env.FROM_EMAIL   || 'onboarding@resend.dev';
    const notifyEmail = process.env.NOTIFY_EMAIL || fromEmail;

    await resendSend({
      from: `SignalAudit Leads <${fromEmail}>`,
      to: [notifyEmail],
      subject: `New Inquiry: ${service || 'General'} — ${name || 'Unknown'} (${email})`,
      html: buildLeadHTML({ name, email, websiteUrl, service }),
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
