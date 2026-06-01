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

// Public routes
app.use('/api/auth',  require('./modules/auth/auth.routes'));
app.use('/api/kiosk', require('./modules/kiosk/kiosk.routes'));

// Protected routes
app.use('/api/companies',      authMiddleware, require('./modules/companies/company.routes'));
app.use('/api/departments',    authMiddleware, require('./modules/companies/department.routes'));
app.use('/api/employees',      authMiddleware, require('./modules/employees/employee.routes'));
app.use('/api/attendance',     authMiddleware, require('./modules/attendance/attendance.routes'));
app.use('/api/settings',       authMiddleware, require('./modules/settings/settings.routes'));
app.use('/api/reports',        authMiddleware, require('./modules/reports/report.routes'));
app.use('/api/dashboard',      authMiddleware, require('./modules/dashboard/dashboard.routes'));
app.use('/api/admin-accounts', authMiddleware, require('./modules/adminAccounts/adminAccounts.routes'));
app.use('/api/analytics',      authMiddleware, require('./modules/analytics/analytics.routes'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
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
