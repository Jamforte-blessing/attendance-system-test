const { Pool, types } = require('pg');

types.setTypeParser(1114, str => str);

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
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
      CREATE TABLE IF NOT EXISTS units (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        department_id INT REFERENCES departments(id) ON DELETE CASCADE,
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
      CREATE TABLE IF NOT EXISTS attendance_logs (
        id SERIAL PRIMARY KEY,
        employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        generated_password TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_company_access (
        admin_id INT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
        company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        PRIMARY KEY (admin_id, company_id)
      )
    `);

    try { await client.query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) ON DELETE SET NULL'); } catch (_) {}
    try { await client.query('ALTER TABLE departments ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) ON DELETE SET NULL'); } catch (_) {}
    try { await client.query('ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS is_early SMALLINT DEFAULT 0'); } catch (_) {}
    try { await client.query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS unit_id INT REFERENCES units(id) ON DELETE SET NULL'); } catch (_) {}
    try { await client.query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS password_hash TEXT'); } catch (_) {}
    try { await client.query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT TRUE'); } catch (_) {}
    try { await client.query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP'); } catch (_) {}
    try { await client.query('ALTER TABLE admins ADD COLUMN IF NOT EXISTS generated_password TEXT'); } catch (_) {}
    try { await client.query("ALTER TABLE companies ADD COLUMN IF NOT EXISTS default_shift_start VARCHAR(5) DEFAULT '09:00'"); } catch (_) {}
    try { await client.query("ALTER TABLE companies ADD COLUMN IF NOT EXISTS default_shift_end VARCHAR(5) DEFAULT '17:00'"); } catch (_) {}
    try { await client.query('ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT'); } catch (_) {}
    try { await client.query('ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS photo_url TEXT'); } catch (_) {}
    try { await client.query("ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_days VARCHAR(100) DEFAULT 'Mon,Tue,Wed,Thu,Fri'"); } catch (_) {}
    try { await client.query('ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS client_ip VARCHAR(45)'); } catch (_) {}

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
