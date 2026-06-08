const { query, queryOne, execute } = require('../../shared/database');
const { logAttendance } = require('../../shared/utils/attendance');
const { addCompanyScope, requireCompanyAccess } = require('../../shared/utils/adminScope');
const faceService = require('./face.service'); // Import the new AI service wrapper

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

/**
 * Registers a face vector for a specific employee.
 * 1. Validates employee exists and user has access.
 * 2. Calls AI service to extract face vector.
 * 3. Stores vector in DB.
 */
async function registerFace(employee_id, imageBuffer, user) {
  // 1. Security Check
  const emp = await queryOne('SELECT company_id FROM employees WHERE id = $1', [employee_id]);
  if (!emp) {
    const error = new Error('Employee not found');
    error.status = 404;
    throw error;
  }
  requireCompanyAccess(user, emp.company_id);

  // 2. Process Image with AI Worker
  const result = await faceService.processImageBuffer(imageBuffer);

  if (!result.success || !result.embedding) {
    const error = new Error(result.error || 'No face detected in image');
    error.status = 400;
    throw error;
  }

  // 3. Store Vector
  // Convert standard JS array to Buffer for BYTEA storage
  const vectorBuffer = Buffer.from(new Float32Array(result.embedding).buffer);

  await execute(
    'UPDATE employees SET face_vector = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [vectorBuffer, employee_id]
  );

  return { success: true, message: 'Face registered successfully' };
}

/**
 * Performs Clock In/Out using Facial Recognition.
 * 1. Calls AI service (detects face + spoof check + embedding).
 * 2. Matches face against employees in the same company.
 * 3. Logs the attendance.
 */
async function clockViaFace(imageBuffer, user) {
  // 1. Process Image
  const result = await faceService.processImageBuffer(imageBuffer);

  if (!result.success) {
    throw new Error(result.error || 'Processing failed');
  }

  // 2. Anti-Spoofing Check (Silent-Face)
  if (!result.is_live) {
    const error = new Error('Spoof attempt detected! Please use a real face.');
    error.status = 403;
    throw error;
  }

  if (!result.embedding) {
    throw new Error('No face found');
  }

  // 3. Identify Employee
  // We limit the search to the user's company scope for security and speed
  const companyId = user.company_id; 
  if (!companyId) {
      throw new Error('User account is not associated with a company');
  }

  // Fetch all registered faces in this company
  // Note: For large scale, use pgvector in the DB query instead of JS loop
  const candidates = await query(
    'SELECT id, name, face_vector FROM employees WHERE company_id = $1 AND face_vector IS NOT NULL',
    [companyId]
  );

  let bestMatch = null;
  let minDistance = 0.8; // Recognition threshold (Lower = Stricter)

  for (const candidate of candidates) {
    // Parse stored BYTEA buffer back to Float32 Array
    const storedVector = Array.from(new Float32Array(candidate.face_vector));
    const distance = faceService.calculateDistance(result.embedding, storedVector);

    if (distance < minDistance) {
      minDistance = distance;
      bestMatch = candidate;
    }
  }

  if (!bestMatch) {
    const error = new Error('Face not recognized. Please register first.');
    error.status = 404;
    throw error;
  }

  // 4. Determine Clock Type (Toggle Logic)
  const lastLog = await queryOne(
    `SELECT type FROM attendance_logs 
     WHERE employee_id = $1 AND timestamp::date = CURRENT_DATE 
     ORDER BY timestamp DESC LIMIT 1`,
    [bestMatch.id]
  );

  // If last log was 'clock_in', then we clock out. Otherwise clock in.
  const type = (lastLog && lastLog.type === 'clock_in') ? 'clock_out' : 'clock_in';

  // 5. Log Attendance
  const record = await logAttendance({ 
    employeeId: bestMatch.id, 
    type, 
    isManual: false, 
    notes: 'Face Recognition' 
  });

  return { 
    success: true, 
    employee_id: bestMatch.id,
    employee_name: bestMatch.name, 
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