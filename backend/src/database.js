const { Pool, types } = require('pg');

// By default pg converts TIMESTAMP WITHOUT TIME ZONE columns to JS Dates
// treating the stored value as UTC. Since we store local time (configured timezone),
// return the raw string instead — clients parse it as local time and display correctly.
types.setTypeParser(1114, str => str); // 1114 = TIMESTAMP WITHOUT TIME ZONE

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'fingerprint_attendance',
      }
);

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL UNIQUE,
        address TEXT,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        radius_meters INT DEFAULT 100,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        company_id INT REFERENCES companies(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        employee_id VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(150),
        phone VARCHAR(30),
        company_id INT REFERENCES companies(id) ON DELETE SET NULL,
        department_id INT REFERENCES departments(id) ON DELETE SET NULL,
        shift_start VARCHAR(5) DEFAULT '09:00',
        shift_end VARCHAR(5) DEFAULT '17:00',
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        location VARCHAR(255),
        ip_address VARCHAR(45),
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        last_seen TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS fingerprints (
        id SERIAL PRIMARY KEY,
        employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        device_id INT REFERENCES devices(id) ON DELETE SET NULL,
        finger_index SMALLINT DEFAULT 1,
        template TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance_logs (
        id SERIAL PRIMARY KEY,
        employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        device_id INT REFERENCES devices(id) ON DELETE SET NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('clock_in', 'clock_out')),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_late SMALLINT DEFAULT 0,
        is_manual SMALLINT DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS leaves (
        id SERIAL PRIMARY KEY,
        employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        type VARCHAR(20) DEFAULT 'full_day' CHECK (type IN ('full_day', 'half_day')),
        reason TEXT,
        status VARCHAR(20) DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'rejected')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        "key" VARCHAR(100) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        action VARCHAR(50) NOT NULL,
        entity VARCHAR(50),
        entity_id INT,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migrations: add columns if missing (safe on repeated runs)
    try { await client.query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) ON DELETE SET NULL'); } catch (_) {}
    try { await client.query('ALTER TABLE departments ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) ON DELETE SET NULL'); } catch (_) {}
    try { await client.query('ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS device_id INT REFERENCES devices(id) ON DELETE SET NULL'); } catch (_) {}
    try { await client.query('ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS is_early SMALLINT DEFAULT 0'); } catch (_) {}

    // Seed default settings
    const defaults = [
      ['late_threshold_minutes', '15'],
      ['work_start_time', '09:00'],
      ['work_end_time', '17:00'],
      ['company_name', 'My Company'],
      ['timezone', 'Africa/Lagos'],
    ];
    for (const [key, value] of defaults) {
      await client.query(
        'INSERT INTO settings ("key", value) VALUES ($1, $2) ON CONFLICT ("key") DO NOTHING',
        [key, value]
      );
    }

    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function queryOne(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0] || null;
}

// For INSERT with RETURNING id, UPDATE, DELETE. Returns first row if present.
async function execute(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0] || {};
}

async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, initializeDatabase, query, queryOne, execute, transaction };
