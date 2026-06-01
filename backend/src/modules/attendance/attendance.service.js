const { query, queryOne, execute } = require('../../shared/database');
const { logAttendance } = require('../../shared/utils/attendance');

async function getLogs({ employee_id, date, from, to, department_id, type, limit }) {
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
  if (date)          { sql += ` AND al.timestamp::date = $${params.length + 1}`; params.push(date); }
  if (from)          { sql += ` AND al.timestamp::date >= $${params.length + 1}`;params.push(from); }
  if (to)            { sql += ` AND al.timestamp::date <= $${params.length + 1}`;params.push(to); }

  const safeLimit = Math.min(parseInt(limit) || 200, 500);
  sql += ` ORDER BY al.timestamp DESC LIMIT ${safeLimit}`;

  return query(sql, params);
}

async function getTodayLogs() {
  return query(`
    SELECT al.*, e.name as employee_name, e.employee_id as emp_id, d.name as department_name
    FROM attendance_logs al
    JOIN employees e ON e.id = al.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE al.timestamp::date = CURRENT_DATE
    ORDER BY al.timestamp DESC
  `);
}

async function getEmployeeLogs(id, { from, to }) {
  let sql = `
    SELECT al.*
    FROM attendance_logs al
    WHERE al.employee_id = $1
  `;
  const params = [id];
  if (from) { sql += ` AND al.timestamp::date >= $${params.length + 1}`; params.push(from); }
  if (to)   { sql += ` AND al.timestamp::date <= $${params.length + 1}`; params.push(to); }
  sql += ' ORDER BY al.timestamp DESC LIMIT 100';

  return query(sql, params);
}

async function createManualLog({ employee_id, type, timestamp, notes }) {
  const record = await logAttendance({ employeeId: employee_id, type, timestamp, isManual: true, notes });
  await execute(
    'INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
    ['MANUAL_LOG', 'attendance', record.id, JSON.stringify({ employee_id, type, timestamp })]
  );
  return record;
}

async function deleteLog(id) {
  const log = await queryOne('SELECT id FROM attendance_logs WHERE id = $1', [id]);
  if (!log) return null;

  await execute('DELETE FROM attendance_logs WHERE id = $1', [id]);
  await execute(
    'INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
    ['DELETE', 'attendance', id, null]
  );
  return true;
}

module.exports = { getLogs, getTodayLogs, getEmployeeLogs, createManualLog, deleteLog };
