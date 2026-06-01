const nodemailer = require('nodemailer');

function createTransport() {
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) return null;

  return nodemailer.createTransport({
    host: EMAIL_HOST,
    port: parseInt(EMAIL_PORT || '587', 10),
    secure: parseInt(EMAIL_PORT || '587', 10) === 465,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });
}

async function sendMail({ to, subject, html }) {
  if (!to) return;
  const transport = createTransport();
  if (!transport) return;

  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  try {
    await transport.sendMail({ from, to, subject, html });
  } catch (err) {
    console.error('Email send failed:', err.message);
  }
}

function clockInEmail({ employeeName, timestamp, isLate }) {
  const time = new Date(timestamp).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  const lateNote = isLate
    ? `<p style="color:#b45309;background:#fef3c7;padding:10px 14px;border-radius:6px;margin-top:12px;">You were marked as <strong>late</strong> for this clock-in.</p>`
    : '';
  return {
    subject: 'Clock-In Confirmed',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;color:#111;">
        <h2 style="color:#16a34a;">Clock-In Confirmed</h2>
        <p>Hi <strong>${employeeName}</strong>,</p>
        <p>Your clock-in has been recorded successfully.</p>
        <table style="border-collapse:collapse;width:100%;margin-top:12px;">
          <tr><td style="padding:8px 0;color:#555;">Time</td><td style="padding:8px 0;font-weight:600;">${time}</td></tr>
          <tr><td style="padding:8px 0;color:#555;">Status</td><td style="padding:8px 0;font-weight:600;color:#16a34a;">Clocked In</td></tr>
        </table>
        ${lateNote}
        <p style="margin-top:20px;color:#888;font-size:13px;">This is an automated message from the attendance system.</p>
      </div>`,
  };
}

function clockOutEmail({ employeeName, timestamp, isEarly }) {
  const time = new Date(timestamp).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  const earlyNote = isEarly
    ? `<p style="color:#c2410c;background:#fff7ed;padding:10px 14px;border-radius:6px;margin-top:12px;">You were marked as having <strong>left early</strong>.</p>`
    : '';
  return {
    subject: 'Clock-Out Confirmed',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;color:#111;">
        <h2 style="color:#374151;">Clock-Out Confirmed</h2>
        <p>Hi <strong>${employeeName}</strong>,</p>
        <p>Your clock-out has been recorded successfully.</p>
        <table style="border-collapse:collapse;width:100%;margin-top:12px;">
          <tr><td style="padding:8px 0;color:#555;">Time</td><td style="padding:8px 0;font-weight:600;">${time}</td></tr>
          <tr><td style="padding:8px 0;color:#555;">Status</td><td style="padding:8px 0;font-weight:600;color:#374151;">Clocked Out</td></tr>
        </table>
        ${earlyNote}
        <p style="margin-top:20px;color:#888;font-size:13px;">This is an automated message from the attendance system.</p>
      </div>`,
  };
}

function welcomeEmployeeEmail({ employeeName, employeeId, companyName, shiftStart, shiftEnd }) {
  return {
    subject: 'Welcome — Your Employee Account Has Been Created',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;color:#111;">
        <h2 style="color:#2563eb;">Welcome to ${companyName || 'the team'}!</h2>
        <p>Hi <strong>${employeeName}</strong>,</p>
        <p>Your employee account has been set up. Here are your details:</p>
        <table style="border-collapse:collapse;width:100%;margin-top:12px;">
          <tr><td style="padding:8px 0;color:#555;">Employee ID</td><td style="padding:8px 0;font-weight:600;font-family:monospace;">${employeeId}</td></tr>
          ${companyName ? `<tr><td style="padding:8px 0;color:#555;">Company</td><td style="padding:8px 0;font-weight:600;">${companyName}</td></tr>` : ''}
          <tr><td style="padding:8px 0;color:#555;">Shift Hours</td><td style="padding:8px 0;font-weight:600;">${shiftStart} – ${shiftEnd}</td></tr>
        </table>
        <p style="margin-top:16px;">Use the kiosk to clock in and out each day. Select your company and name from the dropdowns.</p>
        <p style="margin-top:20px;color:#888;font-size:13px;">This is an automated message from the attendance system.</p>
      </div>`,
  };
}

module.exports = { sendMail, clockInEmail, clockOutEmail, welcomeEmployeeEmail };
