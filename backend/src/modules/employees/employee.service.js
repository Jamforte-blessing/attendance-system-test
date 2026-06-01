const { query, queryOne, execute } = require('../../shared/database');
const { sendWelcomeEmail } = require('../../shared/utils/email');

async function getAllEmployees({ company_id, department_id, status, search }) {
  let sql = `
    SELECT e.*, d.name as department_name, c.name as company_name
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN companies c ON c.id = e.company_id
    WHERE 1=1
  `;
  const params = [];

  if (company_id)    { sql += ` AND e.company_id = $${params.length + 1}`;                                               params.push(company_id); }
  if (department_id) { sql += ` AND e.department_id = $${params.length + 1}`;                                            params.push(department_id); }
  if (status)        { sql += ` AND e.status = $${params.length + 1}`;                                                    params.push(status); }
  if (search)        { sql += ` AND (e.name ILIKE $${params.length + 1} OR e.employee_id ILIKE $${params.length + 2})`; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY e.name';

  return query(sql, params);
}

async function getNextId(company_id) {
  const company = await queryOne('SELECT name FROM companies WHERE id = $1', [company_id]);
  if (!company) return null;

  const prefix = company.name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
  const rows = await query(`SELECT COUNT(*)::int as count FROM employees WHERE employee_id LIKE $1`, [`${prefix}%`]);
  const next = String((rows[0]?.count || 0) + 1).padStart(3, '0');
  return `${prefix}${next}`;
}

async function getEmployeeById(id) {
  return queryOne(`
    SELECT e.*, d.name as department_name, c.name as company_name
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN companies c ON c.id = e.company_id
    WHERE e.id = $1
  `, [id]);
}

async function createEmployee({ employee_id, name, email, phone, company_id, department_id, shift_start, shift_end }) {
  const result = await execute(
    `INSERT INTO employees (employee_id, name, email, phone, company_id, department_id, shift_start, shift_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [employee_id, name, email || null, phone || null,
     company_id || null, department_id || null,
     shift_start || '09:00', shift_end || '17:00']
  );
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
    `, [result.id]).then(emp => sendWelcomeEmail(emp)).catch(err =>
      console.error('[email] Welcome email error:', err.message, err.response || '')
    );
  }

  return result;
}

async function updateEmployee(id, { name, email, phone, company_id, department_id, shift_start, shift_end, status }) {
  const emp = await queryOne('SELECT id FROM employees WHERE id = $1', [id]);
  if (!emp) return null;

  await execute(
    `UPDATE employees
     SET name=$1, email=$2, phone=$3, company_id=$4, department_id=$5,
         shift_start=$6, shift_end=$7, status=$8, updated_at=NOW()
     WHERE id=$9`,
    [name, email || null, phone || null,
     company_id || null, department_id || null,
     shift_start || '09:00', shift_end || '17:00',
     status || 'active', id]
  );
  await execute(
    'INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
    ['UPDATE', 'employee', id, JSON.stringify({ name, email, phone, company_id, department_id, shift_start, shift_end, status })]
  );
  return true;
}

async function deactivateEmployee(id) {
  await execute(`UPDATE employees SET status='inactive', updated_at=NOW() WHERE id=$1`, [id]);
  await execute(
    'INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
    ['DEACTIVATE', 'employee', id, null]
  );
}

async function permanentDeleteEmployee(id) {
  const emp = await queryOne('SELECT id, name FROM employees WHERE id = $1', [id]);
  if (!emp) return null;

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
  createEmployee,
  updateEmployee,
  deactivateEmployee,
  permanentDeleteEmployee,
};
