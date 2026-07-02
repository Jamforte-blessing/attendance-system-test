const { query, queryOne, execute } = require('../../shared/database');
const { sendWelcomeEmail } = require('../../shared/utils/email');
const { hashPassword } = require('../../shared/utils/password');

function defaultPassword(companyName) {
  const prefix = (companyName || '').replace(/[^a-zA-Z]/g, '').substring(0, 3) || 'Staff';
  return prefix + '123';
}
const { addCompanyScope, requireCompanyAccess } = require('../../shared/utils/adminScope');

async function getAllEmployees({ company_id, department_id, unit_id, status, search }, user) {
  let sql = `
    SELECT e.id, e.employee_id, e.name, e.email, e.phone, e.company_id, e.department_id,
           e.unit_id, e.shift_start, e.shift_end, e.status, e.work_days, e.created_at, e.updated_at,
           e.must_change_password, e.password_changed_at,
           (e.must_change_password IS TRUE) as can_generate_password,
           d.name as department_name, c.name as company_name, u.name as unit_name
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN companies c ON c.id = e.company_id
    LEFT JOIN units u ON u.id = e.unit_id
    WHERE 1=1
  `;
  const params = [];

  if (company_id)    { sql += ` AND e.company_id = $${params.length + 1}`;                                               params.push(company_id); }
  if (department_id) { sql += ` AND e.department_id = $${params.length + 1}`;                                            params.push(department_id); }
  if (unit_id)       { sql += ` AND e.unit_id = $${params.length + 1}`;                                                  params.push(unit_id); }
  if (status)        { sql += ` AND e.status = $${params.length + 1}`;                                                    params.push(status); }
  if (search)        { sql += ` AND (e.name ILIKE $${params.length + 1} OR e.employee_id ILIKE $${params.length + 2})`; params.push(`%${search}%`, `%${search}%`); }

  const scoped = addCompanyScope({ sql, params, column: 'e.company_id', user });
  return query(scoped.sql + ' ORDER BY e.name', scoped.params);
}

