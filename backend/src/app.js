require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { initializeDatabase } = require('./database');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/companies', require('./routes/companies'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/kiosk', require('./routes/kiosk'));

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
