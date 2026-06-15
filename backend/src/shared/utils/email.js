const sgMail = require('@sendgrid/mail');

function send(msg) {
  const { SENDGRID_API_KEY, SENDGRID_FROM } = process.env;
  if (!SENDGRID_API_KEY || !SENDGRID_FROM) return Promise.resolve();
  sgMail.setApiKey(SENDGRID_API_KEY);
  return sgMail.send({ ...msg, from: SENDGRID_FROM });
}

function formatTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 || 12;
  return `${display}:${m} ${ampm}`;
}

async function sendWelcomeEmail({ name, email, employee_id, company_name, department_name, shift_start, shift_end, password }) {
  if (!email) return;

  const dept = department_name || 'Not assigned';
  const company = company_name || 'Your Company';
  const passwordRow = password ? `
            <tr style="border-top: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; color: #64748b;">Temporary Password</td>
              <td style="padding: 10px 0; font-weight: 600;">${password}</td>
            </tr>
          ` : '';
  const actionNote = password ? 'Use the password above to sign in and change it on your first login. Your login will remain valid for 100 days.' : 'Your account is ready. Use your existing credentials to sign in.';

  await send({
    to: email,
    subject: `Welcome to ${company} – Your Account Details`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: #2563eb; padding: 28px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">Welcome, ${name}!</h1>
        </div>
        <div style="background: #f8fafc; padding: 28px 32px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="margin: 0 0 20px;">Your employee account has been created. Here are your details:</p>

          <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
            <tr>
              <td style="padding: 10px 0; color: #64748b; width: 160px;">Employee ID</td>
              <td style="padding: 10px 0; font-weight: 600;">${employee_id}</td>
            </tr>
            <tr style="border-top: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; color: #64748b;">Company</td>
              <td style="padding: 10px 0;">${company}</td>
            </tr>
            <tr style="border-top: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; color: #64748b;">Department</td>
              <td style="padding: 10px 0;">${dept}</td>
            </tr>
            <tr style="border-top: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; color: #64748b;">Shift Hours</td>
              <td style="padding: 10px 0;">${formatTime(shift_start)} – ${formatTime(shift_end)}</td>
            </tr>
            ${passwordRow}
          </table>

          <p style="margin: 24px 0 0; font-size: 15px; color: #334155;">${actionNote}</p>
          <p style="margin: 12px 0 0; font-size: 13px; color: #94a3b8;">
            If you have questions about your schedule, please contact your manager.
          </p>
        </div>
      </div>
    `,
  });
}

function formatTimestamp(ts) {
  // ts is "YYYY-MM-DD HH:MM:SS" in local timezone
  const timePart = ts.split(' ')[1] || '';
  const [h, m] = timePart.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 || 12;
  return `${display}:${m} ${ampm}`;
}

async function sendClockEmail({ name, email, type, timestamp, isLate, isEarly }) {
  if (!email) return;

  const isIn = type === 'clock_in';
  const label = isIn ? 'Clocked In' : 'Clocked Out';
  const time = formatTimestamp(timestamp);

  let badgeHtml = '';
  if (isIn && isLate) {
    badgeHtml = `<span style="background:#fef2f2;color:#dc2626;padding:2px 10px;border-radius:12px;font-size:13px;font-weight:600;">Late</span>`;
  } else if (!isIn && isEarly) {
    badgeHtml = `<span style="background:#fff7ed;color:#ea580c;padding:2px 10px;border-radius:12px;font-size:13px;font-weight:600;">Early Departure</span>`;
  } else {
    badgeHtml = `<span style="background:#f0fdf4;color:#16a34a;padding:2px 10px;border-radius:12px;font-size:13px;font-weight:600;">On Time</span>`;
  }

  const accentColor = isIn ? '#2563eb' : '#7c3aed';

  await send({
    to: email,
    subject: `${label} at ${time}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: ${accentColor}; padding: 24px 28px; border-radius: 8px 8px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 20px;">${label}</h1>
        </div>
        <div style="background: #f8fafc; padding: 24px 28px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="margin: 0 0 16px;">Hi ${name},</p>
          <p style="margin: 0 0 20px;">Your attendance has been recorded.</p>

          <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
            <tr>
              <td style="padding: 10px 0; color: #64748b; width: 140px;">Action</td>
              <td style="padding: 10px 0; font-weight: 600;">${label}</td>
            </tr>
            <tr style="border-top: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; color: #64748b;">Time</td>
              <td style="padding: 10px 0; font-weight: 600;">${time}</td>
            </tr>
            <tr style="border-top: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; color: #64748b;">Status</td>
              <td style="padding: 10px 0;">${badgeHtml}</td>
            </tr>
          </table>

          <p style="margin: 20px 0 0; font-size: 13px; color: #94a3b8;">
            If this wasn't you, please contact your manager immediately.
          </p>
        </div>
      </div>
    `,
  });
}

async function sendForgotPasswordEmail({ name, email, employee_id, company_name, password }) {
  if (!email) return;

  const company = company_name || 'Your Company';

  await send({
    to: email,
    subject: `Password Reset – ${company}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: #dc2626; padding: 28px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">Password Reset Request</h1>
        </div>
        <div style="background: #f8fafc; padding: 28px 32px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="margin: 0 0 16px;">Hi <strong>${name}</strong>,</p>
          <p style="margin: 0 0 20px;">
            A password reset was requested for your account at <strong>${company}</strong>.
            A new temporary password has been generated for you below.
          </p>

          <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
            <tr>
              <td style="padding: 10px 0; color: #64748b; width: 160px;">Employee ID</td>
              <td style="padding: 10px 0; font-weight: 600;">${employee_id}</td>
            </tr>
            <tr style="border-top: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; color: #64748b;">Temporary Password</td>
              <td style="padding: 10px 0;">
                <code style="background: #f1f5f9; padding: 4px 10px; border-radius: 4px; font-size: 15px; letter-spacing: 1px;">${escapeHtml(password)}</code>
              </td>
            </tr>
          </table>

          <div style="margin: 24px 0 0; padding: 16px; background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #7f1d1d;">
              <strong>If you did not request this reset</strong>, please contact your manager immediately.
              This password is valid for one login only — you will be required to set a new password on sign-in.
            </p>
          </div>

          <p style="margin: 20px 0 0; font-size: 13px; color: #94a3b8;">
            This is an automated message from ${company}. Do not reply to this email.
          </p>
        </div>
      </div>
    `,
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { sendWelcomeEmail, sendForgotPasswordEmail, sendClockEmail };
