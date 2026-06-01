const { query, queryOne } = require('../../shared/database');
const { logAttendance, getNextLogType, haversine } = require('../../shared/utils/attendance');

async function getCompanies() {
  return query('SELECT id, name FROM companies ORDER BY name');
}

async function getDepartments({ company_id }) {
  let sql = 'SELECT id, name FROM departments WHERE 1=1';
  const params = [];
  if (company_id) { sql += ` AND company_id = $${params.length + 1}`; params.push(company_id); }
  sql += ' ORDER BY name';
  return query(sql, params);
}

async function getEmployees({ company_id, department_id }) {
  let sql = `
    SELECT e.id, e.name, e.employee_id, d.name as department_name
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE e.status = 'active'
  `;
  const params = [];
  if (company_id)    { sql += ` AND e.company_id = $${params.length + 1}`;    params.push(company_id); }
  if (department_id) { sql += ` AND e.department_id = $${params.length + 1}`; params.push(department_id); }
  sql += ' ORDER BY e.name';
  return query(sql, params);
}

async function getStatus(employeeId) {
  const employee = await queryOne(
    `SELECT id, name FROM employees WHERE id = $1 AND status = 'active'`,
    [employeeId]
  );
  if (!employee) return null;

  const nextAction = await getNextLogType(employeeId);
  const lastLog = await queryOne(
    `SELECT type, timestamp FROM attendance_logs
     WHERE employee_id = $1 AND timestamp::date = CURRENT_DATE
     ORDER BY timestamp DESC LIMIT 1`,
    [employeeId]
  );

  return { employeeName: employee.name, nextAction, lastLog: lastLog || null };
}

async function scan({ employee_id, latitude, longitude }) {
  const employee = await queryOne(`
    SELECT e.*, c.latitude as co_lat, c.longitude as co_lng,
           c.radius_meters, c.name as company_name
    FROM employees e
    LEFT JOIN companies c ON c.id = e.company_id
    WHERE e.id = $1 AND e.status = 'active'
  `, [employee_id]);

  if (!employee) return { error: 'Employee not found', status: 404 };

  const type = await getNextLogType(employee_id);
  if (type === 'done') {
    return { error: 'You have already clocked in and out today.', status: 409 };
  }

  if (employee.co_lat != null && employee.co_lng != null) {
    if (latitude == null || longitude == null) {
      return { error: 'Location access is required to clock in at this workplace.', status: 400 };
    }

    const dist = Math.round(haversine(
      parseFloat(latitude), parseFloat(longitude),
      parseFloat(employee.co_lat), parseFloat(employee.co_lng)
    ));

    if (dist > employee.radius_meters) {
      return {
        error: `You are ${dist}m away from the workplace. You must be within ${employee.radius_meters}m to clock in.`,
        status: 403,
      };
    }
  }

  const record = await logAttendance({
    employeeId: employee_id,
    type,
    notes: 'Kiosk self-service',
  });

  return {
    success: true,
    type,
    employeeName: employee.name,
    timestamp: record.timestamp,
    isLate: record.isLate,
  };
}

module.exports = { getCompanies, getDepartments, getEmployees, getStatus, scan };
