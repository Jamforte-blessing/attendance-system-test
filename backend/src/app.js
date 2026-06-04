require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { initializeDatabase } = require('./shared/database');
const authMiddleware = require('./shared/middleware/auth');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/api/test-email', async (_req, res) => {
  const sgMail = require('@sendgrid/mail');
  const { SENDGRID_API_KEY, SENDGRID_FROM } = process.env;
  if (!SENDGRID_API_KEY || !SENDGRID_FROM) {
    return res.status(500).json({ error: 'SENDGRID_API_KEY or SENDGRID_FROM not set' });
  }
  sgMail.setApiKey(SENDGRID_API_KEY);
  try {
    await sgMail.send({
      from: SENDGRID_FROM,
      to: SENDGRID_FROM,
      subject: 'SendGrid email test',
      text: 'If you see this, SendGrid email is working.',
    });
    res.json({ success: true, from: SENDGRID_FROM });
  } catch (err) {
    res.status(500).json({ error: err.message, code: err.code, response: err.response?.body });
  }
});

// Public routes
app.use('/api/auth',  require('./modules/auth/auth.routes'));
app.use('/api/kiosk', require('./modules/kiosk/kiosk.routes'));

// Protected routes
app.use('/api/companies',      authMiddleware, authMiddleware.requireAdmin, require('./modules/companies/company.routes'));
app.use('/api/departments',    authMiddleware, authMiddleware.requireAdmin, require('./modules/companies/department.routes'));
app.use('/api/units',          authMiddleware, authMiddleware.requireAdmin, require('./modules/companies/unit.routes'));
app.use('/api/employees',      authMiddleware, authMiddleware.requireAdmin, require('./modules/employees/employee.routes'));
app.use('/api/attendance',     authMiddleware, authMiddleware.requireAdmin, require('./modules/attendance/attendance.routes'));
app.use('/api/settings',       authMiddleware, authMiddleware.requireAdmin, require('./modules/settings/settings.routes'));
app.use('/api/reports',        authMiddleware, authMiddleware.requireAdmin, require('./modules/reports/report.routes'));
app.use('/api/dashboard',      authMiddleware, authMiddleware.requireAdmin, require('./modules/dashboard/dashboard.routes'));
app.use('/api/admin-accounts', authMiddleware, authMiddleware.requireAdmin, authMiddleware.requireSuperAdmin, require('./modules/adminAccounts/adminAccounts.routes'));
app.use('/api/analytics',      authMiddleware, authMiddleware.requireAdmin, require('./modules/analytics/analytics.routes'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err.message);
    console.error('Check your PostgreSQL credentials in .env');
    process.exit(1);
  });
