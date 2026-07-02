const sgMail = require('@sendgrid/mail');

async function send(msg) {
  const { SENDGRID_API_KEY, SENDGRID_FROM } = process.env;
  if (!SENDGRID_API_KEY || !SENDGRID_FROM) return false;
  sgMail.setApiKey(SENDGRID_API_KEY);
  await sgMail.send({ ...msg, from: SENDGRID_FROM });
  return true;
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
              <td style="padding: 10px 0; color: #64748b;">Default Password</td>
              <td style="padding: 10px 0;">
                <code style="background: #f1f5f9; padding: 4px 10px; border-radius: 4px; font-size: 15px; letter-spacing: 1px; font-weight: 700;">${escapeHtml(password)}</code>
              </td>
            </tr>
          ` : '';
  const actionNote = password
    ? 'Sign in with the default password above. You will be asked to set your own password immediately after your first login.'
    : 'Your account is ready. Use your existing credentials to sign in.';

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

async function sendPasswordResetLinkEmail({ name, email, company_name, resetLink }) {
  if (!email) return;

  const company = company_name || 'Your Company';

  await send({
    to: email,
    subject: `Password Reset Request – ${company}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: #dc2626; padding: 28px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">Password Reset Request</h1>
        </div>
        <div style="background: #f8fafc; padding: 28px 32px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="margin: 0 0 16px;">Hi <strong>${name}</strong>,</p>
          <p style="margin: 0 0 24px;">
            We received a request to reset the password for your account at <strong>${company}</strong>.
            Click the button below to set a new password. This link expires in <strong>1 hour</strong>.
          </p>

          <div style="text-align: center; margin: 0 0 24px;">
            <a href="${resetLink}"
               style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none;
                      padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 600;">
              Reset My Password
            </a>
          </div>

          <p style="margin: 0 0 8px; font-size: 13px; color: #64748b;">
            If the button doesn't work, copy and paste this link into your browser:
          </p>
          <p style="margin: 0 0 24px; font-size: 13px; word-break: break-all;">
            <a href="${resetLink}" style="color: #2563eb;">${resetLink}</a>
          </p>

          <div style="padding: 16px; background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #7f1d1d;">
              <strong>If you did not request this</strong>, you can safely ignore this email.
              Your password will not change unless you click the link above.
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

async function sendAdminCredentialsEmail({ username, email, password, companyNames = [] }) {
  if (!email) return false;

  const frontendUrl = (process.env.FRONTEND_URL || 'https://att.jamfortetech.com').replace(/\/$/, '');
  const companies = companyNames.length > 0 ? companyNames.join(', ') : 'Assigned companies';

  return send({
    to: email,
    subject: 'Your VerifyIn admin account credentials',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: #2563eb; padding: 28px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">Your admin account is ready</h1>
        </div>
        <div style="background: #f8fafc; padding: 28px 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <p>You have been granted administrative access to <strong>${escapeHtml(companies)}</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 15px; margin: 20px 0;">
            <tr>
              <td style="padding: 10px 0; color: #64748b; width: 140px;">Username</td>
              <td style="padding: 10px 0; font-weight: 600;">${escapeHtml(username)}</td>
            </tr>
            <tr style="border-top: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; color: #64748b;">Password</td>
              <td style="padding: 10px 0;"><code style="background: #f1f5f9; padding: 4px 10px; border-radius: 4px; font-weight: 700;">${escapeHtml(password)}</code></td>
            </tr>
          </table>
          <p style="text-align: center; margin: 24px 0;">
            <a href="${escapeHtml(frontendUrl)}" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600;">Sign in to VerifyIn</a>
          </p>
          <p style="font-size: 13px; color: #64748b;">Keep these credentials private. Contact your super administrator if you did not expect this email.</p>
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

module.exports = { sendWelcomeEmail, sendPasswordResetLinkEmail, sendForgotPasswordEmail, sendClockEmail, sendAdminCredentialsEmail };
