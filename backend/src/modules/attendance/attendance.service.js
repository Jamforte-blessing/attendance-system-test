const { query, queryOne, execute } = require('../../shared/database');
const { logAttendance } = require('../../shared/utils/attendance');
const { addCompanyScope, requireCompanyAccess } = require('../../shared/utils/adminScope');

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

module.exports = { getLogs, getTodayLogs, getEmployeeLogs, createManualLog, deleteLog };
