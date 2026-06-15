const { query, queryOne, execute } = require('../../shared/database');
const { logAttendance } = require('../../shared/utils/attendance');
const { addCompanyScope, requireCompanyAccess } = require('../../shared/utils/adminScope');
const faceService = require('./face.service');

async function getLogs({ employee_id, date, from, to, department_id, unit_id, type, limit }, user) {
  let sql = `
    SELECT al.*, e.name as employee_name, e.employee_id as emp_id,
           d.name as department_name
    FROM attendance_logs al
    JOIN employees e ON e.id = al.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE 1=1
  `;
  const params = [];

  if (employee_id)   { sql += ` AND al.employee_id = $${params.length + 1}`;     params.push(employee_id); }
  if (type)          { sql += ` AND al.type = $${params.length + 1}`;             params.push(type); }
  if (department_id) { sql += ` AND e.department_id = $${params.length + 1}`;    params.push(department_id); }
  if (unit_id)       { sql += ` AND e.unit_id = $${params.length + 1}`;           params.push(unit_id); }
  if (date)          { sql += ` AND al.timestamp::date = $${params.length + 1}`; params.push(date); }
  if (from)          { sql += ` AND al.timestamp::date >= $${params.length + 1}`;params.push(from); }
  if (to)            { sql += ` AND al.timestamp::date <= $${params.length + 1}`;params.push(to); }

  const scoped = addCompanyScope({ sql, params, column: 'e.company_id', user });
  const safeLimit = Math.min(parseInt(limit) || 200, 500);
  return query(scoped.sql + ` ORDER BY al.timestamp DESC LIMIT ${safeLimit}`, scoped.params);
}

async function getTodayLogs(user) {
  let sql = `
    SELECT al.*, e.name as employee_name, e.employee_id as emp_id, d.name as department_name
    FROM attendance_logs al
    JOIN employees e ON e.id = al.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE al.timestamp::date = CURRENT_DATE`;
  const params = [];
  const scoped = addCompanyScope({ sql, params, column: 'e.company_id', user });
  return query(scoped.sql + ' ORDER BY al.timestamp DESC', scoped.params);
}

async function getEmployeeLogs(id, { from, to }, user) {
  const emp = await queryOne('SELECT company_id FROM employees WHERE id = $1', [id]);
  if (!emp) return [];
  requireCompanyAccess(user, emp.company_id);

  let sql = `SELECT al.* FROM attendance_logs al WHERE al.employee_id = $1`;
  const params = [id];
  if (from) { sql += ` AND al.timestamp::date >= $${params.length + 1}`; params.push(from); }
  if (to)   { sql += ` AND al.timestamp::date <= $${params.length + 1}`; params.push(to); }
  sql += ' ORDER BY al.timestamp DESC LIMIT 100';
  return query(sql, params);
}

async function createManualLog({ employee_id, type, timestamp, notes }, user) {
  const emp = await queryOne('SELECT company_id FROM employees WHERE id = $1', [employee_id]);
  if (!emp) {
    const error = new Error('Employee not found');
    error.status = 404;
    throw error;
  }
  requireCompanyAccess(user, emp.company_id);

  const record = await logAttendance({ employeeId: employee_id, type, timestamp, isManual: true, notes });
  await execute(
    'INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
    ['MANUAL_LOG', 'attendance', record.id, JSON.stringify({ employee_id, type, timestamp })]
  );
  return record;
}

async function deleteLog(id, user) {
  const log = await queryOne(`
    SELECT al.id, e.company_id
    FROM attendance_logs al
    JOIN employees e ON e.id = al.employee_id
    WHERE al.id = $1
  `, [id]);
  if (!log) return null;
  requireCompanyAccess(user, log.company_id);

  await execute('DELETE FROM attendance_logs WHERE id = $1', [id]);
  await execute(
    'INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
    ['DELETE', 'attendance', id, null]
  );
  return true;
}

// ==========================================
// FACE RECOGNITION FUNCTIONS
// ==========================================

async function registerFace(employee_id, imageBuffer, user) {
  const emp = await queryOne('SELECT company_id FROM employees WHERE id = $1', [employee_id]);
  if (!emp) {
    const error = new Error('Employee not found');
    error.status = 404;
    throw error;
  }
  requireCompanyAccess(user, emp.company_id);

  const result = await faceService.processImageBuffer(imageBuffer);

  if (!result.success || !result.embedding) {
    const error = new Error(result.error || 'No face detected in image');
    error.status = 400;
    throw error;
  }

  const vectorBuffer = Buffer.from(new Float32Array(result.embedding).buffer);

  await execute(
    'UPDATE employees SET face_vector = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [vectorBuffer, employee_id]
  );

  return { success: true, message: 'Face registered successfully' };
}

async function clockViaFace(imageBuffer, user) {
  // 1. Process Image
  const result = await faceService.processImageBuffer(imageBuffer);

  if (!result.success) {
    throw new Error(result.error || 'Processing failed');
  }

  // 2. Anti-Spoofing Check
  if (!result.is_live) {
    const error = new Error('Spoof attempt detected! Please use a real face.');
    error.status = 403;
    throw error;
  }

  if (!result.embedding) {
    throw new Error('No face found');
  }

  // 3. Determine Company Scope
  let companyIds = [];

  if (user.company_id) {
    // Case: Logged in as Employee
    companyIds = [user.company_id];
  } else if (user.username === 'admin') {
    // Case: Super Admin (Hardcoded check for username 'admin')
    // This gives the super admin access to search faces in ALL companies
    console.log("Super Admin detected. Fetching all companies...");
    const allComps = await query('SELECT id FROM companies');
    companyIds = allComps.map(c => c.id);
  } else {
    // Case: Regular Admin (Needs entry in admin_company_access table)
    console.log("Regular Admin detected. Fetching assigned companies...");
    const accesses = await query('SELECT company_id FROM admin_company_access WHERE admin_id = $1', [user.id]);
    companyIds = accesses.map(a => a.company_id);
  }

  console.log(`[Face Clock] Searching in companies: ${JSON.stringify(companyIds)}`);

  if (companyIds.length === 0) {
    throw new Error('User account is not associated with a company');
  }

  // 4. Identify Employee
  const employee = await faceService.identifyEmployee(result.embedding, companyIds);
  
  if (!employee) {
    const error = new Error('Face not recognized. Please register first.');
    error.status = 404;
    throw error;
  }

  // 5. Determine Clock Type
  const lastLog = await queryOne(
    `SELECT type FROM attendance_logs 
     WHERE employee_id = $1 AND timestamp::date = CURRENT_DATE 
     ORDER BY timestamp DESC LIMIT 1`,
    [employee.id]
  );

  const type = (lastLog && lastLog.type === 'clock_in') ? 'clock_out' : 'clock_in';

  // 6. Log Attendance
  const record = await logAttendance({ 
    employeeId: employee.id, 
    type, 
    isManual: false, 
    notes: 'Face Recognition' 
  });

  return { 
    success: true, 
    employee_id: employee.id,
    employee_name: employee.name, 
    type, 
    timestamp: record.timestamp 
  };
}

module.exports = { 
  getLogs, 
  getTodayLogs, 
  getEmployeeLogs, 
  createManualLog, 
  deleteLog,
  registerFace,
  clockViaFace
};