async function getNextId(company_id, department_id, unit_id, user) {
  requireCompanyAccess(user, company_id);

  const slug = name => {
    const s = (name || '').replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
    return s || 'GEN';
  };

  const company = await queryOne('SELECT name FROM companies WHERE id = $1', [company_id]);
  if (!company) return null;

  const parts = [slug(company.name)];

  if (department_id) {
    const dept = await queryOne('SELECT name FROM departments WHERE id = $1', [department_id]);
    if (dept) parts.push(slug(dept.name));
  }

  if (unit_id) {
    const unit = await queryOne('SELECT name FROM units WHERE id = $1', [unit_id]);
    if (unit) parts.push(slug(unit.name));
  }

  const prefix = parts.join('-');
  
  const rows = await query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id FROM LENGTH($1) + 2) AS INTEGER)), 0)::int as max_num
     FROM employees
     WHERE employee_id ~ $2`,
    [prefix, `^${prefix}-\\d+$`]
  );
  const next = String((rows[0]?.max_num || 0) + 1).padStart(3, '0');
  return `${prefix}-${next}`;
}

async function getEmployeeById(id, user) {
  const employee = await queryOne(`
    SELECT e.id, e.employee_id, e.name, e.email, e.phone, e.company_id, e.department_id,
           e.unit_id, e.shift_start, e.shift_end, e.status, e.work_days, e.created_at, e.updated_at,
           e.must_change_password, e.password_changed_at,
           (e.must_change_password IS TRUE) as can_generate_password,
           d.name as department_name, c.name as company_name, u.name as unit_name
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN companies c ON c.id = e.company_id
    LEFT JOIN units u ON u.id = e.unit_id
    WHERE e.id = $1
  `, [id]);
  if (!employee) return null;
  requireCompanyAccess(user, employee.company_id);
  return employee;
}

async function createEmployee({ employee_id, name, email, phone, company_id, department_id, unit_id, shift_start, shift_end, work_days }, user) {
  if (company_id) requireCompanyAccess(user, company_id);

  const company = company_id
    ? await queryOne('SELECT name FROM companies WHERE id = $1', [company_id])
    : null;
  const password = defaultPassword(company?.name);

  // Check if employee_id already exists
  const existing = await queryOne('SELECT id FROM employees WHERE employee_id = $1', [employee_id]);
  if (existing) {
    const error = new Error('Employee ID already exists');
    error.code = '23505';
    throw error;
  }

  // If email already exists, reset to default password and resend welcome email
  if (email) {
    const emailExists = await queryOne('SELECT id FROM employees WHERE lower(email) = lower($1)', [email]);
    if (emailExists) {
      const passwordHash = await hashPassword(password);
      await execute(
        'UPDATE employees SET password_hash = $1, must_change_password = TRUE, password_changed_at = NULL, updated_at = NOW() WHERE id = $2',
        [passwordHash, emailExists.id]
      );
      const emp = await queryOne(`
        SELECT e.employee_id, e.name, e.email, e.shift_start, e.shift_end,
               c.name as company_name, d.name as department_name
        FROM employees e
        LEFT JOIN companies c ON c.id = e.company_id
        LEFT JOIN departments d ON d.id = e.department_id
        WHERE e.id = $1
      `, [emailExists.id]).catch(() => null);
      if (emp) {
        sendWelcomeEmail({ ...emp, password }).catch(err =>
          console.error('[email] Password update email error:', err.message)
        );
      }
      return emailExists;
    }
  }

  const passwordHash = await hashPassword(password);

  const result = await execute(
    `INSERT INTO employees (employee_id, name, email, phone, company_id, department_id, unit_id, shift_start, shift_end, work_days, password_hash, must_change_password)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE) RETURNING id, password_hash`,
    [employee_id, name, email || null, phone || null,
     company_id || null, department_id || null, unit_id || null,
     shift_start || '09:00', shift_end || '17:00',
     work_days || 'Mon,Tue,Wed,Thu,Fri', passwordHash]
  );

  // Verify password was actually stored
  if (!result.password_hash) {
    throw new Error('Failed to store password. Please try again.');
  }
  await execute(
    'INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
    ['CREATE', 'employee', result.id, JSON.stringify({ employee_id, name })]
  );

  if (email) {
    queryOne(`
      SELECT e.employee_id, e.name, e.email, e.shift_start, e.shift_end,
             c.name as company_name, d.name as department_name
      FROM employees e
      LEFT JOIN companies c ON c.id = e.company_id
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.id = $1
    `, [result.id]).then(emp => sendWelcomeEmail({ ...emp, password })).catch(err =>
      console.error('[email] Welcome email error:', err.message)
    );
  }

  return { id: result.id };
}

async function generateEmployeePassword(id, user) {
  const employee = await queryOne(`
    SELECT e.id, e.employee_id, e.name, e.email, e.shift_start, e.shift_end,
           e.must_change_password, e.password_changed_at, e.company_id,
           c.name as company_name, d.name as department_name
    FROM employees e
    LEFT JOIN companies c ON c.id = e.company_id
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE e.id = $1
  `, [id]);

  if (!employee) return null;
  requireCompanyAccess(user, employee.company_id);

  if (!employee.must_change_password || employee.password_changed_at) {
    const error = new Error('Employee has already set their own password. Use Forgot password instead.');
    error.status = 409;
    throw error;
  }

  const password = defaultPassword(employee.company_name);
  const passwordHash = await hashPassword(password);

  const updateResult = await execute(
    `UPDATE employees SET password_hash=$1, must_change_password=TRUE, password_changed_at=NULL, updated_at=NOW() WHERE id=$2 RETURNING password_hash`,
    [passwordHash, id]
  );

  // Verify password was stored
  if (!updateResult.password_hash) {
    throw new Error('Failed to update password hash in database');
  }

  if (employee.email) {
    sendWelcomeEmail({ ...employee, password }).catch(err =>
      console.error('[email] Password email error:', err.message, err.response || '')
    );
  }

  await execute(
    'INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
    ['PASSWORD_RESET', 'employee', id, JSON.stringify({ employee_id: employee.employee_id, name: employee.name })]
  );

  return { id: employee.id, employee_id: employee.employee_id, name: employee.name, email: employee.email };
}

async function updateEmployee(id, { name, email, phone, company_id, department_id, unit_id, shift_start, shift_end, work_days, status }, user) {
  const emp = await queryOne('SELECT id, company_id FROM employees WHERE id = $1', [id]);
  if (!emp) return null;
  requireCompanyAccess(user, emp.company_id);
  if (company_id && parseInt(company_id) !== emp.company_id) requireCompanyAccess(user, company_id);

  await execute(
    `UPDATE employees
     SET name=$1, email=$2, phone=$3, company_id=$4, department_id=$5, unit_id=$6,
         shift_start=$7, shift_end=$8, work_days=$9, status=$10, updated_at=NOW()
     WHERE id=$11`,
    [name, email || null, phone || null,
     company_id || null, department_id || null, unit_id || null,
     shift_start || '09:00', shift_end || '17:00',
     work_days || 'Mon,Tue,Wed,Thu,Fri',
     status || 'active', id]
  );
  await execute(
    'INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
    ['UPDATE', 'employee', id, JSON.stringify({ name, email, phone, company_id, department_id, unit_id, shift_start, shift_end, status })]
  );
  return true;
}

async function getEmployeeStats(id, user) {
  const emp = await queryOne('SELECT company_id FROM employees WHERE id = $1', [id]);
  if (!emp) return null;
  requireCompanyAccess(user, emp.company_id);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const [todayLogs, weekRow, monthRow] = await Promise.all([
    query(
      `SELECT type, timestamp, is_late, is_early FROM attendance_logs
       WHERE employee_id = $1 AND timestamp::date = $2
       ORDER BY timestamp`,
      [id, today]
    ),
    queryOne(
      `SELECT
        COUNT(DISTINCT CASE WHEN type='clock_in' THEN timestamp::date END)::int as days_present,
        COUNT(CASE WHEN type='clock_in' AND is_late=1 THEN 1 END)::int as late_days,
        COUNT(CASE WHEN type='clock_out' AND is_early=1 THEN 1 END)::int as early_outs
       FROM attendance_logs
       WHERE employee_id = $1 AND timestamp::date BETWEEN $2 AND $3`,
      [id, weekStartStr, today]
    ),
    queryOne(
      `SELECT
        COUNT(DISTINCT CASE WHEN type='clock_in' THEN timestamp::date END)::int as days_present,
        COUNT(CASE WHEN type='clock_in' AND is_late=1 THEN 1 END)::int as late_days,
        COUNT(CASE WHEN type='clock_out' AND is_early=1 THEN 1 END)::int as early_outs
       FROM attendance_logs
       WHERE employee_id = $1 AND timestamp::date BETWEEN $2 AND $3`,
      [id, monthStart, today]
    ),
  ]);

  return {
    today: todayLogs,
    week:  { from: weekStartStr, to: today, ...weekRow },
    month: { from: monthStart,   to: today, ...monthRow },
  };
}

async function deactivateEmployee(id, user) {
  const emp = await queryOne('SELECT id, name, company_id FROM employees WHERE id = $1', [id]);
  if (!emp) return;
  requireCompanyAccess(user, emp.company_id);
  await execute('DELETE FROM attendance_logs WHERE employee_id = $1', [id]);
  await execute('DELETE FROM employees WHERE id = $1', [id]);
  await execute(
    'INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
    ['DELETE', 'employee', id, JSON.stringify({ name: emp.name })]
  );
}

async function permanentDeleteEmployee(id, user) {
  const emp = await queryOne('SELECT id, name, company_id FROM employees WHERE id = $1', [id]);
  if (!emp) return null;
  requireCompanyAccess(user, emp.company_id);

  await execute('DELETE FROM attendance_logs WHERE employee_id = $1', [id]);
  await execute('DELETE FROM employees WHERE id = $1', [id]);
  await execute(
    'INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
    ['DELETE', 'employee', id, JSON.stringify({ name: emp.name })]
  );
  return true;
}

module.exports = {
  getAllEmployees,
  getNextId,
  getEmployeeById,
  getEmployeeStats,
  createEmployee,
  generateEmployeePassword,
  updateEmployee,
  deactivateEmployee,
  permanentDeleteEmployee,
};
