require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { initializeDatabase } = require('./database');
const authMiddleware = require('./middleware/auth');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

//user routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/kiosk', require('./routes/kiosk'));

// Admin routes 
app.use('/api/companies',  authMiddleware, require('./routes/companies'));
app.use('/api/departments', authMiddleware, require('./routes/departments'));
app.use('/api/employees',  authMiddleware, require('./routes/employees'));
app.use('/api/attendance', authMiddleware, require('./routes/attendance'));
app.use('/api/settings',   authMiddleware, require('./routes/settings'));
app.use('/api/reports',    authMiddleware, require('./routes/reports'));
app.use('/api/dashboard',  authMiddleware, require('./routes/dashboard'));
app.use('/api/admin-accounts', authMiddleware, require('./routes/admin-accounts'));
app.use('/api/analytics',      authMiddleware, require('./routes/analytics'));

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
