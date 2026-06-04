const { query, execute } = require('../../shared/database');
const { addCompanyScope, requireCompanyAccess } = require('../../shared/utils/adminScope');

async function getAllDepartments({ company_id }, user) {
  let sql = `
    SELECT d.*, c.name as company_name,
           COUNT(DISTINCT e.id)::int as employee_count,
           COUNT(DISTINCT u.id)::int as unit_count
    FROM departments d
    LEFT JOIN companies c ON c.id = d.company_id
    LEFT JOIN employees e ON e.department_id = d.id AND e.status = 'active'
    LEFT JOIN units u ON u.department_id = d.id
    WHERE 1=1
  `;
  const params = [];
  if (company_id) { sql += ` AND d.company_id = $${params.length + 1}`; params.push(company_id); }
  const scoped = addCompanyScope({ sql, params, column: 'd.company_id', user });
  sql = scoped.sql;
  sql += ' GROUP BY d.id, c.name ORDER BY d.name';

  return query(sql, scoped.params);
}

async function createDepartment({ name, company_id }, user) {
  if (company_id) requireCompanyAccess(user, company_id);
  const result = await execute(
    'INSERT INTO departments (name, company_id) VALUES ($1, $2) RETURNING id',
    [name.trim(), company_id || null]
  );
  await execute(
    'INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
    ['CREATE', 'department', result.id, JSON.stringify({ name, company_id })]
  );
  return result;
}

async function updateDepartment(id, { name, company_id }, user) {
  if (company_id) requireCompanyAccess(user, company_id);
  const scoped = addCompanyScope({
    sql: 'SELECT d.id FROM departments d WHERE d.id = $1',
    params: [id],
    column: 'd.company_id',
    user,
  });
  const rows = await query(scoped.sql, scoped.params);
  if (rows.length === 0) return null;
  await execute(
    'UPDATE departments SET name = $1, company_id = $2 WHERE id = $3',
    [name.trim(), company_id || null, id]
  );
  return true;
}

async function deleteDepartment(id, user) {
  const scoped = addCompanyScope({
    sql: 'SELECT d.id FROM departments d WHERE d.id = $1',
    params: [id],
    column: 'd.company_id',
    user,
  });
  const rows = await query(scoped.sql, scoped.params);
  if (rows.length === 0) return null;
  await execute('UPDATE employees SET unit_id = NULL WHERE unit_id IN (SELECT id FROM units WHERE department_id = $1)', [id]);
  await execute('UPDATE employees SET department_id = NULL WHERE department_id = $1', [id]);
  await execute('DELETE FROM departments WHERE id = $1', [id]);
  return true;
}

module.exports = { getAllDepartments, createDepartment, updateDepartment, deleteDepartment };
