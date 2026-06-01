const { query, execute } = require('../../shared/database');

async function getAllDepartments({ company_id }) {
  let sql = `
    SELECT d.*, c.name as company_name, COUNT(e.id)::int as employee_count
    FROM departments d
    LEFT JOIN companies c ON c.id = d.company_id
    LEFT JOIN employees e ON e.department_id = d.id AND e.status = 'active'
    WHERE 1=1
  `;
  const params = [];
  if (company_id) { sql += ` AND d.company_id = $${params.length + 1}`; params.push(company_id); }
  sql += ' GROUP BY d.id, c.name ORDER BY d.name';

  return query(sql, params);
}

async function createDepartment({ name, company_id }) {
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

async function updateDepartment(id, { name, company_id }) {
  await execute(
    'UPDATE departments SET name = $1, company_id = $2 WHERE id = $3',
    [name.trim(), company_id || null, id]
  );
}

async function deleteDepartment(id) {
  await execute('UPDATE employees SET department_id = NULL WHERE department_id = $1', [id]);
  await execute('DELETE FROM departments WHERE id = $1', [id]);
}

module.exports = { getAllDepartments, createDepartment, updateDepartment, deleteDepartment };
